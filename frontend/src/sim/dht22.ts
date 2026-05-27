/**
 * Tiny DHT22 1-wire device driven from the AVR sim. Watches the data
 * pin for the host start signal (DDR=OUTPUT, PORT=LOW for >= 500 us),
 * then schedules the 5 ms response sequence: an 80 us LOW + 80 us
 * HIGH presence pulse, then 40 data bits.
 *
 * Each bit is encoded as 50 us LOW + (26 us HIGH for 0, 70 us HIGH
 * for 1). 40 bits = 16-bit humidity (* 10) + 16-bit temperature
 * (* 10, MSB is sign) + 8-bit checksum.
 *
 * The DHT and Adafruit DHT libraries both poll the pin with pulseIn
 * to decode each bit's HIGH width, so honest timing is enough - we
 * do not need to implement library-specific quirks.
 */

import type { CPU } from 'avr8js'
import { AVRIOPort, PinState } from 'avr8js'

const F_CPU = 16_000_000

const HOST_LOW_MIN_US = 500   // Adafruit drives LOW for >= 1 ms, DHT spec is 500 us
const RESPONSE_DELAY_US = 30
const PRESENCE_LOW_US = 80
const PRESENCE_HIGH_US = 80
const BIT_LOW_US = 50
const BIT_HIGH_ZERO_US = 26
const BIT_HIGH_ONE_US = 70

export interface DhtValues {
  celsius: number
  humidity: number
}

export class DHT22Sim {
  private state: 'idle' | 'host-low' | 'responding' = 'idle'
  private hostLowStartCycles = 0
  private readonly cpu: CPU
  private readonly port: AVRIOPort
  private readonly bit: number
  private readonly getValues: () => DhtValues

  constructor(cpu: CPU, port: AVRIOPort, bit: number, getValues: () => DhtValues) {
    this.cpu = cpu
    this.port = port
    this.bit = bit
    this.getValues = getValues
    port.addListener(() => this.onPortChange())
  }

  private onPortChange(): void {
    if (this.state === 'responding') return
    const pin = this.port.pinState(this.bit)
    if (this.state === 'idle' && pin === PinState.Low) {
      // Host pulled the line LOW. Remember when so we can verify the
      // pulse is long enough on release.
      this.state = 'host-low'
      this.hostLowStartCycles = this.cpu.cycles
    } else if (this.state === 'host-low') {
      if (pin === PinState.Low) return
      const cyclesElapsed = this.cpu.cycles - this.hostLowStartCycles
      const usElapsed = (cyclesElapsed * 1_000_000) / F_CPU
      if (usElapsed >= HOST_LOW_MIN_US) {
        this.respond()
      } else {
        this.state = 'idle'
      }
    }
  }

  private respond(): void {
    this.state = 'responding'
    const { celsius, humidity } = this.getValues()
    const h = Math.round(Math.max(0, Math.min(100, humidity)) * 10) & 0xffff
    const traw = Math.round(Math.max(-40, Math.min(80, celsius)) * 10)
    const tEncoded = traw < 0 ? 0x8000 | (-traw & 0x7fff) : traw & 0x7fff
    const bytes = [
      (h >> 8) & 0xff,
      h & 0xff,
      (tEncoded >> 8) & 0xff,
      tEncoded & 0xff,
      0,
    ]
    bytes[4] = (bytes[0] + bytes[1] + bytes[2] + bytes[3]) & 0xff

    const events: Array<[number, boolean]> = []
    let usOffset = RESPONSE_DELAY_US
    events.push([usOffset, false])
    usOffset += PRESENCE_LOW_US
    events.push([usOffset, true])
    usOffset += PRESENCE_HIGH_US
    for (const byte of bytes) {
      for (let i = 7; i >= 0; i--) {
        const isOne = ((byte >> i) & 1) !== 0
        events.push([usOffset, false])
        usOffset += BIT_LOW_US
        events.push([usOffset, true])
        usOffset += isOne ? BIT_HIGH_ONE_US : BIT_HIGH_ZERO_US
      }
    }
    // Final low pulse so the library sees the end-of-frame transition,
    // then release the line.
    events.push([usOffset, false])
    usOffset += BIT_LOW_US
    events.push([usOffset, true])

    for (const [us, value] of events) {
      const cycles = Math.max(1, Math.round((us * F_CPU) / 1_000_000))
      this.cpu.addClockEvent(() => {
        this.port.setPin(this.bit, value)
      }, cycles)
    }

    const finalCycles = Math.round(((usOffset + 100) * F_CPU) / 1_000_000)
    this.cpu.addClockEvent(() => {
      this.state = 'idle'
    }, finalCycles)
  }
}
