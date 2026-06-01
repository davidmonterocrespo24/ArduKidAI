/**
 * Live pin state shared between the avr8js runner and the canvas components.
 *
 * The runner pushes raw digital pin levels (HIGH/LOW) and the timestamp of
 * the last transition. Components subscribe to a derived view through the
 * Zustand store - either "what is pin Dx right now?" for steady-state pins
 * (LEDs), or "has pin Dx toggled recently?" for activity-driven views like
 * the buzzer "playing" indicator.
 *
 * Servo PWM angle decoding and LCD I2C decoding are intentionally not
 * computed here yet - they live behind component-specific handlers that we
 * can add once this primitive is stable.
 */

// A digital pin label like "D0".."D53". Loosened from a fixed UNO union to a
// string so boards with more pins (Mega: D0..D53) work; the live pin snapshot
// is populated dynamically by the runner from the active board's port map.
export type DigitalPinLabel = string

export const DIGITAL_PIN_LABELS: DigitalPinLabel[] = [
  'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7',
  'D8', 'D9', 'D10', 'D11', 'D12', 'D13',
]

/** Empty record with every digital pin pre-keyed at false. */
export function emptyPinLevels(): Record<DigitalPinLabel, boolean> {
  return Object.fromEntries(DIGITAL_PIN_LABELS.map((p) => [p, false])) as Record<
    DigitalPinLabel,
    boolean
  >
}

/** Empty record with every digital pin pre-keyed at 0 (no activity). */
export function emptyActivity(): Record<DigitalPinLabel, number> {
  return Object.fromEntries(DIGITAL_PIN_LABELS.map((p) => [p, 0])) as Record<
    DigitalPinLabel,
    number
  >
}

/** True when the pin transitioned within the last `windowMs` milliseconds. */
export function isActive(
  pin: DigitalPinLabel,
  activity: Record<DigitalPinLabel, number>,
  windowMs = 250,
): boolean {
  const last = activity[pin]
  if (!last) return false
  return Date.now() - last < windowMs
}
