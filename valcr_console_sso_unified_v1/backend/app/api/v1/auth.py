"""
Auth router — register, login, email verification, password reset, OAuth.
Turnstile CAPTCHA protects register and login endpoints.
"""

import logging
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.config import settings
from app.models.user import User, AccountTier, SubscriptionStatus
from app.core.security import (
    hash_password, verify_password, create_access_token, get_current_user
)
from app.services.email_service import (
    send_verification_email, send_password_reset_email, send_welcome_email
)
from app.services.turnstile import verify_turnstile
from app.services.session_service import merge_anonymous_to_user
from app.services.oauth_state import create_oauth_state, consume_oauth_state

logger = logging.getLogger(__name__)
router = APIRouter()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    first_name: str
    last_name: str
    account_tier: str
    email_verified: bool
    is_admin: bool
    is_new_user: bool = False
    data_api_plan: str = "free"
    data_api_subscription_status: str = "none"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    turnstile_token: str = ""   # optional — required in prod

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    turnstile_token: str = ""


@router.post("/register", response_model=TokenResponse)
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Turnstile verification
    ip = request.headers.get("cf-connecting-ip") or request.client.host if request.client else None
    if not await verify_turnstile(body.turnstile_token, ip):
        raise HTTPException(status_code=400, detail="Security check failed. Please try again.")

    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    verify_token = secrets.token_urlsafe(32)
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        email_verified=False,
        email_verify_token=verify_token,
        email_verify_token_expires=datetime.utcnow() + timedelta(hours=24),
        is_new_user = True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    try:
        send_verification_email(body.email, body.first_name, verify_token)
    except Exception as e:
        logger.warning(f"Verification email failed (non-critical): {e}")

    # ─── Merge anonymous session ─────────────────────────────────────
    anonymous_id = request.cookies.get("valcr_aid")
    if anonymous_id:
        try:
            await merge_anonymous_to_user(db, anonymous_id, str(user.id))
        except Exception as e:
            logger.error(f"Failed to merge anonymous session during register: {e}")
    # ────────────────────────────────────────────────────────────────

    token = create_access_token({"sub": str(user.id), "is_admin": user.is_admin})
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        account_tier=user.account_tier.value,
        email_verified=False,
        is_admin=user.is_admin,
        is_new_user=True,
        data_api_plan=str(getattr(user, "data_api_plan", "free") or "free"),
        data_api_subscription_status=str(getattr(user, "data_api_subscription_status", "none") or "none"),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = request.headers.get("cf-connecting-ip") or request.client.host if request.client else None
    if not await verify_turnstile(body.turnstile_token, ip):
        raise HTTPException(status_code=400, detail="Security check failed. Please try again.")

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not user.hashed_password:
        if user and user.oauth_provider:
            raise HTTPException(
                status_code=400,
                detail=f"This account uses {user.oauth_provider.title()} sign-in. Use the Google button to log in."
            )
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled. Contact support.")

    user.last_login = datetime.utcnow()
    await db.commit()

    # ─── Merge anonymous session ─────────────────────────────────────
    anonymous_id = request.cookies.get("valcr_aid")
    if anonymous_id:
        try:
            await merge_anonymous_to_user(db, anonymous_id, str(user.id))
        except Exception as e:
            logger.error(f"Failed to merge anonymous session during login: {e}")
    # ────────────────────────────────────────────────────────────────

    token = create_access_token({"sub": str(user.id), "is_admin": user.is_admin})
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        account_tier=user.account_tier.value,
        email_verified=user.email_verified,
        is_admin=user.is_admin,
        is_new_user=bool(getattr(user, "is_new_user", False)),
        data_api_plan=str(getattr(user, "data_api_plan", "free") or "free"),
        data_api_subscription_status=str(getattr(user, "data_api_subscription_status", "none") or "none"),
    )


