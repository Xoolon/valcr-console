export const SESSION_KEY = 'vcr_console_auth'

const FALLBACK_EXPIRY_MS = 24 * 60 * 60 * 1000

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  return atob(normalized + padding)
}

export function getJwtExpiryMs(token) {
  try {
    const payload = JSON.parse(decodeBase64Url(token.split('.')[1]))
    const expiry = Number(payload.exp) * 1000
    return Number.isFinite(expiry) ? expiry : Date.now() + FALLBACK_EXPIRY_MS
  } catch {
    return Date.now() + FALLBACK_EXPIRY_MS
  }
}

export function normalizeDataApiPlan(value) {
  const plan = String(value || '').toLowerCase()
  const aliases = {
    data_api_dev: 'developer',
    data_api_startup: 'startup',
    data_api_growth: 'growth',
    developer: 'developer',
    startup: 'startup',
    growth: 'growth',
    enterprise: 'enterprise',
    free: 'free',
    none: 'free',
  }
  return aliases[plan] || 'free'
}

export function mapAuthResponse(data, existingToken = '') {
  const token = data?.access_token || existingToken

  return {
    token,
    expiresAt: token ? getJwtExpiryMs(token) : 0,
    id: data?.user_id || data?.id || '',
    email: data?.email || '',
    firstName: data?.first_name || data?.firstName || '',
    lastName: data?.last_name || data?.lastName || '',
    emailVerified: Boolean(data?.email_verified ?? data?.emailVerified),
    isAdmin: Boolean(data?.is_admin ?? data?.isAdmin),

    // Keep Valcr SaaS billing and Console/Data API billing separate.
    valcrTier: data?.account_tier || data?.valcrTier || 'free',
    dataApiPlan: normalizeDataApiPlan(
      data?.data_api_plan || data?.api_plan || data?.console_plan || data?.dataApiPlan
    ),
    dataApiSubscriptionStatus:
      data?.data_api_subscription_status || data?.dataApiSubscriptionStatus || 'none',
    tier: normalizeDataApiPlan(
      data?.data_api_plan || data?.api_plan || data?.console_plan || data?.dataApiPlan
    ),
  }
}

export function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null

    const session = JSON.parse(raw)
    if (!session?.token || !session?.expiresAt || session.expiresAt <= Date.now()) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }

    return {
      ...session,
      dataApiPlan: normalizeDataApiPlan(session.dataApiPlan || session.apiPlan || session.tier),
      valcrTier: session.valcrTier || session.accountTier || 'free',
      tier: normalizeDataApiPlan(session.dataApiPlan || session.apiPlan || session.tier),
    }
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function writeSession(session) {
  if (!session?.token) throw new Error('Cannot save a session without an access token.')
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
