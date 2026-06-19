// src/pages/Quickstart.jsx
import { useApi }    from '../hooks/useApi.js'
import { keysAPI }   from '../utils/api.js'
import { S }         from '../styles/tokens.js'
import { Card, CodeBlock } from '../components/ui/index.jsx'

export function QuickstartPage({ nav }) {
  const { data } = useApi(keysAPI.list)
  const firstKey = data?.keys?.[0]?.prefix
    ? `${data.keys[0].prefix}${'•'.repeat(20)}`
    : '<your_api_key>'

  const CURL = `curl -X GET "https://api.valcr.site/data/v1/benchmarks?category=ecommerce" \\
  -H "Authorization: Bearer ${firstKey}"`

  const PY = `import requests

API_KEY = "${firstKey}"
BASE    = "https://api.valcr.site/data/v1"

r = requests.get(
    f"{BASE}/benchmarks",
    headers={"Authorization": f"Bearer {API_KEY}"},
    params={"category": "ecommerce"},
)
r.raise_for_status()
data = r.json()
print(data["metrics"]["gross_margin"])
# → {"p25": 0.28, "p50": 0.41, "p75": 0.58, "p90": 0.67}`

  const JS = `const API_KEY = "${firstKey}"
const BASE    = "https://api.valcr.site/data/v1"

const res = await fetch(\`\${BASE}/benchmarks?category=ecommerce\`, {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
})
if (!res.ok) throw new Error(\`\${res.status} \${await res.text()}\`)
const data = await res.json()
console.log(data.metrics.gross_margin)
// → { p25: 0.28, p50: 0.41, p75: 0.58, p90: 0.67 }`

  const RESPONSE = `{
  "category":   "ecommerce",
  "period":     "2024-Q4",
  "metrics": {
    "gross_margin":   { "p25": 0.28, "p50": 0.41, "p75": 0.58, "p90": 0.67 },
    "revenue_growth": { "p25": 0.04, "p50": 0.12, "p75": 0.26, "p90": 0.48 }
  },
  "sample_size": 4812
}`

  const steps = [
    { n:'1', title:'Create an API key', body:'Navigate to API Keys in the sidebar and create a live key with at least benchmarks:read scope.', action: nav ? (
      <button onClick={() => nav('keys')} style={{ background:'none',border:'none',cursor:'pointer',fontFamily:S.mono,fontSize:11,color:S.accent }}>
        → Go to API Keys
      </button>
    ) : null, code: null },
    { n:'2', title:'Set the base URL', body:null, action:null, code: { lang:'Base URL', src:'https://api.valcr.site/data/v1' } },
    { n:'3', title:'Make a request', body:null, action:null, codes:[
      { lang:'cURL', src:CURL }, { lang:'Python', src:PY }, { lang:'JavaScript', src:JS },
    ]},
    { n:'4', title:'Read the response', body:null, action:null, code:{ lang:'JSON response', src:RESPONSE } },
  ]

  return (
    <div>
      <p style={{ fontSize:20,fontWeight:700,color:S.text,marginBottom:4 }}>Quickstart</p>
      <p style={{ fontSize:13,color:S.text2,marginBottom:28 }}>
        Make your first authenticated Valcr Data API request in under two minutes.
      </p>

      {steps.map((step,i) => (
        <div key={i} style={{ display:'flex',gap:14,marginBottom:28 }}>
          <div style={{ width:26,height:26,borderRadius:'50%',background:S.accentDim,border:`1px solid ${S.borderHi}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:S.mono,fontSize:11,fontWeight:700,color:S.accent,flexShrink:0,marginTop:2 }}>
            {step.n}
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:14,fontWeight:600,color:S.text,marginBottom:8 }}>{step.title}</p>
            {step.body   && <p style={{ fontSize:12,color:S.text2,marginBottom:10 }}>{step.body}</p>}
            {step.action && step.action}
            {step.code   && <CodeBlock lang={step.code.lang} code={step.code.src} />}
            {step.codes  && step.codes.map(c => <CodeBlock key={c.lang} lang={c.lang} code={c.src} />)}
          </div>
        </div>
      ))}

      <Card>
        <p style={{ fontSize:13,fontWeight:600,color:S.text,marginBottom:10 }}>Next steps</p>
        {nav && [
          ['Browse all endpoints →', 'endpoints'],
          ['Set up webhooks →',       'webhooks'],
          ['Review usage & quota →',  'usage'],
        ].map(([label, page]) => (
          <div key={page} style={{ marginBottom:8 }}>
            <button onClick={() => nav(page)} style={{ background:'none',border:'none',cursor:'pointer',fontFamily:S.mono,fontSize:12,color:S.accent }}>
              {label}
            </button>
          </div>
        ))}
      </Card>
    </div>
  )
}
