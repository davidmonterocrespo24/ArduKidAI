import { useAppStore } from '../store/useAppStore'
import { PERIPHERAL_COMPONENTS } from '../lib/componentCatalog'
import { nextComponentId } from '../lib/nextComponentId'

// Spawn near the top-left corner of the stage so newly added parts are
// always visible no matter how small the canvas panel is. The UNO sits at
// (240, 60), so we lay parts out from the top-left where they cannot
// overlap it. The kid can drag them anywhere afterwards.
const SPAWN_GRID_X = 130
const SPAWN_GRID_Y = 140
const SPAWN_ORIGIN_X = 20
const SPAWN_ORIGIN_Y = 20
const SPAWN_COLS = 2

export function ComponentPicker() {
  const components = useAppStore((s) => s.components)
  const addComponent = useAppStore((s) => s.addComponent)

  function add(meta: (typeof PERIPHERAL_COMPONENTS)[number]) {
    const id = nextComponentId(meta.type, components)
    // Spread new parts in a grid below the UNO so they do not all stack at
    // the origin. The kid can drag them around freely afterwards.
    const peripheralCount = components.filter((c) => c.type !== 'uno').length
    const col = peripheralCount % SPAWN_COLS
    const row = Math.floor(peripheralCount / SPAWN_COLS)
    addComponent({
      id,
      type: meta.type,
      x: SPAWN_ORIGIN_X + col * SPAWN_GRID_X,
      y: SPAWN_ORIGIN_Y + row * SPAWN_GRID_Y,
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
