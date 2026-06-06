---
name: blockly-programming
description: Use before writing the kid's program. Prefer set_program(setup, loop) with a flat list of simple steps - the backend builds valid Blockly XML for you. Lists every step op and shows the traffic-light-plus-7-segment-countdown example. Raw set_blocks XML is only a fallback.
---

# Writing the program

You have TWO ways to write the program. Use the first one.

## 1. set_program(setup, loop) - PREFER THIS

Pass two flat lists of steps. `setup` runs once; `loop` repeats forever. The
backend turns them into blocks, so the program is ALWAYS valid and loads on the
first try. You never write XML or balance any tags.

Each step is an object with an `op`. Pins are plain numbers as strings ("13");
analog pins keep their letter ("A0").

Statement ops (use in `setup` / `loop` / a `body`):

- `{"op": "pin_mode", "pin": "13", "mode": "OUTPUT"}` - mode: OUTPUT | INPUT | INPUT_PULLUP
- `{"op": "digital_write", "pin": "13", "value": "HIGH"}` - value: HIGH | LOW
- `{"op": "analog_write", "pin": "9", "value": 128}` - value 0..255 (PWM)
- `{"op": "delay", "ms": 1000}`
- `{"op": "tone", "pin": "8", "freq": 440, "duration": 200}` - duration optional
- `{"op": "no_tone", "pin": "8"}`
- `{"op": "servo_attach", "pin": "9"}` / `{"op": "servo_write", "pin": "9", "angle": 90}`
- `{"op": "serial_begin", "baud": 9600}`
- `{"op": "serial_print", "text": "hi"}` / `{"op": "serial_println", "text": "hi"}`
  (use `"value": <number-or-expr>` instead of `"text"` to print a number)
- `{"op": "repeat", "times": 3, "body": [ ...steps... ]}` - count loop
- `{"op": "if", "cond": <expr>, "body": [ ...steps... ]}`
- `{"op": "while", "mode": "WHILE", "cond": <expr>, "body": [ ...steps... ]}` - mode: WHILE | UNTIL

Expression ops (use only in a `cond`, or in a numeric `value`/`a`/`b`):

- `{"op": "digital_read", "pin": "2"}` - true while the pin reads HIGH
- `{"op": "analog_read", "pin": "A0"}` - 0..1023
- `{"op": "compare", "cmp": "EQ", "a": <expr>, "b": 500}` - cmp: EQ NEQ LT LTE GT GTE
- `{"op": "and", "a": <expr>, "b": <expr>}` / `{"op": "or", ...}`
- `{"op": "number", "value": 5}` / `{"op": "millis"}`

A plain number where a value is expected is fine (e.g. `"b": 500`); you only
need `number`/`millis` when nesting inside another expression.

### Example: blink an LED on pin 13

```json
{
  "setup": [ {"op": "pin_mode", "pin": "13", "mode": "OUTPUT"} ],
  "loop": [
    {"op": "digital_write", "pin": "13", "value": "HIGH"},
    {"op": "delay", "ms": 500},
    {"op": "digital_write", "pin": "13", "value": "LOW"},
    {"op": "delay", "ms": 500}
  ]
}
```

### Example: traffic light (red D13, yellow D12, green D11) with a 7-segment countdown

The 7-segment digits A..G are on D2..D8. Each phase counts down 3, 2, 1 on the
display while its light is on. Notice how long the `loop` is - this is exactly
the kind of program that is impossible to hand-write as nested XML but trivial
as a flat list. Show a digit by turning its segments HIGH; blank it by turning
them LOW. (Segments for 3: A B C D G; for 2: A B D E G; for 1: B C.)

