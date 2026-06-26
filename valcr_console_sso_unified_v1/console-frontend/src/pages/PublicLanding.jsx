import { S } from '../styles/tokens.js'

const LOGIN_URL = 'https://valcr.site/login?next=console'
const SIGNUP_URL = 'https://valcr.site/signup?next=console'

function Feature({ title, children }) {
  return <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: 20 }}>
    <h3 style={{ color: S.text, fontSize: 14, marginBottom: 8 }}>{title}</h3>
    <p style={{ color: S.text2, fontSize: 12, lineHeight: 1.7 }}>{children}</p>
  </div>
}

export function PublicLandingPage() {
  return <div style={{ minHeight: '100vh', background: S.bg, color: S.text, fontFamily: S.body }}>
    <header style={{ maxWidth: 1080, margin: '0 auto', padding: '22px 24px', display: 'flex', alignItems: 'center' }}>
      <div style={{ width: 30, height: 30, background: S.accent, borderRadius: 4, display: 'grid', placeItems: 'center', fontFamily: S.mono, fontWeight: 700 }}>V</div>
      <span style={{ marginLeft: 10, fontFamily: S.mono, fontWeight: 600 }}>Valcr Console</span>
      <a href="https://valcr.site" style={{ marginLeft: 'auto', color: S.text2, textDecoration: 'none', fontSize: 12 }}>Valcr account ↗</a>
    </header>

    <main style={{ maxWidth: 1080, margin: '0 auto', padding: '80px 24px 60px' }}>
      <div style={{ maxWidth: 720 }}>
        <div style={{ fontFamily: S.mono, fontSize: 11, color: S.accent, marginBottom: 16 }}>VALCR DATA API</div>
        <h1 style={{ fontSize: 'clamp(36px,6vw,68px)', lineHeight: 1.05, marginBottom: 20 }}>Financial intelligence for ecommerce builders.</h1>
        <p style={{ color: S.text2, fontSize: 17, lineHeight: 1.7, maxWidth: 650 }}>
          Access benchmark distributions, segment intelligence, merchant scores and VCFS-normalised financial data through one developer API.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 30 }}>
          <a href={LOGIN_URL} style={{ background: S.accent, color: '#fff', padding: '12px 18px', borderRadius: 5, textDecoration: 'none', fontWeight: 600 }}>Continue with Valcr</a>
          <a href={SIGNUP_URL} style={{ border: `1px solid ${S.borderHi}`, color: S.text, padding: '12px 18px', borderRadius: 5, textDecoration: 'none' }}>Create a Valcr account</a>
        </div>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginTop: 70 }}>
        <Feature title="Benchmarks">Percentile distributions segmented by platform, revenue tier, geography and product category.</Feature>
        <Feature title="Merchant intelligence">Retrieve scores, insights and normalized VCFS records with plan-based scopes.</Feature>
        <Feature title="Developer operations">Create and rotate keys, inspect usage, manage billing and configure signed webhooks.</Feature>
      </section>

      <section style={{ marginTop: 70, background: S.bgDeep, border: `1px solid ${S.border}`, borderRadius: 8, padding: 24 }}>
        <div style={{ fontFamily: S.mono, fontSize: 11, color: S.text3, marginBottom: 12 }}>QUICKSTART</div>
        <pre style={{ overflowX: 'auto', color: S.green, fontFamily: S.mono, fontSize: 12, lineHeight: 1.7 }}>{`curl "https://api.valcr.site/data/v1/benchmarks?segment=shopify_general_10k_50k_us&metric=gross_margin_pct" \
  -H "Authorization: Bearer vck_live_..."`}</pre>
      </section>
    </main>
  </div>
}
