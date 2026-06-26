const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

export async function beginConsoleHandoff(token: string): Promise<never> {
  const response = await fetch(`${API}/auth/console-handoff`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.redirect_url) {
    throw new Error(data.detail || 'Could not open Developer Console.')
  }
  window.location.assign(data.redirect_url)
  return new Promise<never>(() => {})
}
