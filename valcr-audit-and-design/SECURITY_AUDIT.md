# VALCR DATA API — SECURITY & ARCHITECTURE AUDIT
# Task 1: Key generation, rate limiting, quota exhaustion, security review
# ─────────────────────────────────────────────────────────────────────────────

## 1. API KEY GENERATION — ASSESSMENT

### Current implementation (from backend):
  raw_key   = f"vcr_{env}_{secrets.token_urlsafe(36)}"
  key_hash  = hashlib.sha256(raw_key.encode()).hexdigest()
  Store: key_hash only. raw_key shown once, never persisted.

### Verdict: GOOD ✓
  - secrets.token_urlsafe(36) yields 48 chars of base64url = ~287 bits entropy. Well above the
    128-bit minimum for API keys. Safe.
  - SHA-256 hash storage is correct. No reversible encoding (bcrypt is unnecessary for keys
    this long since brute force is computationally infeasible).
  - Prefix schema (vcr_live_ / vcr_test_) enables environment differentiation.

### Recommendation — add key preview column:
  Store first 12 chars as `prefix` column (plaintext) so users can identify keys without
  needing the raw value. This is already industry practice (Stripe, GitHub).
  Backend change needed in console/keys.py:

    prefix    = raw_key[:16]           # e.g. "vcr_live_xKj9Rz"
    key_hash  = sha256(raw_key)
    # Store both prefix + key_hash; never raw_key

### Recommendation — add created_by IP and user-agent logging:
  On key creation, log the request IP and user-agent to the DataAPIKey record.
  Useful for forensics if a key is compromised.


## 2. KEY ROTATION — ASSESSMENT

### Current flow:
  POST /console/keys/{id}/rotate
  1. Generate new raw_key (same format)
  2. Overwrite key_hash in DB atomically
  3. Return new raw_key in response (shown once)
  4. Old key is immediately invalid (same hash row, now updated)

### Verdict: CORRECT ✓
  Atomic swap means there's no window where both old and new keys are valid.
  The previous key is invalidated the moment the DB write commits.

### Issue — no grace period for in-flight requests:
  If a client is in the middle of a burst of requests using the old key and rotation
  fires, all in-flight requests fail immediately. For high-volume production keys this
  is disruptive.

### Fix — add optional `grace_seconds` parameter (recommended):

    # In /console/keys/{id}/rotate
    @router.post("/console/keys/{key_id}/rotate")
    async def rotate_key(
        key_id: str,
        grace_seconds: int = Query(default=0, ge=0, le=300),
        db: AsyncSession = Depends(get_db),
        current_user = Depends(get_current_user),
    ):
        key = await get_key_or_404(db, key_id, current_user.id)
        new_raw     = f"vcr_{key.environment}_{secrets.token_urlsafe(36)}"
        new_hash    = hashlib.sha256(new_raw.encode()).hexdigest()

        # Keep old hash valid until grace period expires
        key.old_key_hash       = key.key_hash
        key.old_key_expires_at = datetime.utcnow() + timedelta(seconds=grace_seconds)
        key.key_hash           = new_hash
        key.prefix             = new_raw[:16]
        await db.commit()
        return {"raw_key": new_raw}

    # In key validation middleware, check both key_hash AND old_key_hash (if not expired)


## 3. RATE LIMITING — ASSESSMENT

### Finding: Rate limit logic not found in provided files.
  The routes.py and data router files show no rate limit middleware or decorator.
  This is a CRITICAL GAP.

### Required implementation — add to FastAPI app startup:

    # requirements: slowapi
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded

    limiter = Limiter(key_func=lambda req: req.state.api_key_id or get_remote_address(req))
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Per-key rate limit on data endpoints:
    TIER_LIMITS = {
        "developer":  "60/minute",
        "startup":    "100/minute",
        "growth":     "300/minute",
        "enterprise": "1000/minute",
    }

    # Apply in key validation middleware:
    tier   = request.state.account_tier
    limit  = TIER_LIMITS.get(tier, "60/minute")
    # Use Redis-backed sliding window: slowapi + Redis backend

