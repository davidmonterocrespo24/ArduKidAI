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
   
  console.log('[sse] start, body=', !!response.body)
  if (!response.body) {
    throw new Error('response has no body to stream')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let chunks = 0

  while (true) {
    const { value, done } = await reader.read()
    if (done) {
       
      console.log('[sse] reader done, chunks=', chunks, 'remaining buffer=', buffer.length)
      break
    }
    chunks += 1
    buffer += decoder.decode(value, { stream: true })
     
    console.log('[sse] chunk', chunks, value.byteLength, 'buffer len', buffer.length)

    let separatorIndex = nextSeparator(buffer)
    while (separatorIndex.index !== -1) {
      const block = buffer.slice(0, separatorIndex.index)
      buffer = buffer.slice(separatorIndex.index + separatorIndex.length)
      const parsed = parseBlock(block)
      if (parsed) yield parsed
      separatorIndex = nextSeparator(buffer)
    }
  }

  if (buffer.trim().length > 0) {
    const parsed = parseBlock(buffer)
    if (parsed) yield parsed
  }
}

// Match either LF-LF or CRLF-CRLF, whichever comes first. sse-starlette uses
// CRLF per the SSE spec; the original parser only handled LF-LF and silently
// produced zero events.
function nextSeparator(buffer: string): { index: number; length: number } {
  const lf = buffer.indexOf('\n\n')
  const cr = buffer.indexOf('\r\n\r\n')
  if (lf === -1 && cr === -1) return { index: -1, length: 0 }
  if (lf === -1) return { index: cr, length: 4 }
  if (cr === -1) return { index: lf, length: 2 }
  return cr < lf ? { index: cr, length: 4 } : { index: lf, length: 2 }
}

function parseBlock(raw: string): SseMessage | null {
  let event = 'message'
  const dataLines: string[] = []
  // Split on either LF or CRLF.
  for (const line of raw.split(/\r?\n/)) {
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
