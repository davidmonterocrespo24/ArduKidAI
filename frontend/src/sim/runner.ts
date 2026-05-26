import {
  AVRADC,
  AVRIOPort,
  AVRTWI,
  AVRTimer,
  AVRUSART,
  CPU,
  adcConfig,
  avrInstruction,
  portBConfig,
  portCConfig,
  portDConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  twiConfig,
  usart0Config,
} from 'avr8js'
import { BLINK_PROGRAM } from './blinkProgram'
import { bytesToProgramWords, parseIntelHex } from '../lib/intelHex'
import { DIGITAL_PIN_LABELS, type DigitalPinLabel } from './pinState'
import { I2CBus } from './i2cBus'
import { PCF8574 } from './pcf8574'
import { HD44780Backpack } from './hd44780'
import { SSD1306Device } from './ssd1306'
import {
  emptyPwmSnapshot,
  pwmSnapshotEquals,
  sampleScale,
  type PwmSnapshot,
} from './pwm'
import { clearInputBridge, registerInputBridge } from './inputBridge'
import { emitPinToggle } from './audioBridge'

export type SerialSender = (bytes: Uint8Array) => void

let activeSerialSender: SerialSender | null = null

export function sendSerialToActiveSim(bytes: Uint8Array): void {
  activeSerialSender?.(bytes)
}

export type { PwmSnapshot } from './pwm'

