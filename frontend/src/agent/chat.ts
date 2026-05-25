import { apiUrl } from '../lib/api'
import { sseStream } from '../lib/sse'
import { getSessionId } from '../lib/sessionId'
import { authHeader } from '../auth/token'
import { useAppStore } from '../store/useAppStore'
import { handleAgentEvent } from './dispatcher'

export async function sendChatMessage(message: string): Promise<void> {
  const trimmed = message.trim()
  if (!trimmed) return

  const store = useAppStore.getState()
  store.appendChatMessage({
    id: crypto.randomUUID(),
    role: 'user',
    text: trimmed,
  })
  store.setAgentStatus('streaming')

  try {
    const res = await fetch(apiUrl('/api/agent/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        session_id: getSessionId(),
        message: trimmed,
        circuit_state: {
          components: store.components,
          wires: store.wires,
          blockly_xml: store.blocklyXml,
          cpp_code: store.cppCode,
        },
      }),
    })

    if (!res.ok) {
      throw new Error(`agent chat returned ${res.status}`)
    }

    for await (const msg of sseStream(res)) {
      handleAgentEvent(msg.event, msg.data)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    store.appendChatMessage({
      id: crypto.randomUUID(),
      role: 'system',
      text: `Could not reach the agent: ${message}`,
    })
    store.setAgentStatus('error')
  }
}
