import {
  AVRIOPort,
  AVRUSART,
  CPU,
  avrInstruction,
  portBConfig,
  portCConfig,
  portDConfig,
  usart0Config,
} from 'avr8js'
import { BLINK_PROGRAM } from './blinkProgram'
import { bytesToProgramWords, parseIntelHex } from '../lib/intelHex'
import { DIGITAL_PIN_LABELS, type DigitalPinLabel } from './pinState'

const PROGRAM_MEM_WORDS = 0x4000
const INSTRUCTIONS_PER_FRAME = 50_000
const F_CPU = 16_000_000

export interface PinSnapshot {
  levels: Record<DigitalPinLabel, boolean>
  activity: Record<DigitalPinLabel, number>
}

export interface SimHandle {
  stop: () => void
}

export interface SimCallbacks {
  onPinChange?: (snapshot: PinSnapshot) => void
  onSerialLine?: (line: string) => void
  onSerialByte?: (byte: number) => void
}

export type SimProgram =
  | { kind: 'hex'; hex: string }
  | { kind: 'fallback' }

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

export function startSim(program: SimProgram, callbacks: SimCallbacks): SimHandle {
  const cpu = new CPU(loadProgram(program))
  const portB = new AVRIOPort(cpu, portBConfig)
  const portC = new AVRIOPort(cpu, portCConfig)
  const portD = new AVRIOPort(cpu, portDConfig)
  const usart = new AVRUSART(cpu, usart0Config, F_CPU)

  if (callbacks.onSerialLine) {
    usart.onLineTransmit = callbacks.onSerialLine
  }
  if (callbacks.onSerialByte) {
    usart.onByteTransmit = callbacks.onSerialByte
  }

  const snapshot = emptySnapshot()
  if (callbacks.onPinChange) {
    callbacks.onPinChange({ levels: { ...snapshot.levels }, activity: { ...snapshot.activity } })
  }

  function emit() {
    callbacks.onPinChange?.({
      levels: { ...snapshot.levels },
      activity: { ...snapshot.activity },
    })
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

// Backward-compatible wrapper kept for the original phase-1 entry point.
export function startBlinkSim(onLedChange: (on: boolean) => void): SimHandle {
  return startSim(
    { kind: 'fallback' },
    {
      onPinChange: (snapshot) => onLedChange(snapshot.levels.D13),
    },
  )
}
