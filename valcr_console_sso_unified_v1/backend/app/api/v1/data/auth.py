import asyncio
import hashlib
import logging
import time
from datetime import datetime

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.models.data_api_key import DataAPIKey

logger = logging.getLogger(__name__)

TIER_CONFIG = {
    "developer": {"calls_per_day": 500, "calls_per_min": 10, "endpoints": {"benchmarks"}, "granularity": "segment"},
    "startup": {"calls_per_day": 5_000, "calls_per_min": 30, "endpoints": {"benchmarks", "score_estimate"}, "granularity": "sub_segment"},
    "growth": {"calls_per_day": 50_000, "calls_per_min": 100, "endpoints": {"benchmarks", "score_estimate", "segment_insights"}, "granularity": "sub_segment"},
    "enterprise": {"calls_per_day": 999_999_999, "calls_per_min": 1000, "endpoints": {"benchmarks", "score_estimate", "segment_insights", "dataset_export"}, "granularity": "full"},
}


async def _check_rate_limit(key_prefix: str, max_per_min: int) -> bool:
    from app.services.redis_cache import get_client
    redis = await get_client()
    if not redis:
        return True
    redis_key = f"rl:{key_prefix}:{int(time.time() // 60)}"
    count = await redis.incr(redis_key)
    if count == 1:
        await redis.expire(redis_key, 60)
    return count <= max_per_min


async def verify_data_api_key(
    authorization: str = Header(None, alias="Authorization"),
    db: AsyncSession = Depends(get_db),
) -> DataAPIKey:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Use Authorization: Bearer <your_api_key>")
    raw_key = authorization[7:].strip()
    if not raw_key:
        raise HTTPException(status_code=401, detail="Empty API key")

    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    result = await db.execute(select(DataAPIKey).where(
        DataAPIKey.key_hash == key_hash,
        DataAPIKey.is_active == True,
    ))
    key_obj = result.scalar_one_or_none()
    if not key_obj:
        raise HTTPException(status_code=401, detail="Invalid or expired API key")
    if key_obj.expires_at and key_obj.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="API key has expired")

    tier = TIER_CONFIG.get(key_obj.tier, TIER_CONFIG["developer"])
    if not await _check_rate_limit(key_obj.key_prefix, tier["calls_per_min"]):
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: {tier['calls_per_min']} requests/minute",
            headers={"Retry-After": "60"},
        )
    if key_obj.calls_today >= tier["calls_per_day"]:
        raise HTTPException(status_code=429, detail="Daily quota exceeded")

    asyncio.create_task(_increment_usage(str(key_obj.id)))
    return key_obj


async def _increment_usage(key_id: str) -> None:
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("""
                UPDATE data_api_keys
                SET calls_today=calls_today+1,
                    calls_month=calls_month+1,
                    last_used_at=NOW()
                WHERE id=:id
            """), {"id": key_id})
            await db.commit()
    except Exception as exc:
        logger.warning("Usage increment failed: %s", exc)


def require_endpoint(endpoint: str):
    async def check(key_obj: DataAPIKey = Depends(verify_data_api_key)) -> DataAPIKey:
        tier = TIER_CONFIG.get(key_obj.tier, TIER_CONFIG["developer"])
        if endpoint not in tier["endpoints"]:
            raise HTTPException(status_code=403, detail=f"Your {key_obj.tier} plan does not include '{endpoint}'.")
        return key_obj
    return check
