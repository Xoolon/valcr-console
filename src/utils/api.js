// src/utils/api.js — Valcr Console API client
// All calls to the backend go through here. Token is read from localStorage.

import { API } from '../styles/tokens.js'

function getToken() {
  try {
    const raw = localStorage.getItem('vcr_console_auth')
    return raw ? JSON.parse(raw)?.token : null
  } catch { return null }
}

function authHeaders() {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request(method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: authHeaders(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.detail || data.message || `HTTP ${r.status}`)
  return data
}

// ── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:    (email, password)        => request('POST', '/auth/login', { email, password }),
  register: (first_name, email, pw)  => request('POST', '/auth/register', { first_name, email, password: pw }),
  me:       ()                       => request('GET',  '/auth/me'),
  logout:   ()                       => request('POST', '/auth/logout').catch(() => null),
  changePassword: (current, next)    => request('POST', '/auth/change-password', { current_password: current, new_password: next }),
  updateProfile: (fields)            => request('PATCH', '/auth/me', fields),
  deleteAccount: ()                  => request('DELETE', '/auth/me'),
}

// ── API Keys (Console) ───────────────────────────────────────────────────────
export const keysAPI = {
  list:   ()                    => request('GET',    '/console/keys'),
  create: (name, env, scopes)   => request('POST',   '/console/keys', { name, environment: env, scopes }),
  rotate: (id)                  => request('POST',   `/console/keys/${id}/rotate`),
  revoke: (id)                  => request('DELETE', `/console/keys/${id}`),
}

// ── Usage ────────────────────────────────────────────────────────────────────
export const usageAPI = {
  summary: ()        => request('GET', '/console/usage/summary'),
  history: (days)    => request('GET', `/console/usage/history?days=${days || 14}`),
  byKey:   ()        => request('GET', '/console/usage/by-key'),
  byEndpoint: ()     => request('GET', '/console/usage/by-endpoint'),
}

// ── Logs ─────────────────────────────────────────────────────────────────────
export const logsAPI = {
  list: (params = {}) => {
    const q = new URLSearchParams()
    if (params.status)   q.set('status_prefix', params.status)
    if (params.endpoint) q.set('endpoint', params.endpoint)
    if (params.key_id)   q.set('key_id', params.key_id)
    q.set('limit', params.limit || 500)
    return request('GET', `/console/logs?${q}`)
  },
  exportCsv: () => fetch(`${API}/console/logs/export`, {
    headers: authHeaders()
  }).then(r => r.blob()),
}

// ── Billing ──────────────────────────────────────────────────────────────────
export const billingAPI = {
  plan:       ()          => request('GET', '/console/billing/plan'),
  invoices:   ()          => request('GET', '/console/billing/invoices'),
  portal:     ()          => request('POST', '/console/billing/portal'),
  checkout:   (tier)      => request('POST', '/console/billing/checkout', { tier }),
}

// ── Webhooks ─────────────────────────────────────────────────────────────────
export const webhooksAPI = {
  get:     ()           => request('GET',   '/console/webhooks'),
  save:    (url, events)=> request('POST',  '/console/webhooks', { url, events }),
  delete:  ()           => request('DELETE','/console/webhooks'),
  test:    ()           => request('POST',  '/console/webhooks/test'),
}

// ── Health (public, no auth) ─────────────────────────────────────────────────
export const healthAPI = {
  check: () => fetch(`${API}/health`).then(r => r.json()),
}
