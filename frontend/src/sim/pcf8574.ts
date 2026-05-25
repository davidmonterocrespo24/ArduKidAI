/**
 * Virtual PCF8574 8-bit I/O expander.
 *
 * The PCF8574 is the "I2C-to-8-bits" chip on every $2 LCD1602 backpack.
 * The sketch issues `Wire.beginTransmission(0x27); Wire.write(byte);` and
 * the chip mirrors that byte on its 8 output pins. We don't model the
 * quasi-bidirectional input mode - kids' sketches only ever write.
 */

import type { I2CSlave } from './i2cBus'

export class PCF8574 implements I2CSlave {
  // Power-on state: all pins HIGH (pulled up by the chip's quasi-Hi-Z
  // outputs). This matters because the LCD strap pulls RW low through a
  // backpack jumper - if we started at 0 the first nibble would land on
  // the wrong rail.
  private port = 0xff
  private onChange: (port: number) => void

  constructor(onChange: (port: number) => void) {
    this.onChange = onChange
  }

  start(): boolean {
    return true
  }

  write(byte: number): boolean {
    this.port = byte & 0xff
    this.onChange(this.port)
    return true
  }

  read(): number {
    return this.port
  }

  stop(): void {
    // No latched state to flush.
  }
}
