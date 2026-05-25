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
import type { Wire } from '../types/circuit'

const PIN_RE = /^UNO\.(D\d+)$/

function unoPin(reference: string): DigitalPinLabel | null {
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

export function resolveDrivePin(
  componentId: string,
  wires: Wire[],
): DigitalPinLabel | null {
  // 1. Direct connection.
  for (const ref of neighboursOfPrefix(componentId, wires)) {
    const pin = unoPin(ref)
    if (pin) return pin
  }
  // 2. Through one resistor (any neighbour whose id begins with `R`).
  for (const ref of neighboursOfPrefix(componentId, wires)) {
    const neighbourId = componentIdOf(ref)
    if (!neighbourId || !neighbourId.startsWith('R')) continue
    for (const ref2 of neighboursOfPrefix(neighbourId, wires)) {
      const pin = unoPin(ref2)
      if (pin) return pin
    }
  }
  return null
}
