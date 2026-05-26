import type * as Blockly from 'blockly'

const SKETCH_HEADER = '// Generated from blocks by ArduKid.\n\n'

function indentLines(text: string, prefix: string): string {
  if (!text) return ''
  return text
    .split('\n')
    .map((line) => (line ? prefix + line : line))
    .join('\n')
}

function valueOf(block: Blockly.Block, name: string, fallback = '0'): string {
  const child = block.getInputTargetBlock(name)
  if (!child) return fallback
  return expressionToCpp(child)
}

function statementsOf(block: Blockly.Block, name: string): string {
  const first = block.getInputTargetBlock(name)
  return chainToCpp(first)
}

function chainToCpp(start: Blockly.Block | null): string {
  let block: Blockly.Block | null = start
  let out = ''
  while (block) {
    out += statementBlockToCpp(block)
    block = block.getNextBlock()
  }
  return out
}

function statementBlockToCpp(block: Blockly.Block): string {
  switch (block.type) {
    case 'ardukid_pin_mode': {
      const pin = block.getFieldValue('PIN') || '13'
      const mode = block.getFieldValue('MODE') || 'OUTPUT'
      return `pinMode(${pin}, ${mode});\n`
    }
    case 'ardukid_digital_write': {
      const pin = block.getFieldValue('PIN') || '13'
      const value = block.getFieldValue('VALUE') || 'LOW'
      return `digitalWrite(${pin}, ${value});\n`
    }
    case 'ardukid_analog_write': {
      const pin = block.getFieldValue('PIN') || '9'
      const value = valueOf(block, 'VALUE', '0')
      return `analogWrite(${pin}, ${value});\n`
    }
    case 'ardukid_delay': {
      const ms = valueOf(block, 'MS', '500')
      return `delay(${ms});\n`
    }
    case 'ardukid_tone': {
      const pin = block.getFieldValue('PIN') || '8'
      const freq = valueOf(block, 'FREQ', '440')
      const duration = valueOf(block, 'DURATION', '250')
      return `tone(${pin}, ${freq}, ${duration});\n`
    }
    case 'ardukid_no_tone': {
      const pin = block.getFieldValue('PIN') || '8'
      return `noTone(${pin});\n`
    }
    case 'ardukid_lcd_begin':
      // The "begin" emits both init() and backlight() so a one-block
      // setup is enough. Includes are added at file scope by emitter.
      return 'lcd.init();\nlcd.backlight();\n'
    case 'ardukid_lcd_clear':
      return 'lcd.clear();\n'
    case 'ardukid_lcd_set_cursor': {
      const col = valueOf(block, 'COL', '0')
      const row = valueOf(block, 'ROW', '0')
      return `lcd.setCursor(${col}, ${row});\n`
    }
    case 'ardukid_lcd_print': {
      const value = valueOf(block, 'VALUE', '""')
      return `lcd.print(${value});\n`
    }
    case 'ardukid_servo_attach': {
      const pin = block.getFieldValue('PIN') || '9'
      return `_servo_${pin}.attach(${pin});\n`
    }
    case 'ardukid_servo_write': {
      const pin = block.getFieldValue('PIN') || '9'
      const angle = valueOf(block, 'ANGLE', '90')
      return `_servo_${pin}.write(${angle});\n`
    }
    case 'variables_set': {
      const name = block.getFieldValue('VAR') ?? 'v'
      const value = valueOf(block, 'VALUE', '0')
      return `${cVarName(name)} = ${value};\n`
    }
    case 'math_change': {
      const name = block.getFieldValue('VAR') ?? 'v'
      const delta = valueOf(block, 'DELTA', '1')
      return `${cVarName(name)} += ${delta};\n`
    }
    case 'controls_if': {
      const condition = valueOf(block, 'IF0', 'false')
      const body = statementsOf(block, 'DO0')
      return `if (${condition}) {\n${indentLines(body, '  ')}}\n`
    }
    case 'controls_repeat_ext': {
      const times = valueOf(block, 'TIMES', '0')
      const body = statementsOf(block, 'DO')
      return `for (int i = 0; i < ${times}; i++) {\n${indentLines(body, '  ')}}\n`
    }
    case 'controls_whileUntil': {
      const mode = block.getFieldValue('MODE') === 'WHILE' ? '' : '!'
      const condition = valueOf(block, 'BOOL', 'true')
      const body = statementsOf(block, 'DO')
      return `while (${mode}(${condition})) {\n${indentLines(body, '  ')}}\n`
    }
    default:
      return `// unsupported block: ${block.type}\n`
  }
}

