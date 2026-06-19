// src/hooks/useRoute.js — hash-based router (no dependency)
import { useState, useEffect, useCallback } from 'react'

export function useRoute(defaultPage = 'overview') {
  const [page, setPage] = useState(
    () => window.location.hash.replace('#', '') || defaultPage
  )
  useEffect(() => {
    const handler = () => setPage(window.location.hash.replace('#', '') || defaultPage)
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [defaultPage])

  const nav = useCallback((p) => { window.location.hash = p }, [])
  return { page, nav }
}
