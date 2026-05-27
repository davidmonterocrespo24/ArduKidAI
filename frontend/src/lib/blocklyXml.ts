/**
 * Tiny DSL for composing Blockly XML programmatically. Each example template
 * uses it to declare its starter program in a way that lines up with the
 * generated C++ sketch.
 *
 * Block types must match the ones registered in src/blockly/arduinoBlocks.ts.
 */

export interface BlockNode {
  type: string
  fields?: Record<string, string | number>
  values?: Record<string, BlockNode>
  /** Body of a container block (setup / loop / if / while / for). */
  statement?: { name: string; child: BlockNode }
  /** The block that follows this one in the same statement chain. */
  next?: BlockNode
}

// ---- factories for individual blocks --------------------------------------

export const setup = (body: BlockNode): BlockNode => ({
  type: 'ardukid_setup',
  statement: { name: 'DO', child: body },
})

export const loop = (body: BlockNode): BlockNode => ({
  type: 'ardukid_loop',
  statement: { name: 'DO', child: body },
})

export const pinMode = (pin: number | string, mode: 'OUTPUT' | 'INPUT' | 'INPUT_PULLUP'): BlockNode => ({
  type: 'ardukid_pin_mode',
  fields: { PIN: String(pin), MODE: mode },
})

export const digitalWrite = (pin: number | string, value: 'HIGH' | 'LOW'): BlockNode => ({
  type: 'ardukid_digital_write',
  fields: { PIN: String(pin), VALUE: value },
})

export const analogWrite = (pin: number | string, value: BlockNode): BlockNode => ({
  type: 'ardukid_analog_write',
  fields: { PIN: String(pin) },
  values: { VALUE: value },
})

export const wait = (ms: number | BlockNode): BlockNode => ({
  type: 'ardukid_delay',
  values: { MS: typeof ms === 'number' ? num(ms) : ms },
})

export const tone = (
  pin: number | string,
  freq: number | BlockNode,
  duration: number | BlockNode,
): BlockNode => ({
  type: 'ardukid_tone',
  fields: { PIN: String(pin) },
  values: {
    FREQ: typeof freq === 'number' ? num(freq) : freq,
    DURATION: typeof duration === 'number' ? num(duration) : duration,
  },
})

export const noTone = (pin: number | string): BlockNode => ({
  type: 'ardukid_no_tone',
  fields: { PIN: String(pin) },
})

export const digitalRead = (pin: number | string): BlockNode => ({
  type: 'ardukid_digital_read',
  fields: { PIN: String(pin) },
})

export const analogRead = (pin: string): BlockNode => ({
  type: 'ardukid_analog_read',
  fields: { PIN: pin },
})

export const arduinoMap = (
  value: BlockNode,
  fromLow: number | BlockNode,
  fromHigh: number | BlockNode,
  toLow: number | BlockNode,
  toHigh: number | BlockNode,
): BlockNode => ({
  type: 'ardukid_map',
  values: {
    VALUE: value,
    FROM_LOW: typeof fromLow === 'number' ? num(fromLow) : fromLow,
    FROM_HIGH: typeof fromHigh === 'number' ? num(fromHigh) : fromHigh,
    TO_LOW: typeof toLow === 'number' ? num(toLow) : toLow,
    TO_HIGH: typeof toHigh === 'number' ? num(toHigh) : toHigh,
  },
})

export const text = (s: string): BlockNode => ({
  type: 'text',
  fields: { TEXT: s },
})

export const lcdBegin = (): BlockNode => ({ type: 'ardukid_lcd_begin' })
export const lcdClear = (): BlockNode => ({ type: 'ardukid_lcd_clear' })
export const lcdSetCursor = (col: number | BlockNode, row: number | BlockNode): BlockNode => ({
  type: 'ardukid_lcd_set_cursor',
  values: {
    COL: typeof col === 'number' ? num(col) : col,
    ROW: typeof row === 'number' ? num(row) : row,
  },
})
export const lcdPrint = (value: string | BlockNode): BlockNode => ({
  type: 'ardukid_lcd_print',
  values: { VALUE: typeof value === 'string' ? text(value) : value },
})

export const setVar = (name: string, value: BlockNode): BlockNode => ({
  type: 'variables_set',
  fields: { VAR: name },
  values: { VALUE: value },
})

export const randomFromTo = (min: number | BlockNode, max: number | BlockNode): BlockNode => ({
  type: 'ardukid_random',
  values: {
    MIN: typeof min === 'number' ? num(min) : min,
    MAX: typeof max === 'number' ? num(max) : max,
  },
})

export const servoAttach = (pin: number | string): BlockNode => ({
  type: 'ardukid_servo_attach',
  fields: { PIN: String(pin) },
})

export const servoWrite = (pin: number | string, angle: number | BlockNode): BlockNode => ({
  type: 'ardukid_servo_write',
  fields: { PIN: String(pin) },
  values: { ANGLE: typeof angle === 'number' ? num(angle) : angle },
})

export const getVar = (name: string): BlockNode => ({
  type: 'variables_get',
  fields: { VAR: name },
})

