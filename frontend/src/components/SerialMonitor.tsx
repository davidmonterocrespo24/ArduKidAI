import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { sendSerialToActiveSim } from '../sim/runner'

type LineEnding = 'none' | 'lf' | 'crlf'

export function SerialMonitor() {
  const serial = useAppStore((s) => s.serialOutput)
  const clear = useAppStore((s) => s.clearSerial)
  const simStatus = useAppStore((s) => s.simStatus)
  const ref = useRef<HTMLPreElement>(null)
  const [draft, setDraft] = useState('')
  const [ending, setEnding] = useState<LineEnding>('lf')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [serial])

  function send() {
    if (!draft) return
    let payload = draft
    if (ending === 'lf') payload += '\n'
    else if (ending === 'crlf') payload += '\r\n'
    const bytes = new TextEncoder().encode(payload)
    sendSerialToActiveSim(bytes)
    setDraft('')
  }

  const canSend = simStatus === 'running' && draft.length > 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5">
        <span className="text-[11px] font-medium text-slate-500">
          {serial.length === 0 ? 'No serial output yet' : `${serial.length} bytes`}
          <span className="ml-2 text-slate-400">9600 baud (default)</span>
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={serial.length === 0}
          className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-white disabled:opacity-40"
        >
          Clear
        </button>
      </div>
      <pre
        ref={ref}
        className="min-h-0 flex-1 overflow-auto bg-slate-950 p-3 font-mono text-[12px] leading-snug text-brand-300"
      >
        {serial.length === 0 ? (
          <span className="text-brand-700">
            {'// Anything the sketch sends with Serial.print()/println() shows up here.\n// Try Serial.println("hello") in setup().'}
          </span>
        ) : (
          serial
        )}
      </pre>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="flex shrink-0 items-center gap-1.5 border-t border-slate-200 bg-slate-50 px-2 py-1.5"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            simStatus === 'running'
              ? 'Type a line and press Send'
              : 'Start the sim to send data'
          }
          disabled={simStatus !== 'running'}
          className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none disabled:bg-slate-100"
        />
        <select
          value={ending}
          onChange={(e) => setEnding(e.target.value as LineEnding)}
          title="Line ending appended before sending"
          className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-700"
        >
          <option value="none">No ending</option>
          <option value="lf">\n</option>
          <option value="crlf">\r\n</option>
        </select>
        <button
          type="submit"
          disabled={!canSend}
          className="rounded border border-brand-300 bg-brand-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}
