const BASE = import.meta.env.VITE_SERVER_URL || ''

export function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${BASE}${path}`, init)
}
