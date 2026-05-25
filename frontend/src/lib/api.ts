const RAW = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8080').replace(/\/+$/, '')

export const API_BASE = RAW

export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${suffix}`
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST ${path} failed: ${res.status} ${res.statusText} ${text}`)
  }
  return res.json() as Promise<T>
}
