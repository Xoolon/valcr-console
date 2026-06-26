import { S } from '../../styles/tokens.js'
import { useAuth } from '../../contexts/AuthContext.jsx'

const NAV_ITEMS = [
  { section: 'Overview' }, { id: 'overview', label: 'Overview', icon: '▪' },
  { section: 'API' }, { id: 'keys', label: 'API Keys', icon: '⌗' }, { id: 'endpoints', label: 'Endpoints', icon: '⌥' }, { id: 'logs', label: 'Request Logs', icon: '≡' },
  { section: 'Usage' }, { id: 'usage', label: 'Usage & Quota', icon: '↗' }, { id: 'billing', label: 'Billing', icon: '▤' },
  { section: 'Docs' }, { id: 'quickstart', label: 'Quickstart', icon: '▶' }, { id: 'webhooks', label: 'Webhooks', icon: '⌀' }, { id: 'settings', label: 'Settings', icon: '⚙' },
]

export function Sidebar({ page, nav, logErrors = 0 }) {
  const { auth, logout } = useAuth()
  const initial = auth?.firstName?.[0]?.toUpperCase() || 'U'
  return <div style={{ width: 220, minWidth: 220, height: '100vh', position: 'fixed', left: 0, top: 0, background: S.bgDeep, borderRight: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto', zIndex: 50 }}>
    <div style={{ padding: '18px 16px 14px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ width: 27, height: 27, background: S.accent, borderRadius: 3, display: 'grid', placeItems: 'center', fontFamily: S.mono, fontSize: 11, fontWeight: 700, color: '#fff' }}>V</div>
      <span style={{ fontFamily: S.mono, fontSize: 12, fontWeight: 600, color: S.text }}>Console</span>
      <span style={{ marginLeft: 'auto', fontFamily: S.mono, fontSize: 9, background: S.accentDim, color: S.accent, padding: '2px 5px', borderRadius: 2 }}>API</span>
    </div>
    <nav style={{ padding: '10px 8px 0', flex: 1 }}>{NAV_ITEMS.map((item, i) => item.section
      ? <p key={i} style={{ fontFamily: S.mono, fontSize: 9, color: S.text3, letterSpacing: '.12em', textTransform: 'uppercase', padding: '14px 8px 6px' }}>{item.section}</p>
      : <button key={item.id} onClick={() => nav(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', borderRadius: 4, margin: '1px 0', border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left', background: page === item.id ? S.accentDim : 'transparent', color: page === item.id ? S.accent : S.text2 }}>
          <span style={{ fontFamily: S.mono }}>{item.icon}</span>{item.label}{item.id === 'logs' && logErrors > 0 ? <span style={{ marginLeft: 'auto', color: S.red }}>{logErrors}</span> : null}
        </button>)}</nav>
    <div style={{ padding: 10, borderTop: `1px solid ${S.border}` }}>
      <div onClick={() => nav('settings')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: S.card, borderRadius: 4, cursor: 'pointer', border: `1px solid ${S.border}` }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: S.accentDim, display: 'grid', placeItems: 'center', color: S.accent }}>{initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, color: S.text }}>{auth?.firstName || 'User'}</div><div style={{ fontFamily: S.mono, fontSize: 9, color: S.accent, textTransform: 'uppercase' }}>{auth?.tier || 'free'}</div></div>
      </div>
      <a href="https://valcr.site/dashboard" style={{ display: 'block', marginTop: 8, padding: '6px 10px', color: S.text3, textDecoration: 'none', fontFamily: S.mono, fontSize: 10 }}>↗ Valcr account</a>
      <button onClick={logout} style={{ width: '100%', marginTop: 2, padding: '6px 10px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: S.mono, fontSize: 10, color: S.text3, textAlign: 'left' }}>⇥ Sign out</button>
    </div>
  </div>
}
