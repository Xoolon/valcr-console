// src/pages/Auth.jsx — Valcr Console authentication
import { useCallback, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { authAPI } from '../utils/authApi.js'
import { mapAuthResponse, writeSession } from '../utils/session.js'
import { S } from '../styles/tokens.js'

const GOOGLE_CLIENT_ID = (
  import.meta.env.VITE_GOOGLE_CLIENT_ID
  || window.__VALCR_CONFIG__?.GOOGLE_CLIENT_ID
  || '143161014607-mleat5tn3hbc6aorsdd38f201m8lo0gj.apps.googleusercontent.com'
)

function loadGoogleIdentityServices(onSuccess, onError) {
  if (!GOOGLE_CLIENT_ID) {
    onError('Google OAuth client ID is missing.')
    return
  }

  const initialize = () => {
    if (!window.google?.accounts?.oauth2) {
      onError('Google Identity Services did not initialize.')
      return
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: response => {
        if (response.error) {
          onError(response.error_description || response.error)
          return
        }
        if (!response.access_token) {
          onError('Google did not return an access token.')
          return
        }
        onSuccess(response.access_token)
      },
      error_callback: error => {
        onError(error?.message || error?.type || 'Google sign-in popup failed.')
      },
    })

    client.requestAccessToken({ prompt: 'select_account' })
  }

  if (window.google?.accounts?.oauth2) {
    initialize()
    return
  }

  const scriptId = 'google-identity-services'
  const existing = document.getElementById(scriptId)
  if (existing) {
    existing.addEventListener('load', initialize, { once: true })
    existing.addEventListener('error', () => onError('Failed to load Google Identity Services.'), { once: true })
    return
  }

  const script = document.createElement('script')
  script.id = scriptId
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.defer = true
  script.onload = initialize
  script.onerror = () => onError('Failed to load Google Identity Services.')
  document.head.appendChild(script)
}

function AuthLayout({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: S.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: S.body,
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36, justifyContent: 'center' }}>
          <div style={{
            width: 32,
            height: 32,
            background: S.accent,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: S.mono,
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
          }}>
            V
          </div>
          <span style={{ fontFamily: S.mono, fontSize: 14, fontWeight: 600, letterSpacing: '.05em', color: S.text }}>
            Valcr Console
          </span>
          <span style={{ fontFamily: S.mono, fontSize: 9, background: S.accentDim, color: S.accent, padding: '2px 6px', borderRadius: 2 }}>
            API
          </span>
        </div>

        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '32px 36px' }}>
          {children}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, fontFamily: S.mono, color: S.text3, marginTop: 20 }}>
          <a href="https://valcr.site" style={{ color: S.accent, textDecoration: 'none' }}>valcr.site</a>
          {' · '}
          <a href="https://valcr.site/terms" style={{ color: S.text3, textDecoration: 'none' }}>Terms</a>
          {' · '}
          <a href="https://valcr.site/privacy" style={{ color: S.text3, textDecoration: 'none' }}>Privacy</a>
        </p>
      </div>
    </div>
  )
}

function Field({ label, type = 'text', placeholder, value, onChange, onKeyDown, autoComplete }) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: S.text3, marginBottom: 5, fontFamily: S.mono, letterSpacing: '.06em' }}>
          {label}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: S.bg,
          border: `1px solid ${focused ? S.accent : S.border}`,
          borderRadius: 4,
          padding: '9px 12px',
          fontSize: 13,
          color: S.text,
          fontFamily: S.body,
          outline: 'none',
          transition: 'border-color .12s',
        }}
      />
    </div>
  )
}

function ErrorBox({ message }) {
  if (!message) return null

  return (
    <div style={{
      background: S.redDim,
      border: '1px solid rgba(255,107,107,.25)',
      borderRadius: 4,
      padding: '9px 12px',
      fontFamily: S.mono,
      fontSize: 11,
      color: S.red,
      marginBottom: 14,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
    }}>
      <span>✗</span>
      <span>{message}</span>
    </div>
  )
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '10px 0',
        background: disabled ? S.border : S.accent,
        color: '#fff',
        border: 'none',
        borderRadius: 4,
        fontFamily: S.body,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: disabled ? 0.7 : 1,
        transition: 'all .12s',
        marginBottom: 12,
      }}
    >
      {children}
    </button>
  )
}

const GOOGLE_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
)

