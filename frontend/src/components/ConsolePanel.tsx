import { useAppStore, type BottomTab } from '../store/useAppStore'
import { cn } from '../lib/cn'
import { CompileLogView } from './CompileLogView'
import { SerialMonitor } from './SerialMonitor'

const TABS: { id: BottomTab; label: string }[] = [
  { id: 'compile', label: 'Compile output' },
  { id: 'serial', label: 'Serial monitor' },
]

export function ConsolePanel() {
  const tab = useAppStore((s) => s.bottomTab)
  const setTab = useAppStore((s) => s.setBottomTab)
  const compileCount = useAppStore((s) => s.compileLog.length)
  const serialLen = useAppStore((s) => s.serialOutput.length)

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex shrink-0 items-center border-b border-slate-200">
        {TABS.map((t) => {
          const active = tab === t.id
          const badge = t.id === 'compile' ? compileCount : serialLen
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm font-semibold',
                active
                  ? 'border-b-2 border-emerald-500 text-emerald-600'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {t.label}
              {badge > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                    active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'compile' ? <CompileLogView /> : <SerialMonitor />}
      </div>
    </section>
  )
}
