---
name: ssd1306
description: Use whenever the circuit shows graphics or text on an OLED screen (SSD1306 128x64, I2C). Covers the exact wire() pin names (DATA, CLK, VIN, GND), the I2C pins to use, and the OLED blocks.
---

# OLED 128x64 (SSD1306, I2C)

A small graphical screen (128x64 pixels) on the I2C bus. Use it for games and
pictures; for plain rows of text the LCD 16x2 is simpler.

## Pins (use these exact names in wire())

- `VIN` - power (wire it to `UNO.5V`).
- `GND` - ground (wire it to `UNO.GND`).
- `DATA` - I2C data / SDA (wire it to `UNO.A4`).
- `CLK` - I2C clock / SCL (wire it to `UNO.A5`).

## Correct wiring

```
wire("OLED<n>.VIN", "UNO.5V")
wire("OLED<n>.GND", "UNO.GND")
wire("OLED<n>.DATA", "UNO.A4")
wire("OLED<n>.CLK", "UNO.A5")
```

## Blocks

- In `ardukid_setup`: `ardukid_oled_begin`.
- Draw with `ardukid_oled_set_cursor` (values `X`, `Y`), `ardukid_oled_text_size`
  (field `SIZE`), and `ardukid_oled_print` / `ardukid_oled_println` (value
  `VALUE`; use a `text` block for a string).
- `ardukid_oled_clear` clears the buffer; **call `ardukid_oled_show` to push the
  buffer to the screen** after drawing. Nothing appears until you call show.

## Gotchas

- `DATA` must go to `UNO.A4` and `CLK` to `UNO.A5` (the I2C pins).
- Always `ardukid_oled_show` at the end of a frame, or the screen stays blank.

## Best practices

- Call `ardukid_oled_begin` once in setup. In the loop: clear, draw, then show.
