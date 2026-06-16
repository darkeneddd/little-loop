// Thin fetch wrapper for the FastAPI backend. Relative paths work in dev via
// vite.config.js's proxy and in prod once frontend + backend share an origin
// (or VITE_API_BASE is set to override).
const BASE = import.meta.env.VITE_API_BASE || ''

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${body}`)
  }
  return res.json()
}

export function getGarment(id) {
  return request(`/garments/${id}`)
}

export function listGarments(filters = {}) {
  const params = new URLSearchParams()
  if (filters.size) params.set('size', filters.size)
  if (filters.condition_min != null) params.set('condition_min', filters.condition_min)
  if (filters.price_max != null) params.set('price_max', filters.price_max)
  const qs = params.toString()
  return request(`/garments${qs ? `?${qs}` : ''}`)
}

export function assessImage(imageBase64) {
  return request('/assess', {
    method: 'POST',
    body: JSON.stringify({ image_base64: imageBase64 }),
  })
}

export function submitTradeIn(payload) {
  return request('/trade-in', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getDashboard() {
  return request('/dashboard')
}

export function purchaseGarment(id) {
  return request(`/garments/${id}/purchase`, { method: 'POST' })
}
