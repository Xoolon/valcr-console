"""Authentication routes shared by Valcr and the Valcr Console."""

import logging
import secrets
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.database import get_db
from app.models.user import User
from app.services.email import send_password_reset_email, send_verification_email, send_welcome_email
from app.services.session_service import merge_anonymous_to_user
from app.services.turnstile import verify_turnstile

logger = logging.getLogger(__name__)
router = APIRouter()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    user_id: str
    email: str
    first_name: str
    last_name: str
    account_tier: str
    data_api_plan: str = 'free'
    data_api_subscription_status: str = 'none'
    email_verified: bool
    is_admin: bool
    is_new_user: bool = False


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    turnstile_token: str

    @field_validator('password')
    @classmethod
    def password_strength(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError('Password must be at least 8 characters')
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    turnstile_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def password_strength(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError('Password must be at least 8 characters')
        return value


class OAuthRequest(BaseModel):
    provider: str
    access_token: str


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get('x-forwarded-for', '').split(',')[0].strip()
    return (
        request.headers.get('cf-connecting-ip')
        or forwarded
        or (request.client.host if request.client else None)
    )


def _token_response(user: User, token: str, *, is_new_user: bool | None = None) -> TokenResponse:
    account_tier = (
        user.account_tier.value
        if hasattr(user.account_tier, 'value')
        else str(user.account_tier)
    )
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        account_tier=account_tier,
        data_api_plan=getattr(user, 'data_api_plan', 'free') or 'free',
        data_api_subscription_status=(
            getattr(user, 'data_api_subscription_status', 'none') or 'none'
        ),
        email_verified=bool(user.email_verified),
        is_admin=bool(user.is_admin),
        is_new_user=(
            bool(getattr(user, 'is_new_user', False))
            if is_new_user is None else is_new_user
        ),
    )


async def _merge_anonymous_session(request: Request, db: AsyncSession, user: User, action: str) -> None:
    anonymous_id = request.cookies.get('valcr_aid')
    if not anonymous_id:
        return
    try:
        await merge_anonymous_to_user(db, anonymous_id, str(user.id))
    except Exception as error:
        logger.error('Failed to merge anonymous session during %s: %s', action, error)


@router.post('/register', response_model=TokenResponse)
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if not await verify_turnstile(body.turnstile_token, _client_ip(request)):
        raise HTTPException(status_code=400, detail='Security check failed. Please try again.')

    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail='An account with this email already exists.')

    verify_token = secrets.token_urlsafe(32)
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        email_verified=False,
        email_verify_token=verify_token,
        email_verify_token_expires=datetime.utcnow() + timedelta(hours=24),
        is_new_user=True,
        data_api_plan='free',
        data_api_subscription_status='none',
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    try:
        send_verification_email(body.email, body.first_name, verify_token)
    except Exception as error:
        logger.warning('Verification email failed (non-critical): %s', error)

    await _merge_anonymous_session(request, db, user, 'register')
    token = create_access_token({'sub': str(user.id), 'is_admin': user.is_admin})
    return _token_response(user, token, is_new_user=True)


@router.post('/login', response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if not await verify_turnstile(body.turnstile_token, _client_ip(request)):
        raise HTTPException(status_code=400, detail='Security check failed. Please try again.')

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not user.hashed_password:
        if user and user.oauth_provider:
            raise HTTPException(
                status_code=400,
                detail=f'This account uses {user.oauth_provider.title()} sign-in. Use the Google button to log in.',
            )
        raise HTTPException(status_code=401, detail='Invalid email or password.')

    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail='Invalid email or password.')
    if not user.is_active:
        raise HTTPException(status_code=403, detail='Account is disabled. Contact support.')

    user.last_login = datetime.utcnow()
    await db.commit()
    await _merge_anonymous_session(request, db, user, 'login')

    token = create_access_token({'sub': str(user.id), 'is_admin': user.is_admin})
    return _token_response(user, token)


@router.get('/verify-email')
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email_verify_token == token))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail='Invalid or expired verification link.')
    if user.email_verify_token_expires and user.email_verify_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail='Verification link expired. Request a new one.')

    user.email_verified = True
    user.email_verify_token = None
    user.email_verify_token_expires = None
    user.updated_at = datetime.utcnow()
    await db.commit()

    try:
        send_welcome_email(user.email, user.first_name)
    except Exception:
        pass

    return {'verified': True, 'message': 'Email verified successfully.'}


