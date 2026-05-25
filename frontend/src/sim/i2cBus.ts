/**
 * Tiny I2C bus router around avr8js' AVRTWI.
 *
 * AVRTWI calls back into a TWIEventHandler for each transaction step:
 *   - start / stop conditions
 *   - addressing a slave (read or write)
 *   - sending or receiving a data byte
 *
 * We dispatch those callbacks to a map of address -> I2CSlave so the
 * sketch's `Wire.beginTransmission(0x27)` reaches the matching virtual
 * device. The only slaves we ship today are PCF8574 backpacks driving
 * 1602 LCDs, but the surface is generic.
 */

import type { AVRTWI, TWIEventHandler } from 'avr8js'

export interface I2CSlave {
  /** Master is opening a transaction. Return true to ACK. */
  start(write: boolean): boolean
  /** Master wrote a byte. Return true to ACK. */
  write(byte: number): boolean
  /** Master wants to read the next byte. */
  read(): number
  /** Master issued STOP after addressing this slave. */
  stop(): void
}

export class I2CBus implements TWIEventHandler {
  private slaves = new Map<number, I2CSlave>()
  private active: I2CSlave | null = null
  private twi: AVRTWI

  constructor(twi: AVRTWI) {
    this.twi = twi
    twi.eventHandler = this
  }

  register(address: number, slave: I2CSlave): void {
    this.slaves.set(address & 0x7f, slave)
  }

  start(): void {
    this.twi.completeStart()
  }

  stop(): void {
    if (this.active) {
      this.active.stop()
      this.active = null
    }
    this.twi.completeStop()
  }

  connectToSlave(address: number, write: boolean): void {
    const slave = this.slaves.get(address & 0x7f)
    if (!slave) {
      this.active = null
      this.twi.completeConnect(false)
      return
    }
    const ack = slave.start(write)
    this.active = ack ? slave : null
    this.twi.completeConnect(ack)
  }

  writeByte(value: number): void {
    const ack = this.active ? this.active.write(value) : false
    this.twi.completeWrite(ack)
  }

  readByte(): void {
    const value = this.active ? this.active.read() : 0xff
    this.twi.completeRead(value)
  }
}
