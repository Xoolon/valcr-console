// src/pages/Webhooks.jsx
import { useState } from 'react'
import { useApi, useMutation } from '../hooks/useApi.js'
import { webhooksAPI }         from '../utils/api.js'
import { useToast }            from '../contexts/ToastContext.jsx'
import { S }                   from '../styles/tokens.js'
import { Card, Label, Mono, Input, Btn, Divider, Spinner, EmptyState, CodeBlock } from '../components/ui/index.jsx'

const EVENTS = [
  { id:'key.created',     desc:'An API key was created' },
  { id:'key.rotated',     desc:'An API key was rotated (old key now invalid)' },
  { id:'key.revoked',     desc:'An API key was permanently revoked' },
  { id:'quota.warning',   desc:'Account quota reached 80% of limit' },
  { id:'quota.exhausted', desc:'Quota fully consumed — auto-billing triggered' },
  { id:'invoice.paid',    desc:'Paystack payment successfully processed' },
  { id:'invoice.failed',  desc:'Paystack payment attempt failed' },
]

const VERIFY_SNIPPET = `import hmac, hashlib

def verify(payload_bytes, sig_header, secret):
    expected = hmac.new(
        secret.encode(), payload_bytes, hashlib.sha256
    ).hexdigest()
    received = sig_header.split("sha256=")[-1]
    return hmac.compare_digest(expected, received)`

export function WebhooksPage() {
  const toast = useToast()
  const { data, loading, refetch } = useApi(webhooksAPI.get)
  const { mutate:save,   loading:saving   } = useMutation(webhooksAPI.save)
  const { mutate:remove, loading:removing } = useMutation(webhooksAPI.delete)
  const { mutate:test,   loading:testing  } = useMutation(webhooksAPI.test)

  const current = data?.webhook
  const [url,    setUrl]    = useState('')
  const [events, setEvents] = useState(['quota.exhausted','invoice.failed'])
  const [mode,   setMode]   = useState('view')

  const toggleEvent = ev => setEvents(e => e.includes(ev) ? e.filter(x=>x!==ev) : [...e,ev])

  const handleSave = async () => {
    if (!url.startsWith('https://')) { toast('Webhook URL must be HTTPS', 'error'); return }
    try { await save(url, events); toast('Webhook saved','success'); refetch(); setMode('view') }
    catch(e) { toast(e.message,'error') }
  }

  const handleDelete = async () => {
    try { await remove(); toast('Webhook removed','success'); refetch() }
    catch(e) { toast(e.message,'error') }
  }

  const handleTest = async () => {
    try { await test(); toast('Test event delivered — check your server','success') }
    catch(e) { toast(e.message,'error') }
  }

  return (
    <div>
      <p style={{ fontSize:20,fontWeight:700,color:S.text,marginBottom:4 }}>Webhooks</p>
      <p style={{ fontSize:13,color:S.text2,marginBottom:24 }}>
        Receive signed HTTP POST notifications for key events — including quota exhaustion and billing failures.
      </p>

      {loading ? (
        <div style={{ padding:40,display:'flex',justifyContent:'center' }}><Spinner size={24}/></div>
      ) : (
        <>
          {current && mode === 'view' ? (
            <Card style={{ marginBottom:20 }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
                <div>
                  <Label>Endpoint URL</Label>
                  <Mono style={{ fontSize:13,color:S.text2 }}>{current.url}</Mono>
                </div>
                <div style={{ display:'flex',gap:8 }}>
                  <Btn variant="secondary" size="sm" onClick={handleTest} disabled={testing}>
                    {testing ? 'Sending…' : '⌦ Test'}
                  </Btn>
                  <Btn variant="secondary" size="sm" onClick={() => { setUrl(current.url); setEvents(current.events||[]); setMode('edit') }}>
                    Edit
                  </Btn>
                  <Btn variant="danger" size="sm" onClick={handleDelete} disabled={removing}>
                    {removing ? '…' : 'Remove'}
                  </Btn>
                </div>
              </div>
              <Divider />
              <Label>Active events</Label>
              <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                {(current.events||[]).map(e => (
                  <span key={e} style={{ fontFamily:S.mono,fontSize:10,padding:'2px 8px',borderRadius:2,background:S.accentDim,color:S.accent }}>{e}</span>
                ))}
              </div>
              {current.signing_secret && (
                <>
                  <Divider />
                  <Label>Signing secret</Label>
                  <Mono style={{ fontSize:12,color:S.text,background:S.surface,padding:'8px 12px',borderRadius:4,display:'block',border:`1px solid ${S.border}`,wordBreak:'break-all',marginBottom:10 }}>
                    {current.signing_secret}
                  </Mono>
                  <CodeBlock lang="Python — verify signature" code={VERIFY_SNIPPET} />
                </>
              )}
            </Card>
          ) : (
            <Card style={{ marginBottom:20 }}>
              <Input label="Endpoint URL (HTTPS)" placeholder="https://your-server.com/webhooks/valcr" value={url} onChange={e=>setUrl(e.target.value)} mono />
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block',fontSize:12,fontWeight:500,color:S.text2,marginBottom:8 }}>Subscribe to events</label>
                {EVENTS.map(ev => (
                  <label key={ev.id} style={{ display:'flex',alignItems:'center',gap:10,marginBottom:7,cursor:'pointer',padding:'6px 10px',borderRadius:4,background:events.includes(ev.id)?S.accentDim:S.surface,border:`1px solid ${events.includes(ev.id)?S.borderHi:S.border}`,transition:'all .1s' }}>
                    <input type="checkbox" checked={events.includes(ev.id)} onChange={() => toggleEvent(ev.id)} style={{ accentColor:S.accent }} />
                    <div>
                      <Mono style={{ fontSize:11,color:events.includes(ev.id)?S.accent:S.text2 }}>{ev.id}</Mono>
                      <span style={{ fontSize:10,color:S.text3 }}> — {ev.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
                {mode==='edit' && <Btn variant="ghost" onClick={() => setMode('view')}>Cancel</Btn>}
                <Btn variant="primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : current ? 'Update webhook' : 'Save webhook'}
                </Btn>
              </div>
            </Card>
          )}

          {!current && mode !== 'edit' && (
            <EmptyState icon="⌀" title="No webhook configured" sub="Add a webhook URL to receive real-time event notifications."
              action={<Btn variant="primary" onClick={() => setMode('edit')}>Configure webhook</Btn>}
            />
          )}
        </>
      )}
    </div>
  )
}
