import { useEffect, useMemo, useRef } from 'react'
import { useApi, useMutation } from '../hooks/useApi.js'
import { billingAPI } from '../utils/billingApi.js'
import { useToast } from '../contexts/ToastContext.jsx'
import { S, TIER_COLOR } from '../styles/tokens.js'
import { Card, Label, Mono, Btn, Badge, Divider, Spinner } from '../components/ui/index.jsx'

const PLANS = [
  {
    id: 'developer',
    name: 'Developer',
    price: '$29',
    period: '/mo',
    desc: 'Ideal for building and testing integrations.',
    limits: ['10,000 calls/month', '2 live keys', 'benchmarks:read, segments:read'],
    highlight: false,
  },
  {
    id: 'startup',
    name: 'Startup',
    price: '$99',
    period: '/mo',
    desc: 'Early-stage products with growing data needs.',
    limits: ['100,000 calls/month', '5 live keys', '+ merchant:read'],
    highlight: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$299',
    period: '/mo',
    desc: 'Full benchmark access for production systems.',
    limits: ['500,000 calls/month', '10 live keys', 'All read scopes + insights'],
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'Volume pricing, SLA, and dedicated support.',
    limits: ['Unlimited calls', 'Unlimited keys', 'All scopes + XBRL export'],
    highlight: false,
  },
]

const PRICE_BY_PLAN = {
  developer: '$29',
  startup: '$99',
  growth: '$299',
  enterprise: 'Custom',
  free: '$0',
}

