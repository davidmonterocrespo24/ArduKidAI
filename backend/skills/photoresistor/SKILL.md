---
name: photoresistor
description: Use whenever the circuit reads light level with an LDR (photoresistor). Covers the exact wire() pin names (VCC, GND, DO, AO), wiring the analog output to an analog pin, and reading the value.
---

# Light sensor (LDR / photoresistor)

A light sensor whose analog reading rises in brighter light, read with `analogRead`.

## Pins (use these exact names in wire())

- `VCC` - power (wire it to `UNO.5V`).
- `GND` - ground (wire it to `UNO.GND`).
- `DO` - optional digital threshold output (wire it to a DIGITAL pin, `UNO.D2`..`UNO.D13`).
- `AO` - analog light signal (wire it to an ANALOG pin, `UNO.A0`..`UNO.A5`).

## Correct wiring

```
wire("LDR<n>.VCC", "UNO.5V")
wire("LDR<n>.GND", "UNO.GND")
wire("LDR<n>.AO", "UNO.A0")    # analog signal -> analog pin
```

## Blocks

- Read it with `ardukid_analog_read` (field `PIN`=A0..A5). The value is higher in brighter light and lower in the dark.
- Compare it against a threshold with `logic_compare` inside `controls_if` (e.g. turn on an LED when it gets dark).

## Gotchas

- `AO` goes to an ANALOG pin (`UNO.A0`..`UNO.A5`), never a digital one.
- The `ardukid_analog_read` field `PIN` must be the same A-pin you wired `AO` to.
- `DO` is optional; only wire it (to a digital pin) if you want the on-board threshold output instead of the analog reading.

## Best practices

- Prefer the `AO` analog reading for smooth light levels; use `DO` only for a simple light/dark switch.
