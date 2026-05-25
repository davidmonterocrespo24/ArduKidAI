import { AVRIOPort, CPU, avrInstruction, portBConfig } from 'avr8js'
import { BLINK_PROGRAM } from './blinkProgram'
import { bytesToProgramWords, parseIntelHex } from '../lib/intelHex'

const PROGRAM_MEM_WORDS = 0x4000
const PIN13_MASK = 1 << 5
const INSTRUCTIONS_PER_FRAME = 50_000

export interface SimHandle {
  stop: () => void
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

export function startSim(
  program: SimProgram,
  onLedChange: (on: boolean) => void,
): SimHandle {
  const cpu = new CPU(loadProgram(program))
  const portB = new AVRIOPort(cpu, portBConfig)

  let prevLed = false
  portB.addListener((value) => {
    const ledOn = (value & PIN13_MASK) !== 0
    if (ledOn !== prevLed) {
      prevLed = ledOn
      onLedChange(ledOn)
    }
  })

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

// Backward-compatible export used by phase 1 footer wiring.
export function startBlinkSim(onLedChange: (on: boolean) => void): SimHandle {
  return startSim({ kind: 'fallback' }, onLedChange)
}
