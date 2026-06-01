---
name: blockly-programming
description: Use before calling set_blocks() to write the kid's program. Defines the EXACT Blockly block types and the XML format the editor accepts (using a wrong type makes the workspace render empty), with two complete verified examples.
---

# Writing the program with set_blocks(blockly_xml)

The XML you pass to `set_blocks` is loaded into Blockly. If ANY block `type` is
unknown, the whole load fails and the workspace renders EMPTY. Use ONLY the exact
types listed here.

## Format rules

- Root: `<xml xmlns="https://developers.google.com/blockly/xml"> ... </xml>` (exact namespace).
- Always exactly two top blocks: `ardukid_setup` (runs once) and `ardukid_loop`
  (repeats). Put ALL logic inside their `<statement name="DO">` slots. A block
  outside these two is ignored by the code generator.
- Chain consecutive statements with `<next><block ...></block></next>` (there is no
  flat list - each next statement nests inside the previous block's `<next>`).
- Numbers go in `<value name="..."><shadow type="math_number"><field name="NUM">N</field></shadow></value>`,
  NOT as a field on the parent. Strings use `<shadow type="text"><field name="TEXT">...</field></shadow>`.
- Order inside a block: `<field>` first, then `<value>`, then `<statement>`, then `<next>`.
- Escape `&` `<` `>` inside field text as `&amp;` `&lt;` `&gt;`.

## Block types (use these names verbatim)

- Containers: `ardukid_setup` (DO), `ardukid_loop` (DO).
- Digital/analog: `ardukid_pin_mode` (fields PIN, MODE=OUTPUT|INPUT|INPUT_PULLUP),
  `ardukid_digital_write` (fields PIN, VALUE=HIGH|LOW), `ardukid_analog_write`
  (field PIN, value VALUE), `ardukid_digital_read` (field PIN), `ardukid_analog_read`
  (field PIN=A0..A5).
- Timing: `ardukid_delay` (value MS), `ardukid_millis`.
- Sound: `ardukid_tone` (field PIN, values FREQ, DURATION), `ardukid_no_tone` (field PIN).
- LCD: `ardukid_lcd_begin`, `ardukid_lcd_clear`, `ardukid_lcd_set_cursor` (values COL, ROW),
  `ardukid_lcd_print` (value VALUE).
- OLED: `ardukid_oled_begin`, `ardukid_oled_clear`, `ardukid_oled_show`,
  `ardukid_oled_text_size` (field SIZE), `ardukid_oled_set_cursor` (values X, Y),
  `ardukid_oled_print`/`ardukid_oled_println` (value VALUE).
- Servo: `ardukid_servo_attach` (field PIN), `ardukid_servo_write` (field PIN, value ANGLE).
- Serial: `ardukid_serial_begin` (field BAUD), `ardukid_serial_print`/`ardukid_serial_println` (value VALUE).
- Sensors: `ardukid_dht_temperature`/`ardukid_dht_humidity` (field PIN), `ardukid_ultrasonic_cm` (fields TRIG, ECHO).
- Math helpers: `ardukid_map` (values VALUE, FROM_LOW, FROM_HIGH, TO_LOW, TO_HIGH), `ardukid_random` (values MIN, MAX).
- Standard Blockly: `controls_if` (value IF0, statement DO0), `controls_repeat_ext`
  (value TIMES, statement DO), `controls_whileUntil` (field MODE, value BOOL, statement DO),
  `logic_compare`/`logic_operation` (field OP, values A, B), `logic_boolean` (field BOOL),
  `math_number` (field NUM), `math_arithmetic` (field OP, values A, B),
  `variables_set` (field VAR, value VALUE), `variables_get` (field VAR), `text` (field TEXT).

## Example: blink an LED on pin 13

```xml
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="ardukid_setup" x="20" y="20">
    <statement name="DO">
      <block type="ardukid_pin_mode">
        <field name="PIN">13</field><field name="MODE">OUTPUT</field>
      </block>
    </statement>
  </block>
  <block type="ardukid_loop" x="20" y="280">
    <statement name="DO">
      <block type="ardukid_digital_write">
        <field name="PIN">13</field><field name="VALUE">HIGH</field>
        <next>
          <block type="ardukid_delay">
            <value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value>
            <next>
              <block type="ardukid_digital_write">
                <field name="PIN">13</field><field name="VALUE">LOW</field>
                <next>
                  <block type="ardukid_delay">
                    <value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>
```

## Example: 3-LED traffic light (red D13, yellow D12, green D11)

```xml
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="ardukid_setup" x="20" y="20">
    <statement name="DO">
      <block type="ardukid_pin_mode">
        <field name="PIN">13</field><field name="MODE">OUTPUT</field>
        <next>
          <block type="ardukid_pin_mode">
            <field name="PIN">12</field><field name="MODE">OUTPUT</field>
            <next>
              <block type="ardukid_pin_mode">
                <field name="PIN">11</field><field name="MODE">OUTPUT</field>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="ardukid_loop" x="20" y="280">
    <statement name="DO">
      <block type="ardukid_digital_write">
        <field name="PIN">13</field><field name="VALUE">HIGH</field>
        <next>
          <block type="ardukid_digital_write">
            <field name="PIN">12</field><field name="VALUE">LOW</field>
            <next>
              <block type="ardukid_digital_write">
                <field name="PIN">11</field><field name="VALUE">LOW</field>
                <next>
                  <block type="ardukid_delay">
                    <value name="MS"><shadow type="math_number"><field name="NUM">3000</field></shadow></value>
                    <next>
                      <block type="ardukid_digital_write">
                        <field name="PIN">13</field><field name="VALUE">LOW</field>
                        <next>
                          <block type="ardukid_digital_write">
                            <field name="PIN">12</field><field name="VALUE">HIGH</field>
                            <next>
                              <block type="ardukid_delay">
                                <value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value>
                                <next>
                                  <block type="ardukid_digital_write">
                                    <field name="PIN">12</field><field name="VALUE">LOW</field>
                                    <next>
                                      <block type="ardukid_digital_write">
                                        <field name="PIN">11</field><field name="VALUE">HIGH</field>
                                        <next>
                                          <block type="ardukid_delay">
                                            <value name="MS"><shadow type="math_number"><field name="NUM">3000</field></shadow></value>
                                            <next>
                                              <block type="ardukid_digital_write">
                                                <field name="PIN">11</field><field name="VALUE">LOW</field>
                                              </block>
                                            </next>
                                          </block>
                                        </next>
                                      </block>
                                    </next>
                                  </block>
                                </next>
                              </block>
                            </next>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>
```
