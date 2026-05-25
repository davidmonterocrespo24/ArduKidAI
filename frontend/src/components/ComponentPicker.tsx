import { useAppStore } from '../store/useAppStore'
import { PERIPHERAL_COMPONENTS } from '../lib/componentCatalog'
import { nextComponentId } from '../lib/nextComponentId'

export function ComponentPicker() {
  const components = useAppStore((s) => s.components)
  const addComponent = useAppStore((s) => s.addComponent)

  function add(meta: (typeof PERIPHERAL_COMPONENTS)[number]) {
    const id = nextComponentId(meta.type, components)
    addComponent({
      id,
      type: meta.type,
      x: 0,
      y: 0,
      props: { ...meta.defaultProps },
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-medium text-slate-500">Add:</span>
      {PERIPHERAL_COMPONENTS.map((meta) => (
        <button
          key={meta.type}
          type="button"
          onClick={() => add(meta)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/30"
          title={`Add ${meta.label}`}
        >
          {meta.label}
        </button>
      ))}
    </div>
  )
}
