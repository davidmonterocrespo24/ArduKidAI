import type { ComponentInstance, ComponentType } from '../types/circuit'

// Mirror of backend/app/agent/session.py _PREFIX so the IDs the user generates
// locally line up with the ones the backend assigns later in the same session.
const PREFIX: Record<ComponentType, string> = {
  uno: 'UNO',
  led: 'L',
  resistor: 'R',
  pushbutton: 'B',
  buzzer: 'BZ',
  servo: 'S',
  potentiometer: 'P',
  lcd1602: 'LCD',
  seg7: 'SEG',
}

const ID_RE = /^([A-Za-z]+)(\d+)$/

export function nextComponentId(type: ComponentType, existing: ComponentInstance[]): string {
  const prefix = PREFIX[type]
  let highest = 0
  for (const c of existing) {
    const match = ID_RE.exec(c.id)
    if (!match) continue
    if (match[1] !== prefix) continue
    const n = parseInt(match[2], 10)
    if (Number.isFinite(n) && n > highest) highest = n
  }
  return `${prefix}${highest + 1}`
}
