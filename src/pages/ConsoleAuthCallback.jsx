import { useEffect, useRef, useState } from 'react'
import { authAPI } from '../utils/authApi.js'
import { mapAuthResponse } from '../utils/session.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { S } from '../styles/tokens.js'

export function ConsoleAuthCallbackPage() {
  const { establishSession } = useAuth()
  const started = useRef(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (started.current) return
    started.current = true
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      setError('The Valcr sign-in response did not contain a login code.')
      return
    }
    authAPI.consoleExchange(code)
      .then(response => {
        establishSession(mapAuthResponse(response))
        window.location.replace('/#overview')
      })
      .catch(caught => setError(caught.message || 'Console sign-in failed.'))
  }, [establishSession])

  return <div style={{ minHeight: '100vh', background: S.bg, display: 'grid', placeItems: 'center', color: S.text, fontFamily: S.body, padding: 24 }}>
    <div style={{ width: '100%', maxWidth: 460, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: 30, textAlign: 'center' }}>
      {error ? <>
        <div style={{ color: S.red, marginBottom: 12 }}>✗</div>
        <h1 style={{ fontSize: 18, marginBottom: 10 }}>Could not sign in</h1>
        <p style={{ color: S.text2, fontSize: 12, lineHeight: 1.7, marginBottom: 20 }}>{error}</p>
        <a href="https://valcr.site/login?next=console" style={{ color: '#fff', background: S.accent, padding: '10px 14px', borderRadius: 4, textDecoration: 'none' }}>Start again</a>
      </> : <>
        <div style={{ width: 24, height: 24, margin: '0 auto 16px', border: `2px solid ${S.border}`, borderTopColor: S.accent, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>Opening Valcr Console</h1>
        <p style={{ color: S.text3, fontFamily: S.mono, fontSize: 11 }}>Exchanging your one-time sign-in code…</p>
      </>}
    </div>
  </div>
}
