// src/contexts/AuthContext.jsx — session management
// Handles restore from localStorage, login, logout, profile updates

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

const API = import.meta?.env?.VITE_API_URL || 'https://api.valcr.site/api/v1'
const SESSION_KEY = 'vcr_console_auth'
const TTL = 30 * 24 * 60 * 60 * 1000  // 30 days

function loadStored() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') }
  catch { return null }
}

function mapUser(d) {
  return {
    id:            d.user_id || d.id || '',
    email:         d.email   || '',
    firstName:     d.first_name || d.firstName || '',
    lastName:      d.last_name  || d.lastName  || '',
    tier:          d.account_tier || d.tier || 'developer',
    emailVerified: d.email_verified ?? d.emailVerified ?? false,
    isAdmin:       d.is_admin || d.isAdmin || false,
    isNewUser:     d.is_new_user || false,
  }
}

export function AuthProvider({ children }) {
  const stored     = loadStored()
  const [auth,     setAuth]      = useState(stored)
  const [restoring,setRestoring] = useState(!!stored?.token)

  // ── Silent session restore ──────────────────────────────────────────────
  useEffect(() => {
    if (!stored?.token) { setRestoring(false); return }
    if (stored.expiresAt && Date.now() > stored.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      setAuth(null); setRestoring(false); return
    }

    // Validate token with backend /me
    fetch(`${API}/auth/me`, {
      headers: {
        'Authorization':  `Bearer ${stored.token}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const updated = { ...stored, ...mapUser(data) }
        localStorage.setItem(SESSION_KEY, JSON.stringify(updated))
        setAuth(updated)
      })
      .catch(() => {
        localStorage.removeItem(SESSION_KEY)
        setAuth(null)
      })
      .finally(() => setRestoring(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = useCallback((session) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    setAuth(session)
  }, [])

  // ── login — called with the full response from /auth/login ──────────────
  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ email, password, turnstile_token: '' }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`)

    const session = {
      token:     data.access_token,
      expiresAt: Date.now() + TTL,
      ...mapUser(data),
    }
    persist(session)
    return session
  }, [persist])

  const logout = useCallback(async () => {
    try {
      await fetch(`${API}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth?.token}`, 'X-Requested-With': 'XMLHttpRequest' },
      })
    } catch {}
    localStorage.removeItem(SESSION_KEY)
    setAuth(null)
  }, [auth?.token])

  const updateLocal = useCallback((fields) => {
    setAuth(prev => {
      if (!prev) return prev
      const next = { ...prev, ...fields }
      localStorage.setItem(SESSION_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return (
    <AuthCtx.Provider value={{ auth, login, logout, restoring, updateLocal, persist }}>
      {children}
    </AuthCtx.Provider>
  )
}
