// src/pages/Logs.jsx — Live request logs with real-time filtering
import { useState, useMemo } from 'react'
import { useApi }   from '../hooks/useApi.js'
import { logsAPI, keysAPI }  from '../utils/api.js'
import { S }        from '../styles/tokens.js'
import { Card, Label, Mono, Btn, Select, EmptyState, Spinner } from '../components/ui/index.jsx'
import { LogRow }   from '../components/shared/LogRow.jsx'

const STATUS_OPTS = [
  { label: 'All statuses', value: '' },
  { label: '2xx — Success', value: '2' },
  { label: '4xx — Client error', value: '4' },
  { label: '5xx — Server error', value: '5' },
]

export function LogsPage() {
  const [statusFilter,   setStatusFilter]   = useState('')
  const [endpointFilter, setEndpointFilter] = useState('')
  const [keyFilter,      setKeyFilter]      = useState('')

  const { data: logsData, loading: logsLoading, refetch } = useApi(() =>
    logsAPI.list({ limit: 500, status: statusFilter || undefined })
  , [statusFilter])

  const { data: keysData } = useApi(keysAPI.list)
  const keys = keysData?.keys || []

  const rawLogs = logsData?.logs || []

  const logs = useMemo(() => {
    let l = rawLogs
    if (endpointFilter) l = l.filter(r => (r.endpoint || r.path || '').includes(endpointFilter))
    if (keyFilter)      l = l.filter(r => (r.key_id || r.key_prefix || '') === keyFilter)
    return l
  }, [rawLogs, endpointFilter, keyFilter])

  const errorCount = logs.filter(l => (l.status_code || l.status || 0) >= 400).length

  const downloadCsv = async () => {
    try {
      const blob = await logsAPI.exportCsv()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `valcr-logs-${Date.now()}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed', e)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 4 }}>Request Logs</p>
          <p style={{ fontSize: 13, color: S.text2 }}>
            Last {rawLogs.length} requests across all keys.
            {errorCount > 0 && (
              <span style={{ color: S.red, marginLeft: 6 }}>
                {errorCount} error{errorCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" size="sm" onClick={refetch}>↺ Refresh</Btn>
          <Btn variant="secondary" size="sm" onClick={downloadCsv}>↓ Export CSV</Btn>
        </div>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 16, padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, color: S.text3, fontFamily: S.mono, marginBottom: 5, letterSpacing: '.06em' }}>
              STATUS
            </label>
            <select
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ width: '100%', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, padding: '7px 10px', fontSize: 12, color: S.text, fontFamily: S.mono, outline: 'none' }}
            >
              {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: 11, color: S.text3, fontFamily: S.mono, marginBottom: 5, letterSpacing: '.06em' }}>
              ENDPOINT CONTAINS
            </label>
            <input
              placeholder="/benchmarks"
              value={endpointFilter} onChange={e => setEndpointFilter(e.target.value)}
              style={{ width: '100%', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, padding: '7px 10px', fontSize: 12, color: S.text, fontFamily: S.mono, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: 11, color: S.text3, fontFamily: S.mono, marginBottom: 5, letterSpacing: '.06em' }}>
              KEY
            </label>
            <select
              value={keyFilter} onChange={e => setKeyFilter(e.target.value)}
              style={{ width: '100%', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, padding: '7px 10px', fontSize: 12, color: S.text, fontFamily: S.mono, outline: 'none' }}
            >
              <option value="">All keys</option>
              {keys.map(k => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>

          {(statusFilter || endpointFilter || keyFilter) && (
            <Btn variant="ghost" size="sm" onClick={() => { setStatusFilter(''); setEndpointFilter(''); setKeyFilter('') }}>
              Clear
            </Btn>
          )}
        </div>
      </Card>

      {/* Log table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 16px', borderBottom: `1px solid ${S.border}`,
          fontFamily: S.mono, fontSize: 10, color: S.text3, letterSpacing: '.06em',
          background: S.surface,
        }}>
          <span style={{ minWidth: 30 }}>CODE</span>
          <span style={{ minWidth: 40 }}>METHOD</span>
          <span style={{ flex: 1 }}>ENDPOINT</span>
          <span style={{ minWidth: 50, textAlign: 'right' }}>LATENCY</span>
          <span style={{ minWidth: 120, textAlign: 'right' }}>KEY</span>
          <span style={{ minWidth: 130, textAlign: 'right' }}>TIMESTAMP</span>
        </div>

        {logsLoading ? (
          <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
            <Spinner size={24} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon="≡"
            title={endpointFilter || statusFilter || keyFilter ? 'No matching logs' : 'No requests yet'}
            sub={endpointFilter || statusFilter || keyFilter ? 'Try clearing the filters.' : 'Request logs appear here as your API keys are used.'}
            action={endpointFilter || statusFilter || keyFilter
              ? <Btn variant="ghost" size="sm" onClick={() => { setStatusFilter(''); setEndpointFilter(''); setKeyFilter('') }}>Clear filters</Btn>
              : null}
          />
        ) : (
          logs.map((l, i) => <LogRow key={i} log={l} />)
        )}
      </Card>

      {logs.length > 0 && (
        <p style={{ textAlign: 'center', fontFamily: S.mono, fontSize: 10, color: S.text3, marginTop: 12 }}>
          Showing {logs.length} of {rawLogs.length} logs — use filters or export for more
        </p>
      )}
    </div>
  )
}
