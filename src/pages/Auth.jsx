// src/pages/Auth.jsx — Login and Signup pages
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useToast } from '../contexts/ToastContext.jsx'
import { Input, Btn } from '../components/ui/index.jsx'
import { S } from '../styles/tokens.js'

function AuthLayout({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: S.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: S.body,
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36, justifyContent: 'center' }}>
          <div style={{
            width: 30, height: 30, background: S.accent, borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: S.mono, fontSize: 12, fontWeight: 700, color: '#fff',
          }}>V</div>
          <span style={{ fontFamily: S.mono, fontSize: 14, fontWeight: 600, letterSpacing: '.05em', color: S.text }}>
            Valcr Console
          </span>
          <span style={{ fontFamily: S.mono, fontSize: 9, background: S.accentDim, color: S.accent, padding: '2px 6px', borderRadius: 2 }}>
            API
          </span>
        </div>

        {/* Card */}
        <div style={{
          background: S.surface, border: `1px solid ${S.border}`,
          borderRadius: 8, padding: '32px 36px',
        }}>
          {children}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, fontFamily: S.mono, color: S.text3, marginTop: 20 }}>
          Valcr Console ·{' '}
          <a href="https://valcr.site" style={{ color: S.accent, textDecoration: 'none' }}>valcr.site</a>
        </p>
      </div>
    </div>
  )
}

export function LoginPage({ onSignup }) {
  const { login } = useAuth()
  const toast     = useToast()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const submit = async () => {
    if (!email || !password) { setError('Email and password required.'); return }
    setLoading(true); setError('')
    try {
      await login(email, password)
      toast('Welcome back', 'success')
    } catch (e) {
      setError(e.message || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <AuthLayout>
      <p style={{ fontSize: 17, fontWeight: 700, color: S.text, marginBottom: 4 }}>Sign in</p>
      <p style={{ fontSize: 12, color: S.text3, marginBottom: 24 }}>
        Access your API keys, usage data, and documentation.
      </p>

      <Input
        label="Email" type="email" placeholder="you@company.com"
        value={email} onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
      />
      <Input
        label="Password" type="password" placeholder="••••••••"
        value={password} onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
      />

      {error && (
        <div style={{
          background: S.redDim, border: '1px solid rgba(255,107,107,.2)',
          borderRadius: 4, padding: '9px 12px',
          fontFamily: S.mono, fontSize: 11, color: S.red, marginBottom: 14,
        }}>
          {error}
        </div>
      )}

      <Btn
        variant="primary" onClick={submit} disabled={loading}
        style={{ width: '100%', justifyContent: 'center', padding: '10px 0', marginBottom: 14 }}
      >
        {loading ? 'Signing in…' : 'Sign in to Console'}
      </Btn>

      <p style={{ textAlign: 'center', fontSize: 12, color: S.text3 }}>
        No account?{' '}
        <button
          onClick={onSignup}
          style={{ background: 'none', border: 'none', color: S.accent, cursor: 'pointer', fontSize: 12 }}
        >
          Create one
        </button>
      </p>
    </AuthLayout>
  )
}

export function SignupPage({ onLogin }) {
  const { login } = useAuth()
  const toast     = useToast()
  const [form, setForm] = useState({ firstName: '', lastName: '' , email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const submit = async () => {
    if (!form.email || !form.password || !form.firstName) { setError('All fields required.'); return }
    if (form.password !== form.confirm)                   { setError('Passwords do not match.'); return }
    if (form.password.length < 8)                         { setError('Password must be at least 8 characters.'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.valcr.site/api/v1'}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: form.firstName, last_name: form.lastName, email: form.email, password: form.password, turnstile_token: '', }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Registration failed') }
      await login(form.email, form.password)
      toast('Account created — welcome!', 'success')
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  return (
    <AuthLayout>
      <p style={{ fontSize: 17, fontWeight: 700, color: S.text, marginBottom: 4 }}>Create account</p>
      <p style={{ fontSize: 12, color: S.text3, marginBottom: 24 }}>
        Get API access to Valcr benchmark intelligence.
      </p>

      <Input label="First name" placeholder="Glen"               value={form.firstName} onChange={set('firstName')} />
      <Input label="Last name" placeholder="Glen" value={form.lastName} onChange={set('lastName')} />
      <Input label="Email"      type="email" placeholder="you@company.com" value={form.email}     onChange={set('email')}     />
      <Input label="Password"   type="password" placeholder="Min. 8 characters" value={form.password} onChange={set('password')} />
      <Input label="Confirm password" type="password" placeholder="••••••••" value={form.confirm}  onChange={set('confirm')}  />

      {error && (
        <div style={{
          background: S.redDim, border: '1px solid rgba(255,107,107,.2)',
          borderRadius: 4, padding: '9px 12px',
          fontFamily: S.mono, fontSize: 11, color: S.red, marginBottom: 14,
        }}>
          {error}
        </div>
      )}

      <Btn
        variant="primary" onClick={submit} disabled={loading}
        style={{ width: '100%', justifyContent: 'center', padding: '10px 0', marginBottom: 14 }}
      >
        {loading ? 'Creating account…' : 'Create account'}
      </Btn>

      <p style={{ textAlign: 'center', fontSize: 12, color: S.text3 }}>
        Have an account?{' '}
        <button
          onClick={onLogin}
          style={{ background: 'none', border: 'none', color: S.accent, cursor: 'pointer', fontSize: 12 }}
        >
          Sign in
        </button>
      </p>
    </AuthLayout>
  )
}
