// src/hooks/useApi.js
import { useState, useEffect, useCallback } from 'react'

/**
 * Generic data-fetching hook.
 * Usage: const { data, loading, error, refetch } = useApi(myAPI.list)
 */
export function useApi(fn, deps = []) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn()
      setData(result)
    } catch (e) {
      setError(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}

/** Mutation hook — manual trigger, no auto-run */
export function useMutation(fn) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const mutate = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn(...args)
      return result
    } catch (e) {
      setError(e.message || 'Something went wrong')
      throw e
    } finally {
      setLoading(false)
    }
  }, [fn])

  return { mutate, loading, error }
}
