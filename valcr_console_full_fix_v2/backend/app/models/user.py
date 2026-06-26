import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class AccountTier(str, enum.Enum):
    free = 'free'
    pro = 'pro'
    teams = 'teams'
    embed_starter = 'embed-starter'
    embed_business = 'embed-business'
    embed_agency = 'embed-agency'

    # Retained temporarily for backwards compatibility and migration of old rows.
    data_api_dev = 'data_api_dev'
    data_api_startup = 'data_api_startup'
    data_api_growth = 'data_api_growth'


class SubscriptionStatus(str, enum.Enum):
    active = 'active'
    non_renewing = 'non-renewing'
    cancelled = 'cancelled'
    past_due = 'past_due'
    none = 'none'


class User(Base):
    __tablename__ = 'users'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=True)
    first_name = Column(String, nullable=False, default='')
    last_name = Column(String, nullable=False, default='')
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)

    # Email verification
    email_verified = Column(Boolean, default=False)
    email_verify_token = Column(String, nullable=True)
    email_verify_token_expires = Column(DateTime, nullable=True)

    # Password reset
    password_reset_token = Column(String, nullable=True)
    password_reset_token_expires = Column(DateTime, nullable=True)

    # OAuth
    oauth_provider = Column(String, nullable=True)
    oauth_provider_id = Column(String, nullable=True)
    oauth_nonce: Optional[str] = Column(String(64), nullable=True)
    oauth_code_verifier: Optional[str] = Column(String(200), nullable=True)

    # Main Valcr SaaS plan. This is not the Console/Data API plan.
    account_tier = Column(SAEnum(AccountTier), default=AccountTier.free, nullable=False)

    # Main Valcr/Embed Paystack subscription
    paystack_customer_code = Column(String, nullable=True)
    paystack_subscription_code = Column(String, nullable=True)
    paystack_plan_code = Column(String, nullable=True)
    paystack_email_token = Column(String, nullable=True)
    subscription_status = Column(
        SAEnum(SubscriptionStatus),
        default=SubscriptionStatus.none,
        nullable=False,
    )
    card_last4 = Column(String, nullable=True)
    card_brand = Column(String, nullable=True)
    trial_started_at = Column(DateTime, nullable=True)
    trial_ends_at = Column(DateTime, nullable=True)
    subscription_started_at = Column(DateTime, nullable=True)
    subscription_ends_at = Column(DateTime, nullable=True)

    # Separate Console/Data API subscription
    data_api_plan = Column(String(32), default='free', nullable=False)
    data_api_subscription_status = Column(String(32), default='none', nullable=False)
    data_api_paystack_customer_code = Column(String, nullable=True)
    data_api_paystack_subscription_code = Column(String, nullable=True)
    data_api_paystack_plan_code = Column(String, nullable=True)
    data_api_paystack_email_token = Column(String, nullable=True)
    data_api_card_last4 = Column(String, nullable=True)
    data_api_card_brand = Column(String, nullable=True)
    data_api_trial_started_at = Column(DateTime, nullable=True)
    data_api_trial_ends_at = Column(DateTime, nullable=True)
    data_api_subscription_started_at = Column(DateTime, nullable=True)
    data_api_subscription_ends_at = Column(DateTime, nullable=True)

    # Preferences
    marketing_emails = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)

    is_new_user = Column(Boolean, default=True)
    onboarding_completed_at = Column(DateTime(timezone=True), nullable=True)

    valcr_score = Column(Integer, nullable=True)
    score_updated_at = Column(DateTime(timezone=True), nullable=True)
