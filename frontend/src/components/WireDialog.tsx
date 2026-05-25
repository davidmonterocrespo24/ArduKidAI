import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { COMPONENT_CATALOG, pinsFor } from '../lib/componentCatalog'

interface Props {
  open: boolean
  onClose: () => void
}

interface PinOption {
  value: string // "componentId.pinName"
  label: string
}

function pinOptionsFor(components: ReturnType<typeof useAppStore.getState>['components']): PinOption[] {
  const out: PinOption[] = []
  for (const pin of pinsFor('uno')) {
    out.push({ value: `UNO.${pin}`, label: `UNO ${pin}` })
  }
  for (const c of components) {
    if (c.type === 'uno') continue
    for (const pin of pinsFor(c.type)) {
      out.push({ value: `${c.id}.${pin}`, label: `${c.id} (${labelFor(c.type)}) ${pin}` })
    }
  }
  return out
}

function labelFor(type: string): string {
  return COMPONENT_CATALOG.find((c) => c.type === type)?.label ?? type
}

export function WireDialog({ open, onClose }: Props) {
  const components = useAppStore((s) => s.components)
  const addWire = useAppStore((s) => s.addWire)

  const options = useMemo(() => pinOptionsFor(components), [components])

  const [fromPin, setFromPin] = useState('')
  const [toPin, setToPin] = useState('')

  if (!open) return null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!fromPin || !toPin || fromPin === toPin) return
    addWire({ from_pin: fromPin, to_pin: toPin })
    setFromPin('')
    setToPin('')
    onClose()
  }

  function cancel() {
    setFromPin('')
    setToPin('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <h3 className="text-base font-semibold">Add a wire</h3>
        <p className="mt-1 text-xs text-slate-500">
          Pick the two pins you want to connect. Pins follow the
          <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-[10px] dark:bg-slate-800">
            componentId.pinName
          </code>
          shape.
        </p>

        <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
          From
        </label>
        <select
          value={fromPin}
          onChange={(e) => setFromPin(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="">Pick a pin...</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
          To
        </label>
        <select
          value={toPin}
          onChange={(e) => setToPin(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="">Pick a pin...</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {fromPin && toPin && fromPin === toPin && (
          <p className="mt-2 text-xs text-rose-600">From and to cannot be the same pin.</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!fromPin || !toPin || fromPin === toPin}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            Add wire
          </button>
        </div>
      </form>
    </div>
  )
}
