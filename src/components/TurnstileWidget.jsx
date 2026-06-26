import { useEffect, useRef } from 'react'

const SCRIPT_ID = 'cloudflare-turnstile-script'
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID)

    if (existing) {
      const onLoad = () => resolve(window.turnstile)
      const onError = () => reject(new Error('Turnstile script failed to load.'))
      existing.addEventListener('load', onLoad, { once: true })
      existing.addEventListener('error', onError, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.turnstile)
    script.onerror = () => reject(new Error('Turnstile script failed to load.'))
    document.head.appendChild(script)
  })
}

export function TurnstileWidget({
  siteKey,
  onToken,
  onExpire,
  onError,
  theme = 'dark',
}) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const callbacksRef = useRef({ onToken, onExpire, onError })

  callbacksRef.current = { onToken, onExpire, onError }

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined

    let cancelled = false

    loadTurnstile()
      .then(turnstile => {
        if (cancelled || !containerRef.current) return

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          size: 'flexible',
          callback: token => callbacksRef.current.onToken?.(token),
          'expired-callback': () => callbacksRef.current.onExpire?.(),
          'timeout-callback': () => callbacksRef.current.onExpire?.(),
          'error-callback': errorCode => callbacksRef.current.onError?.(errorCode),
        })
      })
      .catch(error => callbacksRef.current.onError?.(error.message))

    return () => {
      cancelled = true
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          // Widget may already have been removed by Turnstile.
        }
      }
    }
  }, [siteKey, theme])

  if (!siteKey) {
    return (
      <div style={{
        minHeight: 44,
        marginBottom: 14,
        padding: '10px 12px',
        border: '1px solid rgba(255,107,107,.35)',
        borderRadius: 4,
        color: '#ff6b6b',
        fontSize: 11,
      }}>
        Turnstile is not configured. Set VITE_TURNSTILE_SITE_KEY and rebuild.
      </div>
    )
  }

  return <div ref={containerRef} style={{ minHeight: 65, marginBottom: 14 }} />
}
