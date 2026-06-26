import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import get_current_user
from app.database import get_db
from app.models.notification import Notification
from app.models.user import AccountTier, SubscriptionStatus, User
from app.services import paystack as ps
from app.services.email import (
    send_payment_failed_email,
    send_subscription_started_email,
    send_trial_started_email,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/payments', tags=['payments'])

# Main Valcr and Embed products only. Data API billing is stored separately.
PLAN_CODE_TO_TIER: dict[str, AccountTier] = {
    settings.PAYSTACK_PRO_PLAN_CODE: AccountTier.pro,
    settings.PAYSTACK_TEAMS_PLAN_CODE: AccountTier.teams,
    settings.PAYSTACK_EMBED_STARTER_PLAN_CODE: AccountTier.embed_starter,
    settings.PAYSTACK_EMBED_BUSINESS_PLAN_CODE: AccountTier.embed_business,
    settings.PAYSTACK_EMBED_AGENCY_PLAN_CODE: AccountTier.embed_agency,
}

PLAN_NAME_TO_TIER = {
    'pro': AccountTier.pro,
    'teams': AccountTier.teams,
    'embed-starter': AccountTier.embed_starter,
    'embed-business': AccountTier.embed_business,
    'embed-agency': AccountTier.embed_agency,
}

DATA_API_PLAN_CODE_TO_PUBLIC = {
    settings.PAYSTACK_DATA_API_DEV_PLAN_CODE: 'developer',
    settings.PAYSTACK_DATA_API_STARTUP_PLAN_CODE: 'startup',
    settings.PAYSTACK_DATA_API_GROWTH_PLAN_CODE: 'growth',
}

DATA_API_INTERNAL_TO_PUBLIC = {
    'data_api_dev': 'developer',
    'data_api_startup': 'startup',
    'data_api_growth': 'growth',
}

PLAN_DISPLAY = {
    'pro': ('Pro', '$59'),
    'teams': ('Agency', '$149'),
    'embed-starter': ('Starter Embed', '$49'),
    'embed-business': ('Business Embed', '$99'),
    'embed-agency': ('Agency Embed', '$249'),
}


class SubscribeRequest(BaseModel):
    plan: str
    with_trial: bool = False


def _is_data_api_plan_name(plan_name: str | None) -> bool:
    return str(plan_name or '') in DATA_API_INTERNAL_TO_PUBLIC


def _data_api_plan_from_event(plan_name: str | None, plan_code: str | None) -> str | None:
    if plan_name in DATA_API_INTERNAL_TO_PUBLIC:
        return DATA_API_INTERNAL_TO_PUBLIC[plan_name]
    if plan_code in DATA_API_PLAN_CODE_TO_PUBLIC:
        return DATA_API_PLAN_CODE_TO_PUBLIC[plan_code]
    return None


async def _apply_data_api_payment(user: User, txn: dict, db: AsyncSession) -> str:
    metadata = txn.get('metadata') or {}
    subscription = txn.get('subscription') or {}
    plan = txn.get('plan') or {}
    authorization = txn.get('authorization') or {}

    plan_name = metadata.get('plan') or ''
    plan_code = (
        plan.get('plan_code')
        or (subscription.get('plan') or {}).get('plan_code')
        or metadata.get('plan_code')
        or ''
    )
    public_plan = _data_api_plan_from_event(plan_name, plan_code)
    if not public_plan:
        raise HTTPException(status_code=400, detail='Unrecognized Data API plan')

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
    return public_plan


@router.post('/subscribe')
async def subscribe(
    body: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if _is_data_api_plan_name(body.plan):
        raise HTTPException(
            status_code=400,
            detail='Use /api/v1/console/billing/checkout for Data API plans.',
        )
    if body.plan not in PLAN_NAME_TO_TIER or body.plan not in ps.PLAN_CODE_MAP:
        raise HTTPException(status_code=400, detail=f'Unknown plan: {body.plan}')

    try:
        customer = await ps.create_or_get_customer(
            current_user.email,
            current_user.first_name,
            current_user.last_name,
        )
        if not current_user.paystack_customer_code:
            current_user.paystack_customer_code = customer['customer_code']
            await db.commit()
    except Exception as error:
        logger.exception('Paystack customer error: %s', error)
        raise HTTPException(status_code=502, detail='Payment provider error') from error

    with_trial = body.with_trial or body.plan in ps.TRIAL_ELIGIBLE_PLANS

    try:
        data = await ps.initialize_subscription(
            email=current_user.email,
            plan_name=body.plan,
            callback_url=f'{settings.FRONTEND_URL}/payments/verify',
            metadata={
                'user_id': str(current_user.id),
                'product': 'valcr',
                'plan': body.plan,
                'trial': with_trial,
            },
            with_trial=with_trial,
        )
    except Exception as error:
        logger.exception('Paystack init error: %s', error)
        raise HTTPException(status_code=502, detail='Could not initialize payment') from error

    return {
        'authorization_url': data['authorization_url'],
        'reference': data['reference'],
        'trial': with_trial,
        'trial_days': ps.TRIAL_DAYS if with_trial else 0,
    }


@router.get('/verify')
async def verify_payment(
    reference: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        txn = await ps.verify_transaction(reference)
    except Exception as error:
        logger.exception('Verify error: %s', error)
        raise HTTPException(status_code=502, detail='Could not verify payment') from error

    if txn.get('status') != 'success':
        raise HTTPException(status_code=400, detail='Payment was not successful')

    metadata = txn.get('metadata') or {}
    plan_name = metadata.get('plan', '')
    plan = txn.get('plan') or {}
    subscription = txn.get('subscription') or {}
    plan_code = plan.get('plan_code') or (subscription.get('plan') or {}).get('plan_code')

    if metadata.get('product') == 'data_api' or _data_api_plan_from_event(plan_name, plan_code):
        public_plan = await _apply_data_api_payment(current_user, txn, db)
        return {
            'success': True,
            'product': 'data_api',
            'plan': public_plan,
            'message': 'Data API subscription activated.',
        }

    is_trial = bool(metadata.get('trial', False))
    authorization = txn.get('authorization') or {}
    auth_code = authorization.get('authorization_code')
    now = datetime.utcnow()
    tier = PLAN_CODE_TO_TIER.get(plan_code or '') or PLAN_NAME_TO_TIER.get(plan_name)
    if not tier:
        raise HTTPException(status_code=400, detail='Unrecognized plan')

    if is_trial:
        current_user.account_tier = tier
        current_user.subscription_status = SubscriptionStatus.active
        current_user.trial_started_at = now
        current_user.trial_ends_at = now + timedelta(days=ps.TRIAL_DAYS)
        current_user.paystack_plan_code = ps.PLAN_CODE_MAP.get(plan_name, '')
        current_user.paystack_email_token = auth_code
        current_user.card_last4 = authorization.get('last4')
        current_user.card_brand = authorization.get('card_type')
        current_user.updated_at = now
        await db.commit()

        transaction_id = str(txn.get('id', ''))
        if transaction_id:
            try:
                await ps.refund_transaction(transaction_id, ps.TOKENIZATION_AMOUNT)
            except Exception as error:
                logger.warning('Trial tokenization refund failed: %s', error)

        plan_display, _ = PLAN_DISPLAY.get(plan_name, (plan_name, ''))
        db.add(Notification(
            user_id=current_user.id,
            title='Free trial started! 🎉',
            message=f'Your {ps.TRIAL_DAYS}-day trial for {plan_display} is active.',
            type='success',
            action_url='/profile',
        ))
        await db.commit()
        send_trial_started_email(
            current_user.email,
            current_user.first_name,
            plan_display,
            current_user.trial_ends_at.strftime('%B %d, %Y'),
        )
        return {
            'success': True,
            'plan': tier.value,
            'trial': True,
            'trial_ends_at': current_user.trial_ends_at.isoformat(),
        }

    current_user.account_tier = tier
    current_user.paystack_plan_code = plan_code
    current_user.paystack_subscription_code = (
        subscription.get('subscription_code')
        or current_user.paystack_subscription_code
    )
    current_user.paystack_email_token = (
        subscription.get('email_token')
        or current_user.paystack_email_token
    )
    current_user.card_last4 = authorization.get('last4') or current_user.card_last4
    current_user.card_brand = authorization.get('card_type') or current_user.card_brand
    current_user.subscription_status = SubscriptionStatus.active
    current_user.subscription_started_at = current_user.subscription_started_at or now
    current_user.updated_at = now
    await db.commit()

    plan_display, plan_price = PLAN_DISPLAY.get(plan_name, (plan_name, ''))
    db.add(Notification(
        user_id=current_user.id,
        title='Subscription activated',
        message=f"You're now on {plan_display}.",
        type='success',
        action_url='/profile',
    ))
    await db.commit()
    send_subscription_started_email(
        current_user.email,
        current_user.first_name,
        plan_display,
        plan_price,
    )
    return {'success': True, 'plan': tier.value, 'trial': False}


@router.post('/cancel')
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.paystack_subscription_code:
        raise HTTPException(status_code=400, detail='No active subscription found')

    try:
        if current_user.paystack_email_token and not current_user.trial_started_at:
            await ps.cancel_subscription(
                current_user.paystack_subscription_code,
                current_user.paystack_email_token,
            )
        else:
            await ps.send_cancellation_email(current_user.paystack_subscription_code)
    except Exception as error:
        logger.exception('Cancel error: %s', error)
        raise HTTPException(status_code=502, detail='Could not cancel. Contact support@valcr.site') from error

    current_user.subscription_status = SubscriptionStatus.non_renewing
    current_user.updated_at = datetime.utcnow()
    await db.commit()
    return {'success': True, 'message': 'Subscription cancelled. Access continues until billing period ends.'}


@router.get('/subscription')
async def get_subscription(current_user: User = Depends(get_current_user)):
    trial_active = bool(
        current_user.trial_ends_at
        and current_user.trial_ends_at > datetime.utcnow()
    )
    return {
        'plan': current_user.account_tier.value,
        'status': current_user.subscription_status.value,
        'card_last4': current_user.card_last4,
        'card_brand': current_user.card_brand,
        'started_at': (
            current_user.subscription_started_at.isoformat()
            if current_user.subscription_started_at else None
        ),
        'trial_active': trial_active,
        'trial_ends_at': (
            current_user.trial_ends_at.isoformat()
            if current_user.trial_ends_at else None
        ),
    }


@router.post('/webhook', status_code=status.HTTP_200_OK)
async def paystack_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    signature = request.headers.get('x-paystack-signature', '')
    if settings.PAYSTACK_WEBHOOK_SECRET and not ps.verify_webhook_signature(payload, signature):
        raise HTTPException(status_code=400, detail='Invalid signature')

    try:
        event_data = await request.json()
    except Exception as error:
        raise HTTPException(status_code=400, detail='Invalid JSON') from error

    parsed = ps.parse_webhook_event(event_data)
    event_type = parsed.get('event', '')
    email = parsed.get('email')
    if not email:
        return {'received': True}

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return {'received': True}

    plan_code = parsed.get('plan_code') or ''
    subscription_code = parsed.get('subscription_code') or ''
    data_api_plan = DATA_API_PLAN_CODE_TO_PUBLIC.get(plan_code)
    is_data_api_subscription = bool(
        data_api_plan
        or (
            subscription_code
            and subscription_code == user.data_api_paystack_subscription_code
        )
    )

    if event_type == 'charge.success':
        if data_api_plan and not parsed.get('is_trial'):
            user.data_api_plan = data_api_plan
            user.data_api_subscription_status = 'active'
            user.data_api_paystack_customer_code = parsed.get('customer_code') or user.data_api_paystack_customer_code
            user.data_api_paystack_subscription_code = subscription_code or user.data_api_paystack_subscription_code
            user.data_api_paystack_plan_code = plan_code
            user.data_api_paystack_email_token = parsed.get('email_token') or user.data_api_paystack_email_token
            user.data_api_card_last4 = parsed.get('card_last4') or user.data_api_card_last4
            user.data_api_card_brand = parsed.get('card_brand') or user.data_api_card_brand
            user.data_api_subscription_started_at = user.data_api_subscription_started_at or datetime.utcnow()
            user.updated_at = datetime.utcnow()
            await db.commit()
        else:
            tier = PLAN_CODE_TO_TIER.get(plan_code)
            if tier and not parsed.get('is_trial'):
                user.account_tier = tier
                user.subscription_status = SubscriptionStatus.active
                user.paystack_customer_code = parsed.get('customer_code') or user.paystack_customer_code
                user.paystack_subscription_code = subscription_code or user.paystack_subscription_code
                user.paystack_plan_code = plan_code
                user.paystack_email_token = parsed.get('email_token') or user.paystack_email_token
                user.card_last4 = parsed.get('card_last4') or user.card_last4
                user.card_brand = parsed.get('card_brand') or user.card_brand
                user.subscription_started_at = user.subscription_started_at or datetime.utcnow()
                user.updated_at = datetime.utcnow()
                await db.commit()

    elif event_type == 'subscription.create':
        if data_api_plan or is_data_api_subscription:
            user.data_api_paystack_subscription_code = subscription_code or user.data_api_paystack_subscription_code
            user.data_api_paystack_email_token = parsed.get('email_token') or user.data_api_paystack_email_token
            user.data_api_paystack_plan_code = plan_code or user.data_api_paystack_plan_code
            if data_api_plan:
                user.data_api_plan = data_api_plan
            user.data_api_subscription_status = 'active'
        else:
            user.paystack_subscription_code = subscription_code or user.paystack_subscription_code
            user.paystack_email_token = parsed.get('email_token') or user.paystack_email_token
            user.subscription_status = SubscriptionStatus.active
        user.updated_at = datetime.utcnow()
        await db.commit()

    elif event_type == 'subscription.disable':
        if is_data_api_subscription:
            user.data_api_subscription_status = 'cancelled'
            user.data_api_plan = 'free'
            user.data_api_paystack_subscription_code = None
            user.data_api_paystack_email_token = None
            user.data_api_trial_started_at = None
            user.data_api_trial_ends_at = None
        else:
            user.subscription_status = SubscriptionStatus.cancelled
            user.account_tier = AccountTier.free
            user.paystack_subscription_code = None
            user.paystack_email_token = None
            user.trial_started_at = None
            user.trial_ends_at = None
        user.updated_at = datetime.utcnow()
        await db.commit()

    elif event_type == 'invoice.payment_failed':
        if is_data_api_subscription:
            user.data_api_subscription_status = 'past_due'
        else:
            user.subscription_status = SubscriptionStatus.past_due
        user.updated_at = datetime.utcnow()
        await db.commit()
        send_payment_failed_email(user.email, user.first_name)

    return {'received': True}
