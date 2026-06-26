import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)
TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'


def _secret_key() -> str:
    return (
        getattr(settings, 'TURNSTILE_SECRET_KEY', '')
        or getattr(settings, 'TURNSTILE_SECRET', '')
    )


async def verify_turnstile(token: str, remote_ip: Optional[str] = None) -> bool:
    """Validate a browser-generated Turnstile token with Cloudflare."""
    secret = _secret_key()
    environment = str(getattr(settings, 'ENVIRONMENT', 'development')).lower()

    if not secret:
        if environment != 'production':
            logger.warning('Turnstile secret is missing; allowing request outside production.')
            return True
        logger.error('TURNSTILE_SECRET_KEY is missing in production.')
        return False

    if not token or not token.strip():
        logger.info('Turnstile verification rejected: empty token.')
        return False

    payload = {
        'secret': secret,
        'response': token.strip(),
    }
    if remote_ip:
        payload['remoteip'] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(TURNSTILE_VERIFY_URL, data=payload)
            response.raise_for_status()
            result = response.json()
    except Exception as error:
        logger.exception('Turnstile verification request failed: %s', error)
        return False

    if result.get('success') is True:
        return True

    logger.info(
        'Turnstile verification failed. errors=%s hostname=%s',
        result.get('error-codes'),
        result.get('hostname'),
    )
    return False
