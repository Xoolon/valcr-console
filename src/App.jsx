// src/App.jsx  — Valcr Console  (React 18 + Vite)
// Self-contained: state, auth, routing, all pages in one file.
// Deploy as a separate Vite project at valcr-console.valcr.site
// Shares credentials with main Valcr app but has its own auth pages.

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'

// ─── Config ────────────────────────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000   // 30 days

// ─── Auth Context ──────────────────────────────────────────────────────────
const AuthCtx = createContext(null)
function useAuth() { return useContext(AuthCtx) }

function AuthProvider({ children }) {
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem('vcr_console_auth') || 'null') } catch { return null }
  })()
  const [auth, setAuth] = useState(stored)
  const [restoring, setRestoring] = useState(!!stored?.token)

  useEffect(() => {
    if (!stored?.token) { setRestoring(false); return }
    if (stored.expiresAt && Date.now() > stored.expiresAt) { logout(); return }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${stored.token}` } })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => { setAuth(prev => ({ ...prev, ...mapUser(d) })); setRestoring(false) })
      .catch(() => { logout(); setRestoring(false) })
  }, [])

  const login = useCallback(async (email, password) => {
    const r = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || 'Invalid credentials') }
    const d = await r.json()
    const session = { token: d.access_token, expiresAt: Date.now() + TOKEN_TTL, ...mapUser(d.user || d) }
    localStorage.setItem('vcr_console_auth', JSON.stringify(session))
    setAuth(session)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('vcr_console_auth')
    setAuth(null)
  }, [])

  return <AuthCtx.Provider value={{ auth, login, logout, restoring }}>{children}</AuthCtx.Provider>
}

function mapUser(d) {
  return {
    id:        d?.id || '',
    email:     d?.email || '',
    firstName: d?.first_name || d?.firstName || '',
    tier:      d?.account_tier || d?.accountTier || 'developer',
    isAdmin:   d?.is_admin || d?.isAdmin || false,
  }
}

// ─── Router (hash-based, no React Router dep needed) ──────────────────────
function useRoute() {
  const [page, setPage] = useState(() => window.location.hash.replace('#', '') || 'overview')
  useEffect(() => {
    const h = () => setPage(window.location.hash.replace('#', '') || 'overview')
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  const nav = useCallback((p) => { window.location.hash = p }, [])
  return { page, nav }
}

// ─── Demo seed data ────────────────────────────────────────────────────────
function buildDemoData() {
  const endpoints = [
    '/benchmarks', '/benchmarks/percentile', '/benchmarks/distribution',
    '/benchmarks/history', '/merchant/vcfs', '/merchant/score',
    '/merchant/insights', '/segments', '/metrics', '/health',
  ]
  const statuses = [200,200,200,200,200,200,201,401,404,429,500]
  const now = Date.now()
  const logs = Array.from({ length: 80 }, (_, i) => {
    const ts   = new Date(now - i * 73000 - Math.random() * 40000)
    const ep   = endpoints[Math.floor(Math.random() * endpoints.length)]
    const code = statuses[Math.floor(Math.random() * statuses.length)]
    return { ts, endpoint: ep, status: code, ms: Math.floor(Math.random() * 180 + 18), key: i % 3 === 0 ? 'vcr_live_pro_9x8w' : 'vcr_live_pro_4f8a' }
  }).sort((a, b) => b.ts - a.ts)

  return {
    keys: [
      { id: 'k1', name: 'Production underwriting', prefix: 'vcr_live_pro_4f8a', env: 'live', tier: 'growth', scopes: ['benchmarks:read','merchant:read','score:read','insights:read'], created: '2026-04-01', lastUsed: '2026-06-11', callsToday: 1247, callsMonth: 38420, active: true },
      { id: 'k2', name: 'Internal analytics', prefix: 'vcr_live_pro_9x8w', env: 'live', tier: 'growth', scopes: ['benchmarks:read','segments:read','compare:read'], created: '2026-05-12', lastUsed: '2026-06-10', callsToday: 83, callsMonth: 2100, active: true },
      { id: 'k3', name: 'Staging / CI', prefix: 'vcr_test_dev_2a3b', env: 'test', tier: 'developer', scopes: ['benchmarks:read','segments:read'], created: '2026-06-01', lastUsed: '2026-06-11', callsToday: 4, callsMonth: 60, active: true },
    ],
    logs,
    usage: {
      today: 1330, dailyLimit: 50000, month: 40580, prevMonth: 33400, latency: 48,
      byEndpoint: [
        { ep: '/benchmarks',            calls: 18400, pct: 45 },
        { ep: '/benchmarks/percentile', calls: 12200, pct: 30 },
        { ep: '/merchant/vcfs',         calls:  6100, pct: 15 },
        { ep: '/merchant/score',        calls:  2440, pct:  6 },
        { ep: '/merchant/insights',     calls:  1440, pct:  4 },
      ],
      byKey: [
        { name: 'Production underwriting', calls: 38420 },
        { name: 'Internal analytics',      calls:  2100 },
        { name: 'Staging / CI',            calls:    60 },
      ],
      codes: [
        { code: '200', calls: 38920, pct: 95.8, col: '#34D399' },
        { code: '401', calls:   640, pct:  1.6, col: '#F59E0B' },
        { code: '404', calls:   480, pct:  1.2, col: '#F59E0B' },
        { code: '429', calls:   360, pct:  0.9, col: '#FF6B6B' },
        { code: '500', calls:   180, pct:  0.4, col: '#FF6B6B' },
      ],
    },
    invoices: [
      { date: '2026-06-01', id: 'INV-2026-06', amount: '$499.00', status: 'Paid' },
      { date: '2026-05-01', id: 'INV-2026-05', amount: '$499.00', status: 'Paid' },
      { date: '2026-04-01', id: 'INV-2026-04', amount: '$499.00', status: 'Paid' },
      { date: '2026-03-01', id: 'INV-2026-03', amount: '$249.00', status: 'Paid' },
    ],
  }
}

// ─── Toast ─────────────────────────────────────────────────────────────────
const ToastCtx = createContext(null)
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3400)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: '#111827', border: `1px solid ${t.type === 'error' ? '#FF6B6B' : t.type === 'success' ? '#34D399' : '#4B9EFF'}`, borderLeft: `3px solid ${t.type === 'error' ? '#FF6B6B' : t.type === 'success' ? '#34D399' : '#4B9EFF'}`, borderRadius: 4, padding: '9px 14px', fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: '#E8F4FF', display: 'flex', alignItems: 'center', gap: 8, minWidth: 240, animation: 'toastIn .18s ease' }}>
            {t.type === 'success' && '✓'}{t.type === 'error' && '✗'}{t.type === 'info' && '·'} {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
function useToast() { return useContext(ToastCtx) }

// ─── Shared UI atoms ───────────────────────────────────────────────────────
const S = {
  bg:        '#080B10',
  bgDeep:    '#050709',
  surface:   '#0D1929',
  card:      '#111827',
  cardAlt:   '#0F1E35',
  border:    '#1E3054',
  borderHi:  '#2A4070',
  text:      '#E8F4FF',
  text2:     '#8BA7C7',
  text3:     '#4A6480',
  accent:    '#4B9EFF',
  accentHi:  '#6DB3FF',
  accentDim: '#1A3A6B',
  green:     '#34D399',
  greenDim:  '#0F3D29',
  red:       '#FF6B6B',
  redDim:    '#3D1515',
  amber:     '#F59E0B',
  amberDim:  '#3D2A05',
  purple:    '#A78BFA',
  mono:      'JetBrains Mono,monospace',
  body:      'Inter,-apple-system,sans-serif',
}

function Badge({ children, color = 'blue' }) {
  const map = {
    blue:   { bg: S.accentDim, fg: S.accent },
    green:  { bg: S.greenDim,  fg: S.green  },
    red:    { bg: S.redDim,    fg: S.red    },
    amber:  { bg: S.amberDim,  fg: S.amber  },
    purple: { bg: 'rgba(167,139,250,.12)', fg: S.purple },
    gray:   { bg: S.surface,   fg: S.text3, border: `1px solid ${S.border}` },
  }
  const c = map[color] || map.blue
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: S.mono, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 2, letterSpacing: '.04em', background: c.bg, color: c.fg, border: c.border || 'none' }}>
      {children}
    </span>
  )
}

function Btn({ children, variant = 'primary', size = 'md', onClick, disabled, style = {} }) {
  const base = { display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 4, fontFamily: S.body, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, border: 'none', transition: 'all .12s', ...style }
  const sizes = { sm: { padding: '5px 10px', fontSize: 12 }, md: { padding: '8px 14px', fontSize: 13 }, lg: { padding: '11px 20px', fontSize: 14 } }
  const variants = {
    primary:   { background: S.accent, color: '#fff' },
    secondary: { background: S.card, color: S.text2, border: `1px solid ${S.border}` },
    danger:    { background: S.redDim, color: S.red, border: '1px solid rgba(255,107,107,.2)' },
    ghost:     { background: 'transparent', color: S.text3 },
  }
  return (
    <button style={{ ...base, ...sizes[size], ...variants[variant] }} onClick={disabled ? undefined : onClick} disabled={disabled}>
      {children}
    </button>
  )
}

function Input({ label, hint, mono, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: S.text2, marginBottom: 6 }}>{label}</label>}
      <input {...props} style={{ width: '100%', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, padding: '9px 12px', fontSize: 13, color: S.text, fontFamily: mono ? S.mono : S.body, outline: 'none', boxSizing: 'border-box', ...(props.style || {}) }}
        onFocus={e => e.target.style.borderColor = S.accent}
        onBlur={e => e.target.style.borderColor = S.border} />
      {hint && <p style={{ fontSize: 11, color: S.text3, marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: S.text2, marginBottom: 6 }}>{label}</label>}
      <select {...props} style={{ width: '100%', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, padding: '9px 12px', fontSize: 13, color: S.text, fontFamily: S.body, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
        {children}
      </select>
    </div>
  )
}

function Card({ children, style = {} }) {
  return <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 4, padding: 20, ...style }}>{children}</div>
}

function Divider({ style = {} }) {
  return <div style={{ height: 1, background: S.border, margin: '20px 0', ...style }} />
}

function Label({ children }) {
  return <p style={{ fontFamily: S.mono, fontSize: 10, color: S.text3, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>{children}</p>
}

function Mono({ children, style = {} }) {
  return <span style={{ fontFamily: S.mono, ...style }}>{children}</span>
}

function UsageBar({ label, val, max, color = S.accent, right }) {
  const pct = max ? Math.min(Math.round((val / max) * 100), 100) : 0
  const fillColor = pct > 80 ? S.amber : color
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: S.mono, fontSize: 11, color: S.text2 }}>{label}</span>
        <span style={{ fontFamily: S.mono, fontSize: 11, color: S.text3 }}>{right}</span>
      </div>
      <div style={{ height: 5, background: S.surface, borderRadius: 3, overflow: 'hidden', border: `1px solid ${S.border}` }}>
        <div style={{ height: '100%', width: `${pct}%`, background: fillColor, borderRadius: 3, transition: 'width .6s ease' }} />
      </div>
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, sub, children, danger }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,7,9,.88)', backdropFilter: 'blur(5px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: S.card, border: `1px solid ${danger ? 'rgba(255,107,107,.4)' : S.borderHi}`, borderRadius: 8, padding: 28, width: '100%', maxWidth: 480, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: S.text3, cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}>✕</button>
        <p style={{ fontSize: 15, fontWeight: 700, color: S.text, marginBottom: 4 }}>{title}</p>
        {sub && <p style={{ fontSize: 12, color: S.text2, marginBottom: 20 }}>{sub}</p>}
        {children}
      </div>
    </div>
  )
}

// ─── Sparkline ─────────────────────────────────────────────────────────────
function Sparkline({ data }) {
  const W = 400, H = 52, pad = 3
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => [pad + (i / (data.length - 1)) * (W - pad * 2), H - pad - (v / max) * (H - pad * 2)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 52 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={S.accent} stopOpacity=".22" />
          <stop offset="100%" stopColor={S.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <path d={line} fill="none" stroke={S.accent} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={S.accent} />
    </svg>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  AUTH PAGES
// ────────────────────────────────────────────────────────────────────────────
function AuthLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: S.body }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36, justifyContent: 'center' }}>
          <div style={{ width: 30, height: 30, background: S.accent, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: S.mono, fontSize: 12, fontWeight: 700, color: '#fff' }}>V</div>
          <span style={{ fontFamily: S.mono, fontSize: 14, fontWeight: 600, letterSpacing: '.05em', color: S.text }}>Valcr Console</span>
          <span style={{ fontFamily: S.mono, fontSize: 9, background: S.accentDim, color: S.accent, padding: '2px 6px', borderRadius: 2 }}>API</span>
        </div>
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '32px 36px' }}>
          {children}
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, fontFamily: S.mono, color: S.text3, marginTop: 20 }}>
          Valcr Console · <a href="https://valcr.site" style={{ color: S.accent }}>valcr.site</a>
        </p>
      </div>
    </div>
  )
}

function LoginPage({ onSignup }) {
  const { login } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!email || !password) { setError('Email and password required.'); return }
    setLoading(true); setError('')
    try {
      await login(email, password)
    } catch (e) {
      setError(e.message || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <AuthLayout>
      <p style={{ fontSize: 17, fontWeight: 700, color: S.text, marginBottom: 4 }}>Sign in</p>
      <p style={{ fontSize: 12, color: S.text3, marginBottom: 24 }}>Access your API keys, usage data, and documentation.</p>
      <Input label="Email" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
      <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
      {error && <div style={{ background: S.redDim, border: '1px solid rgba(255,107,107,.2)', borderRadius: 4, padding: '9px 12px', fontFamily: S.mono, fontSize: 11, color: S.red, marginBottom: 14 }}>{error}</div>}
      <Btn variant="primary" onClick={submit} disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '10px 0', marginBottom: 14 }}>
        {loading ? 'Signing in…' : 'Sign in to Console'}
      </Btn>
      <p style={{ textAlign: 'center', fontSize: 12, color: S.text3 }}>
        No account? <button onClick={onSignup} style={{ background: 'none', border: 'none', color: S.accent, cursor: 'pointer', fontSize: 12 }}>Create one</button>
      </p>
    </AuthLayout>
  )
}

function SignupPage({ onLogin }) {
  const { login } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ firstName: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const submit = async () => {
    if (!form.email || !form.password || !form.firstName) { setError('All fields required.'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: form.firstName, email: form.email, password: form.password }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Registration failed') }
      await login(form.email, form.password)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  return (
    <AuthLayout>
      <p style={{ fontSize: 17, fontWeight: 700, color: S.text, marginBottom: 4 }}>Create account</p>
      <p style={{ fontSize: 12, color: S.text3, marginBottom: 24 }}>Get API access to Valcr benchmark intelligence.</p>
      <Input label="First name" placeholder="Glen" value={form.firstName} onChange={set('firstName')} />
      <Input label="Email" type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} />
      <Input label="Password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={set('password')} />
      <Input label="Confirm password" type="password" placeholder="••••••••" value={form.confirm} onChange={set('confirm')} style={{ marginBottom: 4 }} />
      {error && <div style={{ background: S.redDim, border: '1px solid rgba(255,107,107,.2)', borderRadius: 4, padding: '9px 12px', fontFamily: S.mono, fontSize: 11, color: S.red, marginBottom: 14 }}>{error}</div>}
      <Btn variant="primary" onClick={submit} disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '10px 0', marginBottom: 14 }}>
        {loading ? 'Creating account…' : 'Create account'}
      </Btn>
      <p style={{ textAlign: 'center', fontSize: 12, color: S.text3 }}>
        Have an account? <button onClick={onLogin} style={{ background: 'none', border: 'none', color: S.accent, cursor: 'pointer', fontSize: 12 }}>Sign in</button>
      </p>
    </AuthLayout>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  CONSOLE SHELL
// ────────────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { section: 'Overview' },
  { id: 'overview',     label: 'Overview',     icon: '▪' },
  { section: 'API' },
  { id: 'keys',         label: 'API Keys',     icon: '⌗' },
  { id: 'endpoints',    label: 'Endpoints',    icon: '⌥' },
  { id: 'logs',         label: 'Request Logs', icon: '≡' },
  { section: 'Usage' },
  { id: 'usage',        label: 'Usage & Quota', icon: '↗' },
  { id: 'billing',      label: 'Billing',      icon: '▤' },
  { section: 'Docs' },
  { id: 'quickstart',   label: 'Quickstart',   icon: '▶' },
  { id: 'webhooks',     label: 'Webhooks',     icon: '⌀' },
]

function Sidebar({ page, nav, auth, logout, logErrors }) {
  const initial = auth?.firstName?.[0]?.toUpperCase() || 'U'
  return (
    <div style={{ width: 220, minWidth: 220, height: '100vh', position: 'fixed', left: 0, top: 0, background: S.bgDeep, borderRight: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto', zIndex: 50 }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 27, height: 27, background: S.accent, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: S.mono, fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>V</div>
        <span style={{ fontFamily: S.mono, fontSize: 12, fontWeight: 600, letterSpacing: '.05em', color: S.text }}>Console</span>
        <span style={{ marginLeft: 'auto', fontFamily: S.mono, fontSize: 9, background: S.accentDim, color: S.accent, padding: '2px 5px', borderRadius: 2 }}>API</span>
      </div>

      {/* Nav */}
      <div style={{ padding: '10px 8px 0', flex: 1 }}>
        {NAV_ITEMS.map((item, i) => {
          if (item.section) return (
            <p key={i} style={{ fontFamily: S.mono, fontSize: 9, color: S.text3, letterSpacing: '.12em', textTransform: 'uppercase', padding: '14px 8px 6px' }}>{item.section}</p>
          )
          const active = page === item.id
          return (
            <button key={item.id} onClick={() => nav(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px',
              borderRadius: 4, margin: '1px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: S.body, fontWeight: 500, textAlign: 'left',
              background: active ? S.accentDim : 'transparent',
              color: active ? S.accent : S.text2,
              transition: 'all .1s',
            }}>
              <span style={{ fontFamily: S.mono, fontSize: 13, opacity: .8 }}>{item.icon}</span>
              {item.label}
              {item.id === 'logs' && logErrors > 0 && (
                <span style={{ marginLeft: 'auto', fontFamily: S.mono, fontSize: 9, background: S.redDim, color: S.red, padding: '1px 5px', borderRadius: 2 }}>{logErrors}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* User */}
      <div style={{ padding: 10, borderTop: `1px solid ${S.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: S.card, borderRadius: 4, cursor: 'pointer', border: `1px solid ${S.border}` }}
          onClick={() => nav('settings')}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: S.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: S.mono, fontSize: 10, fontWeight: 700, color: S.accent, flexShrink: 0 }}>{initial}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{auth?.firstName || 'User'}</div>
            <div style={{ fontFamily: S.mono, fontSize: 9, color: S.accent, textTransform: 'uppercase', letterSpacing: '.06em' }}>{auth?.tier || 'free'}</div>
          </div>
          <span style={{ fontSize: 10, color: S.text3 }}>⚙</span>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  PAGE: OVERVIEW
