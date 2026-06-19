// src/pages/Usage.jsx — Usage & Quota, live data
import { useState } from 'react'
import { useApi }  from '../hooks/useApi.js'
import { usageAPI } from '../utils/api.js'
import { S }       from '../styles/tokens.js'
import { Card, Label, Mono, UsageBar, Sparkline, Badge, Spinner, EmptyState } from '../components/ui/index.jsx'

function CodeBar({ code, calls, pct, col }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{ fontFamily: S.mono, fontSize: 11, color: col, minWidth: 32, fontWeight: 700 }}>{code}</span>
      <div style={{ flex: 1, height: 5, background: S.surface, borderRadius: 3, overflow: 'hidden', border: `1px solid ${S.border}` }}>
        <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: S.mono, fontSize: 11, color: S.text3, minWidth: 36, textAlign: 'right' }}>
        {pct.toFixed(1)}%
      </span>
      <span style={{ fontFamily: S.mono, fontSize: 11, color: S.text2, minWidth: 50, textAlign: 'right' }}>
        {calls.toLocaleString()}
      </span>
    </div>
  )
}

function statusCodeColor(code) {
  const c = String(code)
  if (c.startsWith('2')) return S.green
  if (c.startsWith('4') && c !== '429') return S.amber
  return S.red
}

export function UsagePage() {
  const [histDays, setHistDays] = useState(14)

  const { data: summary,  loading: sumLoading  } = useApi(usageAPI.summary)
  const { data: history,  loading: histLoading } = useApi(() => usageAPI.history(histDays), [histDays])
  const { data: byKey,    loading: keyLoading  } = useApi(usageAPI.byKey)
  const { data: byEp,     loading: epLoading   } = useApi(usageAPI.byEndpoint)

  const s    = summary  || {}
  const keys = byKey?.keys || []
  const eps  = byEp?.endpoints || []
  const hist = history?.daily || []
  const codes = summary?.status_codes || []

  const totalCalls  = s.month || 0
  const monthLimit  = s.monthly_limit || 0
  const todayCalls  = s.today || 0
  const dailyLimit  = s.daily_limit || 0
  const tokenBalance= s.token_balance
  const sparkData   = hist.map(d => d.calls || 0)

  return (
    <div>
      <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 4 }}>Usage & Quota</p>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 24 }}>
        Real-time consumption across all keys and endpoints.
      </p>

      {sumLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={24} /></div>
      ) : (
        <>
          {/* Quota bars */}
          <Card style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 16 }}>Quota status</p>
            <UsageBar
              label="Today"
              val={todayCalls} max={dailyLimit}
              right={`${todayCalls.toLocaleString()} / ${dailyLimit.toLocaleString()}`}
            />
            <UsageBar
              label="This month"
              val={totalCalls} max={monthLimit || totalCalls + 1}
              right={`${totalCalls.toLocaleString()}${monthLimit ? ` / ${monthLimit.toLocaleString()}` : ''}`}
            />
            {tokenBalance !== undefined && (
              <UsageBar
                label="Token balance"
                val={tokenBalance} max={s.token_limit || tokenBalance + 1}
                right={`${tokenBalance.toLocaleString()} remaining`}
                color={S.purple}
              />
            )}
          </Card>

          {/* Trend */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: S.text }}>Call volume trend</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {[7, 14, 30].map(d => (
                  <button
                    key={d}
                    onClick={() => setHistDays(d)}
                    style={{
                      fontFamily: S.mono, fontSize: 10, padding: '3px 8px',
                      borderRadius: 3, border: `1px solid ${histDays === d ? S.accent : S.border}`,
                      background: histDays === d ? S.accentDim : S.surface,
                      color: histDays === d ? S.accent : S.text3, cursor: 'pointer',
                    }}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            {histLoading ? <Spinner /> : sparkData.length > 1 ? (
              <Sparkline data={sparkData} />
            ) : (
              <EmptyState icon="↗" title="Not enough data" sub="Usage history appears after a few days of activity." />
            )}
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* By endpoint */}
            <Card>
              <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 14 }}>By endpoint</p>
              {epLoading ? <Spinner /> : eps.length === 0 ? (
                <EmptyState icon="⌥" title="No data" />
              ) : (
                eps.slice(0, 8).map(e => {
                  const max = eps[0]?.calls || 1
                  return (
                    <UsageBar key={e.endpoint} label={e.endpoint} val={e.calls} max={max}
                      right={e.calls.toLocaleString()} />
                  )
                })
              )}
            </Card>

            {/* By key */}
            <Card>
              <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 14 }}>By key</p>
              {keyLoading ? <Spinner /> : keys.length === 0 ? (
                <EmptyState icon="⌗" title="No keys yet" />
              ) : (
                keys.map(k => {
                  const max = keys[0]?.calls || 1
                  return (
                    <UsageBar key={k.key_id} label={k.key_name || k.key_id} val={k.calls} max={max}
                      right={k.calls.toLocaleString()} />
                  )
                })
              )}
            </Card>
          </div>

          {/* Status codes */}
          {codes.length > 0 && (
            <Card>
              <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 14 }}>Response codes</p>
              {codes.map(c => (
                <CodeBar
                  key={c.code}
                  code={c.code}
                  calls={c.calls}
                  pct={c.pct || 0}
                  col={statusCodeColor(c.code)}
                />
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