@router.post('/resend-verification')
async def resend_verification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.email_verified:
        return {'message': 'Email is already verified.'}
    if current_user.oauth_provider:
        return {'message': "OAuth accounts don't require email verification."}

    token = secrets.token_urlsafe(32)
    current_user.email_verify_token = token
    current_user.email_verify_token_expires = datetime.utcnow() + timedelta(hours=24)
    await db.commit()

    try:
        send_verification_email(current_user.email, current_user.first_name, token)
    except Exception as error:
        logger.warning('Resend verification email failed: %s', error)

    return {'message': 'Verification email sent. Check your inbox.'}


@router.post('/forgot-password')
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    safe_message = "If that email is registered, you'll receive a reset link shortly."

    if user:
        if user.oauth_provider and not user.hashed_password:
            try:
                from app.services.email import send_support_reply_email
                send_support_reply_email(
                    user.email,
                    user.first_name,
                    'Password Reset Request',
                    f'Hi {user.first_name}, your Valcr account uses {user.oauth_provider.title()} sign-in. '
                    'Use the Continue with Google button to log in.',
                )
            except Exception:
                pass
            return {'message': safe_message}

        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_token_expires = datetime.utcnow() + timedelta(hours=1)
        await db.commit()
        try:
            send_password_reset_email(user.email, user.first_name, token)
        except Exception as error:
            logger.warning('Password reset email failed: %s', error)

    return {'message': safe_message}


@router.post('/reset-password')
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.password_reset_token == body.token))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail='Invalid or expired reset link. Request a new one.')
    if user.password_reset_token_expires and user.password_reset_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail='Reset link expired. Request a new one from the login page.')

    user.hashed_password = hash_password(body.new_password)
    user.password_reset_token = None
    user.password_reset_token_expires = None
    user.updated_at = datetime.utcnow()
    await db.commit()
    return {'message': 'Password updated successfully.'}


@router.post('/oauth', response_model=TokenResponse)
async def oauth_login(
    body: OAuthRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if body.provider != 'google':
        raise HTTPException(status_code=400, detail='Only Google OAuth is currently supported.')

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {body.access_token}'},
        )

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail='Invalid Google token.')

    google_user = response.json()
    email = google_user.get('email')
    if not email:
        raise HTTPException(status_code=400, detail='Could not retrieve email from Google.')

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        if not user.oauth_provider:
            user.oauth_provider = 'google'
        if not user.oauth_provider_id:
            user.oauth_provider_id = google_user.get('sub')
        user.last_login = datetime.utcnow()
        user.email_verified = True
        await db.commit()
    else:
        user = User(
            email=email,
            first_name=google_user.get('given_name', '').strip(),
            last_name=google_user.get('family_name', '').strip(),
            hashed_password=None,
            email_verified=True,
            oauth_provider='google',
            oauth_provider_id=google_user.get('sub'),
            is_new_user=True,
            data_api_plan='free',
            data_api_subscription_status='none',
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        try:
            send_welcome_email(user.email, user.first_name)
        except Exception:
            pass

    await _merge_anonymous_session(request, db, user, 'OAuth')
    token = create_access_token({'sub': str(user.id), 'is_admin': user.is_admin})
    return _token_response(user, token)


@router.get('/unsubscribe')
async def unsubscribe_marketing(email: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        user.marketing_emails = False
        await db.commit()
    return {'unsubscribed': True, 'message': "You've been unsubscribed from promotional emails."}


@router.get('/me')
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        'id': str(current_user.id),
        'email': current_user.email,
        'first_name': current_user.first_name,
        'last_name': current_user.last_name,
        'account_tier': (
            current_user.account_tier.value
            if hasattr(current_user.account_tier, 'value')
            else str(current_user.account_tier)
        ),
        'data_api_plan': getattr(current_user, 'data_api_plan', 'free') or 'free',
        'data_api_subscription_status': (
            getattr(current_user, 'data_api_subscription_status', 'none') or 'none'
        ),
        'email_verified': bool(current_user.email_verified),
        'is_admin': bool(current_user.is_admin),
        'is_new_user': bool(getattr(current_user, 'is_new_user', False)),
        'created_at': str(current_user.created_at)[:10] if current_user.created_at else None,
    }
