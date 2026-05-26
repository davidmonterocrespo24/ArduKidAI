import * as Blockly from 'blockly'

const DIGITAL_PINS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13']
const ANALOG_PINS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5']

let registered = false

export function registerArduinoBlocks(): void {
  if (registered) return
  registered = true

  Blockly.defineBlocksWithJsonArray([
    {
      type: 'ardukid_setup',
      message0: 'when Arduino starts %1 %2',
      args0: [
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO' },
      ],
      colour: 290,
      tooltip: 'Code that runs once when the Arduino boots.',
    },
    {
      type: 'ardukid_loop',
      message0: 'forever %1 %2',
      args0: [
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO' },
      ],
      colour: 290,
      tooltip: 'Code that repeats forever after setup.',
    },
    {
      type: 'ardukid_pin_mode',
      message0: 'set pin %1 as %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS.map((p) => [p, p]) },
        {
          type: 'field_dropdown',
          name: 'MODE',
          options: [
            ['OUTPUT', 'OUTPUT'],
            ['INPUT', 'INPUT'],
            ['INPUT_PULLUP', 'INPUT_PULLUP'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 200,
      tooltip: 'Configures a digital pin as input or output.',
    },
    {
      type: 'ardukid_digital_write',
      message0: 'write pin %1 = %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS.map((p) => [p, p]) },
        {
          type: 'field_dropdown',
          name: 'VALUE',
          options: [
            ['HIGH', 'HIGH'],
            ['LOW', 'LOW'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 200,
      tooltip: 'Sets a digital pin HIGH (on) or LOW (off).',
    },
    {
      type: 'ardukid_analog_write',
      message0: 'write PWM pin %1 = %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS.map((p) => [p, p]) },
        { type: 'input_value', name: 'VALUE', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 200,
    },
    {
      type: 'ardukid_digital_read',
      message0: 'read pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS.map((p) => [p, p]) }],
      output: 'Boolean',
      colour: 200,
    },
    {
      type: 'ardukid_analog_read',
      message0: 'read analog %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: ANALOG_PINS.map((p) => [p, p]) }],
      output: 'Number',
      colour: 200,
    },
    {
      type: 'ardukid_delay',
      message0: 'wait %1 ms',
      args0: [{ type: 'input_value', name: 'MS', check: 'Number' }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 230,
    },
    {
      type: 'ardukid_tone',
      message0: 'tone pin %1 frequency %2 Hz for %3 ms',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS.map((p) => [p, p]) },
        { type: 'input_value', name: 'FREQ', check: 'Number' },
        { type: 'input_value', name: 'DURATION', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 60,
    },
    {
      type: 'ardukid_no_tone',
      message0: 'stop tone on pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS.map((p) => [p, p]) }],
      previousStatement: null,
      nextStatement: null,
      colour: 60,
    },
    {
      type: 'ardukid_map',
      message0: 'map %1 from %2 .. %3 to %4 .. %5',
      args0: [
        { type: 'input_value', name: 'VALUE', check: 'Number' },
        { type: 'input_value', name: 'FROM_LOW', check: 'Number' },
        { type: 'input_value', name: 'FROM_HIGH', check: 'Number' },
        { type: 'input_value', name: 'TO_LOW', check: 'Number' },
        { type: 'input_value', name: 'TO_HIGH', check: 'Number' },
      ],
      inputsInline: true,
      output: 'Number',
      colour: 230,
      tooltip: 'Maps a value from one range to another (Arduino map()).',
    },
    {
      type: 'ardukid_lcd_begin',
      message0: 'LCD start (I2C 0x27)',
      previousStatement: null,
      nextStatement: null,
      colour: 320,
      tooltip: 'Initialise a 16x2 I2C LCD and turn its backlight on.',
    },
    {
      type: 'ardukid_lcd_clear',
      message0: 'LCD clear',
      previousStatement: null,
      nextStatement: null,
      colour: 320,
    },
    {
      type: 'ardukid_lcd_set_cursor',
      message0: 'LCD cursor at column %1 row %2',
      args0: [
        { type: 'input_value', name: 'COL', check: 'Number' },
        { type: 'input_value', name: 'ROW', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 320,
    },
    {
      type: 'ardukid_lcd_print',
      message0: 'LCD print %1',
      args0: [{ type: 'input_value', name: 'VALUE' }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 320,
      tooltip: 'Prints a number or text at the current cursor position.',
    },
    {
      type: 'ardukid_random',
      message0: 'random from %1 to %2',
      args0: [
        { type: 'input_value', name: 'MIN', check: 'Number' },
        { type: 'input_value', name: 'MAX', check: 'Number' },
      ],
      inputsInline: true,
      output: 'Number',
      colour: 230,
      tooltip: 'Arduino random(min, max) - returns a whole number in [min, max).',
    },
    {
      type: 'ardukid_servo_attach',
      message0: 'attach servo to pin %1',
      args0: [{ type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS.map((p) => [p, p]) }],
      previousStatement: null,
      nextStatement: null,
      colour: 0,
      tooltip: 'Bind a Servo to a PWM-capable pin (D3/D5/D6/D9/D10/D11).',
    },
    {
      type: 'ardukid_servo_write',
      message0: 'servo on pin %1 angle %2',
      args0: [
        { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS.map((p) => [p, p]) },
        { type: 'input_value', name: 'ANGLE', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 0,
      tooltip: 'Move the servo on this pin to an angle 0..180.',
    },
  ])
}

export const ARDUINO_TOOLBOX_CATEGORIES = [
  {
    kind: 'category',
    name: 'Arduino',
    colour: '200',
    contents: [
      { kind: 'block', type: 'ardukid_setup' },
      { kind: 'block', type: 'ardukid_loop' },
      { kind: 'block', type: 'ardukid_pin_mode' },
      { kind: 'block', type: 'ardukid_digital_write' },
      { kind: 'block', type: 'ardukid_digital_read' },
      { kind: 'block', type: 'ardukid_analog_write' },
      { kind: 'block', type: 'ardukid_analog_read' },
      {
        kind: 'block',
        type: 'ardukid_delay',
        inputs: { MS: { shadow: { type: 'math_number', fields: { NUM: 500 } } } },
      },
      {
        kind: 'block',
        type: 'ardukid_tone',
        inputs: {
          FREQ: { shadow: { type: 'math_number', fields: { NUM: 440 } } },
          DURATION: { shadow: { type: 'math_number', fields: { NUM: 250 } } },
        },
      },
      { kind: 'block', type: 'ardukid_no_tone' },
      {
        kind: 'block',
        type: 'ardukid_map',
        inputs: {
          FROM_LOW: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
          FROM_HIGH: { shadow: { type: 'math_number', fields: { NUM: 1023 } } },
          TO_LOW: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
          TO_HIGH: { shadow: { type: 'math_number', fields: { NUM: 255 } } },
        },
      },
      {
        kind: 'block',
        type: 'ardukid_random',
        inputs: {
          MIN: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
          MAX: { shadow: { type: 'math_number', fields: { NUM: 10 } } },
        },
      },
    ],
  },
  {
    kind: 'category',
    name: 'Servo',
    colour: '0',
    contents: [
      { kind: 'block', type: 'ardukid_servo_attach' },
      {
        kind: 'block',
        type: 'ardukid_servo_write',
        inputs: { ANGLE: { shadow: { type: 'math_number', fields: { NUM: 90 } } } },
      },
    ],
  },
  {
    kind: 'category',
    name: 'LCD',
    colour: '320',
    contents: [
      { kind: 'block', type: 'ardukid_lcd_begin' },
      { kind: 'block', type: 'ardukid_lcd_clear' },
      {
        kind: 'block',
        type: 'ardukid_lcd_set_cursor',
        inputs: {
          COL: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
          ROW: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
        },
      },
      {
        kind: 'block',
        type: 'ardukid_lcd_print',
        inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: 'Hello' } } } },
      },
    ],
  },
]
