/**
 * Board registry. The simulator, canvas, wiring, and compiler were originally
 * hard-coded to the Arduino UNO (ATmega328P). This abstracts "which board" so
 * we can offer several. Phase A ships UNO + Nano (both ATmega328P, so the
 * avr8js configuration is identical and the in-browser simulation runs fully).
 * The Mega (ATmega2560) lands in phase B with its own hand-written avr8js
 * peripheral map.
 */

export type BoardId = 'uno' | 'nano' | 'mega'

export type Mcu = 'atmega328p' | 'atmega2560'

export interface BoardConfig {
  id: BoardId
  label: string
  /** DOM element id and the prefix the agent uses when wiring (e.g. UNO.D13). */
  canvasId: string
  /** Custom element from @wokwi/elements. */
  wokwiElement: string
  /** arduino-cli fully-qualified board name. */
  fqbn: string
  mcu: Mcu
  digitalPins: string[]
  analogPins: string[]
  pwmPins: string[]
  powerPins: string[]
}

const UNO_PWM = ['D3', 'D5', 'D6', 'D9', 'D10', 'D11']
const POWER = ['5V', '3V3', 'GND']

export const BOARDS: Record<BoardId, BoardConfig> = {
  uno: {
    id: 'uno',
    label: 'Arduino UNO',
    canvasId: 'UNO',
    wokwiElement: 'wokwi-arduino-uno',
    fqbn: 'arduino:avr:uno',
    mcu: 'atmega328p',
    digitalPins: Array.from({ length: 14 }, (_, i) => `D${i}`),
    analogPins: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
    pwmPins: UNO_PWM,
    powerPins: POWER,
  },
  nano: {
    id: 'nano',
    label: 'Arduino Nano',
    canvasId: 'NANO',
    wokwiElement: 'wokwi-arduino-nano',
    fqbn: 'arduino:avr:nano:cpu=atmega328',
    mcu: 'atmega328p',
    // Same ATmega328P as the UNO, but the Nano breaks out two extra
    // analog-only inputs (A6, A7).
    digitalPins: Array.from({ length: 14 }, (_, i) => `D${i}`),
    analogPins: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'],
    pwmPins: UNO_PWM,
    powerPins: POWER,
  },
  mega: {
    id: 'mega',
    label: 'Arduino Mega 2560',
    canvasId: 'MEGA',
    wokwiElement: 'wokwi-arduino-mega',
    fqbn: 'arduino:avr:mega:cpu=atmega2560',
    mcu: 'atmega2560',
    digitalPins: Array.from({ length: 54 }, (_, i) => `D${i}`),
    analogPins: Array.from({ length: 16 }, (_, i) => `A${i}`),
    pwmPins: [
      'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9',
      'D10', 'D11', 'D12', 'D13', 'D44', 'D45', 'D46',
    ],
    powerPins: POWER,
  },
}

/** Boards a kid can pick today. Mega is registered above but its accurate
 * simulation arrives in phase B, so it is gated out of the picker for now. */
export const SELECTABLE_BOARDS: BoardId[] = ['uno', 'nano']

export const DEFAULT_BOARD: BoardId = 'uno'

export function getBoard(id: BoardId): BoardConfig {
  return BOARDS[id] ?? BOARDS[DEFAULT_BOARD]
}

/** All wireable pin names for a board (digital + analog + power). */
export function boardPins(board: BoardConfig): string[] {
  return [...board.digitalPins, ...board.analogPins, ...board.powerPins]
}
