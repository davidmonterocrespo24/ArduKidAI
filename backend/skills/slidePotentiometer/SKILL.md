---
name: slidePotentiometer
description: Use whenever the circuit reads a slide fader (slide potentiometer). Covers the exact wire() pin names (VCC, SIG, GND), wiring the signal to an analog pin, and reading/mapping the value.
---

# Slide potentiometer (fader)

A linear slider that produces an analog value from 0 to 1023, read with `analogRead`.

## Pins (use these exact names in wire())

- `VCC` - power (wire it to `UNO.5V`).
- `SIG` - the wiper signal (wire it to an ANALOG pin, `UNO.A0`..`UNO.A5`).
- `GND` - ground (wire it to `UNO.GND`).

## Correct wiring

```
wire("SP<n>.VCC", "UNO.5V")
wire("SP<n>.GND", "UNO.GND")
wire("SP<n>.SIG", "UNO.A0")    # signal -> analog pin
```

## Blocks

- Read it with `ardukid_analog_read` (field `PIN`=A0..A5). The value goes 0 to 1023 as you slide the fader.
- Scale it with `ardukid_map` (e.g. 0-1023 -> 0-255 for `analogWrite`).

## Gotchas

- `SIG` goes to an ANALOG pin (`UNO.A0`..`UNO.A5`), never a digital one.
- The `ardukid_analog_read` field `PIN` must be the same A-pin you wired `SIG` to.

## Best practices

- Use `ardukid_map` to turn the raw 0-1023 reading into a useful range.
