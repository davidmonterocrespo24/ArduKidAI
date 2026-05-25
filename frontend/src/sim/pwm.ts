/**
 * Sample the ATmega328P's PWM registers each frame so analogWrite() and
 * the Servo library actually drive components on the canvas.
 *
 * avr8js' timers raise / lower the pin in real time so digitalWrite()
 * is already handled by the IOPort listener. PWM is different: the OCR
 * register holds the duty cycle directly, and reading it back is far
 * cheaper than measuring on-time fractions from pin transitions.
 *
 * Pin -> register map (Arduino UNO):
 *   D3  -> OCR2B, TCCR2A COM2B1
 *   D5  -> OCR0B, TCCR0A COM0B1
 *   D6  -> OCR0A, TCCR0A COM0A1
 *   D9  -> OCR1A, TCCR1A COM1A1
 *   D10 -> OCR1B, TCCR1A COM1B1
 *   D11 -> OCR2A, TCCR2A COM2A1
 */

import type { CPU } from 'avr8js'
import type { DigitalPinLabel } from './pinState'

const TCCR0A = 0x44
const OCR0A = 0x47
const OCR0B = 0x48
const TCCR1A = 0x80
const OCR1AL = 0x88
const OCR1AH = 0x89
const OCR1BL = 0x8a
const OCR1BH = 0x8b
const TCCR2A = 0xb0
const OCR2A = 0xb3
const OCR2B = 0xb4

interface Pwm8 {
  pin: DigitalPinLabel
  ocr: number
  tccr: number
  comBit: number
}

const PWM8_PINS: Pwm8[] = [
  { pin: 'D3', ocr: OCR2B, tccr: TCCR2A, comBit: 5 },
  { pin: 'D5', ocr: OCR0B, tccr: TCCR0A, comBit: 5 },
  { pin: 'D6', ocr: OCR0A, tccr: TCCR0A, comBit: 7 },
  { pin: 'D11', ocr: OCR2A, tccr: TCCR2A, comBit: 7 },
]

export interface PwmSnapshot {
  /** Duty cycle 0..1 per pin, only present when the corresponding COM
   * bit is enabled (i.e. analogWrite was called). */
  duty: Partial<Record<DigitalPinLabel, number>>
  /** Raw OCR1A / OCR1B values (0..65535). Servo consumers convert
   * these to a pulse width and then an angle. */
  ocr1a: number
  ocr1b: number
  com1a: boolean
  com1b: boolean
}

export function sampleScale(cpu: CPU): PwmSnapshot {
  const duty: Partial<Record<DigitalPinLabel, number>> = {}
  for (const p of PWM8_PINS) {
    const tccr = cpu.data[p.tccr]
    if ((tccr & (1 << p.comBit)) === 0) continue
    duty[p.pin] = cpu.data[p.ocr] / 255
  }
  const tccr1a = cpu.data[TCCR1A]
  const ocr1a = cpu.data[OCR1AL] | (cpu.data[OCR1AH] << 8)
  const ocr1b = cpu.data[OCR1BL] | (cpu.data[OCR1BH] << 8)
  const com1a = (tccr1a & (1 << 7)) !== 0
  const com1b = (tccr1a & (1 << 5)) !== 0
  // For D9/D10 in 8-bit Fast PWM mode the OCR1x stays <= 255 and we
  // expose it as a duty cycle the same way as the 8-bit timers. Larger
  // values (Servo library uses 1000..4000) are not duty cycles; we
  // leave them out of `duty` and let the servo consumer read ocr1a/b.
  if (com1a && ocr1a <= 255) duty['D9'] = ocr1a / 255
  if (com1b && ocr1b <= 255) duty['D10'] = ocr1b / 255
  return { duty, ocr1a, ocr1b, com1a, com1b }
}

export function pwmSnapshotEquals(a: PwmSnapshot, b: PwmSnapshot): boolean {
  if (a.ocr1a !== b.ocr1a || a.ocr1b !== b.ocr1b) return false
  if (a.com1a !== b.com1a || a.com1b !== b.com1b) return false
  const ak = Object.keys(a.duty)
  const bk = Object.keys(b.duty)
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    if (a.duty[k as DigitalPinLabel] !== b.duty[k as DigitalPinLabel]) return false
  }
  return true
}

export function emptyPwmSnapshot(): PwmSnapshot {
  return { duty: {}, ocr1a: 0, ocr1b: 0, com1a: false, com1b: false }
}

/**
 * Convert a Servo-library OCR1A/B value (in 0.5 µs ticks because the
 * library puts Timer1 on prescaler /8) into a 0..180 horn angle. Pulses
 * outside the standard 544..2400 µs window are clamped.
 */
export function servoMicrosToAngle(ocr: number): number {
  const micros = ocr / 2
  const MIN_US = 544
  const MAX_US = 2400
  if (micros <= MIN_US) return 0
  if (micros >= MAX_US) return 180
  return ((micros - MIN_US) / (MAX_US - MIN_US)) * 180
}