function GoogleButton({ onClick, loading }) {
  return (
    <button
      type="button"
      onClick={loading ? undefined : onClick}
      disabled={loading}
      style={{
        width: '100%',
        padding: '10px 0',
        marginBottom: 16,
        background: S.card,
        border: `1px solid ${S.border}`,
        color: S.text,
        borderRadius: 4,
        fontFamily: S.body,
        fontSize: 13,
        fontWeight: 500,
        cursor: loading ? 'wait' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}
    >
      {loading
        ? <div style={{ width: 16, height: 16, border: `2px solid ${S.border}`, borderTopColor: S.accent, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        : GOOGLE_ICON}
      {loading ? 'Connecting…' : 'Continue with Google'}
    </button>
  )
}

function OAuthDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ flex: 1, height: 1, background: S.border }} />
      <span style={{ fontFamily: S.mono, fontSize: 10, color: S.text3 }}>or email</span>
      <div style={{ flex: 1, height: 1, background: S.border }} />
    </div>
  )
}

export function LoginPage({ onSignup }) {
  const toast = useToast()
  const { establishSession } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [unverified, setUnverified] = useState(false)
  const [pendingSession, setPendingSession] = useState(null)
  const [resent, setResent] = useState(false)


  const finishGoogleLogin = useCallback(async accessToken => {
    setGoogleLoading(true)
    setError('')
    try {
      const response = await authAPI.google(accessToken)
      establishSession(mapAuthResponse(response))
      toast('Signed in with Google', 'success')
    } catch (caught) {
      setError(caught.message || 'Google sign-in failed.')
    } finally {
      setGoogleLoading(false)
    }
  }, [establishSession, toast])

  const startGoogle = () => {
    setGoogleLoading(true)
    setError('')
    loadGoogleIdentityServices(
      finishGoogleLogin,
      message => {
        setError(message)
        setGoogleLoading(false)
      },
    )
  }

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    setLoading(true)
    setError('')
    setUnverified(false)

    try {
      const response = await authAPI.login({
        email: email.trim(),
        password,
      })
      const session = mapAuthResponse(response)

      if (!response.email_verified) {
        writeSession(session)
        setPendingSession(session)
        setUnverified(true)
        return
      }

      establishSession(session)
      toast('Welcome back', 'success')
    } catch (caught) {
      setError(caught.message || 'Sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  const resendVerification = async () => {
    try {
      await authAPI.resendVerification()
      setResent(true)
    } catch (caught) {
      setError(caught.message || 'Could not resend the verification email.')
    }
  }

  const continueUnverified = () => {
    if (pendingSession) establishSession(pendingSession)
  }

  return (
    <AuthLayout>
      <p style={{ fontSize: 18, fontWeight: 700, color: S.text, marginBottom: 4 }}>Sign in</p>
      <p style={{ fontSize: 12, color: S.text3, marginBottom: 22 }}>Access your API keys, usage data, and integrations.</p>

      {unverified && (
        <div style={{ background: S.amberDim, border: '1px solid rgba(245,158,11,.25)', borderRadius: 4, padding: '10px 12px', marginBottom: 14, fontFamily: S.mono, fontSize: 11 }}>
          <p style={{ color: S.amber, fontWeight: 600, marginBottom: 4 }}>⚠ Email not verified</p>
          <p style={{ color: S.text3, marginBottom: 8 }}>Check <span style={{ color: S.text2 }}>{email}</span> for a verification link.</p>
          {resent
            ? <span style={{ color: S.green, fontSize: 10 }}>✓ Resent — check your inbox</span>
            : <button type="button" onClick={resendVerification} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: S.mono, fontSize: 10, color: S.accent }}>Resend verification →</button>}
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={continueUnverified} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: S.mono, fontSize: 10, color: S.text3 }}>
              Continue to Console without verifying →
            </button>
          </div>
        </div>
      )}

      <GoogleButton onClick={startGoogle} loading={googleLoading} />
      <OAuthDivider />
      <ErrorBox message={error} />

      <Field
        label="EMAIL"
        type="email"
        placeholder="you@company.com"
        value={email}
        onChange={event => setEmail(event.target.value)}
        autoComplete="email"
      />
      <Field
        label="PASSWORD"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={event => setPassword(event.target.value)}
        onKeyDown={event => event.key === 'Enter' && handleLogin()}
        autoComplete="current-password"
      />

      <div style={{ textAlign: 'right', marginBottom: 14, marginTop: -4 }}>
        <a href="https://valcr.site/forgot-password" style={{ fontFamily: S.mono, fontSize: 10, color: S.text3, textDecoration: 'none' }}>
          Forgot password?
        </a>
      </div>

      <PrimaryButton onClick={handleLogin} disabled={loading || googleLoading}>
        {loading ? 'Signing in…' : 'Sign in to Console'}
      </PrimaryButton>

      <p style={{ textAlign: 'center', fontSize: 12, color: S.text3 }}>
        No account?{' '}
        <button type="button" onClick={onSignup} style={{ background: 'none', border: 'none', color: S.accent, cursor: 'pointer', fontSize: 12, fontFamily: S.body }}>
          Create one free
        </button>
      </p>
    </AuthLayout>
  )
}

