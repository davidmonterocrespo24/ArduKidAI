// Real breadboard palette: red for power, black for ground, then a cycling
// set of vivid colours for signal wires. The agent and the manual UX both
// share this list so wires stay consistent.

export const WIRE_COLORS = [
  '#dc2626', // red
  '#2563eb', // blue
  '#16a34a', // green
  '#ea580c', // orange
  '#9333ea', // purple
  '#0891b2', // cyan
  '#facc15', // yellow
  '#1f2937', // near-black
] as const

export function nextWireColor(index: number): string {
  return WIRE_COLORS[index % WIRE_COLORS.length]
}

/** Pick a colour based on the pin role - power lines get red/black so the
 * canvas reads like a breadboard photo. */
export function pickWireColor(fromPin: string, toPin: string, fallbackIndex: number): string {
  const isGround = /\bGND\b/i.test(fromPin) || /\bGND\b/i.test(toPin)
  if (isGround) return '#1f2937'
  const isPower = /\b(5V|3V3|VCC)\b/i.test(fromPin) || /\b(5V|3V3|VCC)\b/i.test(toPin)
  if (isPower) return '#dc2626'
  return nextWireColor(fallbackIndex)
}
