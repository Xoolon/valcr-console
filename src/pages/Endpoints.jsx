// src/pages/Endpoints.jsx — API endpoint reference
import { useState } from 'react'
import { S }        from '../styles/tokens.js'
import { Card, Label, Badge, Mono, CodeBlock } from '../components/ui/index.jsx'

const ENDPOINTS = [
  { group: 'Benchmarks', items: [
    { method:'GET',  path:'/benchmarks',              scope:'benchmarks:read',  desc:'Aggregate benchmark percentiles for a category.', params:['category (str, required)','segment (str, optional)','period (str, optional)'] },
    { method:'GET',  path:'/benchmarks/percentile',   scope:'benchmarks:read',  desc:'Percentile rank for a specific metric value.',     params:['metric (str)','value (float)','category (str)'] },
    { method:'GET',  path:'/benchmarks/distribution', scope:'benchmarks:read',  desc:'Full distribution histogram for a metric.',        params:['metric (str)','category (str)','buckets (int, default 20)'] },
    { method:'GET',  path:'/benchmarks/history',      scope:'benchmarks:read',  desc:'Historical benchmark trend over time.',            params:['metric (str)','category (str)','periods (int, default 4)','granularity (quarterly|monthly)'] },
  ]},
  { group: 'Segments', items: [
    { method:'GET',  path:'/segments',                scope:'segments:read',    desc:'List all available categories and segments.',      params:[] },
    { method:'GET',  path:'/segments/breakdown',      scope:'segments:read',    desc:'Metric breakdown across sub-segments.',            params:['segment (str)','metric (str)','period (str, optional)'] },
  ]},
  { group: 'Merchant', items: [
    { method:'GET',  path:'/merchant/vcfs',           scope:'merchant:read',    desc:'Full VCFS profile for the authenticated merchant.', params:[] },
    { method:'POST', path:'/merchant/vcfs',           scope:'merchant:write',   desc:'Submit or update merchant VCFS data.',             params:['body: VCFSPayload'] },
    { method:'GET',  path:'/merchant/score',          scope:'score:read',       desc:'Composite Valcr Score (0–100).',                   params:[] },
    { method:'GET',  path:'/merchant/insights',       scope:'insights:read',    desc:'AI-generated causal insight summary.',             params:['refresh (bool, default false)'] },
    { method:'GET',  path:'/merchant/compare',        scope:'compare:read',     desc:'Compare merchant against peer group percentiles.', params:['segment (str, optional)'] },
  ]},
  { group: 'Reports & Export', items: [
    { method:'GET',  path:'/report',                  scope:'report:read',      desc:'Structured full-period performance report.',       params:['format (json|pdf, default json)'] },
    { method:'GET',  path:'/export/xbrl',             scope:'export:read',      desc:'Export VCFS data as XBRL-tagged XML document.',    params:['taxonomy (valcr-core|us-gaap|ifrs)','include_benchmarks (bool)'] },
  ]},
  { group: 'Utility', items: [
    { method:'GET',  path:'/health',                  scope:null,               desc:'Service health check. No auth required.',          params:[] },
  ]},
]

const M = {
  GET:    { bg:'rgba(75,158,255,.12)',  fg:'#4B9EFF' },
  POST:   { bg:'rgba(52,211,153,.12)', fg:'#34D399' },
  PUT:    { bg:'rgba(167,139,250,.12)',fg:'#A78BFA' },
  DELETE: { bg:'rgba(255,107,107,.12)',fg:'#FF6B6B' },
}

function MethodBadge({ method }) {
  const c = M[method] || M.GET
  return (
    <span style={{ fontFamily:S.mono,fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:2,minWidth:44,textAlign:'center',background:c.bg,color:c.fg }}>
      {method}
    </span>
  )
}

function EndpointRow({ item }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom:`1px solid ${S.border}` }}>
      <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer' }} onClick={() => setOpen(o=>!o)}>
        <MethodBadge method={item.method} />
        <Mono style={{ fontSize:13,color:S.text,flex:1 }}>{item.path}</Mono>
        {item.scope && <Badge color="gray">{item.scope}</Badge>}
        <span style={{ color:S.text3,fontSize:10 }}>{open?'▲':'▼'}</span>
      </div>
      {open && (
        <div style={{ padding:'0 14px 14px',background:'rgba(0,0,0,.12)' }}>
          <p style={{ fontSize:12,color:S.text2,marginBottom:10 }}>{item.desc}</p>
          {item.params.length > 0 && (
            <>
              <Label>Parameters</Label>
              <ul style={{ listStyle:'none',padding:0,margin:'0 0 10px' }}>
                {item.params.map((p,i) => (
                  <li key={i} style={{ fontFamily:S.mono,fontSize:11,color:S.text3,marginBottom:3 }}>→ {p}</li>
                ))}
              </ul>
            </>
          )}
          <CodeBlock lang="Authorization" code={item.scope ? `Authorization: Bearer <api_key>   // requires scope: ${item.scope}` : `// no auth required`} />
        </div>
      )}
    </div>
  )
}

export function EndpointsPage() {
  return (
    <div>
      <p style={{ fontSize:20,fontWeight:700,color:S.text,marginBottom:4 }}>Endpoints</p>
      <p style={{ fontSize:13,color:S.text2,marginBottom:4 }}>
        Base URL: <Mono style={{ fontSize:13,color:S.accent }}>https://api.valcr.site/data/v1</Mono>
      </p>
      <p style={{ fontSize:12,color:S.text3,marginBottom:24 }}>
        All requests require <Mono style={{ fontSize:12,color:S.text2 }}>Authorization: Bearer &lt;key&gt;</Mono> unless marked public.
      </p>
      {ENDPOINTS.map(group => (
        <div key={group.group} style={{ marginBottom:20 }}>
          <Label>{group.group}</Label>
          <Card style={{ padding:0,overflow:'hidden' }}>
            {group.items.map(item => <EndpointRow key={item.path+item.method} item={item} />)}
          </Card>
        </div>
      ))}
    </div>
  )
}
