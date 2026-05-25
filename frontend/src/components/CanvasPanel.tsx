import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { DynamicComponent } from './DynamicComponent'
import { ComponentPicker } from './ComponentPicker'
import { WireDialog } from './WireDialog'

export function CanvasPanel() {
  const components = useAppStore((s) => s.components)
  const wires = useAppStore((s) => s.wires)
  const removeComponent = useAppStore((s) => s.removeComponent)
  const removeWire = useAppStore((s) => s.removeWire)
  const [wireOpen, setWireOpen] = useState(false)

  const periphs = components.filter((c) => c.type !== 'uno')

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">Circuit</h2>
          <span className="text-[11px] text-slate-500">
            {components.length} part{components.length === 1 ? '' : 's'} &middot; {wires.length} wire
            {wires.length === 1 ? '' : 's'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setWireOpen(true)}
          className="rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
        >
          + Wire (dropdown)
        </button>
      </header>

      <div className="shrink-0 border-b border-slate-200 px-3 py-2">
        <ComponentPicker />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="flex w-full flex-col items-center gap-8">
          <div className="self-center">
            <wokwi-arduino-uno />
          </div>

          {periphs.length > 0 && (
            <div className="flex flex-wrap items-end justify-center gap-x-10 gap-y-6">
              {periphs.map((instance) => (
                <div key={instance.id} className="group relative flex flex-col items-center gap-1">
                  <DynamicComponent instance={instance} />
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">{instance.id}</span>
                    <button
                      type="button"
                      onClick={() => removeComponent(instance.id)}
                      title={`Remove ${instance.id}`}
                      className="rounded border border-rose-200 px-1.5 text-[10px] font-medium text-rose-600 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50"
                    >
                      remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {components.length === 0 && (
            <div className="rounded border border-dashed border-slate-300 px-6 py-4 text-center text-sm text-slate-500">
              Ask the agent to build something, or use the Add buttons above to drop parts yourself.
            </div>
          )}

          {wires.length > 0 && (
            <div className="w-full max-w-2xl">
              <p className="mb-1 text-xs font-medium text-slate-500">Wires</p>
              <ul className="space-y-1 rounded border border-slate-200 bg-slate-50 p-2">
                {wires.map((w, i) => (
                  <li
                    key={`${w.from_pin}-${w.to_pin}-${i}`}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1 font-mono text-[11px] text-slate-700 hover:bg-white"
                  >
                    <span>
                      {w.from_pin} <span className="text-slate-400">to</span> {w.to_pin}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeWire(i)}
                      className="rounded border border-rose-200 px-1.5 text-[10px] font-medium text-rose-600 hover:bg-rose-50"
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <WireDialog open={wireOpen} onClose={() => setWireOpen(false)} />
    </section>
  )
}
