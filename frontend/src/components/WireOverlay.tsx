import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { readPinPositions, type PinScreenPosition } from '../sim/pinPositions'
import { pickWireColor } from '../lib/wireColors'
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
  const wires = useAppStore((s) => s.wires)
  const wireInProgress = useAppStore((s) => s.wireInProgress)
  const startWire = useAppStore((s) => s.startWire)
  const cancelWire = useAppStore((s) => s.cancelWire)
  const addWire = useAppStore((s) => s.addWire)

  const removeWire = useAppStore((s) => s.removeWire)

  const overlayRef = useRef<SVGSVGElement>(null)
  const [pins, setPins] = useState<PositionedPin[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [hoveredPin, setHoveredPin] = useState<string | null>(null)
  const [hoveredWire, setHoveredWire] = useState<number | null>(null)
  const wireHoverTimerRef = useRef<number | null>(null)

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
    // UNO has a fixed id on its element so we can route to it too.
    const unoPositions = readPinPositions('UNO', overlay)
    if (unoPositions) {
      for (const p of unoPositions) {
        next.push({ ...p, componentId: 'UNO' })
      }
    }
    setPins(next)
  }, [components, hostRef])

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
    const uno = document.getElementById('UNO')
    if (uno) observer.observe(uno)
    return () => observer.disconnect()
  }, [recompute, components, hostRef])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const onScroll = () => recompute()
    host.addEventListener('scroll', onScroll, { passive: true })
    return () => host.removeEventListener('scroll', onScroll)
  }, [recompute, hostRef])

  useEffect(() => {
    if (!wireInProgress) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelWire()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [wireInProgress, cancelWire])

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
      if (p.componentId === 'UNO') {
        if (/^\d+$/.test(p.name)) {
          map.set(`UNO.D${p.name}`, p)
        }
        if (/^GND(\.\d+)?$/.test(p.name) && !map.has('UNO.GND')) {
          map.set('UNO.GND', p)
        }
        if (p.name === '3.3V') map.set('UNO.3V3', p)
        if (p.name === '5V') map.set('UNO.5V', p)
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
  }, [pins, typeById])

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
      {wires.map((w, i) => {
        const a = pinIndex.get(w.from_pin)
        const b = pinIndex.get(w.to_pin)
        if (!a || !b) return null
        const colour = w.color ?? pickWireColor(w.from_pin, w.to_pin, i)
        const isHover = hoveredWire === i
        const mid = midPointSagged(a.x, a.y, b.x, b.y)
        return (
          <g key={`${w.from_pin}-${w.to_pin}-${i}`}>
            {/* Wide invisible hit area so the kid does not need to land on the 2.5 px line. */}
            <path
              d={curvedPath(a.x, a.y, b.x, b.y)}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              strokeLinecap="round"
              className="pointer-events-auto cursor-pointer"
              onMouseEnter={() => holdWireHover(i)}
              onMouseLeave={() => releaseWireHover(i)}
            />
            <path
              d={curvedPath(a.x, a.y, b.x, b.y)}
              fill="none"
              stroke={colour}
              strokeWidth={isHover ? 3.5 : 2.5}
              strokeLinecap="round"
              pointerEvents="none"
            />
            {isHover && (
              <g
                className="pointer-events-auto cursor-pointer"
                onMouseEnter={() => setHoveredWire(i)}
                onMouseLeave={() => setHoveredWire((prev) => (prev === i ? null : prev))}
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
                <text
                  x={mid.x}
                  y={mid.y + 4}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill="#dc2626"
                >
                  &times;
                </text>
                <rect
                  x={mid.x + 14}
                  y={mid.y - 10}
                  width={Math.max(110, (w.from_pin.length + w.to_pin.length) * 5.5)}
                  height={20}
                  rx={4}
                  fill="#0f172a"
                  fillOpacity={0.9}
                />
                <text
                  x={mid.x + 20}
                  y={mid.y + 4}
                  fontSize={10}
                  fontFamily="ui-monospace, Menlo, monospace"
                  fill="#f8fafc"
                >
                  {w.from_pin} {'→'} {w.to_pin}
                </text>
              </g>
            )}
          </g>
        )
      })}

      {inProgressPin && cursor && (
        <path
          d={curvedPath(inProgressPin.x, inProgressPin.y, cursor.x, cursor.y)}
          fill="none"
          stroke="#10b981"
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
      )}

      {pins.map((p) => {
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
    </svg>
  )
}

function curvedPath(x1: number, y1: number, x2: number, y2: number): string {
  const { x: midX, y: midY } = midPointSagged(x1, y1, x2, y2)
  return `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`
}

function midPointSagged(x1: number, y1: number, x2: number, y2: number): { x: number; y: number } {
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.hypot(dx, dy)
  const sag = Math.min(40, dist * 0.18)
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 + sag }
}
