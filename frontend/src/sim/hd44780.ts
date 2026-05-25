/**
 * HD44780 16x2 character LCD driven through a PCF8574 backpack.
 *
 * The backpack maps the 8 I/O pins like this (every cheap LCM1602
 * variant uses this pinout):
 *   P0 = RS  (0 = command, 1 = data)
 *   P1 = RW  (0 = write, the LCD never reads back here)
 *   P2 = E   (enable strobe - rising edge latches the nibble)
 *   P3 = backlight
 *   P4..P7 = D4..D7  (4-bit data bus)
 *
 * The sketch sends each byte as two nibbles, high one first, by writing
 * the byte to the PCF8574 with E=1 then E=0. We decode that pulse train
 * back into command/data bytes and maintain a 2x40 DDRAM so any sketch
 * using LiquidCrystal_I2C (the de-facto Arduino library) lights up.
 */

const ROW_LEN = 40

const ROW_BASE: Record<number, number> = {
  0x00: 0,
  0x40: 1,
}

export class HD44780Backpack {
  private prevE = false
  private pendingHigh: number | null = null
  // 2 rows x 40 cols of internal DDRAM. The visible window is the first
  // 16 columns of each row.
  private ddram = new Uint8Array(2 * ROW_LEN).fill(0x20)
  private addr = 0
  private increment = 1
  private displayOn = true
  private backlight = true
  private cgramMode = false
  private onText: (text: string) => void

  constructor(onText: (text: string) => void) {
    this.onText = onText
  }

  /** Hook this to the PCF8574 onChange callback. */
  onPort = (port: number): void => {
    const e = (port & 0x04) !== 0
    const fallingEdge = this.prevE && !e
    this.prevE = e

    const newBacklight = (port & 0x08) !== 0
    if (newBacklight !== this.backlight) {
      this.backlight = newBacklight
      this.flush()
    }

    if (!fallingEdge) return

    const nibble = (port >> 4) & 0x0f
    if (this.pendingHigh === null) {
      this.pendingHigh = nibble
      return
    }

    const byte = ((this.pendingHigh & 0x0f) << 4) | (nibble & 0x0f)
    this.pendingHigh = null
    const rs = (port & 0x01) !== 0
    if (rs) this.writeData(byte)
    else this.writeCommand(byte)
  }

  private writeCommand(byte: number): void {
    if (byte === 0x01) {
      this.ddram.fill(0x20)
      this.addr = 0
      this.cgramMode = false
      this.flush()
      return
    }
    if (byte === 0x02 || byte === 0x03) {
      this.addr = 0
      this.cgramMode = false
      return
    }
    if ((byte & 0xfc) === 0x04) {
      // Entry mode set: bit 1 controls increment / decrement.
      this.increment = byte & 0x02 ? 1 : -1
      return
    }
    if ((byte & 0xf8) === 0x08) {
      // Display on/off control - bit 2 is the display power.
      this.displayOn = (byte & 0x04) !== 0
      this.flush()
      return
    }
    if ((byte & 0xc0) === 0x40) {
      this.cgramMode = true
      return
    }
    if ((byte & 0x80) === 0x80) {
      this.addr = byte & 0x7f
      this.cgramMode = false
      return
    }
    // Function set, cursor shift, etc. - we don't need them to render.
  }

  private writeData(byte: number): void {
    if (this.cgramMode) return
    const row = ROW_BASE[this.addr & 0xc0] ?? (this.addr < 0x40 ? 0 : 1)
    const col = this.addr & 0x3f
    if (col < ROW_LEN) {
      this.ddram[row * ROW_LEN + col] = byte
      this.flush()
    }
    this.addr = (this.addr + this.increment) & 0x7f
  }

  private flush(): void {
    if (!this.displayOn || !this.backlight) {
      this.onText('')
      return
    }
    const row0 = this.rowToString(0)
    const row1 = this.rowToString(1)
    this.onText(`${row0}\n${row1}`.replace(/\s+$/, ''))
  }

  private rowToString(row: number): string {
    let out = ''
    const start = row * ROW_LEN
    for (let i = 0; i < 16; i++) {
      const c = this.ddram[start + i]
      out += c >= 0x20 && c < 0x80 ? String.fromCharCode(c) : ' '
    }
    return out.replace(/\s+$/, '')
  }
}
