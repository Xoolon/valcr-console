import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { beginConsoleHandoff } from '@/api/consoleHandoff'

const PENDING_KEY = 'valcr-next-destination'

export function ConsoleAuthBridge() {
  const location = useLocation()
  const { isAuthenticated, isRestoring, token, user } = useAuthStore()
  const starting = useRef(false)

  useEffect(() => {
    const next = new URLSearchParams(location.search).get('next')
    if (next === 'console') sessionStorage.setItem(PENDING_KEY, 'console')
  }, [location.search])

  useEffect(() => {
    if (starting.current || isRestoring || !isAuthenticated || !token) return
    if (sessionStorage.getItem(PENDING_KEY) !== 'console') return
    // Google accounts are verified immediately. Password accounts finish email verification first.
    if (user && user.emailVerified === false) return

    starting.current = true
    sessionStorage.removeItem(PENDING_KEY)
    beginConsoleHandoff(token).catch(error => {
      starting.current = false
      sessionStorage.setItem(PENDING_KEY, 'console')
      console.error('[Console SSO]', error)
    })
  }, [isAuthenticated, isRestoring, token, user])

  return null
}