function expressionToCpp(block: Blockly.Block): string {
  switch (block.type) {
    case 'math_number':
      return String(Number(block.getFieldValue('NUM') ?? 0))
    case 'logic_boolean':
      return block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false'
    case 'math_arithmetic': {
      const a = valueOf(block, 'A', '0')
      const b = valueOf(block, 'B', '0')
      const op = block.getFieldValue('OP') ?? 'ADD'
      const opMap: Record<string, string> = {
        ADD: '+',
        MINUS: '-',
        MULTIPLY: '*',
        DIVIDE: '/',
        POWER: '/* power not supported */ *',
      }
      return `(${a} ${opMap[op] ?? '+'} ${b})`
    }
    case 'logic_compare': {
      const a = valueOf(block, 'A', '0')
      const b = valueOf(block, 'B', '0')
      const op = block.getFieldValue('OP') ?? 'EQ'
      const opMap: Record<string, string> = {
        EQ: '==',
        NEQ: '!=',
        LT: '<',
        LTE: '<=',
        GT: '>',
        GTE: '>=',
      }
      return `(${a} ${opMap[op] ?? '=='} ${b})`
    }
    case 'logic_operation': {
      const a = valueOf(block, 'A', 'false')
      const b = valueOf(block, 'B', 'false')
      const op = block.getFieldValue('OP') === 'AND' ? '&&' : '||'
      return `(${a} ${op} ${b})`
    }
    case 'ardukid_digital_read': {
      const pin = block.getFieldValue('PIN') || '2'
      return `(digitalRead(${pin}) == HIGH)`
    }
    case 'ardukid_analog_read': {
      const pin = block.getFieldValue('PIN') || 'A0'
      return `analogRead(${pin})`
    }
    case 'ardukid_map': {
      const value = valueOf(block, 'VALUE', '0')
      const fl = valueOf(block, 'FROM_LOW', '0')
      const fh = valueOf(block, 'FROM_HIGH', '1023')
      const tl = valueOf(block, 'TO_LOW', '0')
      const th = valueOf(block, 'TO_HIGH', '255')
      return `map(${value}, ${fl}, ${fh}, ${tl}, ${th})`
    }
    case 'ardukid_random': {
      const min = valueOf(block, 'MIN', '0')
      const max = valueOf(block, 'MAX', '10')
      return `random(${min}, ${max})`
    }
    case 'text':
      return `"${String(block.getFieldValue('TEXT') ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    case 'variables_get': {
      const name = block.getFieldValue('VAR') ?? 'v'
      return cVarName(name)
    }
    default:
      return '/* unsupported expression */ 0'
  }
}

// Sanitize a Blockly variable name into a valid C identifier. Blockly
// allows spaces and other characters; the Arduino sketch does not.
function cVarName(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_]/g, '_').replace(/^[0-9]/, '_$&')
}

// Recursively walk a block tree and add every pin referenced by a
// servo_attach / servo_write block to `out`. Used by the C++ emitter
// to declare one global `Servo _servo_<pin>` per pin the workspace
// touches.
function walkServoPins(block: Blockly.Block | null, out: Set<string>) {
  let b: Blockly.Block | null = block
  while (b) {
    if (b.type === 'ardukid_servo_attach' || b.type === 'ardukid_servo_write') {
      const pin = b.getFieldValue('PIN')
      if (pin) out.add(String(pin))
    }
    for (const input of b.inputList) {
      const child = input.connection?.targetBlock() ?? null
      if (child) walkServoPins(child, out)
    }
    b = b.getNextBlock()
  }
}

function collectBlockTypes(workspace: Blockly.Workspace): Set<string> {
  const types = new Set<string>()
  function walk(block: Blockly.Block | null) {
    while (block) {
      types.add(block.type)
      for (const input of block.inputList) {
        const child = input.connection?.targetBlock() ?? null
        if (child) walk(child)
      }
      block = block.getNextBlock()
    }
  }
  for (const top of workspace.getTopBlocks(false)) walk(top)
  return types
}

export function generateCpp(workspace: Blockly.Workspace): string {
  const topBlocks = workspace.getTopBlocks(true)
  let setupBody = ''
  let loopBody = ''
  let stray = ''

  for (const top of topBlocks) {
    if (top.type === 'ardukid_setup') {
      setupBody += statementsOf(top, 'DO')
    } else if (top.type === 'ardukid_loop') {
      loopBody += statementsOf(top, 'DO')
    } else {
      stray += statementBlockToCpp(top)
    }
  }

  if (!setupBody && !loopBody && !stray) {
    return ''
  }

  // Auto-declare any Blockly variable as a top-level int. Kids never
  // bother with explicit type declarations; an int default covers
  // every block our generator emits (analogRead, map, counters).
  const allBlockTypes = collectBlockTypes(workspace)
  const varNames = new Set<string>(
    workspace
      .getAllVariables()
      .map((v) => cVarName((v as unknown as { name: string }).name)),
  )
  const declarations: string[] = []
  for (const name of varNames) declarations.push(`int ${name} = 0;`)

  // Auto-include LCD library + global instance when any LCD block is
  // used, so the kid can drop "LCD start" and the sketch compiles.
  let includes = ''
  let globals = ''
  if ([...allBlockTypes].some((t) => t.startsWith('ardukid_lcd_'))) {
    includes += '#include <Wire.h>\n#include <LiquidCrystal_I2C.h>\n'
    globals += 'LiquidCrystal_I2C lcd(0x27, 16, 2);\n'
  }
  // Auto-include Servo and declare one Servo instance per PWM pin
  // the workspace mentions. The block emits `_servo_<pin>.attach(...)`
  // / `_servo_<pin>.write(...)`, so each unique pin needs a matching
  // global declaration.
  const servoPins = new Set<string>()
  for (const top of workspace.getTopBlocks(false)) {
    walkServoPins(top, servoPins)
  }
  if (servoPins.size > 0) {
    includes += '#include <Servo.h>\n'
    for (const pin of servoPins) globals += `Servo _servo_${pin};\n`
  }

  const preamble = [
    SKETCH_HEADER.trim(),
    includes && includes.trim(),
    globals && globals.trim(),
    declarations.length > 0 && declarations.join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n')

  return (
    `${preamble}\n\n` +
    `void setup() {\n${indentLines(setupBody, '  ')}}\n\n` +
    `void loop() {\n${indentLines(loopBody, '  ')}${
      stray ? `\n  // stray top-level blocks:\n${indentLines(stray, '  ')}` : ''
    }}\n`
  )
}
