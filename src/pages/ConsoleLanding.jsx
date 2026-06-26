// src/pages/ConsoleLanding.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Public landing page served at console.valcr.site BEFORE authentication.
// Visitors see this before deciding to sign up or log in.
// Authenticated users are taken directly to the console shell instead.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { S } from '../styles/tokens.js'

const DOCS  = 'https://docs.valcr.site'
const MAIN  = 'https://valcr.site'
const LOGIN = 'https://valcr.site/login'

// ── Tiny inline animation CSS ─────────────────────────────────────────────────
const LANDING_CSS = `
  @keyframes fadeUp   { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
  @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
  @keyframes pulse    { 0%,100% { opacity:1 } 50% { opacity:.4 } }
  @keyframes scanline { from { transform:translateY(-100%) } to { transform:translateY(100%) } }
  @keyframes blink    { 0%,100% { opacity:1 } 49% { opacity:1 } 50% { opacity:0 } }
  .land-fade-up  { animation: fadeUp .6s ease both }
  .land-fade-in  { animation: fadeIn .8s ease both }
  .land-d1 { animation-delay: .1s }
  .land-d2 { animation-delay: .2s }
  .land-d3 { animation-delay: .35s }
  .land-d4 { animation-delay: .5s }
  .land-d5 { animation-delay: .65s }
  .land-card:hover { border-color: #2A4070 !important; background: #0F1E35 !important }
  .land-btn-primary:hover { background: #6DB3FF !important }
  .land-btn-secondary:hover { border-color: #4B9EFF !important; color: #4B9EFF !important }
  .land-link:hover { color: #6DB3FF !important }
  .land-tier:hover { border-color: #2A4070 !important; transform: translateY(-2px) }
  .cursor-blink { animation: blink 1s step-end infinite }
`

// ── Reusable primitives ───────────────────────────────────────────────────────
function Tag({ children }) {
  return (
    <span style={{
      fontFamily: S.mono, fontSize: 9, fontWeight: 700,
      letterSpacing: '.1em', textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: 2,
      background: '#1A3A6B', color: S.accent,
      border: `1px solid ${S.borderHi}`,
    }}>
      {children}
    </span>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
    }}>
      <span style={{ width: 24, height: 1, background: S.accent, display: 'block' }} />
      <span style={{
        fontFamily: S.mono, fontSize: 10, color: S.accent,
        letterSpacing: '.14em', textTransform: 'uppercase',
      }}>
        {children}
      </span>
    </div>
  )
}

