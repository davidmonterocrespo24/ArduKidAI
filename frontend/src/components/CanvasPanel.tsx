import { useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { ComponentPicker } from './ComponentPicker'
import { DraggablePart } from './DraggablePart'
import { WireDialog } from './WireDialog'
import { WireOverlay } from './WireOverlay'

// Stage size big enough to spread out the catalog. The container is
// scrollable so smaller screens can pan.
const STAGE_WIDTH = 1400
const STAGE_HEIGHT = 1000
const UNO_LEFT = 240
const UNO_TOP = 60

export function CanvasPanel() {
  const components = useAppStore((s) => s.components)
  const wires = useAppStore((s) => s.wires)
  const wireInProgress = useAppStore((s) => s.wireInProgress)
  const cancelWire = useAppStore((s) => s.cancelWire)
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
        Drag any part to move it. Click a blue pin to start a wire, click a second pin to finish.
        <kbd className="mx-1 rounded bg-white px-1 py-0.5 font-mono text-[10px] text-slate-500 shadow-sm">Esc</kbd>
        cancels.
      </p>

      <div
        ref={canvasRef}
        className="relative min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.06)_1px,transparent_0)] [background-size:20px_20px]"
        onClick={(e) => {
          if (wireInProgress && e.target === e.currentTarget) {
            cancelWire()
          }
        }}
      >
        <div className="relative" style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}>
          {/* Arduino UNO is pinned for now (user request). */}
          <div
            style={{ position: 'absolute', left: UNO_LEFT, top: UNO_TOP, userSelect: 'none' }}
            className="flex flex-col items-center gap-1"
          >
            <wokwi-arduino-uno id="UNO" />
            <span className="rounded bg-white/80 px-1 font-mono text-[10px] text-slate-600 shadow-sm">
              UNO (pinned)
            </span>
          </div>

          {periphs.map((instance) => (
            <DraggablePart key={instance.id} instance={instance} />
          ))}

          {components.length === 0 && (
            <div
              style={{ position: 'absolute', left: UNO_LEFT + 360, top: UNO_TOP + 40 }}
              className="rounded border border-dashed border-slate-300 bg-white/80 px-4 py-3 text-center text-sm text-slate-500"
            >
              Use the Add buttons above, or ask the agent.
            </div>
          )}

          <WireOverlay hostRef={canvasRef} />
        </div>
      </div>

      {wires.length > 0 && (
        <div className="shrink-0 max-h-32 overflow-auto border-t border-slate-200 bg-slate-50 px-3 py-2">
          <p className="mb-1 text-[11px] font-medium text-slate-500">Wires</p>
          <ul className="space-y-0.5">
            {wires.map((w, i) => (
              <li
                key={`${w.from_pin}-${w.to_pin}-${i}`}
                className="flex items-center justify-between gap-2 rounded px-2 py-0.5 font-mono text-[11px] text-slate-700 hover:bg-white"
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

      <WireDialog open={wireOpen} onClose={() => setWireOpen(false)} />
    </section>
  )
}
