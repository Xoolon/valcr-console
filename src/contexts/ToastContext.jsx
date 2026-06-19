// src/contexts/ToastContext.jsx
import { createContext, useContext, useState, useCallback } from 'react'
import { S } from '../styles/tokens.js'

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3400)
  }, [])

  const COLOR = {
    success: S.green,
    error:   S.red,
    info:    S.accent,
    warning: S.amber,
  }

  const ICON = { success: '✓', error: '✗', info: '·', warning: '⚠' }

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 999,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background:   S.card,
            border:       `1px solid ${COLOR[t.type]}40`,
            borderLeft:   `3px solid ${COLOR[t.type]}`,
            borderRadius: 4,
            padding:      '9px 14px',
            fontFamily:   S.mono,
            fontSize:     12,
            color:        S.text,
            display:      'flex',
            alignItems:   'center',
            gap:          8,
            minWidth:     240,
            maxWidth:     360,
            animation:    'toastIn .18s ease',
            boxShadow:    '0 4px 20px rgba(0,0,0,.4)',
          }}>
            <span style={{ color: COLOR[t.type], flexShrink: 0 }}>{ICON[t.type]}</span>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
