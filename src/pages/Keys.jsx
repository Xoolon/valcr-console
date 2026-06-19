// src/pages/Keys.jsx — API Key management, 100% live data
import { useState, useCallback } from 'react'
import { useAuth }   from '../contexts/AuthContext.jsx'
import { useToast }  from '../contexts/ToastContext.jsx'
import { useApi }    from '../hooks/useApi.js'
import { keysAPI }   from '../utils/api.js'
import { ALL_SCOPES, S } from '../styles/tokens.js'
import {
  Card, Label, Mono, Badge, Btn, Input, Select,
  Modal, Divider, EmptyState, Spinner,
} from '../components/ui/index.jsx'

// Scope descriptions for the UI
const SCOPE_DESC = {
  'benchmarks:read':  'Read benchmark data and percentiles',
  'segments:read':    'Read segment breakdowns',
  'merchant:read':    'Read merchant VCFS profile',
  'merchant:write':   'Submit/update merchant data',
  'insights:read':    'Read AI-generated insights',
  'compare:read':     'Peer group comparisons',
  'score:read':       'Valcr Score composite',
  'report:read':      'Full structured reports',
  'export:read':      'XBRL export endpoints',
}

function KeyCard({ k, onRotate, onRevoke, onCopy }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      background: S.surface, border: `1px solid ${S.border}`,
      borderRadius: 4, marginBottom: 8, overflow: 'hidden',
      transition: 'border-color .15s',
    }}>
      {/* Header row */}
      <div
        style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
        onClick={() => setExpanded(x => !x)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{k.name}</span>
            <Badge color={k.environment === 'live' ? 'green' : 'amber'}>{k.environment || k.env}</Badge>
            {!k.is_active && <Badge color="red">revoked</Badge>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Mono style={{ fontSize: 12, color: S.text3 }}>{k.prefix}{'•'.repeat(20)}</Mono>
            <button
              onClick={e => { e.stopPropagation(); onCopy(k.prefix + '•'.repeat(20), k.id) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: S.mono, fontSize: 10, color: S.accent }}
            >
              copy prefix
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <Mono style={{ fontSize: 11, color: S.text2 }}>{(k.calls_today ?? 0).toLocaleString()}</Mono>
            <Mono style={{ fontSize: 10, color: S.text3, display: 'block' }}>today</Mono>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Mono style={{ fontSize: 11, color: S.text2 }}>{(k.calls_month ?? 0).toLocaleString()}</Mono>
            <Mono style={{ fontSize: 10, color: S.text3, display: 'block' }}>this month</Mono>
          </div>
          <span style={{ color: S.text3, fontSize: 12, marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${S.border}`, padding: '12px 14px', background: 'rgba(0,0,0,.15)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 14 }}>
            <div>
              <Label>Created</Label>
              <Mono style={{ fontSize: 12, color: S.text2 }}>{k.created_at ? new Date(k.created_at).toLocaleDateString() : k.created || '—'}</Mono>
            </div>
            <div>
              <Label>Last used</Label>
              <Mono style={{ fontSize: 12, color: S.text2 }}>{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : '—'}</Mono>
            </div>
            <div>
              <Label>Tier</Label>
              <Mono style={{ fontSize: 12, color: S.text2 }}>{k.tier || '—'}</Mono>
            </div>
          </div>

          <Label>Scopes</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
            {(k.scopes || []).map(sc => (
              <span key={sc} style={{
                fontFamily: S.mono, fontSize: 10, padding: '2px 7px',
                borderRadius: 2, background: S.accentDim, color: S.accent,
              }}>{sc}</span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="secondary" size="sm" onClick={() => onRotate(k)}>⟳ Rotate key</Btn>
            <Btn variant="danger"    size="sm" onClick={() => onRevoke(k)}>✕ Revoke</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

export function KeysPage() {
  const toast = useToast()
  const { auth } = useAuth()

  const { data, loading, refetch } = useApi(keysAPI.list)
  const keys = data?.keys || []

  const [createOpen, setCreateOpen] = useState(false)
  const [revealOpen, setRevealOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [activeKey,  setActiveKey]  = useState(null)
  const [revealedKey, setRevealedKey] = useState('')
  const [saving,     setSaving]     = useState(false)

  const [newForm, setNewForm] = useState({
    name:   '',
    env:    'live',
    scopes: ['benchmarks:read', 'merchant:read'],
  })

  const toggleScope = sc => setNewForm(p => ({
    ...p,
    scopes: p.scopes.includes(sc) ? p.scopes.filter(s => s !== sc) : [...p.scopes, sc],
  }))

  const createKey = async () => {
    if (!newForm.name.trim()) { toast('Enter a key name', 'error'); return }
    if (newForm.scopes.length === 0) { toast('Select at least one scope', 'error'); return }
    setSaving(true)
    try {
      const res = await keysAPI.create(newForm.name, newForm.env, newForm.scopes)
      setRevealedKey(res.raw_key || res.key || '')
      setCreateOpen(false)
      setRevealOpen(true)
      setNewForm({ name: '', env: 'live', scopes: ['benchmarks:read', 'merchant:read'] })
      await refetch()
    } catch (e) {
      toast(e.message || 'Failed to create key', 'error')
    } finally { setSaving(false) }
  }

  const rotateKey = async () => {
    if (!activeKey) return
    setSaving(true)
    try {
      const res = await keysAPI.rotate(activeKey.id)
      setRevealedKey(res.raw_key || res.key || '')
      setRotateOpen(false)
      setRevealOpen(true)
      await refetch()
      toast('Key rotated — update your integration', 'success')
    } catch (e) {
      toast(e.message || 'Rotation failed', 'error')
    } finally { setSaving(false) }
  }

  const revokeKey = async () => {
    if (!activeKey) return
    setSaving(true)
    try {
      await keysAPI.revoke(activeKey.id)
      setRevokeOpen(false)
      await refetch()
      toast('Key revoked permanently', 'success')
    } catch (e) {
      toast(e.message || 'Revocation failed', 'error')
    } finally { setSaving(false) }
  }

  const copyKey = (val) => {
    navigator.clipboard.writeText(val).catch(() => {})
    toast('Copied to clipboard', 'success')
  }

  const live = keys.filter(k => (k.environment || k.env) === 'live' && k.is_active !== false)
  const test = keys.filter(k => (k.environment || k.env) === 'test' && k.is_active !== false)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 4 }}>API Keys</p>
          <p style={{ fontSize: 13, color: S.text2 }}>
            Manage credentials for the Valcr Data API. Keys are hashed on our servers — we never store the raw value.
          </p>
        </div>
        <Btn variant="primary" onClick={() => setCreateOpen(true)}>+ Create key</Btn>
      </div>

      {/* Security callout */}
      <div style={{
        background: S.accentDim, border: `1px solid ${S.borderHi}`,
        borderRadius: 4, padding: '10px 14px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: S.mono, fontSize: 11, color: S.accent,
      }}>
        ⚿ Keys are shown only once at creation. Store them securely — we cannot recover them.
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={24} /></div>
      ) : keys.length === 0 ? (
        <EmptyState
          icon="⌗"
          title="No API keys yet"
          sub="Create your first key to start making authenticated requests to the Valcr Data API."
          action={<Btn variant="primary" onClick={() => setCreateOpen(true)}>Create your first key</Btn>}
        />
      ) : (
        <>
          {live.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Label style={{ margin: 0 }}>Live keys</Label>
                <span style={{ fontFamily: S.mono, fontSize: 10, color: S.text3 }}>({live.length})</span>
              </div>
              {live.map(k => (
                <KeyCard
                  key={k.id} k={k}
                  onRotate={k => { setActiveKey(k); setRotateOpen(true) }}
                  onRevoke={k => { setActiveKey(k); setRevokeOpen(true) }}
                  onCopy={copyKey}
                />
              ))}
            </div>
          )}

          {test.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Label style={{ margin: 0 }}>Test keys</Label>
                <span style={{ fontFamily: S.mono, fontSize: 10, color: S.text3 }}>({test.length})</span>
              </div>
              {test.map(k => (
                <KeyCard
                  key={k.id} k={k}
                  onRotate={k => { setActiveKey(k); setRotateOpen(true) }}
                  onRevoke={k => { setActiveKey(k); setRevokeOpen(true) }}
                  onCopy={copyKey}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Create modal ─────────────────────────────── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create API key" sub="Choose a name, environment, and the scopes this key will be allowed to access.">
        <Input
          label="Key name"
          placeholder="e.g. Production underwriting"
          value={newForm.name}
          onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
        />
        <Select
          label="Environment"
          value={newForm.env}
          onChange={e => setNewForm(p => ({ ...p, env: e.target.value }))}
        >
          <option value="live">Live (production)</option>
          <option value="test">Test (sandbox)</option>
        </Select>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: S.text2, marginBottom: 8 }}>
            Scopes — select access level
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ALL_SCOPES.map(sc => {
              const checked = newForm.scopes.includes(sc)
              return (
                <label key={sc} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px', borderRadius: 4, cursor: 'pointer',
                  background: checked ? S.accentDim : S.surface,
                  border: `1px solid ${checked ? S.borderHi : S.border}`,
                  transition: 'all .1s',
                }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleScope(sc)}
                    style={{ accentColor: S.accent }}
                  />
                  <div>
                    <Mono style={{ fontSize: 11, color: checked ? S.accent : S.text2 }}>{sc}</Mono>
                    <p style={{ fontSize: 10, color: S.text3, marginTop: 1 }}>{SCOPE_DESC[sc]}</p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Btn>
          <Btn variant="primary"   onClick={createKey} disabled={saving}>
            {saving ? 'Creating…' : 'Create key'}
          </Btn>
        </div>
      </Modal>

      {/* ── Reveal modal ─────────────────────────────── */}
      <Modal open={revealOpen} onClose={() => setRevealOpen(false)} title="Your new API key">
        <div style={{
          background: S.greenDim, border: `1px solid rgba(52,211,153,.25)`,
          borderRadius: 4, padding: '9px 12px', marginBottom: 12,
          fontFamily: S.mono, fontSize: 11, color: S.green,
        }}>
          ✓ Copy this key now — it will not be shown again.
        </div>
        <div style={{
          background: S.bgDeep, border: `1px solid ${S.border}`,
          borderRadius: 4, padding: '12px 14px', fontFamily: S.mono,
          fontSize: 12, color: S.text, wordBreak: 'break-all',
          marginBottom: 14, lineHeight: 1.6,
        }}>
          {revealedKey}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="primary" onClick={() => copyKey(revealedKey)}>Copy key</Btn>
          <Btn variant="secondary" onClick={() => setRevealOpen(false)}>I've saved it</Btn>
        </div>
      </Modal>

      {/* ── Rotate modal ─────────────────────────────── */}
      <Modal open={rotateOpen} onClose={() => setRotateOpen(false)} title="Rotate key" sub={`Rotating "${activeKey?.name}" will immediately invalidate the current key. Update your integration before confirming.`} danger>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setRotateOpen(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={rotateKey} disabled={saving}>
            {saving ? 'Rotating…' : 'Rotate key'}
          </Btn>
        </div>
      </Modal>

      {/* ── Revoke modal ─────────────────────────────── */}
      <Modal open={revokeOpen} onClose={() => setRevokeOpen(false)} title="Revoke key" sub={`This will permanently revoke "${activeKey?.name}". All requests using this key will fail immediately.`} danger>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setRevokeOpen(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={revokeKey} disabled={saving}>
            {saving ? 'Revoking…' : 'Revoke permanently'}
          </Btn>
        </div>
      </Modal>
    </div>
  )
}
