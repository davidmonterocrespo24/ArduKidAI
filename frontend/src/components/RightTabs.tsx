import { useAppStore, type RightTab } from '../store/useAppStore'
import { BlocklyPanel } from './BlocklyPanel'
import { CodePanel } from './CodePanel'
import { cn } from '../lib/cn'

const TABS: { id: RightTab; label: string }[] = [
  { id: 'blockly', label: 'Blocks' },
  { id: 'code', label: 'Arduino code' },
]

export function RightTabs() {
  const tab = useAppStore((s) => s.rightTab)
  const setTab = useAppStore((s) => s.setRightTab)

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 px-3 py-2 text-sm font-semibold',
              tab === t.id
                ? 'border-b-2 border-emerald-500 text-emerald-600'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </header>
      <div className="flex-1 overflow-hidden">
        {tab === 'blockly' ? <BlocklyPanel /> : <CodePanel />}
      </div>
    </section>
  )
}
