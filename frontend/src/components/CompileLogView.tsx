import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { cn } from '../lib/cn'

const TYPE_STYLES: Record<string, string> = {
  info: 'text-slate-700',
  success: 'text-brand-700',
  warn: 'text-amber-700',
  error: 'text-rose-700',
}

const TYPE_DOT: Record<string, string> = {
  info: 'bg-slate-400',
  success: 'bg-brand-500',
  warn: 'bg-amber-500',
  error: 'bg-rose-500',
}

export function CompileLogView() {
  const log = useAppStore((s) => s.compileLog)
  const clear = useAppStore((s) => s.clearCompileLog)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [log])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5">
        <span className="text-[11px] font-medium text-slate-500">
          {log.length === 0 ? 'No compile output yet' : `${log.length} entr${log.length === 1 ? 'y' : 'ies'}`}
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={log.length === 0}
          className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-white disabled:opacity-40"
        >
          Clear
        </button>
      </div>
      <div ref={ref} className="min-h-0 flex-1 overflow-auto bg-white p-2 font-mono text-[11px] leading-relaxed">
        {log.length === 0 ? (
          <p className="text-slate-400">
            Click <span className="font-semibold">Compile &amp; run</span> in the top bar. The
            arduino-cli output appears here.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {log.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2">
                <span className="shrink-0 text-slate-400">[{entry.timestamp}]</span>
                <span
                  aria-hidden="true"
                  className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', TYPE_DOT[entry.type])}
                />
                <pre className={cn('whitespace-pre-wrap break-words', TYPE_STYLES[entry.type])}>
                  {entry.message}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
