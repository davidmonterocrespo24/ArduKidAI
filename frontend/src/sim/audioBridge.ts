/**
 * Module-level bridge for "the simulator just toggled a pin" events.
 *
 * The IOPort listener already calls onPinChange when any monitored pin
 * flips, but it does so via a Zustand store update which throttles to
 * React's render rhythm. For the buzzer we need every single toggle
 * (a 1 kHz tone is 2 000 transitions/sec) so we can measure the
 * audible frequency. Listeners registered here run synchronously
 * inside the avr8js callback.
 */

import type { DigitalPinLabel } from './pinState'

type ToggleListener = (pin: DigitalPinLabel) => void

const listeners = new Set<ToggleListener>()

export function onPinToggle(fn: ToggleListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emitPinToggle(pin: DigitalPinLabel): void {
  for (const l of listeners) l(pin)
}

/**
 * Singleton AudioContext + on-first-gesture unsuspend.
 *
 * Browsers reject `new AudioContext()` audio until the page has had a
 * user gesture. We create it lazily and resume on the first click.
 */
let cachedCtx: AudioContext | null = null

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (cachedCtx) return cachedCtx
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  cachedCtx = new Ctor()
  const resume = () => {
    if (cachedCtx && cachedCtx.state === 'suspended') {
      void cachedCtx.resume()
    }
  }
  window.addEventListener('mousedown', resume, { once: false })
  window.addEventListener('keydown', resume, { once: false })
  window.addEventListener('touchstart', resume, { once: false })
  return cachedCtx
}