function Card({ children, style = {}, className = '' }) {
  return (
    <div
      className={`land-card ${className}`}
      style={{
        background: S.card, border: `1px solid ${S.border}`,
        borderRadius: 6, transition: 'all .15s', ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Animated terminal block ───────────────────────────────────────────────────
const TERMINAL_LINES = [
  { delay: 0,    text: '$ curl "https://api.valcr.site/data/v1/benchmarks?category=ecommerce"', color: S.text3 },
  { delay: 800,  text: '  -H "Authorization: Bearer vcr_live_••••••••••••••••"', color: S.text3 },
  { delay: 1400, text: '', color: '' },
  { delay: 1600, text: '{', color: S.text2 },
  { delay: 1700, text: '  "category": "ecommerce",', color: S.text2 },
  { delay: 1800, text: '  "period": "2025-Q1",', color: S.text2 },
  { delay: 1900, text: '  "metrics": {', color: S.text2 },
  { delay: 2000, text: '    "gross_margin":   { "p25": 0.31, "p50": 0.44, "p75": 0.59 },', color: '#34D399' },
  { delay: 2150, text: '    "revenue_growth": { "p25": 0.06, "p50": 0.14, "p75": 0.28 },', color: '#34D399' },
  { delay: 2300, text: '    "ltv_cac_ratio":  { "p25": 1.8,  "p50": 3.1,  "p75": 4.9  },', color: '#34D399' },
  { delay: 2450, text: '    "cart_abandon":   { "p25": 0.60, "p50": 0.69, "p75": 0.77 }', color: '#34D399' },
  { delay: 2600, text: '  },', color: S.text2 },
  { delay: 2700, text: '  "sample_size": 4812', color: S.text2 },
  { delay: 2800, text: '}', color: S.text2 },
  { delay: 2950, text: '', color: '' },
  { delay: 3000, text: '// 200 OK · 48ms · benchmarks:read scope', color: S.text3 },
]

function Terminal() {
  const [visible, setVisible] = useState(0)

  useEffect(() => {
    const timers = TERMINAL_LINES.map((_, i) =>
      setTimeout(() => setVisible(v => Math.max(v, i + 1)), TERMINAL_LINES[i].delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div style={{
      background: S.bgDeep, border: `1px solid ${S.border}`,
      borderRadius: 6, overflow: 'hidden',
      fontFamily: S.mono, fontSize: 12.5, lineHeight: 1.65,
    }}>
      {/* Title bar */}
      <div style={{
        background: S.surface, borderBottom: `1px solid ${S.border}`,
        padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 7,
      }}>
        {['#FF6B6B','#F59E0B','#34D399'].map(c => (
          <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: .7 }} />
        ))}
        <span style={{ marginLeft: 8, fontSize: 10, color: S.text3, letterSpacing: '.06em' }}>
          terminal — valcr data api
        </span>
      </div>

      {/* Lines */}
      <div style={{ padding: '16px 18px', minHeight: 320 }}>
        {TERMINAL_LINES.slice(0, visible).map((line, i) => (
          <div key={i} style={{ color: line.color || 'transparent' }}>
            {line.text || '\u00A0'}
          </div>
        ))}
        {visible < TERMINAL_LINES.length && (
          <span style={{ color: S.accent }}>
            ▊<span className="cursor-blink"> </span>
          </span>
        )}
      </div>
    </div>
  )
}

// ── Scope pill ────────────────────────────────────────────────────────────────
function Scope({ name, color = S.accent }) {
  return (
    <span style={{
      fontFamily: S.mono, fontSize: 10, fontWeight: 500,
      padding: '3px 8px', borderRadius: 3,
      background: `${color}14`, color, border: `1px solid ${color}28`,
    }}>
      {name}
    </span>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function Stat({ value, label, sub }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{
        fontFamily: S.mono, fontSize: 32, fontWeight: 700, color: S.accent,
        lineHeight: 1, marginBottom: 6, letterSpacing: '-.02em',
      }}>
        {value}
      </p>
      <p style={{ fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 3 }}>{label}</p>
      {sub && <p style={{ fontFamily: S.mono, fontSize: 10, color: S.text3 }}>{sub}</p>}
    </div>
  )
}

// ── Feature row ───────────────────────────────────────────────────────────────
function Feature({ icon, title, body, link, linkLabel }) {
  return (
    <Card style={{ padding: '22px 24px' }}>
      <div style={{
        width: 36, height: 36, borderRadius: 6,
        background: S.accentDim, border: `1px solid ${S.borderHi}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: S.mono, fontSize: 16, color: S.accent,
        marginBottom: 14,
      }}>
        {icon}
      </div>
      <p style={{ fontSize: 14, fontWeight: 700, color: S.text, marginBottom: 8 }}>{title}</p>
      <p style={{ fontSize: 13, color: S.text2, lineHeight: 1.75, marginBottom: link ? 14 : 0 }}>{body}</p>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="land-link"
          style={{
            fontFamily: S.mono, fontSize: 11, color: S.accent,
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
            transition: 'color .12s',
          }}
        >
          {linkLabel} →
        </a>
      )}
    </Card>
  )
}

// ── Tier card ─────────────────────────────────────────────────────────────────
function TierCard({ name, price, period, desc, features, accent, popular, ctaLabel, ctaHref }) {
  return (
    <div
      className="land-tier"
      style={{
        background: popular ? S.cardAlt : S.card,
        border: `1px solid ${popular ? S.borderHi : S.border}`,
        borderRadius: 6, padding: '24px 22px',
        display: 'flex', flexDirection: 'column',
        position: 'relative', transition: 'all .15s',
      }}
    >
      {popular && (
        <div style={{
          position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
          background: S.accent, color: '#fff',
          fontFamily: S.mono, fontSize: 9, fontWeight: 700,
          padding: '3px 12px', borderRadius: '0 0 4px 4px', letterSpacing: '.06em',
        }}>
          POPULAR
        </div>
      )}
      <p style={{
        fontFamily: S.mono, fontSize: 10, color: accent,
        letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10,
      }}>
        {name}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 6 }}>
        <span style={{ fontFamily: S.mono, fontSize: 28, fontWeight: 700, color: S.text }}>{price}</span>
        {period && <span style={{ fontFamily: S.mono, fontSize: 11, color: S.text3 }}>{period}</span>}
      </div>
      <p style={{ fontSize: 12, color: S.text3, marginBottom: 18, lineHeight: 1.6 }}>{desc}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', flex: 1 }}>
        {features.map((f, i) => (
          <li key={i} style={{
            fontSize: 12, color: S.text2, marginBottom: 7,
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <span style={{ color: S.green, fontSize: 10, marginTop: 2, flexShrink: 0 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>
      <a
        href={ctaHref}
        style={{
          display: 'block', textAlign: 'center', textDecoration: 'none',
          padding: '9px 0',
          background: popular ? S.accent : 'transparent',
          color: popular ? '#fff' : S.text2,
          border: `1px solid ${popular ? S.accent : S.border}`,
          borderRadius: 4, fontFamily: S.body, fontSize: 13, fontWeight: 600,
          transition: 'all .12s',
        }}
        onMouseEnter={e => {
          if (!popular) { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.color = S.accent }
        }}
        onMouseLeave={e => {
          if (!popular) { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.text2 }
        }}
      >
        {ctaLabel}
      </a>
    </div>
  )
}

// ── Step card ─────────────────────────────────────────────────────────────────
function Step({ n, title, body, code }) {
  return (
    <div style={{ display: 'flex', gap: 20 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: S.accentDim, border: `1px solid ${S.borderHi}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: S.mono, fontSize: 12, fontWeight: 700, color: S.accent,
        marginTop: 2,
      }}>
        {n}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: S.text, marginBottom: 6 }}>{title}</p>
        <p style={{ fontSize: 13, color: S.text2, lineHeight: 1.75, marginBottom: code ? 12 : 0 }}>{body}</p>
        {code && (
          <div style={{
            background: S.bgDeep, border: `1px solid ${S.border}`, borderRadius: 4,
            padding: '10px 14px', fontFamily: S.mono, fontSize: 12, color: S.text2,
            overflowX: 'auto',
          }}>
            <pre style={{ margin: 0 }}>{code}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LANDING PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function ConsoleLanding({ onLogin, onSignup }) {
  // Inject animation CSS
  useEffect(() => {
    if (document.getElementById('vcr-landing-css')) return
    const el = document.createElement('style')
    el.id = 'vcr-landing-css'
    el.textContent = LANDING_CSS
    document.head.appendChild(el)
    document.title = 'Valcr Console — Commerce Intelligence API'
  }, [])

  const W = { maxWidth: 1080, margin: '0 auto', padding: '0 24px' }

  return (
    <div style={{ background: S.bg, color: S.text, fontFamily: S.body, minHeight: '100vh' }}>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: `${S.bgDeep}ee`, backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${S.border}`,
      }}>
        <div style={{ ...W, display: 'flex', alignItems: 'center', height: 58, gap: 24 }}>
          {/* Logo */}
          <a href={MAIN} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 28, height: 28, background: S.accent, borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: S.mono, fontSize: 12, fontWeight: 700, color: '#fff',
            }}>V</div>
            <span style={{ fontFamily: S.mono, fontSize: 13, fontWeight: 600, color: S.text, letterSpacing: '.04em' }}>
              Console
            </span>
            <span style={{
              fontFamily: S.mono, fontSize: 9, fontWeight: 700,
              background: S.accentDim, color: S.accent,
              padding: '2px 6px', borderRadius: 2, border: `1px solid ${S.borderHi}`,
            }}>
              API
            </span>
          </a>

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 16 }}>
            {[
              { label: 'Docs',        href: DOCS },
              { label: 'Benchmarks',  href: `${DOCS}/api/benchmarks` },
              { label: 'Pricing',     href: `${DOCS}/guides/pricing` },
              { label: 'Security',    href: `${DOCS}/guides/security` },
              { label: 'Valcr.site',  href: MAIN },
            ].map(l => (
              <a
                key={l.label}
                href={l.href}
                target={l.href.startsWith('http') ? '_blank' : undefined}
                rel="noreferrer"
                className="land-link"
                style={{
                  fontFamily: S.body, fontSize: 13, color: S.text2,
                  textDecoration: 'none', padding: '6px 10px', borderRadius: 4,
                  transition: 'color .12s',
                }}
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* CTA buttons */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={onLogin}
              className="land-btn-secondary"
              style={{
                background: 'none', border: `1px solid ${S.border}`,
                borderRadius: 4, padding: '7px 14px',
                fontFamily: S.body, fontSize: 13, color: S.text2,
                cursor: 'pointer', transition: 'all .12s',
              }}
            >
              Sign in
            </button>
            <button
              onClick={onSignup}
              className="land-btn-primary"
              style={{
                background: S.accent, border: 'none',
                borderRadius: 4, padding: '7px 16px',
                fontFamily: S.body, fontSize: 13, fontWeight: 600,
                color: '#fff', cursor: 'pointer', transition: 'background .12s',
              }}
            >
              Get API access →
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section style={{ padding: '88px 24px 72px', ...W, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 56, alignItems: 'center',
          }}>
            {/* Left */}
            <div>
              <div className="land-fade-up land-d1" style={{ marginBottom: 18 }}>
                <Tag>Commerce Intelligence API — Now Open</Tag>
              </div>

              <h1
                className="land-fade-up land-d2"
                style={{
                  fontSize: 'clamp(32px, 4vw, 50px)', fontWeight: 700,
                  lineHeight: 1.08, letterSpacing: '-.025em',
                  color: S.text, marginBottom: 20,
                }}
              >
                Financial benchmarks.<br />
                <span style={{ color: S.accent }}>Served via API.</span><br />
                Built for builders.
              </h1>

              <p
                className="land-fade-up land-d3"
                style={{
                  fontSize: 15, color: S.text2, lineHeight: 1.8,
                  marginBottom: 32, maxWidth: 460,
                }}
              >
                The Valcr Console is your developer hub for the Commerce Intelligence API —
                benchmark percentiles, merchant VCFS profiles, AI insights, and XBRL exports,
                all behind a single authenticated endpoint.
              </p>

              <div className="land-fade-up land-d4" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={onSignup}
                  className="land-btn-primary"
                  style={{
                    background: S.accent, border: 'none',
                    borderRadius: 4, padding: '11px 22px',
                    fontFamily: S.body, fontSize: 14, fontWeight: 600,
                    color: '#fff', cursor: 'pointer', transition: 'background .12s',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  Create free account →
                </button>
                <a
                  href={`${DOCS}/quickstart`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    border: `1px solid ${S.border}`, borderRadius: 4,
                    padding: '11px 22px', fontFamily: S.body, fontSize: 14,
                    color: S.text2, textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'all .12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.color = S.accent }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.text2 }}
                >
                  View docs ↗
                </a>
              </div>

              {/* Trust signals */}
              <div
                className="land-fade-up land-d5"
                style={{
                  display: 'flex', alignItems: 'center', gap: 20,
                  marginTop: 32, paddingTop: 24, borderTop: `1px solid ${S.border}`,
                  flexWrap: 'wrap',
                }}
              >
                {[
                  '✓  No credit card to start',
                  '✓  Test keys always free',
                  '✓  2-minute setup',
                ].map(t => (
                  <span key={t} style={{ fontFamily: S.mono, fontSize: 11, color: S.text3 }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Right — animated terminal */}
            <div className="land-fade-in land-d3">
              <Terminal />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ───────────────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${S.border}`, borderBottom: `1px solid ${S.border}` }}>
        <div style={{ ...W, padding: '36px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            <Stat value="16,000+"  label="Merchants benchmarked"    sub="across 5 categories" />
            <Stat value="20+"      label="Market segments"          sub="granular sub-segment data" />
            <Stat value="287-bit"  label="Key entropy"              sub="SHA-256 hashed, never stored" />
            <Stat value="48ms"     label="Median API latency"       sub="p50 across all endpoints" />
          </div>
        </div>
      </div>

      {/* ── WHAT YOU CAN BUILD ──────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ ...W, paddingLeft: 24, paddingRight: 24 }}>
          <SectionLabel>What you can build</SectionLabel>
          <h2 style={{
            fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 700, letterSpacing: '-.02em',
            color: S.text, marginBottom: 12, maxWidth: 600,
          }}>
            One API. Four product categories.
          </h2>
          <p style={{ fontSize: 14, color: S.text2, marginBottom: 44, maxWidth: 520, lineHeight: 1.8 }}>
            The Valcr Data API is built for teams who need financial benchmark intelligence
            inside their own products — not a dashboard they visit occasionally.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 16 }}>
            <Feature
              icon="⚖"
              title="Underwriting & credit decisions"
              body="Lenders and RBF platforms use Valcr to contextualise a merchant's financials within their actual peer group — not an industry average from a dated report. Integrate benchmark percentiles and the Valcr Score directly into your underwriting pipeline."
              link={`${DOCS}/api/merchant`}
              linkLabel="Merchant API"
            />
            <Feature
              icon="◈"
              title="Embedded SaaS benchmarking"
              body="Accounting software, analytics tools, and ecommerce platforms embed Valcr benchmark distributions inside their own products. One API call returns the full percentile distribution for any metric — your users see the intelligence, you never maintain the dataset."
              link={`${DOCS}/api/benchmarks`}
              linkLabel="Benchmarks API"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <Feature
              icon="⬡"
              title="Portfolio monitoring"
              body="VC firms and PE teams use Valcr to assess whether a portfolio company's financial metrics are credible, exceptional, or cause for concern — benchmarked against verified data from real comparable businesses updated quarterly."
              link={`${DOCS}/guides/valcr-score`}
              linkLabel="Valcr Score"
            />
            <Feature
              icon="⎈"
              title="Regulatory & audit export"
              body="Enterprise integrations use the XBRL export endpoint to generate taxonomy-tagged financial documents from merchant VCFS data — suitable for SEC/Companies House submissions, ERP import, and structured audit trails."
              link={`${DOCS}/api/xbrl`}
              linkLabel="XBRL Export API"
            />
          </div>
        </div>
      </section>

      {/* ── ENDPOINTS REFERENCE ─────────────────────────────────────────── */}
      <section style={{ background: S.surface, padding: '80px 24px', borderTop: `1px solid ${S.border}`, borderBottom: `1px solid ${S.border}` }}>
        <div style={{ ...W, paddingLeft: 24, paddingRight: 24 }}>
          <SectionLabel>API Reference</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>
            <div>
              <h2 style={{ fontSize: 26, fontWeight: 700, color: S.text, marginBottom: 12, letterSpacing: '-.02em' }}>
                Every endpoint, one base URL
              </h2>
              <p style={{ fontSize: 14, color: S.text2, lineHeight: 1.8, marginBottom: 24 }}>
                All Data API requests go to{' '}
                <span style={{ fontFamily: S.mono, color: S.accent, fontSize: 13 }}>
                  api.valcr.site/data/v1
                </span>
                . Authenticate with a bearer token. Scope controls access.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
                {['benchmarks:read','segments:read','merchant:read','merchant:write','insights:read','compare:read','score:read','export:read'].map(s => (
                  <Scope key={s} name={s} />
                ))}
              </div>
              <a
                href={`${DOCS}/api/overview`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: S.mono, fontSize: 12, color: S.accent,
                  textDecoration: 'none',
                }}
              >
                Full API reference →
              </a>
            </div>

            {/* Endpoint list */}
            <div style={{
              background: S.bgDeep, border: `1px solid ${S.border}`,
              borderRadius: 6, overflow: 'hidden',
            }}>
              {[
                { method: 'GET',  path: '/benchmarks',              scope: 'benchmarks:read', col: S.accent },
                { method: 'GET',  path: '/benchmarks/percentile',   scope: 'benchmarks:read', col: S.accent },
                { method: 'GET',  path: '/segments/breakdown',      scope: 'segments:read',   col: S.accent },
                { method: 'GET',  path: '/merchant/vcfs',           scope: 'merchant:read',   col: '#34D399' },
                { method: 'POST', path: '/merchant/vcfs',           scope: 'merchant:write',  col: '#34D399' },
                { method: 'GET',  path: '/merchant/insights',       scope: 'insights:read',   col: S.purple },
                { method: 'GET',  path: '/merchant/score',          scope: 'score:read',      col: S.amber },
                { method: 'GET',  path: '/export/xbrl',             scope: 'export:read',     col: S.amber },
                { method: 'GET',  path: '/health',                  scope: 'public',          col: S.text3 },
              ].map((e, i, arr) => (
                <div
                  key={e.path}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px',
                    borderBottom: i < arr.length - 1 ? `1px solid ${S.border}` : 'none',
                  }}
                >
                  <span style={{
                    fontFamily: S.mono, fontSize: 9, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 2, minWidth: 34, textAlign: 'center',
                    background: `${e.col}14`, color: e.col,
                  }}>
                    {e.method}
                  </span>
                  <span style={{ fontFamily: S.mono, fontSize: 12, color: S.text, flex: 1 }}>{e.path}</span>
                  <span style={{
                    fontFamily: S.mono, fontSize: 9, color: S.text3,
                    background: S.card, padding: '2px 6px', borderRadius: 2,
                    border: `1px solid ${S.border}`,
                  }}>
                    {e.scope}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ ...W, paddingLeft: 24, paddingRight: 24 }}>
          <SectionLabel>Get started</SectionLabel>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: S.text, marginBottom: 48, letterSpacing: '-.02em' }}>
            From zero to first response in 2 minutes
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36, maxWidth: 680 }}>
            <Step
              n="1"
              title="Create a free account"
              body="Sign up with your email or Google. No credit card required. You'll land in the Console with a Developer tier account and two live API key slots."
            />
            <div style={{ width: 1, height: 1, borderLeft: `1px dashed ${S.border}`, marginLeft: 15, marginTop: -24, marginBottom: -24 }} />
            <Step
              n="2"
              title="Create an API key"
              body="Go to API Keys → Create key. Choose your environment (live or test), give it a name, and select the scopes your integration needs. The raw key is shown once — copy it immediately."
            />
            <div style={{ width: 1, height: 1, borderLeft: `1px dashed ${S.border}`, marginLeft: 15, marginTop: -24, marginBottom: -24 }} />
            <Step
              n="3"
              title="Make your first request"
              body="Add the Authorization header and hit any endpoint. Test keys return seeded data and never count against your quota."
              code={`curl "https://api.valcr.site/data/v1/benchmarks?category=ecommerce" \\
  -H "Authorization: Bearer vcr_test_your_key_here"`}
            />
            <div style={{ width: 1, height: 1, borderLeft: `1px dashed ${S.border}`, marginLeft: 15, marginTop: -24, marginBottom: -24 }} />
            <Step
              n="4"
              title="Monitor in the Console"
              body="The Console shows real-time request logs, quota usage, latency, endpoint breakdown, and per-key analytics — everything you need to manage a production integration."
            />
          </div>
          <div style={{ marginTop: 44 }}>
            <a
              href={`${DOCS}/quickstart`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontFamily: S.mono, fontSize: 12, color: S.accent, textDecoration: 'none',
              }}
            >
              Full Quickstart guide →
            </a>
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────────────── */}
      <section style={{ background: S.surface, padding: '80px 24px', borderTop: `1px solid ${S.border}`, borderBottom: `1px solid ${S.border}` }}>
        <div style={{ ...W, paddingLeft: 24, paddingRight: 24 }}>
          <SectionLabel>Pricing</SectionLabel>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: S.text, marginBottom: 8, letterSpacing: '-.02em' }}>
            Start free. Scale as you grow.
          </h2>
          <p style={{ fontSize: 14, color: S.text2, marginBottom: 44 }}>
            Test keys are free and unlimited on every plan. Pay only for production traffic.
            <a
              href={`${DOCS}/guides/pricing`}
              target="_blank"
              rel="noreferrer"
              style={{ color: S.accent, marginLeft: 8, textDecoration: 'none', fontFamily: S.mono, fontSize: 12 }}
            >
              Full pricing details →
            </a>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <TierCard
              name="Developer"
              price="$29"
              period="/mo"
              desc="Build and test integrations. Sufficient for low-volume production."
              accent={S.text3}
              features={[
                '10,000 calls / month', '2 live API keys',
                'benchmarks:read', 'segments:read',
                '60 req/min rate limit', 'Email support',
              ]}
              ctaLabel="Start building"
              ctaHref="#"
            />
            <TierCard
              name="Startup"
              price="$99"
              period="/mo"
              desc="Early-stage products with growing benchmark data needs."
              accent={S.accent}
              features={[
                '100,000 calls / month', '5 live API keys',
                '+ merchant:read', 'Peer comparisons',
                '100 req/min rate limit', 'Priority email',
              ]}
              ctaLabel="Get started"
              ctaHref="#"
            />
            <TierCard
              name="Growth"
              price="$299"
              period="/mo"
              desc="Full benchmark access for production underwriting and analytics."
              accent={S.purple}
              popular
              features={[
                '500,000 calls / month', '10 live API keys',
                '+ merchant:write', '+ insights:read',
                '+ compare:read', '300 req/min rate limit',
              ]}
              ctaLabel="Upgrade to Growth"
              ctaHref="#"
            />
            <TierCard
              name="Enterprise"
              price="Custom"
              period=""
              desc="Unlimited volume, SLA, XBRL export, and dedicated support."
              accent={S.amber}
              features={[
                'Unlimited calls & keys',
                'All scopes incl. score:read',
                'XBRL export (export:read)',
                'Full reports (report:read)',
                '99.9% uptime SLA',
                'Dedicated Slack channel',
              ]}
              ctaLabel="Contact us"
              ctaHref="mailto:teams@valcr.site"
            />
          </div>
        </div>
      </section>

      {/* ── SECURITY ────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ ...W, paddingLeft: 24, paddingRight: 24 }}>
          <SectionLabel>Security</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>
            <div>
              <h2 style={{ fontSize: 26, fontWeight: 700, color: S.text, marginBottom: 12, letterSpacing: '-.02em' }}>
                Designed for financial data.<br />Secured accordingly.
              </h2>
              <p style={{ fontSize: 14, color: S.text2, lineHeight: 1.8, marginBottom: 24 }}>
                API keys are never stored in plaintext. OAuth tokens are encrypted at rest.
                Every response is served over TLS 1.3 with HSTS enforced.
              </p>
              <a
                href={`${DOCS}/guides/security`}
                target="_blank"
                rel="noreferrer"
                style={{ fontFamily: S.mono, fontSize: 12, color: S.accent, textDecoration: 'none' }}
              >
                Full security documentation →
              </a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { icon: '⌗', title: 'SHA-256 key hashing', body: 'Raw API keys shown once, immediately hashed. Never stored, never recoverable.' },
                { icon: '🔒', title: 'TLS 1.3 + HSTS', body: 'All traffic encrypted in transit. HSTS enforced with 1-year max-age and preloading.' },
                { icon: '⚿', title: 'Scoped permissions', body: 'Keys carry only the scopes they need. A compromised key has a minimal blast radius.' },
                { icon: '↺', title: 'Instant rotation', body: 'Rotate any key in under 10 seconds. Old key invalidated immediately on the database write.' },
                { icon: '⏱', title: 'Timing-safe compare', body: 'All key hash comparisons use hmac.compare_digest — no timing-based enumeration.' },
                { icon: '⌦', title: 'Audit logging', body: 'Every key creation, rotation, and revocation is logged with IP and user-agent.' },
              ].map(item => (
                <Card key={item.title} style={{ padding: '16px 18px' }}>
                  <p style={{ fontFamily: S.mono, fontSize: 16, color: S.accent, marginBottom: 8 }}>{item.icon}</p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: S.text, marginBottom: 5 }}>{item.title}</p>
                  <p style={{ fontSize: 11, color: S.text3, lineHeight: 1.65 }}>{item.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── VCFS ────────────────────────────────────────────────────────── */}
      <section style={{ background: S.surface, padding: '80px 24px', borderTop: `1px solid ${S.border}`, borderBottom: `1px solid ${S.border}` }}>
        <div style={{ ...W, paddingLeft: 24, paddingRight: 24 }}>
          <SectionLabel>Data standard</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 26, fontWeight: 700, color: S.text, marginBottom: 12, letterSpacing: '-.02em' }}>
                Built on VCFS — the canonical financial schema for commerce
              </h2>
              <p style={{ fontSize: 14, color: S.text2, lineHeight: 1.8, marginBottom: 16 }}>
                Every benchmark in the API is computed from merchant data normalised through the
                Valcr Commerce Financial Schema — the same field names, the same calculation
                methodology, across every merchant in the dataset.
              </p>
              <p style={{ fontSize: 14, color: S.text2, lineHeight: 1.8, marginBottom: 24 }}>
                This is what makes the percentiles valid. Without consistent normalisation,
                a benchmark is a blend of different things calculated differently.
                With VCFS, p50 means the median of businesses where gross margin was
                calculated identically.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <a href={`${DOCS}/guides/vcfs-schema`} target="_blank" rel="noreferrer"
                  style={{ fontFamily: S.mono, fontSize: 12, color: S.accent, textDecoration: 'none' }}>
                  VCFS schema reference →
                </a>
                <a href={`${DOCS}/api/xbrl`} target="_blank" rel="noreferrer"
                  style={{ fontFamily: S.mono, fontSize: 12, color: S.text3, textDecoration: 'none' }}>
                  XBRL export →
                </a>
              </div>
            </div>

            {/* VCFS field preview */}
            <div style={{
              background: S.bgDeep, border: `1px solid ${S.border}`,
              borderRadius: 6, padding: '20px 22px', fontFamily: S.mono, fontSize: 12,
            }}>
              <p style={{ color: S.text3, marginBottom: 12, fontSize: 10, letterSpacing: '.08em' }}>
                VCFS PAYLOAD — POST /merchant/vcfs
              </p>
              {[
                { path: 'revenue.gross_revenue',     val: '480000',  col: S.text2 },
                { path: 'revenue.net_revenue',       val: '432000',  col: S.text2 },
                { path: 'margins.gross_margin',      val: '0.52',    col: '#34D399' },
                { path: 'margins.operating_margin',  val: '0.14',    col: '#34D399' },
                { path: 'customers.active_customers',val: '3840',    col: S.accent },
                { path: 'customers.customer_ltv',    val: '310',     col: S.accent },
                { path: 'customers.ltv_cac_ratio',   val: '6.5',     col: S.accent },
                { path: 'growth.revenue_growth_qoq', val: '0.18',    col: S.purple },
                { path: 'operations.refund_rate',    val: '0.04',    col: S.text2 },
                { path: 'channel.direct',            val: '0.64',    col: S.amber },
              ].map(r => (
                <div key={r.path} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${S.border}22` }}>
                  <span style={{ color: S.text3 }}>{r.path}</span>
                  <span style={{ color: r.col }}>{r.val}</span>
                </div>
              ))}
              <p style={{ color: S.green, marginTop: 12, fontSize: 10 }}>
                completeness_score: 0.92 ✓ eligible for all benchmarks
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: '96px 24px' }}>
        <div style={{ ...W, paddingLeft: 24, paddingRight: 24, textAlign: 'center' }}>
          <Tag>Start today</Tag>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700,
            letterSpacing: '-.025em', color: S.text,
            marginTop: 20, marginBottom: 16, lineHeight: 1.1,
          }}>
            Commerce intelligence,<br />
            <span style={{ color: S.accent }}>in your product by end of day.</span>
          </h2>
          <p style={{ fontSize: 15, color: S.text2, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
            Create a free Console account, generate a test key, and make your first
            benchmark request — all in under two minutes.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={onSignup}
              className="land-btn-primary"
              style={{
                background: S.accent, border: 'none', borderRadius: 4,
                padding: '12px 28px', fontFamily: S.body,
                fontSize: 14, fontWeight: 600, color: '#fff',
                cursor: 'pointer', transition: 'background .12s',
              }}
            >
              Create free account →
            </button>
            <a
              href={`${DOCS}`}
              target="_blank"
              rel="noreferrer"
              style={{
                border: `1px solid ${S.border}`, borderRadius: 4,
                padding: '12px 28px', fontFamily: S.body, fontSize: 14,
                color: S.text2, textDecoration: 'none', transition: 'all .12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.color = S.accent }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.text2 }}
            >
              Browse documentation
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{
        background: S.bgDeep, borderTop: `1px solid ${S.border}`,
        padding: '40px 24px 28px',
      }}>
        <div style={{ ...W, paddingLeft: 24, paddingRight: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 36 }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                <div style={{
                  width: 24, height: 24, background: S.accent, borderRadius: 3,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: S.mono, fontSize: 10, fontWeight: 700, color: '#fff',
                }}>V</div>
                <span style={{ fontFamily: S.mono, fontSize: 12, fontWeight: 600, color: S.text }}>Valcr Console</span>
              </div>
              <p style={{ fontSize: 12, color: S.text3, lineHeight: 1.75, maxWidth: 240, marginBottom: 14 }}>
                The developer hub for the Valcr Commerce Intelligence API.
                Benchmark data. Merchant profiles. Built for production.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { label: 'Twitter', href: 'https://twitter.com/cyntax_llc' },
                  { label: 'Instagram', href: 'https://instagram.com/valcr.io' },
                ].map(s => (
                  <a key={s.label} href={s.href} target="_blank" rel="noreferrer"
                    style={{ fontFamily: S.mono, fontSize: 10, color: S.text3, textDecoration: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.color = S.accent}
                    onMouseLeave={e => e.currentTarget.style.color = S.text3}>
                    {s.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Links */}
            {[
              { title: 'Product', links: [
                { label: 'Valcr Platform', href: MAIN },
                { label: 'Pricing', href: `${DOCS}/guides/pricing` },
                { label: 'Changelog', href: `${MAIN}/blog` },
                { label: 'Status', href: 'https://status.valcr.site' },
              ]},
              { title: 'Docs', links: [
                { label: 'Quickstart', href: `${DOCS}/quickstart` },
                { label: 'API reference', href: `${DOCS}/api/overview` },
                { label: 'VCFS Schema', href: `${DOCS}/guides/vcfs-schema` },
                { label: 'Security', href: `${DOCS}/guides/security` },
              ]},
              { title: 'Support', links: [
                { label: 'support@valcr.site', href: 'mailto:support@valcr.site' },
                { label: 'teams@valcr.site', href: 'mailto:teams@valcr.site' },
                { label: 'Documentation', href: DOCS },
                { label: 'Terms', href: `${MAIN}/terms` },
              ]},
            ].map(col => (
              <div key={col.title}>
                <p style={{
                  fontFamily: S.mono, fontSize: 9, fontWeight: 700,
                  color: S.text3, letterSpacing: '.12em',
                  textTransform: 'uppercase', marginBottom: 14,
                }}>
                  {col.title}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {col.links.map(l => (
                    <a
                      key={l.label}
                      href={l.href}
                      target={l.href.startsWith('http') ? '_blank' : undefined}
                      rel="noreferrer"
                      style={{ fontSize: 13, color: S.text3, textDecoration: 'none', transition: 'color .12s' }}
                      onMouseEnter={e => e.currentTarget.style.color = S.accent}
                      onMouseLeave={e => e.currentTarget.style.color = S.text3}
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div style={{
            borderTop: `1px solid ${S.border}`, paddingTop: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 12,
          }}>
            <p style={{ fontFamily: S.mono, fontSize: 10, color: S.text3 }}>
              🇺🇸 &nbsp;Copyright © {new Date().getFullYear()} Valcr · Cyntax LLC
            </p>
            <div style={{ display: 'flex', gap: 16 }}>
              {[
                { label: 'Privacy', href: `${MAIN}/privacy` },
                { label: 'Terms',   href: `${MAIN}/terms` },
                { label: 'Support', href: `${DOCS}/support` },
              ].map(l => (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                  style={{ fontFamily: S.mono, fontSize: 10, color: S.text3, textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.color = S.text2}
                  onMouseLeave={e => e.currentTarget.style.color = S.text3}>
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}