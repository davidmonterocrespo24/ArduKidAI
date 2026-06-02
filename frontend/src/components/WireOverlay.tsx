import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { readPinPositions, type PinScreenPosition } from '../sim/pinPositions'
import { pickWireColor } from '../lib/wireColors'
import { getBoard } from '../sim/boards'
import type { ComponentType } from '../types/circuit'

// wokwi-elements expose abbreviated pin names while the agent / backend
// catalog speaks the Arduino-tutorial names. Register the agent names as
// aliases pointing at the same pin position so wires resolve either way.
const PIN_ALIASES: Partial<Record<ComponentType, Record<string, string[]>>> = {
  led: { A: ['anode'], C: ['cathode'] },
  resistor: { '1': ['a'], '2': ['b'] },
  pushbutton: { '1.l': ['1a'], '1.r': ['1b'], '2.l': ['2a'], '2.r': ['2b'] },
  servo: { 'V+': ['VCC'] },
}

interface Props {
  /** The element the overlay should size against (the scroll container). */
  hostRef: React.RefObject<HTMLElement | null>
}

interface PositionedPin extends PinScreenPosition {
  componentId: string
}

export function WireOverlay({ hostRef }: Props) {
  const components = useAppStore((s) => s.components)
  const boardCanvasId = getBoard(useAppStore((s) => s.board)).canvasId
  const wires = useAppStore((s) => s.wires)
  const wireInProgress = useAppStore((s) => s.wireInProgress)
  const startWire = useAppStore((s) => s.startWire)
  const cancelWire = useAppStore((s) => s.cancelWire)
  const addWire = useAppStore((s) => s.addWire)

  const removeWire = useAppStore((s) => s.removeWire)

  const selectedWireIndex = useAppStore((s) => s.selectedWireIndex)
  const selectWire = useAppStore((s) => s.selectWire)
  const setWireWaypoints = useAppStore((s) => s.setWireWaypoints)
  const insertWireWaypoint = useAppStore((s) => s.insertWireWaypoint)

  // While the simulator runs the circuit is locked: wires and pins are not
  // selectable, movable, deletable, or connectable. Only the components stay
  // interactive (press a button, drag a sensor slider). This keeps a wire that
  // happens to cross a button from stealing the click.
  const simStatus = useAppStore((s) => s.simStatus)
  const isRunning = simStatus === 'running'

  const overlayRef = useRef<SVGSVGElement>(null)
  const [pins, setPins] = useState<PositionedPin[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [hoveredPin, setHoveredPin] = useState<string | null>(null)
  const [hoveredWire, setHoveredWire] = useState<number | null>(null)
  const wireHoverTimerRef = useRef<number | null>(null)

  // Active drag - either a single waypoint or a whole segment.
  // - waypointIndex set: drag the waypoint to follow the cursor.
  // - segment set: drag the segment perpendicular to its axis (vertical
  //   segments go left/right, horizontal segments go up/down). On the
  //   first drag we re-derive the wire's waypoints from the moved
  //   polyline so the corner is persisted.
  const dragRef = useRef<
    | { kind: 'waypoint'; wireIndex: number; waypointIndex: number }
    | { kind: 'segment'; wireIndex: number; segIndex: number; axis: 'horizontal' | 'vertical'; polyline: Array<{ x: number; y: number }> }
    | null
  >(null)

  function holdWireHover(i: number) {
    if (wireHoverTimerRef.current !== null) {
      window.clearTimeout(wireHoverTimerRef.current)
      wireHoverTimerRef.current = null
    }
    setHoveredWire(i)
  }

  function releaseWireHover(i: number) {
    if (wireHoverTimerRef.current !== null) {
      window.clearTimeout(wireHoverTimerRef.current)
    }
    // 250 ms grace so the kid can drift from the wire to the red x without
    // the badge vanishing under the cursor.
    wireHoverTimerRef.current = window.setTimeout(() => {
      setHoveredWire((prev) => (prev === i ? null : prev))
      wireHoverTimerRef.current = null
    }, 250)
  }

  const recompute = useCallback(() => {
    const overlay = overlayRef.current
    const host = hostRef.current
    if (!overlay || !host) return
    setSize({ width: host.scrollWidth, height: host.scrollHeight })
    const next: PositionedPin[] = []
    for (const c of components) {
      const positions = readPinPositions(c.id, overlay)
      if (!positions) continue
      for (const p of positions) {
        next.push({ ...p, componentId: c.id })
      }
    }
    // The board has a fixed id on its element so we can route to it too.
    const boardPositions = readPinPositions(boardCanvasId, overlay)
    if (boardPositions) {
      for (const p of boardPositions) {
        next.push({ ...p, componentId: boardCanvasId })
      }
    }
    setPins(next)
  }, [components, hostRef, boardCanvasId])

  useEffect(() => {
    recompute()
    const id = window.setTimeout(recompute, 100)
    return () => window.clearTimeout(id)
  }, [recompute, components, wires])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const observer = new ResizeObserver(() => recompute())
    observer.observe(host)
    for (const c of components) {
      const el = document.getElementById(c.id)
      if (el) observer.observe(el)
    }
    const boardEl = document.getElementById(boardCanvasId)
    if (boardEl) observer.observe(boardEl)
    return () => observer.disconnect()
  }, [recompute, components, hostRef, boardCanvasId])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const onScroll = () => recompute()
    host.addEventListener('scroll', onScroll, { passive: true })
    return () => host.removeEventListener('scroll', onScroll)
  }, [recompute, hostRef])

  // Lock editing when the sim starts: drop any wire selection or half-drawn wire
  // so no handles or delete badges linger over the running circuit.
  useEffect(() => {
    if (!isRunning) return
    if (selectedWireIndex !== null) selectWire(null)
    if (wireInProgress) cancelWire()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isRunning) return
      // Don't steal keys when the kid is typing into a chat box,
      // slider, blockly text field, etc.
      const tgt = e.target as HTMLElement | null
      const tag = tgt?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tgt?.isContentEditable) return
      if (e.key === 'Escape') {
        if (wireInProgress) cancelWire()
        if (selectedWireIndex !== null) selectWire(null)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWireIndex !== null) {
        e.preventDefault()
        removeWire(selectedWireIndex)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isRunning, wireInProgress, cancelWire, selectedWireIndex, selectWire, removeWire])

  useEffect(() => {
    if (!wireInProgress) return
    const host = hostRef.current
    const overlay = overlayRef.current
    if (!host || !overlay) return
    const onMove = (e: MouseEvent) => {
      const rect = overlay.getBoundingClientRect()
      setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    host.addEventListener('mousemove', onMove)
    return () => {
      host.removeEventListener('mousemove', onMove)
      setCursor(null)
    }
  }, [wireInProgress, hostRef])

  const typeById = useMemo(() => {
    const m = new Map<string, ComponentType>()
    for (const c of components) m.set(c.id, c.type)
    return m
  }, [components])

  // Build the pin lookup. The agent / backend speaks Arduino-tutorial pin
  // names ("UNO.D13", "UNO.GND", "L1.anode", "R1.a") while the wokwi shadow
  // DOM exposes them as "13", "GND.1", "A", "1" etc. Register both forms so
  // wires resolve regardless of which side authored them.
  const pinIndex = useMemo(() => {
    const map = new Map<string, PositionedPin>()
    for (const p of pins) {
      map.set(`${p.componentId}.${p.name}`, p)
      if (p.componentId === boardCanvasId) {
        if (/^\d+$/.test(p.name)) {
          map.set(`${boardCanvasId}.D${p.name}`, p)
        }
        if (/^GND(\.\d+)?$/.test(p.name) && !map.has(`${boardCanvasId}.GND`)) {
          map.set(`${boardCanvasId}.GND`, p)
        }
        if (p.name === '3.3V') map.set(`${boardCanvasId}.3V3`, p)
        if (p.name === '5V') map.set(`${boardCanvasId}.5V`, p)
        continue
      }
      const type = typeById.get(p.componentId)
      if (!type) continue
      const aliases = PIN_ALIASES[type]?.[p.name]
      if (aliases) {
        for (const alias of aliases) {
          map.set(`${p.componentId}.${alias}`, p)
        }
      }
    }
    return map
  }, [pins, typeById, boardCanvasId])

  // Hover detection by distance, not by SVG hit area. The old wide
  // invisible stroke would absorb mousedown on top of pushbuttons and
  // pots, making the components unclickable wherever a wire ran over
  // them. Sampling the curve in mousemove keeps the visible wire fully
  // pointer-events: none so clicks always reach the part below.
  useEffect(() => {
    const host = hostRef.current
    const overlay = overlayRef.current
    if (!host || !overlay) return
    const onMove = (e: MouseEvent) => {
      if (isRunning) return
      const rect = overlay.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      // While a waypoint is being dragged, route the move into the store.
      if (dragRef.current?.kind === 'waypoint') {
        const { wireIndex, waypointIndex } = dragRef.current
        const w = wires[wireIndex]
        const wp = [...(w?.waypoints ?? [])]
        if (waypointIndex >= 0 && waypointIndex < wp.length) {
          wp[waypointIndex] = { x: mx, y: my }
          setWireWaypoints(wireIndex, wp)
        }
        return
      }
      // While a segment is being dragged, slide it perpendicular to its
      // axis and persist the resulting polyline as the wire's waypoints.
      if (dragRef.current?.kind === 'segment') {
        const { wireIndex, segIndex, axis, polyline } = dragRef.current
        const newValue = axis === 'horizontal' ? my : mx
        const moved = moveSegment(polyline, segIndex, axis, newValue)
        const simplified = simplifyOrthogonalPath(moved)
        // strip the start/end endpoints (which match the pin positions)
        // and store only the inner points as waypoints.
        setWireWaypoints(wireIndex, simplified.slice(1, -1))
        return
      }
      let best = -1
      let bestDist = Infinity
      for (let i = 0; i < wires.length; i++) {
        const w = wires[i]
        const a = pinIndex.get(w.from_pin)
        const b = pinIndex.get(w.to_pin)
        if (!a || !b) continue
        const pts: Array<{ x: number; y: number }> = orthogonalPolyline(a, w.waypoints ?? [], b)
        const d = distanceToPolyline(mx, my, pts)
        if (d < bestDist) {
          bestDist = d
          best = i
        }
      }
      if (bestDist <= 10) {
        if (hoveredWire !== best) holdWireHover(best)
      } else if (hoveredWire !== null) {
        releaseWireHover(hoveredWire)
      }
    }
    const onUp = () => { dragRef.current = null }
    host.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      host.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [hostRef, wires, pinIndex, hoveredWire, setWireWaypoints, isRunning])

  function handlePinClick(componentId: string, pinName: string) {
    const ref = `${componentId}.${pinName}`
    if (!wireInProgress) {
      startWire(ref)
      return
    }
    if (wireInProgress.from_pin === ref) {
      cancelWire()
      return
    }
    addWire({
      from_pin: wireInProgress.from_pin,
      to_pin: ref,
      color: pickWireColor(wireInProgress.from_pin, ref, wires.length),
    })
  }

  // Insert a direction point (waypoint) on a wire at the given client position,
  // placing it in the correct slot between the wire's control points so the wire
  // bends at the click instead of re-routing oddly.
  function addWaypointFromClient(clientX: number, clientY: number, wireIndex: number) {
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect) return
    const w = wires[wireIndex]
    if (!w) return
    const a = pinIndex.get(w.from_pin)
    const b = pinIndex.get(w.to_pin)
    if (!a || !b) return
    const x = clientX - rect.left
    const y = clientY - rect.top
    const wps = w.waypoints ?? []
    const ctrl = [a, ...wps, b]
    let bestCtrl = 0
    let bestD = Infinity
    for (let i = 0; i < ctrl.length - 1; i++) {
      const sub = orthogonalPolyline(ctrl[i], [], ctrl[i + 1])
      const d = distanceToPolyline(x, y, sub)
      if (d < bestD) {
        bestD = d
        bestCtrl = i
      }
    }
    insertWireWaypoint(wireIndex, Math.min(wps.length, bestCtrl), { x, y })
    selectWire(wireIndex)
  }

  // Right-click anywhere near a wire inserts a direction point on it. A native
  // contextmenu listener makes this reliable even when a handle or the curved
  // stroke sits under the cursor (those would otherwise swallow the event).
  useEffect(() => {
    const host = hostRef.current
    const overlay = overlayRef.current
    if (!host || !overlay) return
    const onCtx = (e: MouseEvent) => {
      if (isRunning) return
      const rect = overlay.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      let best = -1
      let bestD = Infinity
      for (let i = 0; i < wires.length; i++) {
        const a = pinIndex.get(wires[i].from_pin)
        const b = pinIndex.get(wires[i].to_pin)
        if (!a || !b) continue
        const poly = orthogonalPolyline(a, wires[i].waypoints ?? [], b)
        const d = distanceToPolyline(x, y, poly)
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      if (best >= 0 && bestD <= 20) {
        e.preventDefault()
        addWaypointFromClient(e.clientX, e.clientY, best)
      }
    }
    host.addEventListener('contextmenu', onCtx)
    return () => host.removeEventListener('contextmenu', onCtx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostRef, wires, pinIndex, isRunning])

  const inProgressPin = wireInProgress ? pinIndex.get(wireInProgress.from_pin) : undefined

  return (
    <svg
      ref={overlayRef}
      className="pointer-events-none absolute inset-0"
      width={size.width}
      height={size.height}
      style={{ width: size.width, height: size.height }}
      role="img"
      aria-label="circuit wires overlay"
    >
      {/* Invisible click targets for selecting/editing wires - hidden while the
          sim runs so a wire over a button never steals the click. */}
      {!isRunning && wires.map((w, i) => {
        const a = pinIndex.get(w.from_pin)
        const b = pinIndex.get(w.to_pin)
        if (!a || !b) return null
        const polyline = orthogonalPolyline(a, w.waypoints ?? [], b)
        const pathD = polylineToRoundedPath(polyline)
        return (
          <path
            key={`hit-${w.from_pin}-${w.to_pin}-${i}`}
            d={pathD}
            fill="none"
            stroke="transparent"
            strokeWidth={14}
            strokeLinecap="round"
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              selectWire(i)
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              addWaypointFromClient(e.clientX, e.clientY, i)
            }}
            onMouseEnter={() => holdWireHover(i)}
            onMouseLeave={() => releaseWireHover(i)}
          />
        )
      })}

      {inProgressPin && cursor && (
        <path
          d={polylineToPath([{ x: inProgressPin.x, y: inProgressPin.y }, { x: cursor.x, y: cursor.y }])}
          fill="none"
          stroke="#10b981"
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
      )}

      {!isRunning && pins.map((p) => {
        const ref = `${p.componentId}.${p.name}`
        const isSource = wireInProgress?.from_pin === ref
        const isHover = hoveredPin === ref
        const radius = isSource ? 7 : isHover ? 6 : 4.5
        const fill = isSource ? '#10b981' : '#2563eb'
        const stroke = isSource || isHover ? '#0f172a' : '#1e3a8a'
        return (
          <g
            key={ref}
            className="pointer-events-auto cursor-pointer"
            onMouseEnter={() => setHoveredPin(ref)}
            onMouseLeave={() => setHoveredPin(null)}
            onClick={(e) => {
              e.stopPropagation()
              handlePinClick(p.componentId, p.name)
            }}
          >
            <circle cx={p.x} cy={p.y} r={radius + 6} fill="transparent" />
            <circle
              cx={p.x}
              cy={p.y}
              r={radius}
              fill={fill}
              fillOpacity={isSource ? 1 : 0.85}
              stroke={stroke}
              strokeWidth={1}
            />
            {isHover && (
              <g pointerEvents="none">
                <rect
                  x={p.x + 8}
                  y={p.y - 18}
                  width={Math.max(40, ref.length * 6.5)}
                  height={16}
                  rx={3}
                  fill="#0f172a"
                  fillOpacity={0.9}
                />
                <text
                  x={p.x + 12}
                  y={p.y - 6}
                  fontSize={10}
                  fontFamily="ui-monospace, Menlo, monospace"
                  fill="#f8fafc"
                >
                  {ref}
                </text>
              </g>
            )}
          </g>
        )
      })}
      {/* Visible wire strokes + editing handles, ON TOP of the pins. The strokes
          are pointer-events:none (pins stay clickable), but the selected wire's
          drag handles and the delete badge are pointer-events:all so they are
          always grabbable - even where a wire crosses a pin. */}
      {wires.map((w, i) => {
        const a = pinIndex.get(w.from_pin)
        const b = pinIndex.get(w.to_pin)
        if (!a || !b) return null
        const colour = w.color ?? pickWireColor(w.from_pin, w.to_pin, i)
        const isHover = hoveredWire === i
        const isSelected = selectedWireIndex === i
        const waypoints = w.waypoints ?? []
        const polyline = orthogonalPolyline(a, waypoints, b)
        const pathD = polylineToRoundedPath(polyline)
        const mid = polyline[Math.floor(polyline.length / 2)]
        return (
          <g key={`vis-${w.from_pin}-${w.to_pin}-${i}`}>
            {isSelected && (
              <path
                d={pathD}
                fill="none"
                stroke="#10b981"
                strokeWidth={10}
                strokeOpacity={0.3}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            )}
            <path
              d={pathD}
              fill="none"
              stroke={colour}
              strokeWidth={isSelected ? 5 : isHover ? 5.5 : 4}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
            {/* Delete badge (hover or selected) - never while the sim runs */}
            {!isRunning && (isHover || isSelected) && (
              <g
                className="cursor-pointer"
                style={{ pointerEvents: 'all' }}
                onMouseEnter={() => holdWireHover(i)}
                onMouseLeave={() => releaseWireHover(i)}
                onClick={(e) => {
                  e.stopPropagation()
                  if (wireHoverTimerRef.current !== null) {
                    window.clearTimeout(wireHoverTimerRef.current)
                    wireHoverTimerRef.current = null
                  }
                  setHoveredWire(null)
                  removeWire(i)
                }}
              >
                <circle cx={mid.x} cy={mid.y} r={10} fill="#fee2e2" stroke="#dc2626" strokeWidth={1.5} />
                <text x={mid.x} y={mid.y + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="#dc2626">
                  &times;
                </text>
              </g>
            )}
            {/* Segment midpoint handles - drag perpendicular to slide the segment
                (vertical segments move left/right, horizontal move up/down). */}
            {isSelected && polyline.slice(0, -1).map((p1, si) => {
              const p2 = polyline[si + 1]
              if (p1.x === p2.x && p1.y === p2.y) return null
              const axis: 'horizontal' | 'vertical' = p1.y === p2.y ? 'horizontal' : 'vertical'
              const hx = (p1.x + p2.x) / 2
              const hy = (p1.y + p2.y) / 2
              return (
                <circle
                  key={`seg-${si}`}
                  cx={hx}
                  cy={hy}
                  r={7}
                  fill="white"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  style={{ pointerEvents: 'all', cursor: axis === 'horizontal' ? 'ns-resize' : 'ew-resize' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    dragRef.current = {
                      kind: 'segment',
                      wireIndex: i,
                      segIndex: si,
                      axis,
                      polyline: polyline.map((p) => ({ ...p })),
                    }
                  }}
                />
              )
            })}
            {/* Waypoint handles - drag to bend freely, double-click to remove. */}
            {isSelected && waypoints.map((wp, wi) => (
              <circle
                key={`wp-${wi}`}
                cx={wp.x}
                cy={wp.y}
                r={7}
                fill="#10b981"
                stroke="white"
                strokeWidth={2.5}
                style={{ pointerEvents: 'all', cursor: 'move' }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  dragRef.current = { kind: 'waypoint', wireIndex: i, waypointIndex: wi }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  setWireWaypoints(i, waypoints.filter((_, idx) => idx !== wi))
                }}
              />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Build the polyline that an orthogonal wire follows: starting at `start`,
 * detouring through each waypoint, and ending at `end`. Between any two
 * consecutive control points we insert a corner (go horizontal first,
 * then vertical) so the visible wire is always axis-aligned, Wokwi-style.
 */
function orthogonalPolyline(
  start: { x: number; y: number },
  waypoints: Array<{ x: number; y: number }>,
  end: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const ctrl = [start, ...waypoints, end]
  const out: Array<{ x: number; y: number }> = [{ x: start.x, y: start.y }]
  for (let i = 1; i < ctrl.length; i++) {
    const prev = ctrl[i - 1]
    const curr = ctrl[i]
    if (prev.x !== curr.x && prev.y !== curr.y) {
      // Corner: go horizontal first, then vertical.
      out.push({ x: curr.x, y: prev.y })
    }
    out.push({ x: curr.x, y: curr.y })
  }
  return out
}

function polylineToPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`
  return d
}

// Like polylineToPath, but each interior corner is replaced by a quadratic
// bezier so bends look curved instead of sharp 90-degree angles. The corner
// radius is clamped to half of each adjoining segment so short segments do not
// overshoot.
function polylineToRoundedPath(points: Array<{ x: number; y: number }>, radius = 12): string {
  if (points.length <= 2) return polylineToPath(points)
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1
    const d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1
    const r = Math.min(radius, d1 / 2, d2 / 2)
    const a = { x: p1.x + ((p0.x - p1.x) / d1) * r, y: p1.y + ((p0.y - p1.y) / d1) * r }
    const b = { x: p1.x + ((p2.x - p1.x) / d2) * r, y: p1.y + ((p2.y - p1.y) / d2) * r }
    d += ` L ${a.x} ${a.y} Q ${p1.x} ${p1.y} ${b.x} ${b.y}`
  }
  const last = points[points.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

function distancePointToSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

function distanceToPolyline(px: number, py: number, pts: Array<{ x: number; y: number }>): number {
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distancePointToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
    if (d < best) best = d
  }
  return best
}

/**
 * Slide one segment of an orthogonal polyline perpendicular to its axis.
 * A horizontal segment takes a new Y (moves up/down); a vertical segment takes a
 * new X (moves left/right). Middle segments just shift both of their endpoints.
 * The first/last segments touch a pin, so instead of moving the pin we insert two
 * connector points that keep the wire joined to the pin while the segment moves.
 */
function moveSegment(
  pts: Array<{ x: number; y: number }>,
  segIndex: number,
  axis: 'horizontal' | 'vertical',
  newValue: number,
): Array<{ x: number; y: number }> {
  const out = pts.map((p) => ({ ...p }))
  const lastSeg = out.length - 2

  // Middle segment: slide both of its endpoints perpendicular to the axis.
  if (segIndex > 0 && segIndex < lastSeg) {
    if (axis === 'horizontal') {
      out[segIndex].y = newValue
      out[segIndex + 1].y = newValue
    } else {
      out[segIndex].x = newValue
      out[segIndex + 1].x = newValue
    }
    return out
  }

  // First segment: keep the start pin (out[0]) and insert two connectors after it.
  if (segIndex === 0) {
    const p0 = out[0]
    const p1 = out[1]
    const connectors =
      axis === 'horizontal'
        ? [{ x: p0.x, y: newValue }, { x: p1.x, y: newValue }]
        : [{ x: newValue, y: p0.y }, { x: newValue, y: p1.y }]
    out.splice(1, 0, ...connectors)
    return out
  }

  // Last segment: keep the end pin (last point) and insert two connectors before it.
  const n = out.length
  const pPrev = out[n - 2]
  const pEnd = out[n - 1]
  const connectors =
    axis === 'horizontal'
      ? [{ x: pPrev.x, y: newValue }, { x: pEnd.x, y: newValue }]
      : [{ x: newValue, y: pPrev.y }, { x: newValue, y: pEnd.y }]
  out.splice(n - 1, 0, ...connectors)
  return out
}

/**
 * Drop duplicate points and collapse triples that share an axis (either
 * collinear or U-turns) so the wire doesn't accumulate visible bumps
 * after a chain of segment drags.
 */
function simplifyOrthogonalPath(
  pts: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  if (pts.length <= 2) return pts.map((p) => ({ ...p }))
  const dedup: Array<{ x: number; y: number }> = []
  for (const p of pts) {
    const last = dedup[dedup.length - 1]
    if (!last || last.x !== p.x || last.y !== p.y) dedup.push({ ...p })
  }
  let result = dedup
  let changed = true
  while (changed && result.length > 2) {
    changed = false
    for (let i = 1; i < result.length - 1; i++) {
      const prev = result[i - 1]
      const curr = result[i]
      const next = result[i + 1]
      if ((prev.x === curr.x && curr.x === next.x) || (prev.y === curr.y && curr.y === next.y)) {
        result = [...result.slice(0, i), ...result.slice(i + 1)]
        changed = true
        break
      }
    }
  }
  return result
}
