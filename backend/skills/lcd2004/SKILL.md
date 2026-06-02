---
name: lcd2004
description: Use whenever the circuit shows text on a 20x4 LCD screen (I2C). Covers the exact wire() pin names (GND, VCC, SDA, SCL), the I2C pins to use, and the LCD blocks.
---

# LCD 20x4 (I2C)

A 20x4 character text screen on the I2C bus. It has 4 rows (ROW 0..3) and 20
columns (COL 0..19), so it fits more text than the 16x2.

## Pins (use these exact names in wire())

- `GND` - ground (wire it to `UNO.GND`).
- `VCC` - power (wire it to `UNO.5V`).
- `SDA` - I2C data (wire it to `UNO.A4`).
- `SCL` - I2C clock (wire it to `UNO.A5`).

## Correct wiring

```
wire("LCD<n>.GND", "UNO.GND")
wire("LCD<n>.VCC", "UNO.5V")
wire("LCD<n>.SDA", "UNO.A4")
wire("LCD<n>.SCL", "UNO.A5")
```

## Blocks

- In `ardukid_setup`: `ardukid_lcd_begin`.
- Then `ardukid_lcd_set_cursor` (values `COL` 0..19, `ROW` 0..3) and
  `ardukid_lcd_print` (value `VALUE`; use a `text` block for a string).
  `ardukid_lcd_clear` clears it.

## Gotchas

- `SDA` must go to `UNO.A4` and `SCL` to `UNO.A5` (the I2C pins).
- `ROW` goes 0..3 and `COL` goes 0..19; values outside that print nothing.

## Best practices

- Call `ardukid_lcd_begin` once in setup; clear before re-printing changing text.
- Use the extra rows for labels (row 0) and values (row 1) instead of one long line.
