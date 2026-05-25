import { useEffect, useRef, useState } from 'react'
import type { ComponentInstance } from '../types/circuit'
import { useAppStore } from '../store/useAppStore'
import { DynamicComponent } from './DynamicComponent'

interface Props {
  instance: ComponentInstance
}

/**
 * Wraps a wokwi component so the kid can drag it around the canvas with
 * the mouse. Uses pointer events on the wrapper, listens on the window for
 * move/up so the drag survives the cursor leaving the wrapper's bounds.
 * The Arduino UNO is NOT rendered through this wrapper (it stays pinned).
 */
export function DraggablePart({ instance }: Props) {
  const updatePosition = useAppStore((s) => s.updateComponentPosition)
  const removeComponent = useAppStore((s) => s.removeComponent)
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

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    startDrag(e.clientX, e.clientY)
  }

  // Some automation tools and a few odd input devices only emit mouse
  // events, not pointer events. Listening to both keeps drag working
  // everywhere.
  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    if (dragRef.current) return
    startDrag(e.clientX, e.clientY)
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: instance.x,
        top: instance.y,
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
      className="group flex flex-col items-center gap-1"
    >
      <DynamicComponent instance={instance} />
      <div className="flex items-center gap-2">
        <span className="rounded bg-white/80 px-1 font-mono text-[10px] text-slate-600 shadow-sm">
          {instance.id}
        </span>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            removeComponent(instance.id)
          }}
          title={`Remove ${instance.id}`}
          className="rounded border border-rose-200 bg-white/90 px-1.5 text-[10px] font-medium text-rose-600 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50"
        >
          remove
        </button>
      </div>
    </div>
  )
}
