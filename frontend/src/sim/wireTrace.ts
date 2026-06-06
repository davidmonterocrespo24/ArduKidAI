/**
 * Map a component id to the Arduino UNO digital pin it is driven from.
 *
 * The kid's circuits follow two stereotyped wiring patterns:
 *   1. Direct: `componentId.somePin -> UNO.D#`
 *   2. Through a resistor: `componentId.anode -> R*.a` and `R*.b -> UNO.D#`
 *
 * For phase B we cover both. Anything more exotic (multiple components
 * sharing a resistor, daisy chains, transistors) returns null - the
 * component then renders with its default static prop.
 */

import type { DigitalPinLabel } from './pinState'
import { BOARDS } from './boards'
import type { Wire } from '../types/circuit'

// Match a board pin reference like UNO.D13 / NANO.D13 / MEGA.D40. Restricting
// the prefix to the registered board ids avoids matching a component pin that
// happens to look like "A5" (e.g. an LED bar-graph anode).
const _BOARD_PREFIX = Object.values(BOARDS)
  .map((b) => b.canvasId)
  .join('|')
const PIN_RE = new RegExp(`^(?:${_BOARD_PREFIX})\\.(D\\d+)$`)

function boardPin(reference: string): DigitalPinLabel | null {
  const match = PIN_RE.exec(reference)
  if (!match) return null
  return match[1] as DigitalPinLabel
}

function otherEnd(wire: Wire, refPrefix: string): string | null {
  if (wire.from_pin.startsWith(`${refPrefix}.`)) return wire.to_pin
  if (wire.to_pin.startsWith(`${refPrefix}.`)) return wire.from_pin
  return null
}

function neighboursOfPrefix(prefix: string, wires: Wire[]): string[] {
  const out: string[] = []
  for (const w of wires) {
    const other = otherEnd(w, prefix)
    if (other) out.push(other)
  }
  return out
}

function componentIdOf(reference: string): string | null {
  const dot = reference.indexOf('.')
  if (dot <= 0) return null
  return reference.slice(0, dot)
}

// Resistor ids are the prefix "R" plus a counter (R1, R2, ...). Match them
// exactly so component prefixes that merely start with R (RGB, ...) are not
// mistaken for a current-limiting resistor.
const RESISTOR_ID_RE = /^R\d+$/

// Resolve a wire's far end to a board digital pin, following at most one
// resistor in between. Covers the same two stereotyped wiring patterns the
// kid's circuits use (direct, or through a series resistor) so any pin can
// be traced regardless of which leg carries the resistor.
function boardPinVia(reference: string, wires: Wire[]): DigitalPinLabel | null {
  const direct = boardPin(reference)
  if (direct) return direct
  const neighbourId = componentIdOf(reference)
  if (!neighbourId || !RESISTOR_ID_RE.test(neighbourId)) return null
  for (const ref2 of neighboursOfPrefix(neighbourId, wires)) {
    const pin = boardPin(ref2)
    if (pin) return pin
  }
  return null
}

const ANALOG_PIN_RE = new RegExp(`^(?:${_BOARD_PREFIX})\\.A(\\d+)$`)

/** Return the analog input channel the component is wired into, or null if it
 * is not connected to an analog pin. Used so the simulator can route a
 * potentiometer / sensor on the canvas into `analogRead(A?)`. */
export function resolveAnalogChannel(componentId: string, wires: Wire[]): number | null {
  for (const w of wires) {
    const other = otherEnd(w, componentId)
    if (!other) continue
    const m = ANALOG_PIN_RE.exec(other)
    if (m) return parseInt(m[1], 10)
  }
  return null
}

/**
 * Return a map of pin-name -> UNO digital pin for every wire that
 * leaves `componentId`. Used for multi-pin parts such as the 7-segment
 * display where each segment connects to its own digital pin. Each leg is
 * traced through an optional series resistor, the same way single-pin
 * parts are, so a segment wired `SEG.A -> R.a` and `R.b -> UNO.D2` still
 * resolves to D2 (without this the display stayed dark whenever the kid
 * added a current-limiting resistor per segment).
 */
export function resolveAllDrivePins(
  componentId: string,
  wires: Wire[],
): Record<string, DigitalPinLabel> {
  const out: Record<string, DigitalPinLabel> = {}
  for (const w of wires) {
    const selfRef = w.from_pin.startsWith(`${componentId}.`) ? w.from_pin
      : w.to_pin.startsWith(`${componentId}.`) ? w.to_pin
        : null
    if (!selfRef) continue
    const other = selfRef === w.from_pin ? w.to_pin : w.from_pin
    const pin = boardPinVia(other, wires)
    if (!pin) continue
    const pinName = selfRef.slice(componentId.length + 1)
    out[pinName] = pin
  }
  return out
}

export function resolveDrivePin(
  componentId: string,
  wires: Wire[],
): DigitalPinLabel | null {
  // Direct connection, or through one series resistor.
  for (const ref of neighboursOfPrefix(componentId, wires)) {
    const pin = boardPinVia(ref, wires)
    if (pin) return pin
  }
  return null
}