```json
{
  "setup": [
    {"op": "pin_mode", "pin": "13", "mode": "OUTPUT"},
    {"op": "pin_mode", "pin": "12", "mode": "OUTPUT"},
    {"op": "pin_mode", "pin": "11", "mode": "OUTPUT"},
    {"op": "pin_mode", "pin": "2", "mode": "OUTPUT"},
    {"op": "pin_mode", "pin": "3", "mode": "OUTPUT"},
    {"op": "pin_mode", "pin": "4", "mode": "OUTPUT"},
    {"op": "pin_mode", "pin": "5", "mode": "OUTPUT"},
    {"op": "pin_mode", "pin": "6", "mode": "OUTPUT"},
    {"op": "pin_mode", "pin": "7", "mode": "OUTPUT"},
    {"op": "pin_mode", "pin": "8", "mode": "OUTPUT"}
  ],
  "loop": [
    {"op": "digital_write", "pin": "13", "value": "HIGH"},
    {"op": "digital_write", "pin": "12", "value": "LOW"},
    {"op": "digital_write", "pin": "11", "value": "LOW"},

    {"op": "digital_write", "pin": "2", "value": "HIGH"},
    {"op": "digital_write", "pin": "3", "value": "HIGH"},
    {"op": "digital_write", "pin": "4", "value": "HIGH"},
    {"op": "digital_write", "pin": "5", "value": "HIGH"},
    {"op": "digital_write", "pin": "6", "value": "LOW"},
    {"op": "digital_write", "pin": "7", "value": "LOW"},
    {"op": "digital_write", "pin": "8", "value": "HIGH"},
    {"op": "delay", "ms": 1000},

    {"op": "digital_write", "pin": "13", "value": "LOW"},
    {"op": "digital_write", "pin": "12", "value": "HIGH"},
    {"op": "delay", "ms": 1000},

    {"op": "digital_write", "pin": "12", "value": "LOW"},
    {"op": "digital_write", "pin": "11", "value": "HIGH"},
    {"op": "delay", "ms": 1000}
  ]
}
```

### Changing part of the program: edit_program(edits)

When the child asks for a SMALL change to a program you already wrote with
set_program, do NOT resend the whole thing - patch it. Pass `edits`, a list where
each edit names the `list` ("setup" or "loop"), an `action`, an `anchor` (a short
run of steps that occurs EXACTLY ONCE, so the backend knows where), and `steps`
(the new content, for every action except delete).

actions: `replace`, `insert_before`, `insert_after`, `delete`, `append`,
`prepend`. append/prepend add to the end/start and need no anchor.

If the anchor is not unique you get an error - add another step to the anchor to
pin it down (e.g. include the digital_write just before the delay you mean).

```json
{
  "edits": [
    { "list": "loop", "action": "replace",
      "anchor": [ {"op": "digital_write", "pin": "13", "value": "HIGH"}, {"op": "delay"} ],
      "steps":  [ {"op": "digital_write", "pin": "13", "value": "HIGH"}, {"op": "delay", "ms": 5000} ] },
    { "list": "loop", "action": "append",
      "steps":  [ {"op": "tone", "pin": "8", "freq": 880, "duration": 200} ] }
  ]
}
```

## 2. set_blocks(blockly_xml) - fallback only

Only if you need a block set_program does not cover. The XML is loaded into
Blockly; if ANY block `type` is unknown the whole load fails and the editor
renders EMPTY. Rules: root `<xml xmlns="https://developers.google.com/blockly/xml">`;
exactly two top blocks `ardukid_setup` and `ardukid_loop`, each with a
`<statement name="DO">`; chain statements with `<next><block>...</block></next>`;
numbers go in `<value name="..."><shadow type="math_number"><field name="NUM">N</field></shadow></value>`.

```xml
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="ardukid_setup" x="20" y="20">
    <statement name="DO">
      <block type="ardukid_pin_mode">
        <field name="PIN">13</field><field name="MODE">OUTPUT</field>
      </block>
    </statement>
  </block>
  <block type="ardukid_loop" x="20" y="320">
    <statement name="DO">
      <block type="ardukid_digital_write">
        <field name="PIN">13</field><field name="VALUE">HIGH</field>
        <next>
          <block type="ardukid_delay">
            <value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>
```

Valid set_blocks types: `ardukid_setup`, `ardukid_loop`, `ardukid_pin_mode`,
`ardukid_digital_write`, `ardukid_analog_write`, `ardukid_digital_read`,
`ardukid_analog_read`, `ardukid_delay`, `ardukid_millis`, `ardukid_tone`,
`ardukid_no_tone`, the `ardukid_lcd_*` / `ardukid_oled_*` blocks,
`ardukid_servo_attach`, `ardukid_servo_write`, `ardukid_serial_*`,
`ardukid_dht_*`, `ardukid_ultrasonic_cm`, `ardukid_map`, `ardukid_random`,
`controls_if`, `controls_repeat_ext`, `controls_whileUntil`, `logic_compare`,
`logic_operation`, `logic_boolean`, `math_number`, `math_arithmetic`,
`math_change`, `variables_set`, `variables_get`, `text`.
