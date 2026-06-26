// src/App.jsx — Valcr Console root
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import { useRoute } from './hooks/useRoute.js'
import { Sidebar } from './components/layout/Sidebar.jsx'
import { LoginPage, SignupPage } from './pages/Auth.jsx'
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
  overview: 'Overview',
  keys: 'API Keys',
  endpoints: 'Endpoints',
  logs: 'Request Logs',
  usage: 'Usage & Quota',
  billing: 'Billing',
  quickstart: 'Quickstart',
  webhooks: 'Webhooks',
  settings: 'Settings',
}

function ConsoleShell() {
  const { auth, restoring } = useAuth()
  const { page, nav } = useRoute('overview')
  const [showSignup, setShowSignup] = useState(false)

  useEffect(() => {
    document.title = `${PAGE_TITLE[page] || page} — Valcr Console`
  }, [page])

  // Paystack returns reference/trxref in the URL. Route directly to Billing,
  // where Billing.jsx performs server-side verification.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hasPaymentReference = params.has('reference') || params.has('trxref')
    if (hasPaymentReference && page !== 'billing') nav('billing')
  }, [nav, page])

  if (restoring) {
    return (
      <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: S.mono, fontSize: 12, color: S.text3, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 16, height: 16, border: `2px solid ${S.border}`, borderTopColor: S.accent, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          Restoring session…
        </div>
      </div>
    )
  }

  if (!auth) {
    return showSignup
      ? <SignupPage onLogin={() => setShowSignup(false)} />
      : <LoginPage onSignup={() => setShowSignup(true)} />
  }

  const pages = {
    overview: <OverviewPage nav={nav} />,
    keys: <KeysPage />,
    endpoints: <EndpointsPage />,
    logs: <LogsPage />,
    usage: <UsagePage />,
    billing: <BillingPage />,
    quickstart: <QuickstartPage nav={nav} />,
    webhooks: <WebhooksPage />,
    settings: <SettingsPage />,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: S.bg, fontFamily: S.body }}>
      <Sidebar page={page} nav={nav} />
      <main style={{ marginLeft: 220, flex: 1, padding: '24px 28px', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, paddingBottom: 14, borderBottom: `1px solid ${S.border}` }}>
          <span style={{ fontFamily: S.mono, fontSize: 10, color: S.text3 }}>Console</span>
          <span style={{ fontFamily: S.mono, fontSize: 10, color: S.border }}>/</span>
          <span style={{ fontFamily: S.mono, fontSize: 10, color: S.text2 }}>{PAGE_TITLE[page] || page}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: S.green, display: 'inline-block', boxShadow: `0 0 6px ${S.green}` }} />
            <span style={{ fontFamily: S.mono, fontSize: 10, color: S.text3 }}>api operational</span>
          </div>
        </div>
        {pages[page] ?? pages.overview}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ConsoleShell />
      </AuthProvider>
    </ToastProvider>
  )
}