const PROGRAM_MEM_WORDS = 0x4000
// 250k instructions per ~16 ms frame keeps the simulator close to a real
// 16 MHz Arduino UNO (15 M cycles/sec actual, ~16 M target) so delay(500)
// in the kid's sketch feels like half a second of wall time. 50k was four
// times too slow and made every blink look frozen.
const INSTRUCTIONS_PER_FRAME = 250_000
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
  /** Called every frame for each ADC channel 0..5. Return the voltage at
   * that pin (0..VCC). Feeds analogRead(A0..A5) from the canvas. */
  getAdcChannel?: (channel: number) => number
  /** Called when a virtual I2C LCD updates its visible text. Two lines
   * joined by "\n", trailing blanks trimmed. */
  onLcdText?: (text: string) => void
  /** Called when the virtual SSD1306 OLED repaints. The pixel buffer is
   * 128 cols x 64 rows, 1-byte-per-pixel (1 = lit). */
  onOledPixels?: (pixels: Uint8Array) => void
  /** Called once per frame if the PWM register snapshot changed.
   * Consumers (LED brightness, servo angle) project the relevant fields. */
  onPwmChange?: (snapshot: PwmSnapshot) => void
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
  // Wire the three ATmega328P timers. Without them `millis()` stays at 0
  // because the Timer0 overflow interrupt never fires, so `delay()` and
  // `tone()` block forever and any sketch using them looks frozen after
  // the first instruction. tone() also needs Timer2; Timer1 is here for
  // sketches that use PWM on pins 9/10.
  new AVRTimer(cpu, timer0Config)
  new AVRTimer(cpu, timer1Config)
  new AVRTimer(cpu, timer2Config)
  // ADC: feeds analogRead(A0..A5). channelValues[i] is the voltage at that
  // pin; we refresh from the caller every frame so dragging the
  // potentiometer knob is reflected on the next conversion.
  const adc = new AVRADC(cpu, adcConfig)

  // TWI / I2C: kids' I2C sketches are 99% "LiquidCrystal_I2C lcd(0x27,
  // 16, 2);" so we always wire a virtual PCF8574 backpack at 0x27 into
  // an HD44780 decoder. The text flows up via onLcdText so the canvas
  // can mirror it on the wokwi-lcd1602 element. Sketches that don't
  // touch I2C pay nothing.
  const twi = new AVRTWI(cpu, twiConfig, F_CPU)
  const i2cBus = new I2CBus(twi)
  if (callbacks.onLcdText) {
    const lcd = new HD44780Backpack(callbacks.onLcdText)
    i2cBus.register(0x27, new PCF8574(lcd.onPort))
  }
  // SSD1306 OLED at the Adafruit default I2C addresses (0x3C and
  // 0x3D, since some modules ship strapped to the second one).
  if (callbacks.onOledPixels) {
    const oled = new SSD1306Device(() => callbacks.onOledPixels!(oled.pixels))
    i2cBus.register(0x3c, oled)
    i2cBus.register(0x3d, oled)
  }

  // We buffer bytes ourselves instead of using usart.onLineTransmit so
  // a sketch that prints "ready" with no newline still surfaces in the
  // panel when the kid hits stop. avr8js' built-in line callback drops
  // the trailing partial line on shutdown.
  let lineBuffer = ''
  if (callbacks.onSerialLine || callbacks.onSerialByte) {
    usart.onByteTransmit = (value: number) => {
      callbacks.onSerialByte?.(value)
      if (!callbacks.onSerialLine) return
      if (value === 0x0a) {
        callbacks.onSerialLine(lineBuffer)
        lineBuffer = ''
      } else if (value !== 0x0d) {
        lineBuffer += String.fromCharCode(value)
        // Hard cap so a runaway Serial.write(0xff) loop cannot grow
        // memory unbounded between newlines.
        if (lineBuffer.length > 4096) {
          callbacks.onSerialLine(lineBuffer)
          lineBuffer = ''
        }
      }
    }
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
          // Audible-rate events for the buzzer's frequency tracker.
          // Stays out of Zustand because tone(1000) fires 2 000 of
          // these per second.
          emitPinToggle(label)
        }
      }
      if (changed) emit()
    }
  }

  portB.addListener(makeHandler(PORTB_MAP))
  portD.addListener(makeHandler(PORTD_MAP))
  portC.addListener(makeHandler([]))

  // Serial RX bridge: the SerialMonitor "Send" button feeds bytes
  // into the USART so the sketch can read them with Serial.read().
  // writeByte(b, true) bypasses the baud-rate delay so we don't have
  // to wait O(milliseconds) per character.
  activeSerialSender = (bytes: Uint8Array) => {
    for (const b of bytes) usart.writeByte(b, true)
  }

  // External input bridge: pushbuttons / switches on the canvas pull
  // a pin LOW or release it back HIGH. We translate the label to the
  // right port+bit and call setPin, which inside avr8js also fires
  // INT0/INT1/PCINT vectors so attachInterrupt() works for free.
  const setter = (label: DigitalPinLabel, value: boolean) => {
    for (const [l, bit] of PORTD_MAP) {
      if (l === label) {
        portD.setPin(bit, value)
        return
      }
    }
    for (const [l, bit] of PORTB_MAP) {
      if (l === label) {
        portB.setPin(bit, value)
        return
      }
    }
  }
  registerInputBridge(setter)

  let stopped = false
  let lastPwm: PwmSnapshot = emptyPwmSnapshot()

  function frame() {
    if (stopped) return
    if (callbacks.getAdcChannel) {
      for (let ch = 0; ch < 6; ch++) {
        adc.channelValues[ch] = callbacks.getAdcChannel(ch)
      }
    }
    for (let i = 0; i < INSTRUCTIONS_PER_FRAME; i++) {
      avrInstruction(cpu)
      cpu.tick()
    }
    if (callbacks.onPwmChange) {
      const snap = sampleScale(cpu)
      if (!pwmSnapshotEquals(snap, lastPwm)) {
        lastPwm = snap
        callbacks.onPwmChange(snap)
      }
    }
  }

  // setInterval keeps ticking regardless of tab visibility, headless mode,
  // or rAF throttling. ~16 ms gives a 60 Hz target. requestAnimationFrame
  // would sync to the display but stalls when the tab is hidden or the
  // browser throttles background timers (which is exactly what made the
  // LED look frozen during QA).
  const intervalHandle = window.setInterval(frame, 16)

  return {
    stop: () => {
      stopped = true
      window.clearInterval(intervalHandle)
      clearInputBridge(setter)
      activeSerialSender = null
      if (lineBuffer.length > 0 && callbacks.onSerialLine) {
        callbacks.onSerialLine(lineBuffer)
        lineBuffer = ''
      }
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
