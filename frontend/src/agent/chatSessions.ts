// Backend-driven chat history. The agent's conversations are persisted in
// MongoDB by the ADK MongoSessionService; these endpoints list, load, and
// delete them, scoped to the signed-in user (or the anonymous client id).

import { apiUrl, getJson } from '../lib/api'
import { authHeader } from '../auth/token'
import { getClientId } from '../lib/clientId'
import type { ChatMessage } from '../types/circuit'

export interface ChatSessionSummary {
  id: string
  title: string
  updated_at: number
}

export interface ChatTranscript {
  id: string
  title: string
  messages: ChatMessage[]
}

function q(path: string): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}client_id=${encodeURIComponent(getClientId())}`
}

export async function listChatSessions(): Promise<ChatSessionSummary[]> {
  return getJson<ChatSessionSummary[]>(q('/api/agent/sessions'))
}

export async function getChatSession(id: string): Promise<ChatTranscript> {
  return getJson<ChatTranscript>(q(`/api/agent/sessions/${encodeURIComponent(id)}`))
}

export async function deleteChatSession(id: string): Promise<void> {
  const res = await fetch(apiUrl(q(`/api/agent/sessions/${encodeURIComponent(id)}`)), {
    method: 'DELETE',
    headers: { ...authHeader() },
  })
  if (!res.ok) throw new Error(`delete chat failed: ${res.status}`)
}