export function SignupPage({ onLogin }) {
  const toast = useToast()
  const { establishSession } = useAuth()

  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [completedEmail, setCompletedEmail] = useState('')
  const [pendingSession, setPendingSession] = useState(null)

  const setField = key => event => {
    setForm(previous => ({ ...previous, [key]: event.target.value }))
  }


  const finishGoogleSignup = useCallback(async accessToken => {
    setGoogleLoading(true)
    setError('')
    try {
      const response = await authAPI.google(accessToken)
      establishSession(mapAuthResponse(response))
      toast('Account ready — welcome!', 'success')
    } catch (caught) {
      setError(caught.message || 'Google sign-up failed.')
    } finally {
      setGoogleLoading(false)
    }
  }, [establishSession, toast])

  const startGoogle = () => {
    setGoogleLoading(true)
    setError('')
    loadGoogleIdentityServices(
      finishGoogleSignup,
      message => {
        setError(message)
        setGoogleLoading(false)
      },
    )
  }

  const handleSignup = async () => {
    const { firstName, lastName, email, password, confirm } = form

    if (!firstName.trim() || !email.trim() || !password) {
      setError('First name, email, and password are required.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const response = await authAPI.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      })
      const session = mapAuthResponse(response)
      writeSession(session)
      setPendingSession(session)
      setCompletedEmail(email.trim())
    } catch (caught) {
      setError(caught.message || 'Account creation failed.')
    } finally {
      setLoading(false)
    }
  }

  if (completedEmail) {
    return (
      <AuthLayout>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: S.accentDim, border: `1px solid ${S.borderHi}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: S.mono, fontSize: 22, color: S.accent, margin: '0 auto 20px' }}>
            ✉
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: S.text, marginBottom: 8 }}>Check your inbox</p>
          <p style={{ fontSize: 12, color: S.text3, marginBottom: 6 }}>We sent a verification link to</p>
          <p style={{ fontFamily: S.mono, fontSize: 13, color: S.accent, marginBottom: 20 }}>{completedEmail}</p>
          <p style={{ fontSize: 11, color: S.text3, marginBottom: 24, lineHeight: 1.7 }}>
            Click the link to verify your account. You may continue to the Console while verification is pending.
          </p>
          <PrimaryButton onClick={() => pendingSession && establishSession(pendingSession)} disabled={!pendingSession}>
            Continue to Console →
          </PrimaryButton>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <p style={{ fontSize: 18, fontWeight: 700, color: S.text, marginBottom: 4 }}>Create account</p>
      <p style={{ fontSize: 12, color: S.text3, marginBottom: 22 }}>Get API access to Valcr benchmark intelligence.</p>

      <GoogleButton onClick={startGoogle} loading={googleLoading} />
      <OAuthDivider />
      <ErrorBox message={error} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="FIRST NAME" placeholder="Glen" value={form.firstName} onChange={setField('firstName')} autoComplete="given-name" />
        <Field label="LAST NAME" placeholder="Norman" value={form.lastName} onChange={setField('lastName')} autoComplete="family-name" />
      </div>
      <Field label="EMAIL" type="email" placeholder="you@company.com" value={form.email} onChange={setField('email')} autoComplete="email" />
      <Field label="PASSWORD" type="password" placeholder="Min. 8 characters" value={form.password} onChange={setField('password')} autoComplete="new-password" />
      <Field
        label="CONFIRM PASSWORD"
        type="password"
        placeholder="••••••••"
        value={form.confirm}
        onChange={setField('confirm')}
        onKeyDown={event => event.key === 'Enter' && handleSignup()}
        autoComplete="new-password"
      />

      <PrimaryButton onClick={handleSignup} disabled={loading || googleLoading}>
        {loading ? 'Creating account…' : 'Create account'}
      </PrimaryButton>

      <p style={{ textAlign: 'center', fontSize: 11, color: S.text3, lineHeight: 1.6 }}>
        By signing up you agree to{' '}
        <a href="https://valcr.site/terms" style={{ color: S.text3 }}>Terms</a>
        {' & '}
        <a href="https://valcr.site/privacy" style={{ color: S.text3 }}>Privacy Policy</a>
      </p>
      <p style={{ textAlign: 'center', fontSize: 12, color: S.text3, marginTop: 14 }}>
        Have an account?{' '}
        <button type="button" onClick={onLogin} style={{ background: 'none', border: 'none', color: S.accent, cursor: 'pointer', fontSize: 12, fontFamily: S.body }}>
          Sign in
        </button>
      </p>
    </AuthLayout>
  )
}
