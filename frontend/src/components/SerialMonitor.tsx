import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'

export function SerialMonitor() {
  const serial = useAppStore((s) => s.serialOutput)
  const clear = useAppStore((s) => s.clearSerial)
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [serial])

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
        className="min-h-0 flex-1 overflow-auto bg-slate-950 p-3 font-mono text-[12px] leading-snug text-emerald-300"
      >
        {serial.length === 0 ? (
          <span className="text-emerald-700">
            {'// Anything the sketch sends with Serial.print()/println() shows up here.\n// Try Serial.println("hello") in setup().'}
          </span>
        ) : (
          serial
        )}
      </pre>
    </div>
  )
}
