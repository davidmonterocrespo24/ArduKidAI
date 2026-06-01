// Chat session history, stored in localStorage and keyed by the logged-in user
// (or "guest"). Each session keeps its message transcript so the kid can reopen
// a past conversation from the history button. Anonymous history lives under
// "guest" and is kept separate per browser.

import type { ChatMessage } from '../types/circuit'

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  board?: string
  updatedAt: number
}

const KEY_PREFIX = 'ardukid:chat-history:'
const MAX_SESSIONS = 40

function storageKey(userKey: string): string {
  return KEY_PREFIX + (userKey || 'guest')
}

export function listSessions(userKey: string): ChatSession[] {
  try {
    const raw = localStorage.getItem(storageKey(userKey))
    if (!raw) return []
    const arr = JSON.parse(raw) as ChatSession[]
    return Array.isArray(arr) ? arr.slice().sort((a, b) => b.updatedAt - a.updatedAt) : []
  } catch {
    return []
  }
}

function writeAll(userKey: string, sessions: ChatSession[]): void {
  try {
    localStorage.setItem(storageKey(userKey), JSON.stringify(sessions.slice(0, MAX_SESSIONS)))
  } catch {
    /* quota or disabled storage - history is best-effort */
  }
}

export function saveSession(userKey: string, session: Omit<ChatSession, 'updatedAt'>): void {
  if (!session.messages.some((m) => m.role === 'user')) return // skip empty chats
  const rest = listSessions(userKey).filter((s) => s.id !== session.id)
  writeAll(userKey, [{ ...session, updatedAt: Date.now() }, ...rest])
}

export function deleteSession(userKey: string, id: string): void {
  writeAll(userKey, listSessions(userKey).filter((s) => s.id !== id))
}

export function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user' && m.text.trim())
  if (firstUser) return firstUser.text.trim().slice(0, 60)
  return `Chat ${new Date().toLocaleString()}`
}
