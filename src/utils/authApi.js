import { apiFetch } from './http.js'

export const authAPI = {
  login: ({ email, password }) =>
    apiFetch('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    }),

  register: ({ firstName, lastName, email, password }) =>
    apiFetch('/auth/register', {
      method: 'POST',
      auth: false,
      body: {
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      },
    }),

  google: accessToken =>
    apiFetch('/auth/oauth', {
      method: 'POST',
      auth: false,
      body: {
        provider: 'google',
        access_token: accessToken,
      },
    }),

  me: () => apiFetch('/auth/me'),

  resendVerification: () =>
    apiFetch('/auth/resend-verification', {
      method: 'POST',
    }),
}
