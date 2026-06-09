import { Suspense, lazy } from 'react'
import { useAppStore, type RightTab } from '../store/useAppStore'
import { cn } from '../lib/cn'

const BlocklyPanel = lazy(() =>
  import('./BlocklyPanel').then((mod) => ({ default: mod.BlocklyPanel })),
)
const CodePanel = lazy(() =>
  import('./CodePanel').then((mod) => ({ default: mod.CodePanel })),
)
// The A2UI renderer (and its catalog) is a sizeable chunk; load it only when the
// child opens the Tutor tab or the agent sends a lesson.
const TutorPanel = lazy(() =>
  import('./TutorPanel').then((mod) => ({ default: mod.TutorPanel })),
)

const TABS: { id: RightTab; label: string }[] = [
  { id: 'blockly', label: 'Blocks' },
  { id: 'code', label: 'Arduino code' },
  { id: 'tutor', label: 'Tutor' },
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
              'flex-1 px-3 py-2 text-sm font-semibold transition-colors',
              tab === t.id
                ? 'bg-brand-500 text-white'
                : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<PanelFallback />}>
          {tab === 'blockly' ? <BlocklyPanel /> : tab === 'code' ? <CodePanel /> : <TutorPanel />}
        </Suspense>
      </div>
    </section>
  )
}
