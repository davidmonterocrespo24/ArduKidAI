import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { isActive } from '../sim/pinState'
import { getBoard } from '../sim/boards'
import { AddComponentModal } from './AddComponentModal'
import { DraggablePart } from './DraggablePart'
import { WireDialog } from './WireDialog'
import { WireOverlay } from './WireOverlay'
import { IconPlus } from './Icons'

// Stage size big enough to spread out the catalog. The container is
// scrollable so smaller screens can pan. The board sits just to the right
// of the single-column parts gutter (~x=20..220) and close enough to the
// left that it stays visible in a narrow canvas, instead of hiding off the
// right edge next to the chat panel.
const STAGE_WIDTH = 1000
const STAGE_HEIGHT = 1000
const UNO_LEFT = 300
const UNO_TOP = 60

// Render the selected board's wokwi element with its built-in LED indicators
// bound to the live sim: the L LED follows pin D13, RX/TX flicker on USART pin
// activity, ledPower stays on while the sim is running. Without this binding
// the SVG ships dark even though D13 is being toggled. The element tag and id
// come from the board registry so UNO/Nano/Mega all render correctly.
function ArduinoBoard() {
  const ref = useRef<HTMLElement>(null)
  const board = useAppStore((s) => s.board)
  const pinLevels = useAppStore((s) => s.pinLevels)
  const pinActivity = useAppStore((s) => s.pinActivity)
  const simStatus = useAppStore((s) => s.simStatus)
  const cfg = getBoard(board)
  const props = useMemo(
    () => ({
      led13: !!pinLevels.D13,
      // D0 = USART RX, D1 = USART TX. We do not own a real serial RX
      // signal, so RX stays dark; TX flickers on D1 toggles which the
      // pin-activity heartbeat already tracks.
      ledTX: isActive('D1', pinActivity, 200),
      ledRX: false,
      ledPower: simStatus === 'running',
    }),
    [pinLevels.D13, pinActivity, simStatus],
  )
  useEffect(() => {
    if (!ref.current) return
    const el = ref.current as unknown as Record<string, unknown>
    for (const [k, v] of Object.entries(props)) el[k] = v
  }, [props])
  if (cfg.id === 'nano') return <wokwi-arduino-nano ref={ref} id={cfg.canvasId} />
  if (cfg.id === 'mega') return <wokwi-arduino-mega ref={ref} id={cfg.canvasId} />
  return <wokwi-arduino-uno ref={ref} id={cfg.canvasId} />
}

export function CanvasPanel() {
  const components = useAppStore((s) => s.components)
  const boardId = useAppStore((s) => s.board)
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

  // On first mount, center the pinned board in the viewport so it is
  // immediately visible instead of being hidden off the right edge on a
  // narrow canvas. Runs once; the add-part effect above takes over the
  // scroll position as soon as the first component appears.
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const boardCenterX = UNO_LEFT + 150 // ~half the UNO element width
    el.scrollLeft = Math.max(0, boardCenterX - el.clientWidth / 2)
  }, [])

  const periphs = components.filter((c) => c.type !== 'uno')

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-brand-300 bg-brand-500 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
          >
            <IconPlus />
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
        onContextMenu={(e) => {
          // Suppress the browser menu in the canvas so right-clicking a wire can
          // add a direction point instead of opening the native context menu.
          e.preventDefault()
        }}
      >
        <div className="relative" style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}>
          {/* The selected Arduino board is pinned on the canvas. */}
          <div
            style={{ position: 'absolute', left: UNO_LEFT, top: UNO_TOP, userSelect: 'none' }}
            className="flex flex-col items-center gap-1"
          >
            <ArduinoBoard />
            <span className="rounded bg-white/80 px-1 font-mono text-[10px] text-slate-600 shadow-sm">
              {getBoard(boardId).canvasId} (pinned)
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
