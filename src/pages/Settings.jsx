// src/pages/Settings.jsx — Account settings, all connected to real backend
import { useState } from 'react'
import { useAuth }         from '../contexts/AuthContext.jsx'
import { useToast }        from '../contexts/ToastContext.jsx'
import { authAPI }         from '../utils/api.js'
import { S, TIER_COLOR }   from '../styles/tokens.js'
import { Card, Label, Mono, Input, Btn, Divider, Badge } from '../components/ui/index.jsx'

export function SettingsPage() {
  const { auth, logout, updateLocal } = useAuth()
  const toast = useToast()

  // Profile
  const [firstName, setFirstName] = useState(auth?.firstName || '')
  const [savingProfile, setSavingProfile] = useState(false)

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      await authAPI.updateProfile({ first_name: firstName })
      updateLocal({ firstName })
      toast('Profile updated', 'success')
    } catch (e) {
      toast(e.message || 'Update failed', 'error')
    } finally { setSavingProfile(false) }
  }

  // Password
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [savingPw, setSavingPw] = useState(false)

  const savePw = async () => {
    if (!pw.current || !pw.next) { toast('All fields required', 'error'); return }
    if (pw.next !== pw.confirm)  { toast('Passwords do not match', 'error'); return }
    if (pw.next.length < 8)      { toast('Min 8 characters', 'error'); return }
    setSavingPw(true)
    try {
      await authAPI.changePassword(pw.current, pw.next)
      setPw({ current: '', next: '', confirm: '' })
      toast('Password updated', 'success')
    } catch (e) {
      toast(e.message || 'Password change failed', 'error')
    } finally { setSavingPw(false) }
  }

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const deleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') { toast('Type DELETE to confirm', 'error'); return }
    setDeleting(true)
    try {
      await authAPI.deleteAccount()
      logout()
    } catch (e) {
      toast(e.message || 'Deletion failed', 'error')
      setDeleting(false)
    }
  }

  return (
    <div>
      <p style={{ fontSize: 20, fontWeight: 700, color: S.text, marginBottom: 4 }}>Settings</p>
      <p style={{ fontSize: 13, color: S.text2, marginBottom: 28 }}>
        Manage your account profile and security settings.
      </p>

      {/* Account info */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: S.text }}>Account</p>
          <Badge color={TIER_COLOR[auth?.tier] || 'blue'}>{auth?.tier || 'developer'}</Badge>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <Label>Email</Label>
            <Mono style={{ fontSize: 13, color: S.text2 }}>{auth?.email || '—'}</Mono>
          </div>
          <div>
            <Label>Account ID</Label>
            <Mono style={{ fontSize: 13, color: S.text3 }}>{auth?.id || '—'}</Mono>
          </div>
        </div>

        <Divider />

        <p style={{ fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 14 }}>Display name</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Input
              label="First name"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveProfile()}
              style={{ marginBottom: 0 }}
            />
          </div>
          <Btn variant="primary" size="sm" onClick={saveProfile} disabled={savingProfile} style={{ marginBottom: 16 }}>
            {savingProfile ? 'Saving…' : 'Save'}
          </Btn>
        </div>
      </Card>

      {/* Password */}
      <Card style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 16 }}>Change password</p>
        <Input
          label="Current password"
          type="password"
          placeholder="••••••••"
          value={pw.current}
          onChange={e => setPw(p => ({ ...p, current: e.target.value }))}
        />
        <Input
          label="New password"
          type="password"
          placeholder="Min. 8 characters"
          value={pw.next}
          onChange={e => setPw(p => ({ ...p, next: e.target.value }))}
        />
        <Input
          label="Confirm new password"
          type="password"
          placeholder="••••••••"
          value={pw.confirm}
          onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="primary" size="sm" onClick={savePw} disabled={savingPw}>
            {savingPw ? 'Updating…' : 'Update password'}
          </Btn>
        </div>
      </Card>

      {/* API Key security info */}
      <Card style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 14 }}>API key security</p>
        {[
          { label: 'Storage',       val: 'SHA-256 hash only — raw keys never stored on server' },
          { label: 'Transmission',  val: 'TLS 1.3 in transit, keys shown once at creation' },
          { label: 'Rotation',      val: 'Immediate invalidation of previous key on rotate' },
          { label: 'Rate limiting', val: 'Per-key: 100 req/min · 10,000 req/day · auto-reset UTC midnight' },
          { label: 'Auto-billing',  val: 'Quota exhaustion triggers Paystack charge and resets balance' },
        ].map(row => (
          <div key={row.label} style={{
            display: 'flex', gap: 16, padding: '8px 0',
            borderBottom: `1px solid ${S.border}`,
          }}>
            <Mono style={{ fontSize: 11, color: S.text3, minWidth: 110 }}>{row.label}</Mono>
            <span style={{ fontSize: 12, color: S.text2 }}>{row.val}</span>
          </div>
        ))}
      </Card>

      {/* Danger zone */}
      <div style={{
        background: S.redDim, border: '1px solid rgba(255,107,107,.25)',
        borderRadius: 4, padding: '18px 20px',
      }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: S.red, marginBottom: 8 }}>Danger zone</p>
        <p style={{ fontSize: 12, color: S.text2, marginBottom: 14 }}>
          Deleting your account is permanent. All API keys, usage history, and billing data will be removed immediately.
          Active subscriptions are cancelled automatically.
        </p>
        <Input
          label='Type DELETE to confirm'
          placeholder="DELETE"
          value={deleteConfirm}
          onChange={e => setDeleteConfirm(e.target.value)}
          style={{ borderColor: 'rgba(255,107,107,.4)' }}
        />
        <Btn
          variant="danger"
          onClick={deleteAccount}
          disabled={deleteConfirm !== 'DELETE' || deleting}
        >
          {deleting ? 'Deleting account…' : 'Delete my account permanently'}
        </Btn>
      </div>
    </div>
  )
}
