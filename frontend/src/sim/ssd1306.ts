/**
 * Tiny SSD1306 OLED I2C decoder.
 *
 * The Adafruit_SSD1306 library's `display.display()` issues:
 *   1. control byte 0x00, command 0x21 (Set Column Address),  start=0, end=127
 *   2. control byte 0x00, command 0x22 (Set Page Address),    start=0, end=7
 *   3. control byte 0x40 (data stream), then 1024 framebuffer
 *      bytes (8 pages x 128 columns). Each byte writes 8 vertical
 *      pixels into the cell at (col, page).
 *
 * We honour exactly this pattern. Other commands (display on/off,
 * contrast, scroll, ...) are accepted with the right argument count
 * and ignored. Kid sketches that paint text or pixels via the
 * standard library all hit this path so the canvas reflects the
 * actual drawing.
 *
 * Framebuffer layout in `pixels`: 128 cols x 64 rows, 1 = lit.
 * Row r is in page r >> 3, bit (r & 7) of the page-byte.
 */

import type { I2CSlave } from './i2cBus'

const WIDTH = 128
const HEIGHT = 64

type Mode = 'control' | 'cmd-args' | 'data'

// Command argument counts the library uses. Anything not in the table
// is treated as a zero-arg command (no-op for our render).
const ARG_COUNT: Record<number, number> = {
  0x21: 2, // set column address (start, end)
  0x22: 2, // set page address (start, end)
  0x81: 1, // set contrast
  0xa8: 1, // set multiplex ratio
  0xd3: 1, // set display offset
  0xd5: 1, // set display clock divide
  0xd9: 1, // set pre-charge
  0xda: 1, // set com pins
  0xdb: 1, // set vcom detect
  0x20: 1, // memory addressing mode
  0x8d: 1, // charge pump
  0x40: 0, // set start line (variants 0x40-0x7f)
}

export class SSD1306Device implements I2CSlave {
  // 128x64 monochrome framebuffer.
  readonly pixels = new Uint8Array(WIDTH * HEIGHT)

  // Decoder state.
  private mode: Mode = 'control'
  private nextDataIsCommand = false
  private pendingCmd = 0
  private pendingArgs: number[] = []
  private argsLeft = 0

  // Drawing cursor (column 0..127, page 0..7).
  private colStart = 0
  private colEnd = 127
  private pageStart = 0
  private pageEnd = 7
  private col = 0
  private page = 0

  private onChange: () => void

  constructor(onChange: () => void) {
    this.onChange = onChange
  }

  start(): boolean {
    // Reset stream parsing to expect the control byte on every START.
    this.mode = 'control'
    return true
  }

  stop(): void {
    // No latched state.
  }

  read(): number {
    return 0x00
  }

  write(byte: number): boolean {
    if (this.mode === 'control') {
      // 0x00 -> command stream until next START; 0x40 -> data stream.
      this.nextDataIsCommand = (byte & 0x40) === 0
      this.mode = this.nextDataIsCommand ? 'cmd-args' : 'data'
      return true
    }
    if (this.mode === 'cmd-args') {
      if (this.argsLeft > 0) {
        this.pendingArgs.push(byte)
        this.argsLeft--
        if (this.argsLeft === 0) this.commitCommand()
        return true
      }
      // First byte after the control: it's the command opcode.
      this.pendingCmd = byte
      this.pendingArgs = []
      this.argsLeft = ARG_COUNT[byte] ?? 0
      if (this.argsLeft === 0) this.commitCommand()
      return true
    }
    // Data byte: write 8 vertical pixels at (col, page).
    const baseRow = this.page * 8
    for (let bit = 0; bit < 8; bit++) {
      const r = baseRow + bit
      if (r >= HEIGHT) break
      const idx = r * WIDTH + this.col
      this.pixels[idx] = (byte >> bit) & 1
    }
    this.advanceCursor()
    this.onChange()
    return true
  }

  private commitCommand(): void {
    switch (this.pendingCmd) {
      case 0x21: // Set column address (start, end)
        this.colStart = this.pendingArgs[0] & 0x7f
        this.colEnd = this.pendingArgs[1] & 0x7f
        this.col = this.colStart
        break
      case 0x22: // Set page address (start, end)
        this.pageStart = this.pendingArgs[0] & 0x07
        this.pageEnd = this.pendingArgs[1] & 0x07
        this.page = this.pageStart
        break
      // Other commands (contrast, scroll, display on/off, ...) -> no-op.
    }
    this.pendingArgs = []
    this.argsLeft = 0
    // Stay in cmd-args until START re-arms the stream.
  }

  private advanceCursor(): void {
    this.col++
    if (this.col > this.colEnd) {
      this.col = this.colStart
      this.page++
      if (this.page > this.pageEnd) this.page = this.pageStart
    }
  }
}

export const SSD1306_WIDTH = WIDTH
export const SSD1306_HEIGHT = HEIGHT
