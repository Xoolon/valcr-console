# VALCR — AUTH & BILLING ARCHITECTURE DESIGN
# Task 3: How to handle users who have both a Valcr.site account AND a Console account
# ─────────────────────────────────────────────────────────────────────────────────────

## THE PROBLEM

  User Glen has:
    A. A Valcr.site account (pays $59/mo for Pro — store analytics, Valcr Score UI)
    B. A Console account (pays $29/mo for Developer Data API)

  These serve fundamentally different buyers:
    Valcr Pro    → Commerce operators, non-technical, use the dashboard
    Console API  → Developers / technical teams, programmatic access

  They can be the same person (e.g. a founder who wants both),
  OR completely different people (e.g. a SaaS company's dev team using the API
  while their ops team uses the Pro dashboard).


## RECOMMENDED DESIGN: UNIFIED IDENTITY, SEPARATED BILLING SUBSCRIPTIONS

  This is the same model used by Anthropic (Claude.ai + API), Stripe (Dashboard + API),
  and GitHub (github.com + Marketplace).

### Core principle:
  ONE user account (email + password) → MULTIPLE product subscriptions, each with its
  own billing context and entitlements.

### Data model:

    User
    ├── id, email, password_hash, first_name
    ├── created_at
    └── subscriptions[]
          ├── Subscription (type=valcr_pro)
          │   ├── tier: free | pro
          │   ├── paystack_customer_id
          │   ├── paystack_subscription_id
          │   └── entitlements: { valcr_score: true, insights: true, ... }
          │
          └── Subscription (type=data_api)
              ├── tier: developer | startup | growth | enterprise
              ├── paystack_customer_id        ← CAN be same Paystack customer
              ├── paystack_subscription_id    ← SEPARATE Paystack subscription
              ├── token_balance
              └── api_keys[]

### Auth flow:
  1. User signs in once (email + password → JWT)
  2. JWT contains: user_id, email
  3. Each product reads its own subscription from DB based on user_id
  4. No duplication of user records

### Login UI:
  Single login page at accounts.valcr.site (or shared across valcr.site and console.valcr.site)
  After login → redirect to wherever they came from.

  If no Console subscription: show upgrade CTA in Console.
  If no Pro subscription: show upgrade CTA on valcr.site.

### Why NOT separate accounts:
  ✗ User friction — two emails, two passwords
  ✗ No cross-sell opportunity (can't upsell Console user to Pro from within the product)
  ✗ Support nightmare — two accounts, billing split across two contexts
  ✗ Data duplication, sync issues


## IMPLEMENTATION — KEY CHANGES NEEDED

### 1. Shared User table (already exists in your backend)
  No change needed. user.id is the anchor.

### 2. Add ProductSubscription table

    class ProductSubscription(Base):
        __tablename__ = "product_subscriptions"
        id                        = Column(UUID, primary_key=True, default=uuid4)
        user_id                   = Column(UUID, ForeignKey("users.id"), nullable=False)
        product_type              = Column(Enum("valcr_pro", "data_api"), nullable=False)
        tier                      = Column(String, default="free")
        paystack_customer_id      = Column(String, nullable=True)
        paystack_subscription_id  = Column(String, nullable=True)
        paystack_auth_code        = Column(String, nullable=True)  # for auto-billing
        token_balance             = Column(Integer, default=0)
        is_active                 = Column(Boolean, default=True)
        current_period_start      = Column(DateTime, nullable=True)
        current_period_end        = Column(DateTime, nullable=True)
        created_at                = Column(DateTime, default=datetime.utcnow)

    # Index:
    Index("ix_user_product", "user_id", "product_type", unique=True)

### 3. JWT payload update

    # Current: { "sub": user_id, "email": ... }
    # Add: product subscriptions summary (NOT full detail — load from DB on demand)
    {
      "sub":   "user_id",
      "email": "glen@example.com",
      "products": {
        "valcr_pro": "pro",       # or null
        "data_api":  "developer"  # or null
      }
    }

### 4. Console middleware: check data_api subscription

    async def require_console_access(
        current_user = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        sub = await db.scalar(
            select(ProductSubscription).where(
                ProductSubscription.user_id    == current_user.id,
                ProductSubscription.product_type == "data_api",
                ProductSubscription.is_active  == True,
            )
        )
        if not sub:
            raise HTTPException(403, detail="No active Data API subscription")
        return sub

### 5. Signup flow for Console

  Option A — Console-first signup (developer building an integration):
    Sign up at console.valcr.site → creates User + data_api subscription (developer tier)
    Gets 7-day free trial with 1,000 test calls.

  Option B — Pro user adding API access:
    Logged in at valcr.site → clicks "Developer API" → redirected to console.valcr.site
    → already logged in (same JWT) → prompted to activate API subscription → Paystack checkout

  Option C — API-first (machine-to-machine):
    POST /api/v1/auth/register with { email, password, product: "data_api" }
    Creates User + data_api Developer subscription.


## PAYSTACK INTEGRATION NOTES

  Paystack supports multiple subscriptions per customer (same customer_id, different plan codes).
  Use this to link both Pro and API subscriptions to one Paystack customer record.

  Paystack plan codes needed:
    PLAN_VALCR_PRO       = "PLN_xxxxxxxx"   # $59/mo
    PLAN_API_DEVELOPER   = "PLN_xxxxxxxx"   # $29/mo
    PLAN_API_STARTUP     = "PLN_xxxxxxxx"   # $99/mo
    PLAN_API_GROWTH      = "PLN_xxxxxxxx"   # $299/mo

  Auto-billing for quota exhaustion uses the stored authorization_code
  (from first payment via Paystack Charge Authorization endpoint).
  Store this on ProductSubscription.paystack_auth_code.


## SUMMARY RECOMMENDATION

  Implement unified accounts + separate subscriptions. This is:
  ✓ Low friction for users (one login)
  ✓ Clean billing separation (Paystack handles multi-plan per customer)
  ✓ Future-proof (add Titania AI, NaleX APIs, etc. as additional product types)
  ✓ Cross-sell ready (show upsell banners based on which products user has)
  ✓ Minimal migration cost (user table already exists)
