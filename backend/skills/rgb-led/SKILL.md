---
name: rgb-led
description: Use whenever the circuit mixes colors with an RGB LED (common cathode). Covers the exact wire() pin names (R, G, B, COM), the per-color resistors, the PWM pins to use, and the analog write block.
---

# RGB LED (common cathode)

One LED with three color channels (red, green, blue) sharing a common cathode.
Mix colors by setting each channel from 0 (off) to 255 (full) with PWM.

## Pins (use these exact names in wire())

- `R` - red leg (wire it through a 220 ohm resistor to a PWM pin).
- `G` - green leg (wire it through a 220 ohm resistor to a PWM pin).
- `B` - blue leg (wire it through a 220 ohm resistor to a PWM pin).
- `COM` - common cathode (wire it to `UNO.GND`).

## Correct wiring

Add three resistor components; wire each color leg through its own resistor to a
PWM pin (choose from 3, 5, 6, 9, 10, 11). Example using pins 9, 10, 11:

```
wire("RGB<n>.R", "R1.1")
wire("R1.2", "UNO.D9")
wire("RGB<n>.G", "R2.1")
wire("R2.2", "UNO.D10")
wire("RGB<n>.B", "R3.1")
wire("R3.2", "UNO.D11")
wire("RGB<n>.COM", "UNO.GND")
```

## Blocks

- Set each channel with `ardukid_analog_write` (field `PIN` = the pin that leg
  is wired to; value `VALUE` 0..255). Three blocks, one per color.
- Example: red = `analog_write(9, 255)`, green = `analog_write(10, 0)`,
  blue = `analog_write(11, 0)`.

## Gotchas

- Each color leg needs its own 220 ohm resistor; without it the LED can burn out.
- Only PWM pins (3, 5, 6, 9, 10, 11) can dim. Non-PWM pins give on/off only.
- This is common cathode, so 0 is off and 255 is full brightness.

## Best practices

- Wire all three legs to PWM pins so any color mix works.
- Keep one resistor per leg and pick three different PWM pins.
