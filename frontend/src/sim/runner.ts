import { AVRIOPort, CPU, avrInstruction, portBConfig } from 'avr8js'
import { BLINK_PROGRAM } from './blinkProgram'

const PROGRAM_MEM_WORDS = 0x4000
const PIN13_MASK = 1 << 5
const INSTRUCTIONS_PER_FRAME = 50_000

export interface SimHandle {
  stop: () => void
}

export function startBlinkSim(onLedChange: (on: boolean) => void): SimHandle {
  const progMem = new Uint16Array(PROGRAM_MEM_WORDS)
  progMem.set(BLINK_PROGRAM)

  const cpu = new CPU(progMem)
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
