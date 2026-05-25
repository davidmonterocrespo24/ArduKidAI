import {
  AVRIOPort,
  CPU,
  avrInstruction,
  portBConfig,
  portCConfig,
  portDConfig,
} from 'avr8js'
import { BLINK_PROGRAM } from './blinkProgram'
import { bytesToProgramWords, parseIntelHex } from '../lib/intelHex'
import { DIGITAL_PIN_LABELS, type DigitalPinLabel } from './pinState'

const PROGRAM_MEM_WORDS = 0x4000
const INSTRUCTIONS_PER_FRAME = 50_000

export interface PinSnapshot {
  levels: Record<DigitalPinLabel, boolean>
  activity: Record<DigitalPinLabel, number>
}

export interface SimHandle {
  stop: () => void
}

export type SimProgram =
  | { kind: 'hex'; hex: string }
  | { kind: 'fallback' }

export type PinChangeListener = (snapshot: PinSnapshot) => void

function loadProgram(input: SimProgram): Uint16Array {
  const mem = new Uint16Array(PROGRAM_MEM_WORDS)
  if (input.kind === 'hex') {
    const bytes = parseIntelHex(input.hex)
    if (bytes.length > 0) {
      const words = bytesToProgramWords(bytes, PROGRAM_MEM_WORDS)
      mem.set(words)
      return mem
    }
  }
  mem.set(BLINK_PROGRAM)
  return mem
}

// Map each digital pin to (portConfig, bit-index-within-port). These mirror
// the ATmega328P pinout used by the Arduino UNO.
//   PORTD (0x0b) -> D0..D7
//   PORTB (0x05) -> D8..D13 (bits 0..5)
//   PORTC (0x08) -> A0..A5  (analog inputs; not used for digital out today)
const PORTD_MAP: Array<[DigitalPinLabel, number]> = [
  ['D0', 0], ['D1', 1], ['D2', 2], ['D3', 3],
  ['D4', 4], ['D5', 5], ['D6', 6], ['D7', 7],
]
const PORTB_MAP: Array<[DigitalPinLabel, number]> = [
  ['D8', 0], ['D9', 1], ['D10', 2], ['D11', 3], ['D12', 4], ['D13', 5],
]

function emptySnapshot(): PinSnapshot {
  const levels = Object.fromEntries(
    DIGITAL_PIN_LABELS.map((p) => [p, false]),
  ) as Record<DigitalPinLabel, boolean>
  const activity = Object.fromEntries(
    DIGITAL_PIN_LABELS.map((p) => [p, 0]),
  ) as Record<DigitalPinLabel, number>
  return { levels, activity }
}

export function startSim(program: SimProgram, onPinChange: PinChangeListener): SimHandle {
  const cpu = new CPU(loadProgram(program))
  const portB = new AVRIOPort(cpu, portBConfig)
  const portC = new AVRIOPort(cpu, portCConfig)
  const portD = new AVRIOPort(cpu, portDConfig)

  const snapshot = emptySnapshot()
  // Push an initial snapshot so subscribers reflect the all-LOW boot state.
  onPinChange({ levels: { ...snapshot.levels }, activity: { ...snapshot.activity } })

  function emit() {
    onPinChange({ levels: { ...snapshot.levels }, activity: { ...snapshot.activity } })
  }

  function makeHandler(map: Array<[DigitalPinLabel, number]>) {
    return (value: number) => {
      let changed = false
      const now = Date.now()
      for (const [label, bit] of map) {
        const level = (value & (1 << bit)) !== 0
        if (snapshot.levels[label] !== level) {
          snapshot.levels[label] = level
          snapshot.activity[label] = now
          changed = true
        }
      }
      if (changed) emit()
    }
  }

  portB.addListener(makeHandler(PORTB_MAP))
  portD.addListener(makeHandler(PORTD_MAP))
  // PORTC writes are rare in beginner sketches but we still listen so any
  // future analog-pin-as-digital usage shows up correctly.
  portC.addListener(makeHandler([]))

  let stopped = false
  let rafHandle = 0

  function frame() {
    if (stopped) return
    for (let i = 0; i < INSTRUCTIONS_PER_FRAME; i++) {
      avrInstruction(cpu)
      cpu.tick()
    }
    rafHandle = requestAnimationFrame(frame)
  }

  rafHandle = requestAnimationFrame(frame)

  return {
    stop: () => {
      stopped = true
      cancelAnimationFrame(rafHandle)
    },
  }
}

// Backward-compatible wrapper. Kept so existing entry points can be migrated
// without a flurry of imports.
export function startBlinkSim(onLedChange: (on: boolean) => void): SimHandle {
  return startSim({ kind: 'fallback' }, (snapshot) => {
    onLedChange(snapshot.levels.D13)
  })
}
