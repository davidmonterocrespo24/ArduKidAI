/**
 * Map a wokwi-element instance to the screen positions of each of its pins.
 *
 * Each wokwi custom element exposes `pinInfo: ElementPin[]` with `{name, x, y}`
 * coordinates in the element's local pixel space. We read those, add the
 * element's screen offset (getBoundingClientRect), and subtract the overlay's
 * own offset so the result is in the overlay SVG's local space.
 */

export interface PinScreenPosition {
  name: string
  x: number
  y: number
  /** Optional tag derived from signals (e.g. "GND", "PWM"). */
  hint?: string
}

interface PinInfoEntry {
  name: string
  x: number
  y: number
  signals?: Array<{ type: string; signal?: string }>
}

export function readPinPositions(
  componentId: string,
  overlay: Element,
): PinScreenPosition[] | null {
  const root = document.getElementById(componentId)
  if (!root) return null
  const info = (root as unknown as { pinInfo?: PinInfoEntry[] }).pinInfo
  if (!Array.isArray(info)) return null
  const elementRect = root.getBoundingClientRect()
  const overlayRect = overlay.getBoundingClientRect()
  return info.map((p) => ({
    name: p.name,
    x: elementRect.left + p.x - overlayRect.left,
    y: elementRect.top + p.y - overlayRect.top,
    hint: hintFor(p.signals),
  }))
}

function hintFor(signals?: Array<{ type: string; signal?: string }>): string | undefined {
  if (!signals || signals.length === 0) return undefined
  const s = signals[0]
  if (s.type === 'power') return s.signal // GND or VCC
  if (s.type === 'pwm') return 'PWM'
  if (s.type === 'analog') return 'A'
  if (s.type === 'i2c') return s.signal // SDA / SCL
  if (s.type === 'spi' || s.type === 'usart') return s.signal
  return undefined
}
