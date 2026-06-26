BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS data_api_plan VARCHAR(32) NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_api_subscription_status VARCHAR(32) NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_api_paystack_customer_code VARCHAR NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_api_paystack_subscription_code VARCHAR NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_api_paystack_plan_code VARCHAR NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_api_paystack_email_token VARCHAR NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_api_card_last4 VARCHAR NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_api_card_brand VARCHAR NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_api_trial_started_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_api_trial_ends_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_api_subscription_started_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_api_subscription_ends_at TIMESTAMP NULL;

-- Migrate any users whose Data API subscription was previously stored in account_tier.
UPDATE users
SET
    data_api_plan = CASE account_tier::text
        WHEN 'data_api_dev' THEN 'developer'
        WHEN 'data_api_startup' THEN 'startup'
        WHEN 'data_api_growth' THEN 'growth'
        ELSE data_api_plan
    END,
    data_api_subscription_status = subscription_status::text,
    data_api_paystack_customer_code = paystack_customer_code,
    data_api_paystack_subscription_code = paystack_subscription_code,
    data_api_paystack_plan_code = paystack_plan_code,
    data_api_paystack_email_token = paystack_email_token,
    data_api_card_last4 = card_last4,
    data_api_card_brand = card_brand,
    data_api_trial_started_at = trial_started_at,
    data_api_trial_ends_at = trial_ends_at,
    data_api_subscription_started_at = subscription_started_at,
    data_api_subscription_ends_at = subscription_ends_at
WHERE account_tier::text IN ('data_api_dev', 'data_api_startup', 'data_api_growth');

UPDATE users
SET
    account_tier = 'free',
    subscription_status = 'none',
    paystack_customer_code = NULL,
    paystack_subscription_code = NULL,
    paystack_plan_code = NULL,
    paystack_email_token = NULL,
    card_last4 = NULL,
    card_brand = NULL,
    trial_started_at = NULL,
    trial_ends_at = NULL,
    subscription_started_at = NULL,
    subscription_ends_at = NULL
WHERE account_tier::text IN ('data_api_dev', 'data_api_startup', 'data_api_growth');

COMMIT;
