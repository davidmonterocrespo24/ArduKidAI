import { useEffect, useRef, useState } from 'react'
import type { ComponentInstance } from '../types/circuit'
import { useAppStore } from '../store/useAppStore'
import { DynamicComponent } from './DynamicComponent'
import { SensorControl } from './SensorControl'

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

/**
 * Wraps a wokwi component so the kid can drag it around the canvas.
 * Passive parts (LED, resistor, LCD, ...) drag from anywhere on the
 * body. Interactive parts (pushbutton, pot) only drag from the small
 * id-badge below the part, so clicks on the button or knob reach the
 * wokwi element's own pointerdown. The Arduino UNO is NOT wrapped.
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
    if (isOnInteractiveSurface(e.target)) return
    startDrag(e.clientX, e.clientY)
  }

  // The id-badge below the part is always a drag handle, even for
  // interactive components - it's how the kid grabs a button or pot
  // to rearrange them.
  function onHandleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    e.stopPropagation()
    startDrag(e.clientX, e.clientY)
  }

  return (
    <div
      onMouseDown={onWrapperMouseDown}
      style={{
        position: 'absolute',
        left: instance.x,
        top: instance.y,
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
      className="group inline-block"
    >
      <DynamicComponent instance={instance} />
      {/* Absolutely positioned so widening it (e.g. mounting the
          SensorControl popover when sim starts) cannot shift the
          wokwi element above. Without this the part jumps sideways
          on Run and the wires no longer meet its pins. */}
      <div
        className="absolute left-1/2 top-full flex -translate-x-1/2 items-center gap-2 pt-1"
      >
        <span
          onMouseDown={onHandleMouseDown}
          title="Drag to move"
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
          className="rounded bg-white/80 px-1 font-mono text-[10px] text-slate-600 shadow-sm"
        >
          {instance.id}
        </span>
        {simStatus === 'running' ? <SensorControl instance={instance} /> : null}
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => removeComponent(instance.id)}
          title={`Remove ${instance.id}`}
          className="rounded border border-rose-200 bg-white/90 px-1.5 text-[10px] font-medium text-rose-600 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50"
        >
          remove
        </button>
      </div>
    </div>
  )
}
