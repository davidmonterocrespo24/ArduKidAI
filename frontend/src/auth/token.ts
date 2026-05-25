const KEY = 'ardukid.authToken'

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(KEY)
}

export function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return
  if (token === null) {
    window.localStorage.removeItem(KEY)
  } else {
    window.localStorage.setItem(KEY, token)
  }
}

export function authHeader(): Record<string, string> {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
