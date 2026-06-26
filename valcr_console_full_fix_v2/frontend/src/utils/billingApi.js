import { apiFetch } from './http.js'

export const billingAPI = {
  plan: () => apiFetch('/console/billing/subscription'),

  checkout: plan =>
    apiFetch('/console/billing/checkout', {
      method: 'POST',
      body: { plan },
    }),

  verify: reference =>
    apiFetch(`/console/billing/verify?reference=${encodeURIComponent(reference)}`),

  cancel: () =>
    apiFetch('/console/billing/cancel', {
      method: 'POST',
    }),
}
