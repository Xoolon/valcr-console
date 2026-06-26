import { apiFetch } from './http.js'

export const authAPI = {
  // Kept for emergency fallback/testing; the normal Console UI uses Valcr SSO.
  login: ({ email, password, turnstileToken = '' }) => apiFetch('/auth/login', {
    method: 'POST', auth: false,
    body: { email, password, turnstile_token: turnstileToken },
  }),
  register: ({ firstName, lastName, email, password, turnstileToken = '' }) => apiFetch('/auth/register', {
    method: 'POST', auth: false,
    body: { first_name: firstName, last_name: lastName, email, password, turnstile_token: turnstileToken },
  }),
  google: accessToken => apiFetch('/auth/oauth', {
    method: 'POST', auth: false,
    body: { provider: 'google', access_token: accessToken },
  }),
  consoleExchange: code => apiFetch('/auth/console-exchange', {
    method: 'POST', auth: false, body: { code },
  }),
  me: () => apiFetch('/auth/me'),
  resendVerification: () => apiFetch('/auth/resend-verification', { method: 'POST' }),
}
