// src/components/ui/index.jsx — All shared UI primitives
import { S } from '../../styles/tokens.js'

export function Badge({ children, color = 'blue' }) {
  const map = {
    blue:   { bg: S.accentDim,                    fg: S.accent  },
    green:  { bg: S.greenDim,                     fg: S.green   },
    red:    { bg: S.redDim,                        fg: S.red     },
    amber:  { bg: S.amberDim,                      fg: S.amber   },
    purple: { bg: 'rgba(167,139,250,.12)',          fg: S.purple  },
    gray:   { bg: S.surface, fg: S.text3, border: `1px solid ${S.border}` },
  }
  const c = map[color] || map.blue
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontFamily: S.mono, fontSize: 10, fontWeight: 600,
      padding: '2px 7px', borderRadius: 2, letterSpacing: '.04em',
      background: c.bg, color: c.fg, border: c.border || 'none',
    }}>
      {children}
    </span>
  )
}

export function Btn({ children, variant = 'primary', size = 'md', onClick, disabled, style = {}, type = 'button' }) {
  const sizes = {
    sm: { padding: '5px 10px',  fontSize: 12 },
    md: { padding: '8px 14px',  fontSize: 13 },
    lg: { padding: '11px 20px', fontSize: 14 },
  }
  const variants = {
    primary:   { background: S.accent,   color: '#fff' },
    secondary: { background: S.card,     color: S.text2, border: `1px solid ${S.border}` },
    danger:    { background: S.redDim,   color: S.red,   border: '1px solid rgba(255,107,107,.2)' },
    ghost:     { background: 'transparent', color: S.text3 },
    success:   { background: S.greenDim, color: S.green, border: `1px solid rgba(52,211,153,.2)` },
  }
  return (
    <button
      type={type}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        borderRadius: 4, fontFamily: S.body, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        border: 'none', transition: 'all .12s',
        ...sizes[size], ...variants[variant], ...style,
      }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function Input({ label, hint, mono, error, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: S.text2, marginBottom: 6 }}>
          {label}
        </label>
      )}
      <input
        {...props}
        style={{
          width: '100%', background: S.surface,
          border: `1px solid ${error ? S.red : S.border}`,
          borderRadius: 4, padding: '9px 12px', fontSize: 13,
          color: S.text, fontFamily: mono ? S.mono : S.body,
          outline: 'none', boxSizing: 'border-box',
          ...(props.style || {}),
        }}
        onFocus={e => e.target.style.borderColor = error ? S.red : S.accent}
        onBlur={e  => e.target.style.borderColor = error ? S.red : S.border}
      />
      {hint  && <p style={{ fontSize: 11, color: S.text3, marginTop: 4 }}>{hint}</p>}
      {error && <p style={{ fontSize: 11, color: S.red,   marginTop: 4 }}>{error}</p>}
    </div>
  )
}

export function Select({ label, children, hint, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: S.text2, marginBottom: 6 }}>
          {label}
        </label>
      )}
      <select
        {...props}
        style={{
          width: '100%', background: S.surface,
          border: `1px solid ${S.border}`,
          borderRadius: 4, padding: '9px 12px', fontSize: 13,
          color: S.text, fontFamily: S.body,
          outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
          ...(props.style || {}),
        }}
      >
        {children}
      </select>
      {hint && <p style={{ fontSize: 11, color: S.text3, marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

export function Textarea({ label, hint, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: S.text2, marginBottom: 6 }}>
          {label}
        </label>
      )}
      <textarea
        {...props}
        style={{
          width: '100%', background: S.surface,
          border: `1px solid ${S.border}`,
          borderRadius: 4, padding: '9px 12px', fontSize: 13,
          color: S.text, fontFamily: S.mono, resize: 'vertical',
          outline: 'none', boxSizing: 'border-box', minHeight: 80,
          ...(props.style || {}),
        }}
        onFocus={e => e.target.style.borderColor = S.accent}
        onBlur={e  => e.target.style.borderColor = S.border}
      />
      {hint && <p style={{ fontSize: 11, color: S.text3, marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: S.card, border: `1px solid ${S.border}`,
      borderRadius: 4, padding: 20, ...style,
    }}>
      {children}
    </div>
  )
}

export function Divider({ style = {} }) {
  return <div style={{ height: 1, background: S.border, margin: '20px 0', ...style }} />
}

export function Label({ children, style = {} }) {
  return (
    <p style={{
      fontFamily: S.mono, fontSize: 10, color: S.text3,
      letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6, ...style,
    }}>
      {children}
    </p>
  )
}

