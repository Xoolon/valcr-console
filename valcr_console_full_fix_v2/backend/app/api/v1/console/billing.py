import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import get_current_user
from app.database import get_db
from app.models.user import User
from app.services import paystack as ps

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/console/billing', tags=['console-billing'])

PUBLIC_TO_INTERNAL = {
    'developer': 'data_api_dev',
    'startup': 'data_api_startup',
    'growth': 'data_api_growth',
}

INTERNAL_TO_PUBLIC = {value: key for key, value in PUBLIC_TO_INTERNAL.items()}

PLAN_CODE_TO_PUBLIC = {
    settings.PAYSTACK_DATA_API_DEV_PLAN_CODE: 'developer',
    settings.PAYSTACK_DATA_API_STARTUP_PLAN_CODE: 'startup',
    settings.PAYSTACK_DATA_API_GROWTH_PLAN_CODE: 'growth',
}

PLAN_DISPLAY = {
    'free': ('No active API plan', '$0'),
    'developer': ('Developer', '$29'),
    'startup': ('Startup', '$99'),
    'growth': ('Growth', '$299'),
}


class CheckoutRequest(BaseModel):
    plan: str


def _console_frontend_url() -> str:
    return str(
        getattr(settings, 'CONSOLE_FRONTEND_URL', '')
        or 'https://console.valcr.site'
    ).rstrip('/')


def _normalize_public_plan(value: str | None) -> str:
    plan = str(value or '').lower()
    if plan in PUBLIC_TO_INTERNAL:
        return plan
    if plan in INTERNAL_TO_PUBLIC:
        return INTERNAL_TO_PUBLIC[plan]
    return 'free'


def _subscription_payload(user: User) -> dict:
    plan = _normalize_public_plan(user.data_api_plan)
    name, amount = PLAN_DISPLAY.get(plan, (plan.title(), '—'))

    next_billing = (
        user.data_api_subscription_ends_at
        or user.data_api_trial_ends_at
    )

    return {
        'plan': plan,
        'name': name,
        'amount': amount,
        'status': user.data_api_subscription_status or 'none',
        'next_billing_date': next_billing.isoformat() if next_billing else None,
        'card_last4': user.data_api_card_last4,
        'card_brand': user.data_api_card_brand,
        'trial_active': bool(
            user.data_api_trial_ends_at
            and user.data_api_trial_ends_at > datetime.utcnow()
        ),
        'trial_ends_at': (
            user.data_api_trial_ends_at.isoformat()
            if user.data_api_trial_ends_at else None
        ),
    }


def _plan_from_transaction(txn: dict) -> tuple[str, str]:
    metadata = txn.get('metadata') or {}
    internal_plan = str(metadata.get('plan') or '')
    public_plan = _normalize_public_plan(internal_plan)

    plan = txn.get('plan') or {}
    subscription = txn.get('subscription') or {}
    plan_code = (
        plan.get('plan_code')
        or (subscription.get('plan') or {}).get('plan_code')
        or metadata.get('plan_code')
        or ''
    )

    if public_plan == 'free' and plan_code:
        public_plan = PLAN_CODE_TO_PUBLIC.get(plan_code, 'free')
        internal_plan = PUBLIC_TO_INTERNAL.get(public_plan, '')

    if public_plan == 'free' or not internal_plan:
        raise HTTPException(status_code=400, detail='Could not determine the Data API plan from the payment.')

    return public_plan, plan_code or ps.PLAN_CODE_MAP.get(internal_plan, '')


