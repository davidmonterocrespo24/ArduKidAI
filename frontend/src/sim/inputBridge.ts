/**
 * Module-level bridge that lets canvas components drive the AVR
 * input pins back into the running simulator.
 *
 * The runner registers a setter when it starts and clears it on stop.
 * Pushbuttons, switches and tilt sensors call `pressInputPin('D2',
 * false)` to pull the bit LOW; pulse / release sequences also fire
 * the matching INT0/INT1/PCINT vectors inside avr8js automatically
 * because `AVRIOPort.setPin` updates the port's PIN register.
 */

import type { DigitalPinLabel } from './pinState'

type Setter = (label: DigitalPinLabel, value: boolean) => void

let active: Setter | null = null

export function registerInputBridge(setter: Setter): void {
  active = setter
}

export function clearInputBridge(setter: Setter): void {
  if (active === setter) active = null
}

export function driveInputPin(label: DigitalPinLabel, value: boolean): void {
  active?.(label, value)
}
