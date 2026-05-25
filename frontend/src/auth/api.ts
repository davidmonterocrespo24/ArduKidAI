import { apiUrl } from '../lib/api'
import { authHeader, setAuthToken } from './token'

export interface UserPublic {
  id: string
  email: string
  created_at: string
}

interface AuthResponse {
  token: string
  user: UserPublic
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const parsed = (await res.json()) as { detail?: string }
      if (parsed?.detail) detail = parsed.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return (await res.json()) as T
}

export async function signup(email: string, password: string): Promise<UserPublic> {
  const res = await request<AuthResponse>('/api/auth/signup', { email, password })
  setAuthToken(res.token)
  return res.user
}

export async function signin(email: string, password: string): Promise<UserPublic> {
  const res = await request<AuthResponse>('/api/auth/signin', { email, password })
  setAuthToken(res.token)
  return res.user
}

export function signout(): void {
  setAuthToken(null)
}

export async function fetchCurrentUser(): Promise<UserPublic | null> {
  const res = await fetch(apiUrl('/api/auth/me'), {
    headers: { ...authHeader() },
  })
  if (!res.ok) return null
  const body = (await res.json()) as UserPublic | null
  return body
}