async def _apply_verified_transaction(user: User, txn: dict, db: AsyncSession) -> dict:
    public_plan, plan_code = _plan_from_transaction(txn)
    authorization = txn.get('authorization') or {}
    subscription = txn.get('subscription') or {}
    now = datetime.utcnow()

    user.data_api_plan = public_plan
    user.data_api_subscription_status = 'active'
    user.data_api_paystack_customer_code = (
        (txn.get('customer') or {}).get('customer_code')
        or user.data_api_paystack_customer_code
    )
    user.data_api_paystack_subscription_code = (
        subscription.get('subscription_code')
        or user.data_api_paystack_subscription_code
    )
    user.data_api_paystack_plan_code = plan_code or user.data_api_paystack_plan_code
    user.data_api_paystack_email_token = (
        subscription.get('email_token')
        or user.data_api_paystack_email_token
    )
    user.data_api_card_last4 = authorization.get('last4') or user.data_api_card_last4
    user.data_api_card_brand = authorization.get('card_type') or user.data_api_card_brand
    user.data_api_subscription_started_at = user.data_api_subscription_started_at or now
    user.updated_at = now

    await db.commit()
    await db.refresh(user)

    payload = _subscription_payload(user)
    payload.update({
        'success': True,
        'message': f'{PLAN_DISPLAY[public_plan][0]} Data API plan activated.',
    })
    return payload


@router.get('/subscription')
async def get_console_subscription(current_user: User = Depends(get_current_user)):
    return _subscription_payload(current_user)


@router.post('/checkout')
async def create_console_checkout(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    public_plan = _normalize_public_plan(body.plan)
    if public_plan not in PUBLIC_TO_INTERNAL:
        raise HTTPException(status_code=400, detail=f'Unknown Data API plan: {body.plan}')

    internal_plan = PUBLIC_TO_INTERNAL[public_plan]

    try:
        customer = await ps.create_or_get_customer(
            current_user.email,
            current_user.first_name,
            current_user.last_name,
        )
        current_user.data_api_paystack_customer_code = (
            customer.get('customer_code')
            or current_user.data_api_paystack_customer_code
        )
        await db.commit()
    except Exception as error:
        logger.exception('Data API Paystack customer error: %s', error)
        raise HTTPException(status_code=502, detail='Payment provider error') from error

    try:
        data = await ps.initialize_subscription(
            email=current_user.email,
            plan_name=internal_plan,
            callback_url=f'{_console_frontend_url()}/',
            metadata={
                'user_id': str(current_user.id),
                'product': 'data_api',
                'plan': internal_plan,
            },
            with_trial=False,
        )
    except Exception as error:
        logger.exception('Data API checkout initialization failed: %s', error)
        raise HTTPException(status_code=502, detail='Could not initialize Data API checkout') from error

    checkout_url = data.get('authorization_url')
    if not checkout_url:
        raise HTTPException(status_code=502, detail='Payment provider returned no checkout URL')

    return {
        'checkout_url': checkout_url,
        'authorization_url': checkout_url,
        'reference': data.get('reference'),
        'plan': public_plan,
    }


@router.get('/verify')
async def verify_console_payment(
    reference: str = Query(min_length=3),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        txn = await ps.verify_transaction(reference)
    except Exception as error:
        logger.exception('Data API payment verification failed: %s', error)
        raise HTTPException(status_code=502, detail='Could not verify payment') from error

    if txn.get('status') != 'success':
        raise HTTPException(status_code=400, detail='Payment was not successful')

    metadata = txn.get('metadata') or {}
    metadata_user_id = str(metadata.get('user_id') or '')
    if metadata_user_id and metadata_user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail='This payment belongs to a different account')

    if metadata.get('product') not in (None, '', 'data_api'):
        raise HTTPException(status_code=400, detail='This is not a Data API payment')

    return await _apply_verified_transaction(current_user, txn, db)


@router.post('/cancel')
async def cancel_console_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    subscription_code = current_user.data_api_paystack_subscription_code
    email_token = current_user.data_api_paystack_email_token

    if not subscription_code:
        raise HTTPException(status_code=400, detail='No active Data API subscription found')

    try:
        if email_token:
            await ps.cancel_subscription(subscription_code, email_token)
        else:
            await ps.send_cancellation_email(subscription_code)
    except Exception as error:
        logger.exception('Data API cancellation failed: %s', error)
        raise HTTPException(status_code=502, detail='Could not cancel the Data API subscription') from error

    current_user.data_api_subscription_status = 'non-renewing'
    current_user.updated_at = datetime.utcnow()
    await db.commit()

    return {
        'success': True,
        'message': 'Auto-renewal is off. Data API access continues until the current billing period ends.',
    }
