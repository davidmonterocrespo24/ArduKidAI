import { Suspense, lazy } from 'react'
import { useAppStore, type RightTab } from '../store/useAppStore'
import { cn } from '../lib/cn'

const BlocklyPanel = lazy(() =>
  import('./BlocklyPanel').then((mod) => ({ default: mod.BlocklyPanel })),
)
const CodePanel = lazy(() =>
  import('./CodePanel').then((mod) => ({ default: mod.CodePanel })),
)

const TABS: { id: RightTab; label: string }[] = [
  { id: 'blockly', label: 'Blocks' },
  { id: 'code', label: 'Arduino code' },
]

function PanelFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
      Loading editor...
    </div>
  )
}

export function RightTabs() {
  const tab = useAppStore((s) => s.rightTab)
  const setTab = useAppStore((s) => s.setRightTab)

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex shrink-0 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 px-3 py-2 text-sm font-semibold',
              tab === t.id
                ? 'border-b-2 border-brand-500 text-brand-600'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<PanelFallback />}>
          {tab === 'blockly' ? <BlocklyPanel /> : <CodePanel />}
        </Suspense>
      </div>
    </section>
  )
}