// ────────────────────────────────────────────────────────────────────────────
function OverviewPage({ data, auth }) {
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const sparkData = Array.from({ length: 14 }, (_, i) => Math.round(1100 + Math.sin(i * .7) * 380 + Math.random() * 280))
  const u = data.usage
  const delta = Math.round((u.month - u.prevMonth) / u.prevMonth * 100)
  const d14 = new Date(); d14.setDate(d14.getDate() - 13)
  const activeKeys = data.keys.filter(k => k.active).length

  return (
    <div>
      <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 2 }}>Overview</p>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 28 }}>{greet}, {auth?.firstName || 'there'}</p>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'API calls today',   value: u.today.toLocaleString(),  sub: `of ${u.dailyLimit.toLocaleString()} daily limit` },
          { label: 'This month',        value: u.month.toLocaleString(),  sub: `+${delta}% vs last month`, subCol: S.green },
          { label: 'Active keys',       value: activeKeys,                sub: `${[...new Set(data.keys.map(k=>k.env))].length} environments` },
          { label: 'Avg latency',       value: `${u.latency}ms`,          sub: 'last 100 requests' },
        ].map(t => (
          <div key={t.label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 4, padding: '16px 18px' }}>
            <Label>{t.label}</Label>
            <p style={{ fontFamily: S.mono, fontSize: 24, fontWeight: 700, color: S.text, lineHeight: 1, marginBottom: 4 }}>{t.value}</p>
            <p style={{ fontFamily: S.mono, fontSize: 11, color: t.subCol || S.text3 }}>{t.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Sparkline */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: S.text }}>Calls — last 14 days</p>
            <Badge color="green"><span style={{ width: 5, height: 5, borderRadius: '50%', background: S.green, display: 'inline-block', marginRight: 4, boxShadow: `0 0 5px ${S.green}` }} />Live</Badge>
          </div>
          <Sparkline data={sparkData} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <Mono style={{ fontSize: 10, color: S.text3 }}>{d14.toLocaleDateString('en',{month:'short',day:'numeric'})}</Mono>
            <Mono style={{ fontSize: 10, color: S.text3 }}>Today</Mono>
          </div>
        </Card>

        {/* Endpoint breakdown */}
        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 14 }}>Top endpoints</p>
          {u.byEndpoint.map(e => (
            <UsageBar key={e.ep} label={e.ep} val={e.pct} max={100} right={e.calls.toLocaleString()} />
          ))}
        </Card>
      </div>

      {/* Recent log */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${S.border}` }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: S.text }}>Recent requests</p>
        </div>
        {data.logs.slice(0, 8).map((l, i) => <LogRow key={i} log={l} />)}
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  PAGE: API KEYS
// ────────────────────────────────────────────────────────────────────────────
const ALL_SCOPES = ['benchmarks:read','segments:read','merchant:read','merchant:write','insights:read','compare:read','score:read','report:read','export:read']

function KeysPage({ data, setData }) {
  const toast = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [revealOpen, setRevealOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [activeKey, setActiveKey] = useState(null)
  const [revealedKey, setRevealedKey] = useState('')
  const [newKeyForm, setNewKeyForm] = useState({ name: '', env: 'live', scopes: ['benchmarks:read','merchant:read','score:read'] })
  const [copiedId, setCopiedId] = useState(null)

  const createKey = () => {
    if (!newKeyForm.name.trim()) { toast('Enter a key name', 'error'); return }
    const rand = Array.from({length:32},()=>'0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random()*36)]).join('')
    const full = `vcr_${newKeyForm.env}_pro_${rand}`
    const prefix = `vcr_${newKeyForm.env}_pro_${rand.slice(0,4)}`
    const k = { id: 'k'+Date.now(), name: newKeyForm.name, prefix, env: newKeyForm.env, tier: 'growth', scopes: newKeyForm.scopes, created: new Date().toISOString().slice(0,10), lastUsed: '—', callsToday: 0, callsMonth: 0, active: true }
    setData(p => ({ ...p, keys: [...p.keys, k] }))
    setRevealedKey(full)
    setCreateOpen(false)
    setRevealOpen(true)
    setNewKeyForm({ name: '', env: 'live', scopes: ['benchmarks:read','merchant:read','score:read'] })
  }

  const copyKey = (id, val) => {
    navigator.clipboard.writeText(val).catch(()=>{})
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast('Copied to clipboard', 'success')
  }

  const rotateKey = () => {
    setData(p => ({ ...p, keys: p.keys.map(k => k.id === activeKey?.id ? { ...k, prefix: k.prefix.slice(0,15) + Array.from({length:4},()=>'0123456789abcdef'[Math.floor(Math.random()*16)]).join('') } : k) }))
    setRotateOpen(false)
    toast('Key rotated. Update your integration.', 'success')
  }

  const deleteKey = () => {
    setData(p => ({ ...p, keys: p.keys.filter(k => k.id !== activeKey?.id) }))
    setDeleteOpen(false)
    toast('Key revoked permanently', 'success')
  }

  const live = data.keys.filter(k => k.env === 'live' && k.active)
  const test = data.keys.filter(k => k.env === 'test' && k.active)

  const KeyRow = ({ k }) => (
    <div style={{ background: copiedId === k.id ? 'rgba(52,211,153,.04)' : S.surface, border: `1px solid ${copiedId === k.id ? S.green : S.border}`, borderRadius: 4, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 12, transition: 'all .2s' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{k.name}</span>
          <Badge color={k.env === 'live' ? 'green' : 'amber'}>{k.env}</Badge>
        </div>
        <div style={{ fontFamily: S.mono, fontSize: 12, color: S.text, marginBottom: 6 }}>
          {k.prefix}••••••••••••••••••••••••
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {k.scopes.slice(0,4).map(s => <Badge key={s} color="blue">{s}</Badge>)}
          {k.scopes.length > 4 && <Badge color="gray">+{k.scopes.length-4}</Badge>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontFamily: S.mono, fontSize: 10, color: S.text3, marginBottom: 2 }}>{k.callsToday.toLocaleString()} calls today</p>
        <p style={{ fontFamily: S.mono, fontSize: 10, color: S.text3, marginBottom: 8 }}>Last used {k.lastUsed}</p>
        <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
          <Btn size="sm" variant="secondary" onClick={() => copyKey(k.id, k.prefix+'_DEMO_ONLY')} style={{ fontFamily: S.mono, fontSize: 10 }}>
            {copiedId === k.id ? '✓ Copied' : 'Copy'}
          </Btn>
          <Btn size="sm" variant="secondary" onClick={() => { setActiveKey(k); setRotateOpen(true) }} style={{ fontFamily: S.mono, fontSize: 10 }}>Rotate</Btn>
          <Btn size="sm" variant="danger" onClick={() => { setActiveKey(k); setDeleteOpen(true) }} style={{ fontFamily: S.mono, fontSize: 10 }}>Revoke</Btn>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 2 }}>API Keys</p>
          <p style={{ fontSize: 13, color: S.text2 }}>Keys authenticate every request. Never expose them in client-side code.</p>
        </div>
        <Btn variant="primary" onClick={() => setCreateOpen(true)}>+ New key</Btn>
      </div>

      {/* Security notice */}
      <div style={{ background: S.amberDim, border: '1px solid rgba(245,158,11,.2)', borderRadius: 4, padding: '10px 14px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ color: S.amber, fontSize: 13, flexShrink: 0 }}>⚠</span>
        <p style={{ fontSize: 12, color: S.amber }}>Keys are shown in full only at creation. We store a SHA-256 hash — never the plaintext. If you lose a key, rotate it.</p>
      </div>

      {/* Live keys */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Label>Live keys</Label>
          <Mono style={{ fontSize: 10, color: S.text3 }}>{live.length} key{live.length !== 1 ? 's' : ''}</Mono>
        </div>
        {live.length ? live.map(k => <KeyRow key={k.id} k={k} />) : <p style={{ color: S.text3, fontSize: 13, padding: '12px 0' }}>No live keys yet.</p>}
      </div>

      {/* Test keys */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Label>Test keys</Label>
          <Mono style={{ fontSize: 10, color: S.text3 }}>{test.length} key{test.length !== 1 ? 's' : ''}</Mono>
        </div>
        {test.length ? test.map(k => <KeyRow key={k.id} k={k} />) : <p style={{ color: S.text3, fontSize: 13, padding: '12px 0' }}>No test keys yet.</p>}
      </div>

      <Divider />
      <Card style={{ background: S.surface }}>
        <Label>Key security policy</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          {['Keys hash-stored (SHA-256)','TLS required on all requests','Per-minute rate limiting (Redis)','Anomaly detection on usage spikes','Full audit log per request','Scope enforcement at endpoint level'].map(f => (
            <p key={f} style={{ fontSize: 12, color: S.text2 }}>✓ {f}</p>
          ))}
        </div>
      </Card>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create API key" sub="Keys are shown once — copy and store securely.">
        <Input label="Key name" placeholder="e.g. Production underwriting" value={newKeyForm.name} onChange={e => setNewKeyForm(p=>({...p,name:e.target.value}))} />
        <Select label="Environment" value={newKeyForm.env} onChange={e => setNewKeyForm(p=>({...p,env:e.target.value}))}>
          <option value="live">Live</option>
          <option value="test">Test</option>
        </Select>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: S.text2, marginBottom: 8 }}>Scopes</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {ALL_SCOPES.map(sc => (
              <label key={sc} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: S.text2, cursor: 'pointer' }}>
                <input type="checkbox" checked={newKeyForm.scopes.includes(sc)}
                  onChange={e => setNewKeyForm(p => ({ ...p, scopes: e.target.checked ? [...p.scopes,sc] : p.scopes.filter(s=>s!==sc) }))}
                  style={{ accentColor: S.accent }} />
                {sc}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" onClick={() => setCreateOpen(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
          <Btn variant="primary" onClick={createKey} style={{ flex: 1, justifyContent: 'center' }}>Generate key</Btn>
        </div>
      </Modal>

      {/* Reveal modal */}
      <Modal open={revealOpen} onClose={() => setRevealOpen(false)} title="Save your API key" sub="This key will not be shown again. Copy it now.">
        <div style={{ background: S.bg, border: `1px solid ${S.green}`, borderRadius: 4, padding: 14, marginBottom: 16 }}>
          <Label>New key</Label>
          <p style={{ fontFamily: S.mono, fontSize: 12, color: S.green, wordBreak: 'break-all', lineHeight: 1.7 }}>{revealedKey}</p>
        </div>
        <Btn variant="primary" onClick={() => { navigator.clipboard.writeText(revealedKey).catch(()=>{}); toast('Copied', 'success') }} style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}>Copy key</Btn>
        <Btn variant="secondary" onClick={() => setRevealOpen(false)} style={{ width: '100%', justifyContent: 'center' }}>Done — I've saved it</Btn>
      </Modal>

      {/* Rotate modal */}
      <Modal open={rotateOpen} onClose={() => setRotateOpen(false)} title="Rotate key" sub="The current key is revoked immediately. Update your integration before rotating." danger>
        <div style={{ background: S.redDim, border: '1px solid rgba(255,107,107,.2)', borderRadius: 4, padding: 12, marginBottom: 20 }}>
          <p style={{ fontFamily: S.mono, fontSize: 11, color: S.red }}>Revoking: {activeKey?.prefix}••••••••••</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" onClick={() => setRotateOpen(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
          <Btn variant="danger" onClick={rotateKey} style={{ flex: 1, justifyContent: 'center' }}>Rotate key</Btn>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Revoke key" sub="This is permanent. Any integration using this key will stop working immediately." danger>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" onClick={() => setDeleteOpen(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
          <Btn variant="danger" onClick={deleteKey} style={{ flex: 1, justifyContent: 'center' }}>Revoke permanently</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  PAGE: ENDPOINTS
// ────────────────────────────────────────────────────────────────────────────
const ENDPOINTS_DATA = [
  { method:'GET', path:'/benchmarks', desc:'Benchmark distribution for a metric', cats:['all','lenders','saas','dev'], scope:'benchmarks:read', tier:'developer',
    params:[{n:'segment',r:true,t:'string',d:'Segment key e.g. shopify_dtc_100k_500k_us_apparel'},{n:'metric',r:true,t:'string',d:'Metric key e.g. gross_margin_pct'},{n:'period',r:false,t:'string',d:'e.g. 2026-Q1 (default: latest)'}],
    resp:`{ "data": { "metric": "gross_margin_pct", "segment": "shopify_dtc_100k_500k_us_apparel", "sample_count": 1847, "confidence": "high", "distribution": { "p10": 18.2, "p25": 28.4, "p50": 38.9, "p75": 49.1, "p90": 61.3 } } }` },
  { method:'GET', path:'/benchmarks/percentile', desc:'Where a value sits in the distribution', cats:['all','lenders'], scope:'benchmarks:read', tier:'developer',
    params:[{n:'segment',r:true,t:'string',d:'Segment key'},{n:'metric',r:true,t:'string',d:'Metric key'},{n:'value',r:true,t:'number',d:'The value to rank'}],
    resp:`{ "data": { "value": 42.5, "percentile": 67, "interpretation": "above_median", "vs_median": 3.6, "p50": 38.9, "p75": 49.1 } }` },
  { method:'GET', path:'/benchmarks/distribution', desc:'Full p10–p90 curve for embedding in your UI', cats:['all','saas','dev'], scope:'benchmarks:read', tier:'developer',
    params:[{n:'segment',r:true,t:'string',d:'Segment key'},{n:'metric',r:true,t:'string',d:'Metric key'}], resp:'Same as /benchmarks' },
  { method:'GET', path:'/benchmarks/history', desc:'Historical p50 trend over time', cats:['all','saas','dev'], scope:'benchmarks:read', tier:'developer',
    params:[{n:'segment',r:true,t:'string',d:'Segment key'},{n:'metric',r:true,t:'string',d:'Metric key'},{n:'periods',r:false,t:'integer',d:'Max 24 (default 8)'}],
    resp:`{ "history": [{ "period": "2026-03-31", "p50": 37.4, "n": 1612 }, { "period": "2026-06-30", "p50": 38.9, "n": 1847 }] }` },
  { method:'GET', path:'/benchmarks/compare', desc:'Compare a metric across multiple segments', cats:['all','institutional'], scope:'compare:read', tier:'growth',
    params:[{n:'metric',r:true,t:'string',d:'Metric key'},{n:'segments',r:true,t:'string',d:'Comma-separated segment keys (max 6)'}],
    resp:`{ "comparison": [{ "segment": "shopify_dtc_100k_500k_us_apparel", "p50": 38.9, "n": 1847 }] }` },
  { method:'GET', path:'/benchmarks/segment_report', desc:'Full benchmark profile across all metrics — PE/VC due diligence', cats:['all','institutional'], scope:'report:read', tier:'enterprise',
    params:[{n:'segment',r:true,t:'string',d:'Segment key'}], resp:'All 19 metrics with full distribution for the segment' },
  { method:'GET', path:'/merchant/vcfs', desc:"Merchant VCFS financial records — lender baseline", cats:['all','lenders','operators'], scope:'merchant:read', tier:'startup',
    params:[{n:'merchant_id',r:true,t:'string',d:'Anonymised merchant ID (m_xxxxxxxx)'},{n:'period',r:false,t:'string',d:'last_3_months | last_12_months | last_24_months | 2026-Q1'}],
    resp:'Array of VCFS records with revenue, costs, derived, inventory objects' },
  { method:'POST', path:'/merchant/vcfs', desc:'Submit VCFS data programmatically', cats:['all','operators'], scope:'merchant:write', tier:'growth',
    params:[{n:'revenue',r:true,t:'object',d:'Revenue fields per VCFS schema'},{n:'costs',r:true,t:'object',d:'Cost fields per VCFS schema'},{n:'period_start',r:true,t:'string',d:'ISO 8601'},{n:'platform',r:true,t:'string',d:'shopify | etsy | amazon | manual'}],
    resp:`{ "queued": true, "job_id": "..." }` },
  { method:'GET', path:'/merchant/score', desc:'Valcr composite score — independent lender assessment', cats:['all','lenders'], scope:'score:read', tier:'growth',
    params:[{n:'merchant_id',r:true,t:'string',d:'Anonymised merchant ID'}],
    resp:`{ "valcr_score": { "composite": 72, "grade": "B+", "margin_score": 78, "efficiency_score": 71 } }` },
  { method:'GET', path:'/merchant/insights', desc:'AI-generated narrative insights (cached 24h)', cats:['all','operators'], scope:'insights:read', tier:'growth',
    params:[{n:'merchant_id',r:true,t:'string',d:'Anonymised merchant ID'},{n:'period',r:false,t:'string',d:'Period (default: latest)'}],
    resp:`{ "insights": "Full narrative text...", "cached": true }` },
  { method:'GET', path:'/merchant/vcfs/compare', desc:'Compare merchants on a metric — portfolio view', cats:['all','operators'], scope:'compare:read', tier:'growth',
    params:[{n:'merchant_ids',r:true,t:'string',d:'Comma-separated IDs (max 10)'},{n:'metric',r:false,t:'string',d:'Default: gross_margin_pct'}],
    resp:'Array of { merchant_id, value, segment, confidence }' },
  { method:'GET', path:'/merchant/alerts', desc:'Active performance alerts for a merchant', cats:['all','operators'], scope:'merchant:read', tier:'startup',
    params:[{n:'merchant_id',r:true,t:'string',d:'Anonymised merchant ID'}], resp:'Array of { metric, severity, message, triggered_at }' },
  { method:'GET', path:'/segments', desc:'List all segments with benchmark data', cats:['all','saas','dev'], scope:'segments:read', tier:'developer',
    params:[{n:'min_sample',r:false,t:'integer',d:'Min operator count (default 5)'},{n:'platform',r:false,t:'string',d:'Filter by platform'},{n:'geo',r:false,t:'string',d:'Filter by geo (us, gb, ca...)'}],
    resp:'Array of { segment_key, platform, operator_count, last_updated }' },
  { method:'GET', path:'/metrics', desc:'List all queryable VCFS metric keys', cats:['all','dev'], scope:'benchmarks:read', tier:'developer',
    params:[], resp:'Array of { key, label, unit, higher_better }' },
  { method:'GET', path:'/health', desc:'Validate your API key and check quota', cats:['all','dev'], scope:'—', tier:'developer',
    params:[], resp:`{ "status": "ok", "tier": "growth", "calls_remaining_today": 4847 }` },
]

const EP_TABS = ['all','lenders','operators','saas','institutional','dev']

function EndpointsPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [openIdx, setOpenIdx] = useState(null)
  const tierColor = { developer:'gray', startup:'blue', growth:'purple', enterprise:'amber' }

  const filtered = ENDPOINTS_DATA.filter(e => e.cats.includes(activeTab))

  return (
    <div>
      <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 2 }}>API Reference</p>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 20 }}>
        Base URL: <Mono style={{ color: S.accent, fontSize: 13 }}>https://api.valcr.site/data/v1</Mono>
        <span style={{ marginLeft: 16, color: S.text3 }}>Authorization: Bearer {'<api_key>'}</span>
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: 20, gap: 2 }}>
        {EP_TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 500, color: activeTab === t ? S.accent : S.text3, borderBottom: `2px solid ${activeTab === t ? S.accent : 'transparent'}`, marginBottom: -1, background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t ? S.accent : 'transparent'}`, cursor: 'pointer', fontFamily: S.body, textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {filtered.map((ep, i) => (
        <div key={i} style={{ border: `1px solid ${S.border}`, borderRadius: 4, marginBottom: 8, overflow: 'hidden' }}>
          <div onClick={() => setOpenIdx(openIdx === i ? null : i)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', cursor: 'pointer', background: S.card, userSelect: 'none' }}>
            <span style={{ fontFamily: S.mono, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 2, background: ep.method === 'GET' ? 'rgba(52,211,153,.12)' : 'rgba(75,158,255,.12)', color: ep.method === 'GET' ? S.green : S.accent, flexShrink: 0 }}>{ep.method}</span>
            <Mono style={{ fontSize: 12, color: S.text, flex: 1 }}>{ep.path}</Mono>
            <span style={{ fontSize: 12, color: S.text3, flex: 2 }}>{ep.desc}</span>
            <Badge color={tierColor[ep.tier] || 'gray'}>{ep.tier}</Badge>
            <span style={{ color: S.text3, fontSize: 11 }}>{openIdx === i ? '▲' : '▼'}</span>
          </div>
          {openIdx === i && (
            <div style={{ padding: 16, background: S.bgDeep, borderTop: `1px solid ${S.border}` }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <Badge color="blue">Scope: {ep.scope}</Badge>
                <Badge color={tierColor[ep.tier] || 'gray'}>Tier: {ep.tier}+</Badge>
              </div>
              {ep.params.length > 0 && <>
                <Label>Parameters</Label>
                <div style={{ border: `1px solid ${S.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 80px 1fr', gap: 12, padding: '7px 12px', background: S.surface }}>
                    {['Parameter','Type','Description'].map(h => <span key={h} style={{ fontFamily: S.mono, fontSize: 10, color: S.text3 }}>{h}</span>)}
                  </div>
                  {ep.params.map((p, j) => (
                    <div key={j} style={{ display: 'grid', gridTemplateColumns: '140px 80px 1fr', gap: 12, padding: '7px 12px', borderTop: `1px solid rgba(30,48,84,.4)` }}>
                      <span style={{ fontFamily: S.mono, fontSize: 11, color: S.text }}>
                        {p.n} {p.r && <span style={{ color: S.red, fontSize: 9, fontFamily: S.mono }}>*req</span>}
                      </span>
                      <span style={{ fontFamily: S.mono, fontSize: 10, color: S.purple }}>{p.t}</span>
                      <span style={{ fontSize: 12, color: S.text3 }}>{p.d}</span>
                    </div>
                  ))}
                </div>
              </>}
              <Label>Response</Label>
              <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 4, padding: 14, fontFamily: S.mono, fontSize: 11, color: S.text2, overflowX: 'auto', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {ep.resp}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  SHARED: LogRow
// ────────────────────────────────────────────────────────────────────────────
function LogRow({ log }) {
  const ts   = log.ts.toLocaleTimeString('en', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false })
  const date = log.ts.toLocaleDateString('en', { month:'short', day:'numeric' })
  const col  = log.status >= 500 ? S.red : log.status >= 400 ? S.amber : S.green
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: `1px solid rgba(30,48,84,.3)`, fontFamily: S.mono, fontSize: 11 }}>
      <span style={{ color: S.text3, whiteSpace: 'nowrap', minWidth: 110 }}>{date} {ts}</span>
      <span style={{ color: col, minWidth: 32, textAlign: 'center', fontWeight: 700 }}>{log.status}</span>
      <span style={{ color: S.text, flex: 1 }}>{log.endpoint}</span>
      <span style={{ color: S.text3, minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.key}</span>
      <span style={{ color: S.text3, textAlign: 'right', minWidth: 48 }}>{log.ms}ms</span>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  PAGE: LOGS
// ────────────────────────────────────────────────────────────────────────────
function LogsPage({ data }) {
  const [statusFilter, setStatusFilter] = useState('')
  const [epFilter, setEpFilter] = useState('')
  const filtered = data.logs.filter(l => {
    const sm = !statusFilter || String(l.status)[0] === statusFilter
    const em = !epFilter || l.endpoint === epFilter
    return sm && em
  })
  const uniqueEps = [...new Set(data.logs.map(l => l.endpoint))].sort()
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 2 }}>Request Logs</p>
          <p style={{ fontSize: 13, color: S.text2 }}>Last 500 requests · retained 90 days</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, padding: '8px 12px', fontSize: 12, color: S.text, fontFamily: S.body, outline: 'none', cursor: 'pointer' }}>
            <option value="">All statuses</option>
            <option value="2">2xx Success</option>
            <option value="4">4xx Client error</option>
            <option value="5">5xx Server error</option>
          </select>
          <select value={epFilter} onChange={e => setEpFilter(e.target.value)} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, padding: '8px 12px', fontSize: 12, color: S.text, fontFamily: S.body, outline: 'none', cursor: 'pointer' }}>
            <option value="">All endpoints</option>
            {uniqueEps.map(e => <option key={e}>{e}</option>)}
          </select>
        </div>
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 32px 1fr 120px 48px', gap: 12, padding: '8px 14px', background: S.surface, borderBottom: `1px solid ${S.border}` }}>
          {['Timestamp','','Endpoint','Key','ms'].map(h => <span key={h} style={{ fontFamily: S.mono, fontSize: 10, color: S.text3, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 500 }}>{h}</span>)}
        </div>
        {filtered.slice(0, 60).map((l, i) => <LogRow key={i} log={l} />)}
      </Card>
      <p style={{ fontSize: 11, fontFamily: S.mono, color: S.text3, marginTop: 10, textAlign: 'right' }}>
        Logs retained 90 days. <a href="#" style={{ color: S.accent }}>Export CSV</a>
      </p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  PAGE: USAGE
// ────────────────────────────────────────────────────────────────────────────
function UsagePage({ data }) {
  const u = data.usage
  const now = new Date()
  const periodLabel = now.toLocaleDateString('en', { month: 'long', year: 'numeric' })
  const todayPct = Math.round((u.today / u.dailyLimit) * 100)
  return (
    <div>
      <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 2 }}>Usage & Quota</p>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 24 }}>Quota resets midnight UTC. 1 call = 1 token.</p>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: S.text }}>Current billing period</p>
          <Mono style={{ fontSize: 11, color: S.text3 }}>{periodLabel}</Mono>
        </div>
        <UsageBar label="Today" val={u.today} max={u.dailyLimit} right={`${u.today.toLocaleString()} / ${u.dailyLimit.toLocaleString()}`} />
        <p style={{ fontFamily: S.mono, fontSize: 10, color: S.text3, marginBottom: 14 }}>{todayPct}% of daily limit used</p>
        <UsageBar label="This month" val={81} max={100} right={`${u.month.toLocaleString()} calls`} color={S.accent} />
        <p style={{ fontFamily: S.mono, fontSize: 10, color: S.text3 }}>Unlimited on Growth plan</p>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 14 }}>Calls by endpoint</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Endpoint','Calls','Share'].map(h => <th key={h} style={{ fontFamily: S.mono, fontSize: 10, color: S.text3, letterSpacing: '.08em', textTransform: 'uppercase', padding: '6px 8px', textAlign: 'left', borderBottom: `1px solid ${S.border}`, fontWeight: 500 }}>{h}</th>)}</tr></thead>
            <tbody>{u.byEndpoint.map((e,i) => (
              <tr key={i}><td style={{ padding: '9px 8px', fontFamily: S.mono, fontSize: 11, color: S.text, borderBottom: `1px solid rgba(30,48,84,.4)` }}>{e.ep}</td><td style={{ padding: '9px 8px', fontFamily: S.mono, fontSize: 11, color: S.text2, borderBottom: `1px solid rgba(30,48,84,.4)` }}>{e.calls.toLocaleString()}</td><td style={{ padding: '9px 8px', fontFamily: S.mono, fontSize: 11, color: S.text3, borderBottom: `1px solid rgba(30,48,84,.4)` }}>{e.pct}%</td></tr>
            ))}</tbody>
          </table>
        </Card>
        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 14 }}>Calls by key</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Key','Calls'].map(h => <th key={h} style={{ fontFamily: S.mono, fontSize: 10, color: S.text3, letterSpacing: '.08em', textTransform: 'uppercase', padding: '6px 8px', textAlign: 'left', borderBottom: `1px solid ${S.border}`, fontWeight: 500 }}>{h}</th>)}</tr></thead>
            <tbody>{u.byKey.map((k,i) => (
              <tr key={i}><td style={{ padding: '9px 8px', fontSize: 13, color: S.text2, borderBottom: `1px solid rgba(30,48,84,.4)` }}>{k.name}</td><td style={{ padding: '9px 8px', fontFamily: S.mono, fontSize: 12, color: S.text, borderBottom: `1px solid rgba(30,48,84,.4)` }}>{k.calls.toLocaleString()}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      </div>

      <Card>
        <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 14 }}>Response codes — this month</p>
        {u.codes.map(c => (
          <UsageBar key={c.code} label={c.code} val={c.pct} max={100} color={c.col} right={`${c.calls.toLocaleString()} (${c.pct}%)`} />
        ))}
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  PAGE: BILLING
// ────────────────────────────────────────────────────────────────────────────
const PLANS = [
  { name:'Developer', price:'Free', calls:'500/day', rate:'10/min', keys:'2', features:['Benchmark distributions','Segment discovery','History (8 periods)','Standard support'], tier:'developer', color: S.text3 },
  { name:'Startup',   price:'$99/mo', calls:'5k/day', rate:'30/min', keys:'5', features:['+ Merchant VCFS access','Alert endpoints','Priority email support'], tier:'startup', color: S.accent },
  { name:'Growth',    price:'$499/mo', calls:'50k/day', rate:'100/min', keys:'∞', features:['+ AI-powered insights','Compare endpoints','Slack support'], tier:'growth', color: S.purple, recommended: true },
  { name:'Enterprise',price:'Custom', calls:'Unlimited', rate:'500/min', keys:'∞', features:['+ Segment reports','SLA guarantee','Custom rate limits','Dedicated support'], tier:'enterprise', color: S.amber },
]

function BillingPage({ data }) {
  const toast = useToast()
  const plan = PLANS.find(p => p.tier === 'growth')
  return (
    <div>
      <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 2 }}>Billing</p>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 24 }}>Manage your plan and payment details.</p>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <Label>Current plan</Label>
            <p style={{ fontFamily: S.mono, fontSize: 22, fontWeight: 700, color: S.text }}>Growth</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Label>Next renewal</Label>
            <Mono style={{ fontSize: 13, color: S.text2 }}>2026-07-11</Mono>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, padding: '14px 0', borderTop: `1px solid ${S.border}`, borderBottom: `1px solid ${S.border}`, marginBottom: 14 }}>
          {[['Monthly calls','50,000'],['Rate limit','100/min'],['Keys','Unlimited'],['Scopes','All']].map(([l,v])=>(
            <div key={l}><Label>{l}</Label><Mono style={{ fontSize: 14, fontWeight: 600, color: S.text }}>{v}</Mono></div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary">Change plan</Btn>
          <Btn variant="ghost" onClick={() => toast('Contact glen@valcr.site to cancel','info')}>Cancel subscription</Btn>
        </div>
      </Card>

      {/* Plans grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {PLANS.map(p => (
          <div key={p.name} style={{ border: `1px solid ${p.recommended ? S.accent : S.border}`, borderRadius: 4, padding: 18, background: S.card, position: 'relative' }}>
            {p.recommended && <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: S.accent, color: '#fff', fontFamily: S.mono, fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: 2, whiteSpace: 'nowrap' }}>CURRENT</div>}
            <p style={{ fontFamily: S.mono, fontSize: 10, color: S.text3, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>{p.name}</p>
            <p style={{ fontFamily: S.mono, fontSize: 22, fontWeight: 700, color: S.text, lineHeight: 1, marginBottom: 12 }}>{p.price}</p>
            <Divider style={{ margin: '10px 0' }} />
            <div style={{ fontFamily: S.mono, fontSize: 10, color: S.text3, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 8px', marginBottom: 10 }}>
              <span>Calls</span><span style={{ color: S.text }}>{p.calls}</span>
              <span>Rate</span><span style={{ color: S.text }}>{p.rate}</span>
              <span>Keys</span><span style={{ color: S.text }}>{p.keys}</span>
            </div>
            {p.features.map(f => <p key={f} style={{ fontSize: 11, color: S.text2, marginBottom: 5 }}>✓ {f}</p>)}
            <Btn variant={p.recommended ? 'secondary' : 'primary'} onClick={() => !p.recommended && toast(`Contact glen@valcr.site for ${p.name}`, 'info')} disabled={p.recommended} style={{ width: '100%', justifyContent: 'center', marginTop: 12, fontSize: 12 }}>
              {p.recommended ? 'Current plan' : p.name === 'Enterprise' ? 'Contact us' : 'Upgrade'}
            </Btn>
          </div>
        ))}
      </div>

      {/* Invoices */}
      <Card>
        <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 14 }}>Invoice history</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Date','Invoice','Amount','Status',''].map(h=><th key={h} style={{ fontFamily: S.mono, fontSize: 10, color: S.text3, letterSpacing:'.08em', textTransform:'uppercase', padding:'6px 10px', textAlign:'left', borderBottom:`1px solid ${S.border}`, fontWeight:500 }}>{h}</th>)}</tr></thead>
          <tbody>{data.invoices.map((inv,i)=>(
            <tr key={i}>
              <td style={{ padding:'10px',fontFamily:S.mono,fontSize:12,color:S.text2,borderBottom:`1px solid rgba(30,48,84,.4)` }}>{inv.date}</td>
              <td style={{ padding:'10px',fontFamily:S.mono,fontSize:12,color:S.text,borderBottom:`1px solid rgba(30,48,84,.4)` }}>{inv.id}</td>
              <td style={{ padding:'10px',fontFamily:S.mono,fontSize:12,color:S.text,borderBottom:`1px solid rgba(30,48,84,.4)` }}>{inv.amount}</td>
              <td style={{ padding:'10px',borderBottom:`1px solid rgba(30,48,84,.4)` }}><Badge color="green">{inv.status}</Badge></td>
              <td style={{ padding:'10px',borderBottom:`1px solid rgba(30,48,84,.4)` }}><a href="#" style={{ color:S.accent,fontSize:12 }}>PDF</a></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  PAGE: QUICKSTART
// ────────────────────────────────────────────────────────────────────────────
const QS = {
  curl: [
    `# Step 1 — Set your API key\nexport VALCR_KEY="vcr_live_pro_your_key_here"`,
    `# Step 2 — Query a benchmark\ncurl -X GET \\\n  "https://api.valcr.site/data/v1/benchmarks" \\\n  -H "Authorization: Bearer $VALCR_KEY" \\\n  -G \\\n  -d "segment=shopify_dtc_100k_500k_us_apparel" \\\n  -d "metric=gross_margin_pct"`,
    `# Response\n{\n  "success": true,\n  "data": {\n    "metric": "gross_margin_pct",\n    "segment": "shopify_dtc_100k_500k_us_apparel",\n    "sample_count": 1847,\n    "confidence": "high",\n    "distribution": { "p10": 18.2, "p25": 28.4, "p50": 38.9, "p75": 49.1, "p90": 61.3 }\n  },\n  "meta": { "calls_remaining_today": 4847 }\n}`,
  ],
  python: [
    `# pip install requests\nimport requests\nVALCR_KEY = "vcr_live_pro_your_key_here"\nheaders = {"Authorization": f"Bearer {VALCR_KEY}"}`,
    `resp = requests.get(\n    "https://api.valcr.site/data/v1/benchmarks",\n    headers=headers,\n    params={\n        "segment": "shopify_dtc_100k_500k_us_apparel",\n        "metric":  "gross_margin_pct",\n    }\n)\ndata = resp.json()`,
    `# data["data"]["distribution"]["p50"]  →  38.9\n# data["meta"]["calls_remaining_today"]  →  4847`,
  ],
  javascript: [
    `// fetch (Node.js 18+ or browser)\nconst VALCR_KEY = "vcr_live_pro_your_key_here"\nconst headers  = { Authorization: \`Bearer \${VALCR_KEY}\` }`,
    `const res  = await fetch(\n  "https://api.valcr.site/data/v1/benchmarks?segment=shopify_dtc_100k_500k_us_apparel&metric=gross_margin_pct",\n  { headers }\n)\nconst { data } = await res.json()`,
    `// data.distribution.p50   →  38.9\n// data.sample_count       →  1847`,
  ],
  php: [
    `<?php\n$key     = 'vcr_live_pro_your_key_here';\n$headers = ['Authorization: Bearer ' . $key];`,
    `$url = 'https://api.valcr.site/data/v1/benchmarks?' . http_build_query([\n    'segment' => 'shopify_dtc_100k_500k_us_apparel',\n    'metric'  => 'gross_margin_pct',\n]);\n$ctx  = stream_context_create(['http' => ['header' => $headers]]);\n$data = json_decode(file_get_contents($url, false, $ctx));`,
    `// $data->data->distribution->p50  →  38.9`,
  ],
}

function QuickstartPage() {
  const [lang, setLang] = useState('curl')
  const code = QS[lang]
  return (
    <div>
      <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 2 }}>Quickstart</p>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 20 }}>Make your first API call in under 2 minutes.</p>
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, marginBottom: 24, gap: 2 }}>
        {Object.keys(QS).map(l => (
          <button key={l} onClick={() => setLang(l)} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 500, color: lang===l ? S.accent : S.text3, borderBottom: `2px solid ${lang===l ? S.accent : 'transparent'}`, marginBottom: -1, background: 'none', border: 'none', cursor: 'pointer', fontFamily: S.body, textTransform: 'capitalize' }}>{l}</button>
        ))}
      </div>
      {['Authenticate','Query a benchmark','Response'].map((title, i) => (
        <div key={i} style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: S.mono, fontSize: 10, color: S.text3, marginBottom: 8, letterSpacing: '.1em', textTransform: 'uppercase' }}>Step {i+1} — {title}</p>
          <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 4, padding: 14, fontFamily: S.mono, fontSize: 12, color: S.text2, lineHeight: 1.7, whiteSpace: 'pre', overflowX: 'auto' }}>
            {code[i]}
          </div>
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  PAGE: WEBHOOKS
// ────────────────────────────────────────────────────────────────────────────
const WEBHOOK_EVENTS = [
  { id:'benchmark.updated',       label:'benchmark.updated',        desc:'Benchmark data recomputed for any segment you have queried', on:true },
  { id:'quota.threshold_reached', label:'quota.threshold_reached',  desc:'Your daily quota reaches 80% — sent once per day',            on:true },
  { id:'quota.exceeded',          label:'quota.exceeded',           desc:'Your daily quota is reached',                                on:true },
  { id:'key.rotated',             label:'key.rotated',              desc:'One of your API keys is rotated',                            on:false },
  { id:'segment.new',             label:'segment.new',              desc:'A new segment reaches minimum sample threshold',              on:false },
]

function WebhooksPage() {
  const toast = useToast()
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState(WEBHOOK_EVENTS)
  const toggle = id => setEvents(e => e.map(ev => ev.id === id ? {...ev, on: !ev.on} : ev))
  return (
    <div>
      <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 2 }}>Webhooks</p>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 24 }}>Receive push notifications when benchmark data updates or your quota is reached.</p>
      <Card style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 12 }}>Endpoint URL</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://yourserver.com/valcr-webhook" style={{ flex: 1, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, padding: '9px 12px', fontSize: 13, color: S.text, fontFamily: S.mono, outline: 'none' }} />
          <Btn variant="primary" onClick={() => { if (!url.startsWith('https://')) { toast('URL must use HTTPS','error'); return }; toast('Webhook saved','success') }}>Save</Btn>
        </div>
        <p style={{ fontSize: 11, color: S.text3, marginTop: 6 }}>Valcr sends a POST with JSON payload signed with <Mono style={{ fontSize: 11 }}>X-Valcr-Signature</Mono> (HMAC-SHA256).</p>
      </Card>
      <Card>
        <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 14 }}>Events</p>
        {events.map(ev => (
          <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${S.border}` }}>
            <div onClick={() => toggle(ev.id)} style={{ width: 36, height: 20, borderRadius: 10, background: ev.on ? S.accent : S.surface, border: `1px solid ${S.border}`, cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
              <div style={{ position: 'absolute', top: 2, left: ev.on ? 17 : 2, width: 14, height: 14, background: '#fff', borderRadius: '50%', transition: 'left .15s' }} />
            </div>
            <div style={{ flex: 1 }}>
              <Mono style={{ fontSize: 11, color: S.text, display: 'block', marginBottom: 2 }}>{ev.label}</Mono>
              <p style={{ fontSize: 12, color: S.text3 }}>{ev.desc}</p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  PAGE: SETTINGS
// ────────────────────────────────────────────────────────────────────────────
function SettingsPage({ auth, logout }) {
  const toast = useToast()
  const [fname, setFname] = useState(auth?.firstName || '')
  const [email, setEmail] = useState(auth?.email || '')
  return (
    <div>
      <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 2 }}>Account Settings</p>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 24 }}>Manage your profile and security.</p>
      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 16 }}>Profile</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input label="First name" value={fname} onChange={e=>setFname(e.target.value)} style={{ marginBottom: 0 }} />
          <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} style={{ marginBottom: 0 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <Btn variant="primary" size="sm" onClick={() => toast('Profile saved', 'success')}>Save changes</Btn>
        </div>
      </Card>
      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 16 }}>Change password</p>
        <Input label="Current password" type="password" placeholder="••••••••" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input label="New password" type="password" placeholder="Min. 8 characters" style={{ marginBottom: 0 }} />
          <Input label="Confirm new password" type="password" placeholder="••••••••" style={{ marginBottom: 0 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <Btn variant="secondary" size="sm" onClick={() => toast('Password updated', 'success')}>Change password</Btn>
        </div>
      </Card>
      <Card style={{ border: '1px solid rgba(255,107,107,.2)', marginBottom: 14 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: S.red, marginBottom: 8 }}>Danger zone</p>
        <p style={{ fontSize: 12, color: S.text3, marginBottom: 14 }}>Deleting your account revokes all API keys and permanently removes your data. This cannot be undone.</p>
        <Btn variant="danger" size="sm">Delete account</Btn>
      </Card>
      <Btn variant="ghost" onClick={logout}>
        <span style={{ fontSize: 13 }}>→</span> Sign out
      </Btn>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  CONSOLE SHELL
// ────────────────────────────────────────────────────────────────────────────
function Console() {
  const { auth, logout } = useAuth()
  const { page, nav } = useRoute()
  const [data, setData] = useState(buildDemoData)
  const logErrors = data.logs.filter(l => l.status >= 400).length

  const pages = {
    overview:   <OverviewPage data={data} auth={auth} />,
    keys:       <KeysPage data={data} setData={setData} />,
    endpoints:  <EndpointsPage />,
    logs:       <LogsPage data={data} />,
    usage:      <UsagePage data={data} />,
    billing:    <BillingPage data={data} />,
    quickstart: <QuickstartPage />,
    webhooks:   <WebhooksPage />,
    settings:   <SettingsPage auth={auth} logout={logout} />,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: S.bg, fontFamily: S.body, color: S.text }}>
      <Sidebar page={page} nav={nav} auth={auth} logout={logout} logErrors={logErrors} />
      <main style={{ marginLeft: 220, flex: 1, minHeight: '100vh' }}>
        <div style={{ padding: '32px 36px', maxWidth: 1080 }}>
          {pages[page] || pages.overview}
        </div>
      </main>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
//  ROOT
// ────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [authView, setAuthView] = useState('login')

  return (
    <AuthProvider>
      <ToastProvider>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          html{font-size:14px;background:#080B10}
          body{margin:0;padding:0;background:#080B10}
          ::-webkit-scrollbar{width:4px;height:4px}
          ::-webkit-scrollbar-track{background:#080B10}
          ::-webkit-scrollbar-thumb{background:#1E3054;border-radius:2px}
          input,select,textarea{box-sizing:border-box}
          @keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        `}</style>
        <AuthGate authView={authView} setAuthView={setAuthView} />
      </ToastProvider>
    </AuthProvider>
  )
}

function AuthGate({ authView, setAuthView }) {
  const { auth, restoring } = useAuth()

  if (restoring) {
    return (
      <div style={{ minHeight: '100vh', background: '#080B10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: '#4A6480' }}>Restoring session…</div>
      </div>
    )
  }

  if (!auth?.token) {
    return authView === 'login'
      ? <LoginPage onSignup={() => setAuthView('signup')} />
      : <SignupPage onLogin={() => setAuthView('login')} />
  }

  return <Console />
}