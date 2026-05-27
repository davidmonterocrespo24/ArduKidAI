import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { AddComponentModal } from './AddComponentModal'
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
  const wireInProgress = useAppStore((s) => s.wireInProgress)
  const cancelWire = useAppStore((s) => s.cancelWire)
  const selectWire = useAppStore((s) => s.selectWire)
  const [wireOpen, setWireOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(components.length)

  // When a new part is added, scroll the canvas back to the top-left so the
  // kid actually sees it (the spawn position is up there).
  useEffect(() => {
    if (components.length > prevCountRef.current && canvasRef.current) {
      canvasRef.current.scrollTo({ left: 0, top: 0, behavior: 'smooth' })
    }
    prevCountRef.current = components.length
  }, [components.length])

  const periphs = components.filter((c) => c.type !== 'uno')

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-md border border-brand-300 bg-brand-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-600"
          >
            Add component
          </button>
          {wireInProgress && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
              Wiring from <code className="font-mono">{wireInProgress.from_pin}</code> - click a second pin or press Esc
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setWireOpen(true)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
          title="Pick pins from dropdowns instead of clicking"
        >
          dropdown wire
        </button>
      </div>

      <div
        ref={canvasRef}
        data-canvas-scroller
        className="relative min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.06)_1px,transparent_0)] [background-size:20px_20px]"
        onClick={(e) => {
          if (e.target !== e.currentTarget) return
          if (wireInProgress) cancelWire()
          selectWire(null)
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

      <WireDialog open={wireOpen} onClose={() => setWireOpen(false)} />
      <AddComponentModal open={addOpen} onClose={() => setAddOpen(false)} />
    </section>
  )
}
