// src/components/shared/LogRow.jsx
import { S } from '../../styles/tokens.js'

function statusColor(code) {
  if (code >= 500) return S.red
  if (code === 429) return S.red
  if (code >= 400) return S.amber
  return S.green
}

export function LogRow({ log }) {
  const code = log.status_code || log.status || 0
  const col  = statusColor(code)
  const ts   = log.ts ? new Date(log.ts) : log.timestamp ? new Date(log.timestamp) : null
  const timeStr = ts ? ts.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
  const dateStr = ts ? ts.toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 16px', borderBottom: `1px solid ${S.border}`,
      fontFamily: S.mono, fontSize: 11,
    }}>
      {/* Status code */}
      <span style={{ color: col, fontWeight: 700, minWidth: 30 }}>{code}</span>

      {/* Method */}
      <span style={{ color: S.accent, minWidth: 40 }}>{log.method || 'GET'}</span>

      {/* Endpoint */}
      <span style={{ color: S.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {log.endpoint || log.path || '—'}
      </span>

      {/* Latency */}
      <span style={{ color: S.text3, minWidth: 50, textAlign: 'right' }}>
        {log.ms || log.duration_ms ? `${log.ms || log.duration_ms}ms` : '—'}
      </span>

      {/* Key prefix */}
      <span style={{ color: S.text3, minWidth: 120, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {log.key_prefix || log.key || '—'}
      </span>

      {/* Timestamp */}
      <span style={{ color: S.text3, minWidth: 130, textAlign: 'right' }}>
        {dateStr} {timeStr}
      </span>
    </div>
  )
}
