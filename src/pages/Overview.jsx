// src/pages/Overview.jsx — Dashboard overview, all data live from backend
import { S } from '../styles/tokens.js'
import { useApi } from '../hooks/useApi.js'
import { usageAPI, logsAPI } from '../utils/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { Card, Label, Mono, UsageBar, Badge, Spinner, EmptyState } from '../components/ui/index.jsx'
import { LogRow } from '../components/shared/LogRow.jsx'
import { Sparkline } from '../components/ui/index.jsx'

function StatTile({ label, value, sub, subCol }) {
  return (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 4, padding: '16px 18px' }}>
      <Label>{label}</Label>
      <p style={{ fontFamily: S.mono, fontSize: 24, fontWeight: 700, color: S.text, lineHeight: 1, marginBottom: 4 }}>
        {value}
      </p>
      <p style={{ fontFamily: S.mono, fontSize: 11, color: subCol || S.text3 }}>{sub}</p>
    </div>
  )
}

export function OverviewPage({ nav }) {
  const { auth }                                          = useAuth()
  const { data: summary, loading: sumLoading }            = useApi(usageAPI.summary)
  const { data: history, loading: histLoading }           = useApi(() => usageAPI.history(14))
  const { data: byEndpoint, loading: epLoading }          = useApi(usageAPI.byEndpoint)
  const { data: logsData, loading: logsLoading }          = useApi(() => logsAPI.list({ limit: 8 }))

  const hour   = new Date().getHours()
  const greet  = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const sparkData   = (history?.daily || []).map(d => d.calls || 0)
  const today       = summary?.today   || 0
  const dailyLimit  = summary?.daily_limit || 0
  const month       = summary?.month   || 0
  const prevMonth   = summary?.prev_month || 0
  const latency     = summary?.avg_latency_ms || 0
  const activeKeys  = summary?.active_keys || 0
  const envCount    = summary?.environments || 1
  const delta       = prevMonth ? Math.round((month - prevMonth) / prevMonth * 100) : 0
  const endpoints   = byEndpoint?.endpoints || []
  const logs        = logsData?.logs || []

  const d14 = new Date(); d14.setDate(d14.getDate() - 13)

  return (
    <div>
      <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 2 }}>Overview</p>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 28 }}>
        {greet}, {auth?.firstName || 'there'}
      </p>

      {/* Stat tiles */}
      {sumLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner size={24} /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          <StatTile label="API calls today"  value={today.toLocaleString()}  sub={`of ${dailyLimit.toLocaleString()} daily limit`} />
          <StatTile label="This month"       value={month.toLocaleString()}  sub={`${delta >= 0 ? '+' : ''}${delta}% vs last month`} subCol={delta >= 0 ? S.green : S.red} />
          <StatTile label="Active keys"      value={activeKeys}              sub={`${envCount} environment${envCount !== 1 ? 's' : ''}`} />
          <StatTile label="Avg latency"      value={`${latency}ms`}          sub="last 100 requests" />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Sparkline */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: S.text }}>Calls — last 14 days</p>
            <Badge color="green">
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: S.green, display: 'inline-block', marginRight: 4, boxShadow: `0 0 5px ${S.green}` }} />
              Live
            </Badge>
          </div>
          {histLoading ? <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
            : sparkData.length > 1 ? (
              <>
                <Sparkline data={sparkData} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <Mono style={{ fontSize: 10, color: S.text3 }}>{d14.toLocaleDateString('en', { month: 'short', day: 'numeric' })}</Mono>
                  <Mono style={{ fontSize: 10, color: S.text3 }}>Today</Mono>
                </div>
              </>
            ) : (
              <EmptyState icon="↗" title="No data yet" sub="Make some API calls to see your usage trend." />
            )
          }
        </Card>

        {/* Top endpoints */}
        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 14 }}>Top endpoints</p>
          {epLoading ? <Spinner /> : endpoints.length === 0 ? (
            <EmptyState icon="⌥" title="No requests yet" sub="Endpoint breakdown will appear here." />
          ) : (
            endpoints.slice(0, 5).map(e => {
              const max = endpoints[0]?.calls || 1
              return (
                <UsageBar
                  key={e.endpoint}
                  label={e.endpoint}
                  val={e.calls}
                  max={max}
                  right={e.calls.toLocaleString()}
                />
              )
            })
          )}
        </Card>
      </div>

      {/* Recent logs */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 16px', borderBottom: `1px solid ${S.border}`,
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: S.text }}>Recent requests</p>
          <button
            onClick={() => nav('logs')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: S.mono, fontSize: 11, color: S.accent }}
          >
            View all →
          </button>
        </div>
        {logsLoading ? (
          <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        ) : logs.length === 0 ? (
          <EmptyState icon="≡" title="No requests yet" sub="Your API call log will appear here." />
        ) : (
          logs.map((l, i) => <LogRow key={i} log={l} />)
        )}
      </Card>
    </div>
  )
}
