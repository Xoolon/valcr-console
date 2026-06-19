// src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { authAPI } from '../utils/api.js'
import { TOKEN_TTL } from '../styles/tokens.js'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

function mapUser(d) {
  return {
    id:        d?.id || '',
    email:     d?.email || '',
    firstName: d?.first_name || d?.firstName || '',
    tier:      d?.account_tier || d?.tier || 'developer',
    isAdmin:   d?.is_admin || d?.isAdmin || false,
    isNewUser: d?.is_new_user || false,
  }
}

function loadStored() {
  try { return JSON.parse(localStorage.getItem('vcr_console_auth') || 'null') }
  catch { return null }
}

export function AuthProvider({ children }) {
  const stored  = loadStored()
  const [auth, setAuth]         = useState(stored)
  const [restoring, setRestoring] = useState(!!stored?.token)

  // Silent session restore on mount
  useEffect(() => {
    if (!stored?.token) { setRestoring(false); return }
    if (stored.expiresAt && Date.now() > stored.expiresAt) { logout(); return }

    authAPI.me()
      .then(d => { setAuth(prev => ({ ...prev, ...mapUser(d) })); setRestoring(false) })
      .catch(() => { logout(); setRestoring(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = useCallback((session) => {
    localStorage.setItem('vcr_console_auth', JSON.stringify(session))
    setAuth(session)
  }, [])

  const login = useCallback(async (email, password) => {
    const d = await authAPI.login(email, password)
    const session = {
      token:     d.access_token,
      expiresAt: Date.now() + TOKEN_TTL,
      ...mapUser(d.user || d),
    }
    persist(session)
    return session
  }, [persist])

  const logout = useCallback(async () => {
    await authAPI.logout()
    localStorage.removeItem('vcr_console_auth')
    setAuth(null)
  }, [])

  const updateLocal = useCallback((fields) => {
    setAuth(prev => {
      const next = { ...prev, ...fields }
      localStorage.setItem('vcr_console_auth', JSON.stringify(next))
      return next
    })
  }, [])

  return (
    <AuthCtx.Provider value={{ auth, login, logout, restoring, updateLocal }}>
      {children}
    </AuthCtx.Provider>
  )
}
