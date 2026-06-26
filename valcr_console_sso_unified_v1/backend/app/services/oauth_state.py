"""Single-use, provider-scoped OAuth state storage."""
from __future__ import annotations

import hashlib
import json
import secrets
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

STATE_TTL_SECONDS = 10 * 60
SUPPORTED_PROVIDERS = frozenset({"shopify", "etsy", "console"})


def _digest(state: str) -> str:
    return hashlib.sha256(state.encode("utf-8")).hexdigest()


async def create_oauth_state(
    db: AsyncSession,
    *,
    provider: str,
    user_id: Any,
    context: dict[str, Any] | None = None,
    shop_hint: str | None = None,
    code_verifier: str | None = None,
    ttl_seconds: int = STATE_TTL_SECONDS,
) -> str:
    provider = str(provider).strip().lower()
    if provider not in SUPPORTED_PROVIDERS:
        raise ValueError("Unsupported OAuth provider")

    state = secrets.token_urlsafe(48)
    await db.execute(
        text(
            """
            INSERT INTO oauth_connection_states
                (state_hash, provider, user_id, shop_hint, context,
                 code_verifier, created_at, expires_at)
            VALUES
                (:state_hash, :provider, :user_id, :shop_hint,
                 CAST(:context AS jsonb), :code_verifier,
                 NOW(), NOW() + (:ttl * INTERVAL '1 second'))
            """
        ),
        {
            "state_hash": _digest(state),
            "provider": provider,
            "user_id": user_id,
            "shop_hint": shop_hint,
            "context": json.dumps(context or {}, separators=(",", ":"), default=str),
            "code_verifier": code_verifier,
            "ttl": max(30, min(int(ttl_seconds), 3600)),
        },
    )
    await db.execute(
        text(
            """
            DELETE FROM oauth_connection_states
            WHERE expires_at < NOW() - INTERVAL '1 day'
               OR consumed_at < NOW() - INTERVAL '1 day'
            """
        )
    )
    return state


async def consume_oauth_state(
    db: AsyncSession,
    *,
    provider: str,
    state: str,
) -> dict[str, Any] | None:
    provider = str(provider).strip().lower()
    if provider not in SUPPORTED_PROVIDERS:
        return None

    result = await db.execute(
        text(
            """
            UPDATE oauth_connection_states
            SET consumed_at=NOW()
            WHERE state_hash=:state_hash
              AND provider=:provider
              AND consumed_at IS NULL
              AND expires_at > NOW()
            RETURNING user_id, shop_hint, context, code_verifier
            """
        ),
        {"state_hash": _digest(str(state or "")), "provider": provider},
    )
    row = result.fetchone()
    if not row:
        return None
    context = row[2] if isinstance(row[2], dict) else json.loads(row[2] or "{}")
    return {
        "user_id": row[0],
        "shop_hint": row[1],
        "context": context if isinstance(context, dict) else {},
        "code_verifier": row[3],
    }