export function BillingPage() {
  const toast = useToast()
  const verificationStarted = useRef(false)

  const { data: plan, loading: planLoading, error: planError, refetch } = useApi(billingAPI.plan)
  const { mutate: checkout, loading: checkoutLoading } = useMutation(billingAPI.checkout)
  const { mutate: verifyPayment, loading: verifyLoading } = useMutation(billingAPI.verify)
  const { mutate: cancelSubscription, loading: cancelLoading } = useMutation(billingAPI.cancel)

  const currentTier = String(plan?.plan || 'free').toLowerCase()
  const currentPlanName = plan?.name || (currentTier === 'free' ? 'No active API plan' : currentTier)
  const currentAmount = plan?.amount || PRICE_BY_PLAN[currentTier] || '—'
  const isActive = ['active', 'non-renewing', 'past_due'].includes(String(plan?.status || '').toLowerCase())

  useEffect(() => {
    if (verificationStarted.current) return

    const params = new URLSearchParams(window.location.search)
    const reference = params.get('reference') || params.get('trxref')
    if (!reference) return

    verificationStarted.current = true

    verifyPayment(reference)
      .then(result => {
        toast(result?.message || 'Data API subscription activated.', 'success')
        refetch()
      })
      .catch(error => {
        toast(error.message || 'Payment verification failed.', 'error')
      })
      .finally(() => {
        const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash || ''}`
        window.history.replaceState({}, document.title, cleanUrl)
      })
  }, [refetch, toast, verifyPayment])

  const planStatusText = useMemo(() => {
    const status = String(plan?.status || 'none').replaceAll('_', ' ')
    return status.charAt(0).toUpperCase() + status.slice(1)
  }, [plan?.status])

  const handleUpgrade = async tier => {
    if (tier === 'enterprise') {
      window.location.href = 'mailto:hello@valcr.site?subject=Enterprise%20Data%20API'
      return
    }

    try {
      const result = await checkout(tier)
      const url = result?.checkout_url || result?.authorization_url
      if (!url) throw new Error('The backend returned no checkout URL.')
      window.location.assign(url)
    } catch (error) {
      toast(error.message || 'Could not open checkout.', 'error')
    }
  }

  const handleCancel = async () => {
    try {
      const result = await cancelSubscription()
      toast(result?.message || 'Subscription cancellation requested.', 'success')
      refetch()
    } catch (error) {
      toast(error.message || 'Could not cancel the subscription.', 'error')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 4 }}>Billing</p>
          <p style={{ fontSize: 13, color: S.text2 }}>Manage your separate Data API subscription.</p>
        </div>
        <Btn variant="secondary" onClick={refetch} disabled={planLoading || verifyLoading}>
          {planLoading || verifyLoading ? 'Refreshing…' : '↻ Refresh plan'}
        </Btn>
      </div>

      {planError && (
        <Card style={{ marginBottom: 20, borderColor: S.red }}>
          <Mono style={{ color: S.red }}>{planError}</Mono>
        </Card>
      )}

      {planLoading ? <Spinner /> : (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Label>Current Data API plan</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: S.text }}>{currentPlanName}</p>
                <Badge color={TIER_COLOR[currentTier] || 'blue'}>{currentTier}</Badge>
              </div>
              <Mono style={{ fontSize: 12, color: S.text3, marginTop: 4 }}>
                Status: {planStatusText}
              </Mono>
              <Mono style={{ fontSize: 12, color: S.text3, marginTop: 3 }}>
                Next billing: {plan?.next_billing_date ? new Date(plan.next_billing_date).toLocaleDateString() : '—'}
              </Mono>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontFamily: S.mono, fontSize: 24, fontWeight: 700, color: S.text }}>{currentAmount}</p>
              <Mono style={{ fontSize: 11, color: S.text3 }}>per month</Mono>
            </div>
          </div>

          {(plan?.card_last4 || isActive) && (
            <>
              <Divider />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
                <div>
                  <Label>Payment method</Label>
                  <Mono style={{ color: S.text2 }}>
                    {plan?.card_brand ? `${plan.card_brand} ` : ''}{plan?.card_last4 ? `•••• ${plan.card_last4}` : 'Managed by Paystack'}
                  </Mono>
                </div>
                {isActive && (
                  <Btn variant="secondary" onClick={handleCancel} disabled={cancelLoading}>
                    {cancelLoading ? 'Cancelling…' : 'Cancel renewal'}
                  </Btn>
                )}
              </div>
            </>
          )}
        </Card>
      )}

      <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 12 }}>Data API plans</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginBottom: 28 }}>
        {PLANS.map(item => {
          const isCurrent = currentTier === item.id && isActive
          return (
            <div key={item.id} style={{
              background: item.highlight ? S.cardAlt : S.card,
              border: `1px solid ${isCurrent ? S.accent : item.highlight ? S.borderHi : S.border}`,
              borderRadius: 4,
              padding: '18px 16px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}>
              {item.highlight && (
                <div style={{
                  position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                  background: S.accent, color: '#fff', fontFamily: S.mono, fontSize: 9,
                  fontWeight: 700, padding: '2px 10px', borderRadius: '0 0 4px 4px',
                  letterSpacing: '.05em',
                }}>
                  POPULAR
                </div>
              )}
              <Label>{item.name}</Label>
              <p style={{ fontFamily: S.mono, fontSize: 22, fontWeight: 700, color: S.text, marginBottom: 2 }}>
                {item.price}<span style={{ fontSize: 12, color: S.text3 }}>{item.period}</span>
              </p>
              <p style={{ fontSize: 11, color: S.text3, marginBottom: 12, flex: 1 }}>{item.desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px' }}>
                {item.limits.map((limit, index) => (
                  <li key={index} style={{ fontSize: 11, color: S.text2, fontFamily: S.mono, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: S.green, fontSize: 9 }}>✓</span> {limit}
                  </li>
                ))}
              </ul>
              <Btn
                variant={item.highlight ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => handleUpgrade(item.id)}
                disabled={checkoutLoading || isCurrent}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isCurrent ? 'Current plan' : item.id === 'enterprise' ? 'Contact us' : 'Choose plan →'}
              </Btn>
            </div>
          )
        })}
      </div>
    </div>
  )
}
