import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ComponentInstance } from '../types/circuit'
import { useAppStore } from '../store/useAppStore'
import { DynamicComponent } from './DynamicComponent'
import { SensorControlPanel } from './SensorControl'
import { hasSensorControl } from './sensorControlPredicate'

interface Props {
  instance: ComponentInstance
}

// Wokwi elements that own their pointerdown (button press, pot rotate,
// joystick stick, ...). When a mousedown lands on one of these we leave
// it alone instead of starting a component-level drag - otherwise the
// kid clicks the button and the whole part shifts under the cursor.
const INTERACTIVE_WOKWI_TAGS = new Set([
  'wokwi-pushbutton',
  'wokwi-pushbutton-6mm',
  'wokwi-potentiometer',
  'wokwi-slide-potentiometer',
  'wokwi-slide-switch',
])

function isOnInteractiveSurface(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  // closest() crosses the document tree but not shadow DOM boundaries.
  // wokwi elements use shadow DOM, so the event re-targets to the
  // host element when it bubbles out - exactly what we want here.
  for (let el: Element | null = target; el; el = el.parentElement) {
    if (INTERACTIVE_WOKWI_TAGS.has(el.tagName.toLowerCase())) return true
  }
  return false
}

// Pin a `position: fixed` rectangle to the top-right of the canvas
// scroll container's bounding rect. Re-measure on scroll / resize so
// the panel never drifts away from the canvas frame. Returns null on
// the server.
function useCanvasAnchor(active: boolean): { top: number; right: number } | null {
  const [rect, setRect] = useState<{ top: number; right: number } | null>(null)
  useEffect(() => {
    if (!active) return
    const scroller = document.querySelector('[data-canvas-scroller]') as HTMLElement | null
    if (!scroller) return
    function update() {
      const r = scroller!.getBoundingClientRect()
      setRect({ top: r.top + 8, right: window.innerWidth - r.right + 8 })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [active])
  return rect
}

/**
 * Wraps a wokwi component so the kid can drag it around the canvas.
 * Passive parts (LED, resistor, LCD, ...) drag from anywhere on the
 * body. Interactive parts (pushbutton, pot) only drag from the small
 * id-badge below the part, so clicks on the button or knob reach the
 * wokwi element's own pointerdown. The Arduino UNO is NOT wrapped.
 *
 * While the simulator runs, clicking the body of a controllable sensor
 * (NTC, photoresistor, slider switch, DHT, ...) opens its control
 * panel anchored at the top-right of the canvas. Buttons / pots keep
 * their direct interaction (they have built-in pointer handlers).
 */
export function DraggablePart({ instance }: Props) {
  const updatePosition = useAppStore((s) => s.updateComponentPosition)
  const removeComponent = useAppStore((s) => s.removeComponent)
  const simStatus = useAppStore((s) => s.simStatus)
  const dragRef = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [panelOpenWhileRunning, setPanelOpenWhileRunning] = useState(false)
  // Derived: only show the panel while the sim is running. Stopping
  // the sim implicitly closes it without needing a setState in effect.
  const panelOpen = simStatus === 'running' && panelOpenWhileRunning
  const setPanelOpen = setPanelOpenWhileRunning

  useEffect(() => {
    if (!dragging) return
    function onMove(e: MouseEvent) {
      const d = dragRef.current
      if (!d) return
      const nx = Math.max(0, d.originX + (e.clientX - d.startX))
      const ny = Math.max(0, d.originY + (e.clientY - d.startY))
      updatePosition(instance.id, nx, ny)
    }
    function onUp() {
      dragRef.current = null
      setDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, instance.id, updatePosition])

  function startDrag(clientX: number, clientY: number) {
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      originX: instance.x,
      originY: instance.y,
    }
    setDragging(true)
  }

  function onWrapperMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    if (simStatus === 'running') {
      // During sim, clicking the body of a controllable sensor toggles
      // its control panel. Clicks on a wokwi element that owns its
      // pointer (pushbutton, pot) fall through so the kid can press /
      // rotate it directly.
      if (isOnInteractiveSurface(e.target)) return
      if (hasSensorControl(instance.type)) {
        e.stopPropagation()
        setPanelOpen((v) => !v)
      }
      return
    }
    if (isOnInteractiveSurface(e.target)) return
    startDrag(e.clientX, e.clientY)
  }

  // The id-badge below the part is always a drag handle, even for
  // interactive components - it's how the kid grabs a button or pot
  // to rearrange them. Still disabled while the sim is running.
  function onHandleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    if (simStatus === 'running') return
    e.stopPropagation()
    startDrag(e.clientX, e.clientY)
  }

  const anchor = useCanvasAnchor(panelOpen)

  return (
    <div
      data-component-id={instance.id}
      onMouseDown={onWrapperMouseDown}
      style={{
        position: 'absolute',
        left: instance.x,
        top: instance.y,
        cursor:
          simStatus === 'running'
            ? hasSensorControl(instance.type)
              ? 'pointer'
              : 'default'
            : dragging
            ? 'grabbing'
            : 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
      className="group inline-block"
    >
      <DynamicComponent instance={instance} />
      {/* Absolutely positioned so adding child elements does not shift
          the wokwi element above and break the wire pin positions. */}
      <div
        className="absolute left-1/2 top-full flex -translate-x-1/2 items-center gap-2 pt-1"
      >
        <span
          onMouseDown={onHandleMouseDown}
          title="Drag to move"
          style={{ cursor: simStatus === 'running' ? 'default' : dragging ? 'grabbing' : 'grab' }}
          className="rounded bg-white/80 px-1 font-mono text-[10px] text-slate-600 shadow-sm"
        >
          {instance.id}
        </span>
        {simStatus !== 'running' && (
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => removeComponent(instance.id)}
            title={`Remove ${instance.id}`}
            className="rounded border border-rose-200 bg-white/90 px-1.5 text-[10px] font-medium text-rose-600 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50"
          >
            remove
          </button>
        )}
      </div>
      {panelOpen && anchor
        ? createPortal(
            <div
              style={{ position: 'fixed', top: anchor.top, right: anchor.right, zIndex: 60 }}
            >
              <SensorControlPanel instance={instance} onClose={() => setPanelOpen(false)} />
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
