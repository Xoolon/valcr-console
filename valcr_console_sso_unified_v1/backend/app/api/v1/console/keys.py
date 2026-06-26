# app/api/v1/console/keys.py
import hashlib
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/console/keys", tags=["console-keys"])

PLAN_CONFIG = {
    "developer": {
        "rate_limit_day": 500,
        "scopes": {"benchmarks:read", "segments:read"},
    },
    "startup": {
        "rate_limit_day": 5_000,
        "scopes": {"benchmarks:read", "segments:read", "merchant:read"},
    },
    "growth": {
        "rate_limit_day": 50_000,
        "scopes": {
            "benchmarks:read", "segments:read", "merchant:read",
            "merchant:write", "insights:read", "compare:read",
        },
    },
    "enterprise": {
        "rate_limit_day": 999_999_999,
        "scopes": {
            "benchmarks:read", "segments:read", "merchant:read",
            "merchant:write", "insights:read", "compare:read",
            "score:read", "report:read", "export:read", "admin",
        },
    },
}
PLAN_ALIASES = {
    "data_api_dev": "developer",
    "data_api_startup": "startup",
    "data_api_growth": "growth",
    "data_api_enterprise": "enterprise",
}
SCOPE_ALIASES = {
    "benchmarks": "benchmarks:read",
    "segments": "segments:read",
    "merchant": "merchant:read",
    "insights": "insights:read",
    "compare": "compare:read",
    "score": "score:read",
    "report": "report:read",
    "export": "export:read",
}


def _public_plan(user: User) -> str:
    if bool(user.is_admin):
        return "enterprise"
    raw = str(getattr(user, "data_api_plan", "free") or "free").lower()
    return PLAN_ALIASES.get(raw, raw)


def _require_console_access(user: User) -> tuple[str, dict]:
    plan = _public_plan(user)
    config = PLAN_CONFIG.get(plan)
    status = str(getattr(user, "data_api_subscription_status", "none") or "none").lower()
    if not config or (not user.is_admin and status not in {"active", "trialing"}):
        raise HTTPException(
            status_code=403,
            detail="An active Data API plan is required to create API keys.",
        )
    return plan, config


def _generate_key(environment: str) -> tuple[str, str, str]:
    prefix = "vck_test_" if environment == "test" else "vck_live_"
    raw_key = f"{prefix}{secrets.token_urlsafe(32)}"
    return raw_key, hashlib.sha256(raw_key.encode()).hexdigest(), raw_key[:12]


class CreateKeyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    environment: str = "live"
    scopes: list[str] = Field(default_factory=list)
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=3650)


@router.get("")
async def list_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_console_access(current_user)
    result = await db.execute(text("""
        SELECT id, key_prefix, tier, scopes, rate_limit_day,
               calls_today, calls_month, last_used_at,
               expires_at, is_active, created_at
        FROM data_api_keys
        WHERE user_id = :uid
        ORDER BY created_at DESC
    """), {"uid": str(current_user.id)})
    rows = result.mappings().fetchall()
    return {"keys": [{
        "id": str(r["id"]),
        "key_prefix": r["key_prefix"],
        "tier": r["tier"],
        "scopes": r["scopes"] or [],
        "rate_limit_day": r["rate_limit_day"],
        "calls_today": r["calls_today"],
        "calls_month": r["calls_month"],
        "last_used_at": r["last_used_at"].isoformat() if r["last_used_at"] else None,
        "expires_at": r["expires_at"].isoformat() if r["expires_at"] else None,
        "is_active": r["is_active"],
        "created_at": r["created_at"].isoformat(),
    } for r in rows]}


@router.post("")
async def create_key(
    body: CreateKeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan, config = _require_console_access(current_user)
    environment = str(body.environment or "live").lower()
    if environment not in {"live", "test"}:
        raise HTTPException(status_code=400, detail="environment must be 'live' or 'test'")

    requested = {SCOPE_ALIASES.get(str(scope), str(scope)) for scope in body.scopes}
    scopes = requested or set(config["scopes"])
    disallowed = scopes - set(config["scopes"])
    if disallowed:
        raise HTTPException(
            status_code=403,
            detail={
                "message": "One or more scopes are not included in your Data API plan.",
                "disallowed_scopes": sorted(disallowed),
                "plan": plan,
            },
        )

    count_result = await db.execute(text("""
        SELECT COUNT(*) FROM data_api_keys
        WHERE user_id = :uid AND is_active = TRUE
    """), {"uid": str(current_user.id)})
    if (count_result.scalar() or 0) >= 10:
        raise HTTPException(status_code=400, detail="Maximum 10 active API keys.")

    raw_key, key_hash, key_prefix = _generate_key(environment)
    expires_at = (
        datetime.utcnow() + timedelta(days=body.expires_in_days)
        if body.expires_in_days else None
    )
    result = await db.execute(text("""
        INSERT INTO data_api_keys
            (user_id, key_hash, key_prefix, tier, scopes,
             rate_limit_day, expires_at, is_active)
        VALUES
            (:uid, :hash, :prefix, :tier, :scopes,
             :limit, :expires, TRUE)
        RETURNING id, created_at
    """), {
        "uid": str(current_user.id),
        "hash": key_hash,
        "prefix": key_prefix,
        "tier": plan,
        "scopes": sorted(scopes),
        "limit": config["rate_limit_day"],
        "expires": expires_at,
    })
    row = result.fetchone()
    await db.commit()
    return {
        "id": str(row[0]),
        "name": body.name,
        "environment": environment,
        "key": raw_key,
        "key_prefix": key_prefix,
        "tier": plan,
        "scopes": sorted(scopes),
        "rate_limit_day": config["rate_limit_day"],
        "created_at": row[1].isoformat(),
        "_warning": "Save this key now. It will not be shown again.",
    }


@router.post("/{key_id}/rotate")
async def rotate_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_console_access(current_user)
    result = await db.execute(text("""
        SELECT tier, scopes, rate_limit_day, key_prefix FROM data_api_keys
        WHERE id = :id AND user_id = :uid AND is_active = TRUE
    """), {"id": key_id, "uid": str(current_user.id)})
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Key not found or inactive")

    tier, scopes, rate_limit, old_prefix = row
    environment = "test" if str(old_prefix).startswith("vck_test_") else "live"
    await db.execute(text("UPDATE data_api_keys SET is_active=FALSE WHERE id=:id"), {"id": key_id})
    raw_key, key_hash, key_prefix = _generate_key(environment)
    new_result = await db.execute(text("""
        INSERT INTO data_api_keys
            (user_id, key_hash, key_prefix, tier, scopes, rate_limit_day, is_active)
        VALUES
            (:uid, :hash, :prefix, :tier, :scopes, :limit, TRUE)
        RETURNING id
    """), {
        "uid": str(current_user.id), "hash": key_hash, "prefix": key_prefix,
        "tier": tier, "scopes": scopes, "limit": rate_limit,
    })
    new_id = new_result.scalar()
    await db.commit()
    return {
        "new_key_id": str(new_id), "key": raw_key, "key_prefix": key_prefix,
        "_warning": "Old key is invalidated. Save the replacement now.",
    }


@router.delete("/{key_id}")
async def delete_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_console_access(current_user)
    result = await db.execute(text("""
        UPDATE data_api_keys SET is_active=FALSE
        WHERE id=:id AND user_id=:uid AND is_active=TRUE
        RETURNING id
    """), {"id": key_id, "uid": str(current_user.id)})
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Key not found")
    await db.commit()
    return {"status": "deleted", "key_id": key_id}