@router.get("/verify-email")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.email_verify_token == token)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link.")
    if user.email_verify_token_expires and user.email_verify_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification link expired. Request a new one.")

    user.email_verified = True
    user.email_verify_token = None
    user.email_verify_token_expires = None
    user.updated_at = datetime.utcnow()
    await db.commit()

    try:
        send_welcome_email(user.email, user.first_name)
    except Exception:
        pass

    return {"verified": True, "message": "Email verified successfully."}


@router.post("/resend-verification")
async def resend_verification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.email_verified:
        return {"message": "Email is already verified."}
    if current_user.oauth_provider:
        return {"message": "OAuth accounts don't require email verification."}

    token = secrets.token_urlsafe(32)
    current_user.email_verify_token = token
    current_user.email_verify_token_expires = datetime.utcnow() + timedelta(hours=24)
    await db.commit()

    try:
        send_verification_email(current_user.email, current_user.first_name, token)
    except Exception as e:
        logger.warning(f"Resend verification email failed: {e}")

    return {"message": "Verification email sent. Check your inbox."}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Always return the same message — don't reveal if email exists
    SAFE_MSG = "If that email is registered, you'll receive a reset link shortly."

    if user:
        if user.oauth_provider and not user.hashed_password:
            # OAuth-only account — send a helpful message instead of reset link
            try:
                from app.services.email_service import send_support_reply_email
                send_support_reply_email(
                    user.email, user.first_name,
                    "Password Reset Request",
                    f"Hi {user.first_name}, your Valcr account uses {user.oauth_provider.title()} sign-in — "
                    f"you don't have a password set. To log in, use the \"Continue with Google\" button on the login page. "
                    f"If you'd like to set a password as well, reply to this email and we'll help you."
                )
            except Exception:
                pass
            return {"message": SAFE_MSG}

        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_token_expires = datetime.utcnow() + timedelta(hours=1)
        await db.commit()
        try:
            send_password_reset_email(user.email, user.first_name, token)
        except Exception as e:
            logger.warning(f"Password reset email failed: {e}")

    return {"message": SAFE_MSG}


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.password_reset_token == body.token)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link. Request a new one.")
    if user.password_reset_token_expires and user.password_reset_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reset link expired. Request a new one from the login page.")

    user.hashed_password = hash_password(body.new_password)
    user.password_reset_token = None
    user.password_reset_token_expires = None
    user.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "Password updated successfully."}


class OAuthRequest(BaseModel):
    provider: str
    access_token: str


@router.post("/oauth", response_model=TokenResponse)
async def oauth_login(
    body: OAuthRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if body.provider != "google":
        raise HTTPException(status_code=400, detail="Only Google OAuth is currently supported.")

    # Verify Google access token
    async with __import__("httpx").AsyncClient() as client:
        r = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {body.access_token}"},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token.")
        google_user = r.json()

    email = google_user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Could not retrieve email from Google.")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        # Existing user — update OAuth info if needed
        if not user.oauth_provider:
            user.oauth_provider = "google"
        user.last_login = datetime.utcnow()
        user.email_verified = True  # trust Google
        await db.commit()
    else:
        # New user via OAuth
        user = User(
            email=email,
            first_name=google_user.get("given_name", "").strip(),
            last_name=google_user.get("family_name", "").strip(),
            hashed_password=None,
            email_verified=True,
            oauth_provider="google",
            oauth_provider_id=google_user.get("sub"),
            is_new_user=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        try:
            send_welcome_email(user.email, user.first_name)
        except Exception:
            pass

    # ─── Merge anonymous session ─────────────────────────────────────
    anonymous_id = request.cookies.get("valcr_aid")
    if anonymous_id:
        try:
            await merge_anonymous_to_user(db, anonymous_id, str(user.id))
        except Exception as e:
            logger.error(f"Failed to merge anonymous session during OAuth: {e}")
    # ────────────────────────────────────────────────────────────────

    token = create_access_token({"sub": str(user.id), "is_admin": user.is_admin})
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        account_tier=user.account_tier.value,
        email_verified=True,
        is_admin=user.is_admin,
        is_new_user=bool(getattr(user, "is_new_user", False)),
        data_api_plan=str(getattr(user, "data_api_plan", "free") or "free"),
        data_api_subscription_status=str(getattr(user, "data_api_subscription_status", "none") or "none"),
    )


