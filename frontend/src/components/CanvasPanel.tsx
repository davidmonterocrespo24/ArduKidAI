import { useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { DynamicComponent } from './DynamicComponent'
import { ComponentPicker } from './ComponentPicker'
import { WireDialog } from './WireDialog'
import { WireOverlay } from './WireOverlay'

export function CanvasPanel() {
  const components = useAppStore((s) => s.components)
  const wires = useAppStore((s) => s.wires)
  const wireInProgress = useAppStore((s) => s.wireInProgress)
  const cancelWire = useAppStore((s) => s.cancelWire)
  const removeComponent = useAppStore((s) => s.removeComponent)
  const removeWire = useAppStore((s) => s.removeWire)
  const [wireOpen, setWireOpen] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

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
          {wireInProgress && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              Wiring from <code className="font-mono">{wireInProgress.from_pin}</code> - click a second pin or press Esc
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setWireOpen(true)}
          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          title="Pick pins from dropdowns instead of clicking"
        >
          dropdown wire
        </button>
      </header>

      <div className="shrink-0 border-b border-slate-200 px-3 py-2">
        <ComponentPicker />
      </div>

      <p className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
        Click any blue pin to start a wire. Click a second pin to finish it. Press
        <kbd className="mx-1 rounded bg-white px-1 py-0.5 font-mono text-[10px] text-slate-500 shadow-sm">Esc</kbd>
        to cancel.
      </p>

      <div
        ref={canvasRef}
        className="relative min-h-0 flex-1 overflow-auto p-6"
        onClick={(e) => {
          if (wireInProgress && e.target === e.currentTarget) {
            cancelWire()
          }
        }}
      >
        <div className="relative flex w-full flex-col items-center gap-8">
          <div className="self-center">
            <wokwi-arduino-uno id="UNO" />
          </div>

          {periphs.length > 0 && (
            <div className="flex flex-wrap items-end justify-center gap-x-10 gap-y-8">
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
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-4 rounded"
                        style={{ background: w.color ?? '#1f2937' }}
                      />
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

        <WireOverlay hostRef={canvasRef} />
      </div>

      <WireDialog open={wireOpen} onClose={() => setWireOpen(false)} />
    </section>
  )
}
