import { apiUrl } from '../lib/api'
import { sseStream } from '../lib/sse'
import { getSessionId } from '../lib/sessionId'
import { authHeader } from '../auth/token'
import { useAppStore } from '../store/useAppStore'
import { handleAgentEvent } from './dispatcher'

export interface ChatAttachment {
  mime_type: string
  data: string // base64-encoded bytes, no data: URL prefix
  name?: string
}

export async function sendChatMessage(
  message: string,
  attachments?: ChatAttachment[],
): Promise<void> {
  const trimmed = message.trim()
  const hasAttachments = !!attachments && attachments.length > 0
  if (!trimmed && !hasAttachments) return

  const store = useAppStore.getState()
  store.appendChatMessage({
    id: crypto.randomUUID(),
    role: 'user',
    text: trimmed,
    attachments: hasAttachments
      ? attachments!.map((a) => ({
          name: a.name ?? 'file',
          previewUrl: a.mime_type.startsWith('image/')
            ? `data:${a.mime_type};base64,${a.data}`
            : undefined,
        }))
      : undefined,
  })
  store.setAgentStatus('streaming')

  try {
    const res = await fetch(apiUrl('/api/agent/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        session_id: getSessionId(),
        message: trimmed,
        board: store.board,
        circuit_state: {
          components: store.components,
          wires: store.wires,
          blockly_xml: store.blocklyXml,
          cpp_code: store.cppCode,
        },
        attachments: hasAttachments ? attachments : undefined,
      }),
    })

    if (!res.ok) {
      throw new Error(`agent chat returned ${res.status}`)
    }

     
    console.log('[chat] sse open, body=', !!res.body, 'ct=', res.headers.get('content-type'))

    let yieldedCount = 0
    for await (const msg of sseStream(res)) {
      yieldedCount += 1
       
      console.log('[chat] event', yieldedCount, msg.event, msg.data.slice(0, 80))
      handleAgentEvent(msg.event, msg.data)
    }
     
    console.log('[chat] sse loop ended, total events=', yieldedCount)
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
