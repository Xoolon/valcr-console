// src/App.jsx — Valcr Console root
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import { useRoute } from './hooks/useRoute.js'
import { Sidebar } from './components/layout/Sidebar.jsx'
import { PublicLandingPage } from './pages/PublicLanding.jsx'
import { ConsoleAuthCallbackPage } from './pages/ConsoleAuthCallback.jsx'
import { OverviewPage } from './pages/Overview.jsx'
import { KeysPage } from './pages/Keys.jsx'
import { EndpointsPage } from './pages/Endpoints.jsx'
import { LogsPage } from './pages/Logs.jsx'
import { UsagePage } from './pages/Usage.jsx'
import { BillingPage } from './pages/Billing.jsx'
import { QuickstartPage } from './pages/Quickstart.jsx'
import { WebhooksPage } from './pages/Webhooks.jsx'
import { SettingsPage } from './pages/Settings.jsx'
import { GLOBAL_CSS, S } from './styles/tokens.js'

;(() => {
  if (document.getElementById('vcr-globals')) return
  const element = document.createElement('style')
  element.id = 'vcr-globals'
  element.textContent = `${GLOBAL_CSS}@keyframes spin{to{transform:rotate(360deg)}}`
  document.head.appendChild(element)
})()

const PAGE_TITLE = {
  overview: 'Overview', keys: 'API Keys', endpoints: 'Endpoints', logs: 'Request Logs',
  usage: 'Usage & Quota', billing: 'Billing', quickstart: 'Quickstart', webhooks: 'Webhooks', settings: 'Settings',
}

function ConsoleShell() {
  const { auth, restoring } = useAuth()
  const { page, nav } = useRoute('overview')
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'

  useEffect(() => { document.title = `${PAGE_TITLE[page] || 'Developer API'} — Valcr Console` }, [page])
  useEffect(() => {
    if (!auth) return
    const params = new URLSearchParams(window.location.search)
    if ((params.has('reference') || params.has('trxref')) && page !== 'billing') nav('billing')
  }, [auth, nav, page])

  // Must run before session restoration: this route creates the session.
  if (pathname === '/auth/callback') return <ConsoleAuthCallbackPage />

  if (restoring) return <div style={{ minHeight: '100vh', background: S.bg, display: 'grid', placeItems: 'center' }}>
    <div style={{ fontFamily: S.mono, fontSize: 12, color: S.text3 }}>Restoring session…</div>
  </div>

  if (!auth) return <PublicLandingPage />

  const pages = {
    overview: <OverviewPage nav={nav} />, keys: <KeysPage />, endpoints: <EndpointsPage />,
    logs: <LogsPage />, usage: <UsagePage />, billing: <BillingPage />,
    quickstart: <QuickstartPage nav={nav} />, webhooks: <WebhooksPage />, settings: <SettingsPage />,
  }

  return <div style={{ display: 'flex', minHeight: '100vh', background: S.bg, fontFamily: S.body }}>
    <Sidebar page={page} nav={nav} />
    <main style={{ marginLeft: 220, flex: 1, padding: '24px 28px', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, paddingBottom: 14, borderBottom: `1px solid ${S.border}` }}>
        <span style={{ fontFamily: S.mono, fontSize: 10, color: S.text3 }}>Console</span>
        <span style={{ color: S.border }}>/</span>
        <span style={{ fontFamily: S.mono, fontSize: 10, color: S.text2 }}>{PAGE_TITLE[page] || page}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: S.green, boxShadow: `0 0 6px ${S.green}` }} />
          <span style={{ fontFamily: S.mono, fontSize: 10, color: S.text3 }}>api operational</span>
        </div>
      </div>
      {pages[page] ?? pages.overview}
    </main>
  </div>
}

export default function App() {
  return <ToastProvider><AuthProvider><ConsoleShell /></AuthProvider></ToastProvider>
}
