import { clearSession, readSession } from './session.js'

export const API_BASE = (
  import.meta.env.VITE_API_URL || 'https://api.valcr.site/api/v1'
).replace(/\/+$/, '')

const DEFAULT_TIMEOUT_MS = 20_000

function formatApiError(payload, status) {
  const detail = payload?.detail ?? payload?.message ?? payload?.error

  if (typeof detail === 'string' && detail.trim()) return detail

  if (Array.isArray(detail)) {
    return detail
      .map(item => {
        if (typeof item === 'string') return item
        const location = Array.isArray(item?.loc)
          ? item.loc.filter(part => part !== 'body').join('.')
          : ''
        return `${location ? `${location}: ` : ''}${item?.msg || JSON.stringify(item)}`
      })
      .join('; ')
  }

  if (detail && typeof detail === 'object') {
    return detail.message || detail.error || detail.hint || JSON.stringify(detail)
  }

  return `Request failed with HTTP ${status}`
}

async function readResponse(response) {
  const text = await response.text()
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

export async function apiFetch(path, options = {}) {
  const {
    auth = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    body,
    headers: customHeaders,
    signal: externalSignal,
    ...fetchOptions
  } = options

  const session = auth ? readSession() : null
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  const headers = {
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...(customHeaders || {}),
  }

  let serializedBody = body
  if (body !== undefined && typeof body !== 'string' && !(body instanceof FormData)) {
    serializedBody = JSON.stringify(body)
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      body: serializedBody,
      signal: externalSignal || controller.signal,
    })

    const payload = await readResponse(response)

    if (!response.ok) {
      if (response.status === 401 && auth) {
        clearSession()
        window.dispatchEvent(new CustomEvent('valcr:unauthorized'))
      }
      throw new Error(formatApiError(payload, response.status))
    }

    return payload
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`The API did not respond within ${Math.round(timeoutMs / 1000)} seconds.`)
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}
