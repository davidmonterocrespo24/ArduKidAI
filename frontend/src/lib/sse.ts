export interface SseMessage {
  event: string
  data: string
}

/**
 * Parses a fetch ReadableStream as Server-Sent Events. Yields one SseMessage
 * per "event block" (lines ended by a blank line). Robust to chunk boundaries
 * landing in the middle of a line.
 */
export async function* sseStream(response: Response): AsyncGenerator<SseMessage> {
  if (!response.body) {
    throw new Error('response has no body to stream')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })

    let separatorIndex = buffer.indexOf('\n\n')
    while (separatorIndex !== -1) {
      const block = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)
      const parsed = parseBlock(block)
      if (parsed) yield parsed
      separatorIndex = buffer.indexOf('\n\n')
    }
  }

  if (buffer.trim().length > 0) {
    const parsed = parseBlock(buffer)
    if (parsed) yield parsed
  }
}

function parseBlock(raw: string): SseMessage | null {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of raw.split('\n')) {
    if (line === '' || line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim())
    }
  }
  if (dataLines.length === 0 && event === 'message') return null
  return { event, data: dataLines.join('\n') }
}
