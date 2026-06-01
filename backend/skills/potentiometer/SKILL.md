---
name: potentiometer
description: Use whenever the circuit reads a knob or analog dial (potentiometer). Covers the exact wire() pin names (VCC, GND, SIG), wiring the signal to an analog pin, and reading/mapping the value.
---

# Potentiometer

A knob that produces an analog value from 0 to 1023, read with `analogRead`.

## Pins (use these exact names in wire())

- `VCC` - power (wire it to `UNO.5V`).
- `GND` - ground (wire it to `UNO.GND`).
- `SIG` - the wiper signal (wire it to an ANALOG pin, `UNO.A0`..`UNO.A5`).

## Correct wiring

```
wire("P<n>.VCC", "UNO.5V")
wire("P<n>.GND", "UNO.GND")
wire("P<n>.SIG", "UNO.A0")    # signal -> analog pin
```

## Blocks

- Read it with `ardukid_analog_read` (field `PIN`=A0..A5).
- Scale it with `ardukid_map` (e.g. 0-1023 -> 0-255 for `analogWrite`).

## Gotchas

- `SIG` goes to an ANALOG pin (`UNO.A0`..`UNO.A5`), never a digital one.

## Best practices

- Use `ardukid_map` to turn the raw 0-1023 reading into a useful range.
