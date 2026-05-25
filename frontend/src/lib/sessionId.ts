const KEY = 'ardukid.sessionId'

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  const existing = window.sessionStorage.getItem(KEY)
  if (existing) return existing
  const fresh = window.crypto.randomUUID()
  window.sessionStorage.setItem(KEY, fresh)
  return fresh
}