export const serialBegin = (baud: number = 9600): BlockNode => ({
  type: 'ardukid_serial_begin',
  fields: { BAUD: String(baud) },
})
export const serialPrint = (value: string | BlockNode): BlockNode => ({
  type: 'ardukid_serial_print',
  values: { VALUE: typeof value === 'string' ? text(value) : value },
})
export const serialPrintln = (value: string | BlockNode): BlockNode => ({
  type: 'ardukid_serial_println',
  values: { VALUE: typeof value === 'string' ? text(value) : value },
})
export const millis = (): BlockNode => ({ type: 'ardukid_millis' })

export const dhtTemperature = (pin: number | string): BlockNode => ({
  type: 'ardukid_dht_temperature',
  fields: { PIN: String(pin) },
})
export const dhtHumidity = (pin: number | string): BlockNode => ({
  type: 'ardukid_dht_humidity',
  fields: { PIN: String(pin) },
})
export const ultrasonicCm = (trig: number | string, echo: number | string): BlockNode => ({
  type: 'ardukid_ultrasonic_cm',
  fields: { TRIG: String(trig), ECHO: String(echo) },
})

export const oledBegin = (): BlockNode => ({ type: 'ardukid_oled_begin' })
export const oledClear = (): BlockNode => ({ type: 'ardukid_oled_clear' })
export const oledTextSize = (size: 1 | 2 | 3 | 4): BlockNode => ({
  type: 'ardukid_oled_text_size',
  fields: { SIZE: String(size) },
})
export const oledSetCursor = (x: number | BlockNode, y: number | BlockNode): BlockNode => ({
  type: 'ardukid_oled_set_cursor',
  values: {
    X: typeof x === 'number' ? num(x) : x,
    Y: typeof y === 'number' ? num(y) : y,
  },
})
export const oledPrint = (value: string | BlockNode): BlockNode => ({
  type: 'ardukid_oled_print',
  values: { VALUE: typeof value === 'string' ? text(value) : value },
})
export const oledPrintln = (value: string | BlockNode): BlockNode => ({
  type: 'ardukid_oled_println',
  values: { VALUE: typeof value === 'string' ? text(value) : value },
})
export const oledShow = (): BlockNode => ({ type: 'ardukid_oled_show' })

export const num = (n: number): BlockNode => ({
  type: 'math_number',
  fields: { NUM: n },
})

export const bool = (v: boolean): BlockNode => ({
  type: 'logic_boolean',
  fields: { BOOL: v ? 'TRUE' : 'FALSE' },
})

export const ifThen = (cond: BlockNode, body: BlockNode): BlockNode => ({
  type: 'controls_if',
  values: { IF0: cond },
  statement: { name: 'DO0', child: body },
})

export const repeat = (times: number, body: BlockNode): BlockNode => ({
  type: 'controls_repeat_ext',
  values: { TIMES: num(times) },
  statement: { name: 'DO', child: body },
})

// ---- chain helpers --------------------------------------------------------

/** Link a sequence of blocks via their `next` slot. Returns the first one. */
export function chain(...blocks: BlockNode[]): BlockNode {
  if (blocks.length === 0) throw new Error('chain() needs at least one block')
  for (let i = 0; i < blocks.length - 1; i++) {
    blocks[i].next = blocks[i + 1]
  }
  return blocks[0]
}

// ---- serialisation --------------------------------------------------------

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function serialiseNode(
  node: BlockNode,
  asShadow = false,
  indent = 0,
  position?: { x: number; y: number },
): string {
  const tag = asShadow ? 'shadow' : 'block'
  const pad = '  '.repeat(indent)
  const posAttrs = position ? ` x="${position.x}" y="${position.y}"` : ''
  const parts: string[] = []
  parts.push(`${pad}<${tag} type="${node.type}"${posAttrs}>`)
  if (node.fields) {
    for (const [name, val] of Object.entries(node.fields)) {
      parts.push(`${pad}  <field name="${name}">${escape(String(val))}</field>`)
    }
  }
  if (node.values) {
    for (const [name, child] of Object.entries(node.values)) {
      parts.push(`${pad}  <value name="${name}">`)
      parts.push(serialiseNode(child, true, indent + 2))
      parts.push(`${pad}  </value>`)
    }
  }
  if (node.statement) {
    parts.push(`${pad}  <statement name="${node.statement.name}">`)
    parts.push(serialiseNode(node.statement.child, false, indent + 2))
    parts.push(`${pad}  </statement>`)
  }
  if (node.next) {
    parts.push(`${pad}  <next>`)
    parts.push(serialiseNode(node.next, false, indent + 2))
    parts.push(`${pad}  </next>`)
  }
  parts.push(`${pad}</${tag}>`)
  return parts.join('\n')
}

export function toXml(...topBlocks: BlockNode[]): string {
  const body = topBlocks
    .map((b, i) => serialiseNode(b, false, 1, { x: 20, y: 20 + i * 260 }))
    .join('\n')
  return `<xml xmlns="https://developers.google.com/blockly/xml">\n${body}\n</xml>`
}