export function Mono({ children, style = {} }) {
  return <span style={{ fontFamily: S.mono, ...style }}>{children}</span>
}

export function UsageBar({ label, val, max, color, right }) {
  const pct      = max ? Math.min(Math.round((val / max) * 100), 100) : 0
  const fill     = pct > 85 ? S.red : pct > 65 ? S.amber : (color || S.accent)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: S.mono, fontSize: 11, color: S.text2 }}>{label}</span>
        <span style={{ fontFamily: S.mono, fontSize: 11, color: S.text3 }}>{right}</span>
      </div>
      <div style={{ height: 5, background: S.surface, borderRadius: 3, overflow: 'hidden', border: `1px solid ${S.border}` }}>
        <div style={{ height: '100%', width: `${pct}%`, background: fill, borderRadius: 3, transition: 'width .6s ease' }} />
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, sub, children, danger }) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(5,7,9,.88)',
        backdropFilter: 'blur(5px)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: S.card,
        border: `1px solid ${danger ? 'rgba(255,107,107,.4)' : S.borderHi}`,
        borderRadius: 8, padding: 28, width: '100%', maxWidth: 480, position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14, background: 'none',
            border: 'none', color: S.text3, cursor: 'pointer',
            width: 28, height: 28, display: 'flex', alignItems: 'center',
            justifyContent: 'center', borderRadius: 4, fontSize: 14,
          }}
        >✕</button>
        {title && <p style={{ fontSize: 15, fontWeight: 700, color: danger ? S.red : S.text, marginBottom: 4 }}>{title}</p>}
        {sub   && <p style={{ fontSize: 12, color: S.text2, marginBottom: 20 }}>{sub}</p>}
        {children}
      </div>
    </div>
  )
}

export function Sparkline({ data }) {
  const W = 400, H = 52, pad = 3
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (W - pad * 2),
    H - pad - (v / max) * (H - pad * 2),
  ])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length-1][0]},${H} L${pts[0][0]},${H} Z`
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 52 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={S.accent} stopOpacity=".22" />
          <stop offset="100%" stopColor={S.accent} stopOpacity="0"   />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <path d={line} fill="none" stroke={S.accent} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={S.accent} />
    </svg>
  )
}

export function Spinner({ size = 18 }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid ${S.border}`,
      borderTopColor: S.accent,
      borderRadius: '50%',
      animation: 'spin .7s linear infinite',
    }} />
  )
}

export function EmptyState({ icon = '·', title, sub, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', textAlign: 'center',
    }}>
      <div style={{ fontFamily: S.mono, fontSize: 32, color: S.text3, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 14, fontWeight: 600, color: S.text2, marginBottom: 6 }}>{title}</p>
      {sub && <p style={{ fontSize: 12, color: S.text3, maxWidth: 280, marginBottom: 16 }}>{sub}</p>}
      {action}
    </div>
  )
}

export function StatusDot({ ok }) {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: ok ? S.green : S.red,
      boxShadow: `0 0 6px ${ok ? S.green : S.red}`,
    }} />
  )
}

export function CodeBlock({ code, lang = '' }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      background: S.bgDeep, border: `1px solid ${S.border}`,
      borderRadius: 4, position: 'relative', marginBottom: 12,
    }}>
      {lang && (
        <div style={{
          padding: '6px 12px', borderBottom: `1px solid ${S.border}`,
          fontFamily: S.mono, fontSize: 10, color: S.text3,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{lang}</span>
          <button onClick={copy} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: S.mono, fontSize: 10,
            color: copied ? S.green : S.text3,
          }}>
            {copied ? '✓ copied' : 'copy'}
          </button>
        </div>
      )}
      <pre style={{
        margin: 0, padding: '12px 14px', fontFamily: S.mono,
        fontSize: 12, color: S.text, overflowX: 'auto', lineHeight: 1.6,
      }}>
        {code}
      </pre>
      {!lang && (
        <button onClick={copy} style={{
          position: 'absolute', top: 8, right: 8,
          background: S.surface, border: `1px solid ${S.border}`,
          borderRadius: 3, padding: '3px 8px',
          fontFamily: S.mono, fontSize: 10,
          color: copied ? S.green : S.text3, cursor: 'pointer',
        }}>
          {copied ? '✓' : 'copy'}
        </button>
      )}
    </div>
  )
}

// Need useState import
import { useState } from 'react'
