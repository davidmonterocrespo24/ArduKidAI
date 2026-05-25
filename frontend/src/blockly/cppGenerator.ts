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
    default:
      return '/* unsupported expression */ 0'
  }
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

  return (
    SKETCH_HEADER +
    `void setup() {\n${indentLines(setupBody, '  ')}}\n\n` +
    `void loop() {\n${indentLines(loopBody, '  ')}${
      stray ? `\n  // stray top-level blocks:\n${indentLines(stray, '  ')}` : ''
    }}\n`
  )
}
