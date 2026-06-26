import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authAPI } from '../utils/authApi.js'
import {
  clearSession,
  mapAuthResponse,
  readSession,
  writeSession,
} from '../utils/session.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => readSession())
  const [restoring, setRestoring] = useState(true)

  const establishSession = useCallback(sessionOrResponse => {
    const session = sessionOrResponse?.access_token
      ? mapAuthResponse(sessionOrResponse)
      : sessionOrResponse

    writeSession(session)
    setAuth(session)
    return session
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setAuth(null)
  }, [])

  const refreshSession = useCallback(async () => {
    const existing = readSession()
    if (!existing?.token) {
      logout()
      return null
    }

    const me = await authAPI.me()
    const refreshed = mapAuthResponse(me, existing.token)
    establishSession(refreshed)
    return refreshed
  }, [establishSession, logout])

  useEffect(() => {
    let cancelled = false

    async function restore() {
      const existing = readSession()
      if (!existing?.token) {
        if (!cancelled) {
          setAuth(null)
          setRestoring(false)
        }
        return
      }

      try {
        const me = await authAPI.me()
        const refreshed = mapAuthResponse(me, existing.token)
        if (!cancelled) {
          writeSession(refreshed)
          setAuth(refreshed)
        }
      } catch {
        if (!cancelled) logout()
      } finally {
        if (!cancelled) setRestoring(false)
      }
    }

    restore()

    const handleUnauthorized = () => {
      if (!cancelled) logout()
    }
    window.addEventListener('valcr:unauthorized', handleUnauthorized)

    return () => {
      cancelled = true
      window.removeEventListener('valcr:unauthorized', handleUnauthorized)
    }
  }, [logout])

  const value = useMemo(() => ({
    auth,
    restoring,
    establishSession,
    refreshSession,
    logout,
  }), [auth, restoring, establishSession, refreshSession, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider.')
  return value
}
