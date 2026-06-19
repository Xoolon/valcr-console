// src/pages/Billing.jsx — Live billing, invoices, Paystack upgrade
import { useState } from 'react'
import { useApi, useMutation } from '../hooks/useApi.js'
import { billingAPI }          from '../utils/api.js'
import { useAuth }             from '../contexts/AuthContext.jsx'
import { useToast }            from '../contexts/ToastContext.jsx'
import { S, TIER_COLOR }       from '../styles/tokens.js'
import { Card, Label, Mono, Btn, Badge, Divider, Spinner, EmptyState } from '../components/ui/index.jsx'

const PLANS = [
  {
    id:       'developer',
    name:     'Developer',
    price:    '$29',
    period:   '/mo',
    desc:     'Ideal for building and testing integrations.',
    limits:   ['10,000 calls/month', '2 live keys', 'benchmarks:read, segments:read'],
    highlight: false,
  },
  {
    id:       'startup',
    name:     'Startup',
    price:    '$99',
    period:   '/mo',
    desc:     'Early-stage products with growing data needs.',
    limits:   ['100,000 calls/month', '5 live keys', '+ merchant:read'],
    highlight: false,
  },
  {
    id:       'growth',
    name:     'Growth',
    price:    '$299',
    period:   '/mo',
    desc:     'Full benchmark access for production systems.',
    limits:   ['500,000 calls/month', '10 live keys', 'All read scopes + insights'],
    highlight: true,
  },
  {
    id:       'enterprise',
    name:     'Enterprise',
    price:    'Custom',
    period:   '',
    desc:     'Volume pricing, SLA, and dedicated support.',
    limits:   ['Unlimited calls', 'Unlimited keys', 'All scopes + XBRL export'],
    highlight: false,
  },
]