CONSOLE_HANDOFF_TTL_SECONDS = 90


def _console_frontend_url() -> str:
    return str(
        getattr(settings, "CONSOLE_FRONTEND_URL", "")
        or "https://console.valcr.site"
    ).rstrip("/")


class ConsoleExchangeRequest(BaseModel):
    code: str


@router.post("/console-handoff")
async def create_console_handoff(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a fixed-destination, single-use login handoff for Console."""
    code = await create_oauth_state(
        db,
        provider="console",
        user_id=current_user.id,
        context={"purpose": "console_login"},
        ttl_seconds=CONSOLE_HANDOFF_TTL_SECONDS,
    )
    await db.commit()

    query = urlencode({"code": code})
    return {
        "redirect_url": f"{_console_frontend_url()}/auth/callback?{query}",
        "expires_in": CONSOLE_HANDOFF_TTL_SECONDS,
    }


@router.post("/console-exchange", response_model=TokenResponse)
async def exchange_console_handoff(
    body: ConsoleExchangeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Consume a Console handoff exactly once and issue the normal Valcr JWT."""
    state_row = await consume_oauth_state(
        db,
        provider="console",
        state=body.code.strip(),
    )
    if not state_row:
        raise HTTPException(
            status_code=400,
            detail="Console sign-in link is invalid, expired, or already used.",
        )

    # Commit consumption before issuing a token so retries cannot reuse the code.
    await db.commit()

    result = await db.execute(select(User).where(User.id == state_row["user_id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User account no longer exists.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled. Contact support.")

    token = create_access_token({
        "sub": str(user.id),
        "is_admin": bool(user.is_admin),
        "client": "console",
    })
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        account_tier=(
            user.account_tier.value
            if hasattr(user.account_tier, "value")
            else str(user.account_tier)
        ),
        email_verified=bool(user.email_verified),
        is_admin=bool(user.is_admin),
        is_new_user=bool(getattr(user, "is_new_user", False)),
        data_api_plan=str(getattr(user, "data_api_plan", "free") or "free"),
        data_api_subscription_status=str(
            getattr(user, "data_api_subscription_status", "none") or "none"
        ),
    )


@router.get("/unsubscribe")
async def unsubscribe_marketing(email: str, db: AsyncSession = Depends(get_db)):
    """One-click unsubscribe from marketing emails."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        user.marketing_emails = False
        await db.commit()
    # Always return success — don't reveal if email exists
    return {"unsubscribed": True, "message": "You've been unsubscribed from promotional emails."}


# =============================================================================
# NEW ENDPOINT: /auth/me – used by frontend for silent session restoration
# =============================================================================
@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the current user's profile.
    Called by the frontend on app load to validate the stored token.
    A 401 here means token expired → frontend will redirect to /login.
    """
    return {
        "id":           str(current_user.id),
        "email":        current_user.email,
        "first_name":   current_user.first_name,
        "last_name":    current_user.last_name,
        "account_tier": current_user.account_tier.value if hasattr(current_user.account_tier, 'value') else str(current_user.account_tier),
        "is_admin":     current_user.is_admin,
        "email_verified": bool(current_user.email_verified),
        "data_api_plan": str(getattr(current_user, "data_api_plan", "free") or "free"),
        "data_api_subscription_status": str(getattr(current_user, "data_api_subscription_status", "none") or "none"),
        "is_new_user":  getattr(current_user, 'is_new_user', False),
        "created_at":   str(current_user.created_at)[:10] if current_user.created_at else None,
    }