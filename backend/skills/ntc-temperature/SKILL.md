---
name: ntc-temperature
description: Use whenever the circuit reads temperature with an NTC sensor. Covers the exact wire() pin names (GND, VCC, OUT), wiring the output to an analog pin, and mapping the value to degrees.
---

# NTC temperature sensor

A temperature sensor that produces an analog value from 0 to 1023, read with `analogRead`.

## Pins (use these exact names in wire())

- `GND` - ground (wire it to `UNO.GND`).
- `VCC` - power (wire it to `UNO.5V`).
- `OUT` - analog temperature signal (wire it to an ANALOG pin, `UNO.A0`..`UNO.A5`).

## Correct wiring

```
wire("NTC<n>.VCC", "UNO.5V")
wire("NTC<n>.GND", "UNO.GND")
wire("NTC<n>.OUT", "UNO.A0")    # analog signal -> analog pin
```

## Blocks

- Read it with `ardukid_analog_read` (field `PIN`=A0..A5).
- Convert the raw 0-1023 reading into degrees with `ardukid_map`.

## Gotchas

- `OUT` goes to an ANALOG pin (`UNO.A0`..`UNO.A5`), never a digital one.
- The `ardukid_analog_read` field `PIN` must be the same A-pin you wired `OUT` to.

## Best practices

- Use `ardukid_map` to turn the raw 0-1023 reading into a temperature range in degrees.