export function BillingPage() {
  const { auth }   = useAuth()
  const toast      = useToast()
  const currentTier = auth?.tier || 'developer'

  const { data: plan,     loading: planLoading   } = useApi(billingAPI.plan)
  const { data: invoices, loading: invLoading    } = useApi(billingAPI.invoices)
  const { mutate: checkout, loading: checkoutLoading } = useMutation(billingAPI.checkout)
  const { mutate: portal,   loading: portalLoading   } = useMutation(billingAPI.portal)

  const handleUpgrade = async (tier) => {
    if (tier === 'enterprise') {
      window.open('mailto:hello@valcr.site?subject=Enterprise%20Data%20API', '_blank')
      return
    }
    try {
      const res = await checkout(tier)
      if (res?.checkout_url) window.open(res.checkout_url, '_blank')
    } catch (e) {
      toast(e.message || 'Could not open checkout', 'error')
    }
  }

  const handlePortal = async () => {
    try {
      const res = await portal()
      if (res?.portal_url) window.open(res.portal_url, '_blank')
    } catch (e) {
      toast(e.message || 'Could not open billing portal', 'error')
    }
  }

  const inv = invoices?.invoices || []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 4 }}>Billing</p>
          <p style={{ fontSize: 13, color: S.text2 }}>
            Manage your Data API plan and payment details.
          </p>
        </div>
        <Btn variant="secondary" onClick={handlePortal} disabled={portalLoading}>
          {portalLoading ? 'Opening…' : '↗ Billing portal'}
        </Btn>
      </div>

      {/* Current plan */}
      {planLoading ? <Spinner /> : plan && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Label>Current plan</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: S.text }}>{plan.name || currentTier}</p>
                <Badge color={TIER_COLOR[currentTier] || 'blue'}>{currentTier}</Badge>
              </div>
              <Mono style={{ fontSize: 12, color: S.text3, marginTop: 4 }}>
                Next billing: {plan.next_billing_date ? new Date(plan.next_billing_date).toLocaleDateString() : '—'}
              </Mono>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontFamily: S.mono, fontSize: 24, fontWeight: 700, color: S.text }}>
                {plan.amount || '—'}
              </p>
              <Mono style={{ fontSize: 11, color: S.text3 }}>per month</Mono>
            </div>
          </div>

          {plan.calls_used !== undefined && (
            <>
              <Divider />
              <div style={{ display: 'flex', gap: 24 }}>
                <div>
                  <Label>Calls used</Label>
                  <Mono style={{ fontSize: 14, color: S.text2 }}>{plan.calls_used?.toLocaleString() || 0}</Mono>
                </div>
                <div>
                  <Label>Calls remaining</Label>
                  <Mono style={{ fontSize: 14, color: S.text2 }}>{plan.calls_remaining?.toLocaleString() || '∞'}</Mono>
                </div>
                <div>
                  <Label>Overage rate</Label>
                  <Mono style={{ fontSize: 14, color: S.text2 }}>{plan.overage_rate || '—'}</Mono>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Plan cards */}
      <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 12 }}>Plans</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
        {PLANS.map(p => {
          const isCurrent = currentTier === p.id
          return (
            <div key={p.id} style={{
              background: p.highlight ? S.cardAlt : S.card,
              border: `1px solid ${isCurrent ? S.accent : p.highlight ? S.borderHi : S.border}`,
              borderRadius: 4, padding: '18px 16px',
              display: 'flex', flexDirection: 'column',
              position: 'relative',
            }}>
              {p.highlight && (
                <div style={{
                  position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                  background: S.accent, color: '#fff',
                  fontFamily: S.mono, fontSize: 9, fontWeight: 700,
                  padding: '2px 10px', borderRadius: '0 0 4px 4px', letterSpacing: '.05em',
                }}>
                  POPULAR
                </div>
              )}
              <Label>{p.name}</Label>
              <p style={{ fontFamily: S.mono, fontSize: 22, fontWeight: 700, color: S.text, marginBottom: 2 }}>
                {p.price}<span style={{ fontSize: 12, color: S.text3 }}>{p.period}</span>
              </p>
              <p style={{ fontSize: 11, color: S.text3, marginBottom: 12, flex: 1 }}>{p.desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px' }}>
                {p.limits.map((l, i) => (
                  <li key={i} style={{ fontSize: 11, color: S.text2, fontFamily: S.mono, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: S.green, fontSize: 9 }}>✓</span> {l}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <Btn variant="secondary" size="sm" disabled style={{ width: '100%', justifyContent: 'center' }}>
                  Current plan
                </Btn>
              ) : (
                <Btn
                  variant={p.highlight ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleUpgrade(p.id)}
                  disabled={checkoutLoading}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {p.id === 'enterprise' ? 'Contact us' : 'Upgrade →'}
                </Btn>
              )}
            </div>
          )
        })}
      </div>

      {/* Invoices */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${S.border}` }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: S.text }}>Invoice history</p>
        </div>
        {invLoading ? (
          <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : inv.length === 0 ? (
          <EmptyState icon="▤" title="No invoices yet" sub="Your billing history will appear here." />
        ) : (
          inv.map((inv, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '11px 16px', borderBottom: `1px solid ${S.border}`,
              fontFamily: S.mono, fontSize: 12,
            }}>
              <Mono style={{ color: S.text3, minWidth: 90 }}>
                {inv.date ? new Date(inv.date).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
              </Mono>
              <Mono style={{ color: S.text3, flex: 1 }}>{inv.id || inv.invoice_id}</Mono>
              <Mono style={{ color: S.text, fontWeight: 600, minWidth: 70, textAlign: 'right' }}>
                {inv.amount}
              </Mono>
              <span style={{
                fontFamily: S.mono, fontSize: 10, fontWeight: 600,
                color: inv.status === 'Paid' ? S.green : S.amber,
                background: inv.status === 'Paid' ? S.greenDim : S.amberDim,
                padding: '2px 7px', borderRadius: 2, minWidth: 52, textAlign: 'center',
              }}>
                {inv.status}
              </span>
              {inv.pdf_url && (
                <a href={inv.pdf_url} target="_blank" rel="noreferrer" style={{ color: S.accent, fontSize: 10 }}>
                  PDF ↗
                </a>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  )
}