### Rate limit response headers (MUST add):
    X-RateLimit-Limit:     {limit}
    X-RateLimit-Remaining: {remaining}
    X-RateLimit-Reset:     {unix_timestamp}
    Retry-After:           {seconds}   # only on 429


## 4. QUOTA & AUTO-BILLING — ASSESSMENT

### Finding: Paystack auto-billing on quota exhaustion needs validation.
  The flow should be:
    1. Middleware checks account.token_balance before forwarding request
    2. If balance == 0, trigger Paystack charge
    3. Wait for Paystack webhook confirming payment
    4. On success: reset balance, allow request, fire quota.exhausted webhook
    5. On failure: return 402, fire invoice.failed webhook

### Recommended middleware addition (before route handlers):

    async def check_quota(request: Request, call_next):
        key_data = request.state.api_key
        if not key_data: return await call_next(request)

        account = await get_account(key_data.account_id)
        if account.token_balance <= 0:
            # Trigger auto-billing
            charge_result = await paystack.charge(
                amount      = account.tier_price_kobo,
                email       = account.email,
                authorization_code = account.paystack_auth_code,
                metadata    = {"reason": "quota_refill", "account_id": account.id},
            )
            if charge_result.status == "success":
                await reset_quota(account.id)
                await fire_webhook(account.id, "quota.exhausted", {...})
            else:
                await fire_webhook(account.id, "invoice.failed", {...})
                return JSONResponse(
                    status_code=402,
                    content={"detail": "Quota exhausted. Payment failed. Check billing settings.",
                             "code": "billing.payment_failed"}
                )
        return await call_next(request)


## 5. SECURITY — ADDITIONAL FINDINGS

### 5a. Scope enforcement — GOOD ✓
  TIER_SCOPES dict in keys.py correctly gates scope assignment at key creation.
  The validate_api_key dependency checks key.scopes against ENDPOINT_SCOPE_MAP.
  No bypass vectors found in provided code.

### 5b. Timing attack on key comparison — NEEDS FIX ⚠
  Current hash lookup uses a DB WHERE clause (hash == provided_hash).
  DB index lookup is fine but the final comparison should use hmac.compare_digest
  if any string comparison is done in Python after the DB lookup:

    import hmac
    # If comparing in Python (not just DB WHERE):
    if not hmac.compare_digest(stored_hash, provided_hash):
        raise HTTPException(401)

### 5c. Key enumeration — LOW RISK, monitor
  The 401 response on invalid key vs 403 on insufficient scope reveals that the key
  exists. This is acceptable (same as Stripe/GitHub). No fix needed.

### 5d. Add security response headers to all API responses:
    app.add_middleware with:
      X-Content-Type-Options: nosniff
      X-Frame-Options: DENY
      Strict-Transport-Security: max-age=31536000; includeSubDomains
      Cache-Control: no-store   # prevent key caching by proxies

### 5e. Webhook signature — GOOD ✓
  hmac.new(secret, payload, sha256) pattern is correct.
  whsec_ prefix on signing secret correctly distinguishes it from API keys.

### 5f. Console session tokens vs API keys — GOOD ✓
  Console uses JWT/session tokens (separate from Data API keys).
  Data API middleware only accepts vcr_* prefixed keys.
  No cross-contamination risk found.


## 6. PRIORITY ACTION LIST

  CRITICAL (before go-live):
  [ ] Implement per-key rate limiting with Redis sliding window
  [ ] Add rate limit headers to all 429 responses
  [ ] Implement quota middleware with Paystack auto-charge

  HIGH:
  [ ] Add prefix column to DataAPIKey for UI display
  [ ] Add grace_seconds option to key rotation
  [ ] Add security headers middleware

  MEDIUM:
  [ ] hmac.compare_digest in key validation if any Python string compare
  [ ] Add IP + user-agent to key creation log
  [ ] Automated key expiry option (e.g. expire_at datetime column)

  LOW:
  [ ] JSON-LD XBRL format stability review before Enterprise GA
  [ ] Add key usage anomaly alerting (spike detection per key)
