---
name: flame-sensor
description: Use whenever the circuit detects fire or a flame. Covers the exact wire() pin names (VCC, GND, DOUT, AOUT), which pins are analog vs digital, and how to read the flame level or a flame threshold.
---

# Flame sensor

A sensor that reacts to a flame or strong light, reporting a level on an analog output and a detection threshold on a digital output.

## Pins (use these exact names in wire())

- `VCC` - power (wire it to `UNO.5V`).
- `GND` - ground (wire it to `UNO.GND`).
- `DOUT` - digital threshold signal (wire it to a digital pin, e.g. `UNO.D2`).
- `AOUT` - analog flame level (wire it to an analog pin, e.g. `UNO.A0`).

## Correct wiring

```
wire("FLM<n>.VCC", "UNO.5V")
wire("FLM<n>.GND", "UNO.GND")
wire("FLM<n>.AOUT", "UNO.A0")
wire("FLM<n>.DOUT", "UNO.D2")
```

## Blocks

- `ardukid_analog_read` (field `PIN` = the analog pin, e.g. `A0`) returns `0..1023` and reacts to a flame or strong light.
- `ardukid_digital_read` (field `PIN` = the digital pin, e.g. `D2`) returns HIGH when a flame is detected.
- Combine with `controls_if` and `logic_compare` to act when fire is detected.

## Gotchas

- `AOUT` must go to an analog pin (`UNO.A0`..`UNO.A5`); `DOUT` must go to a digital pin (`UNO.D2`..`UNO.D13`).
- Use `ardukid_analog_read` only on the analog pin; `ardukid_digital_read` only on the digital pin.

## Best practices

- Use `DOUT` + `digital_read` for a simple flame/no-flame alarm; use `AOUT` + `analog_read` to see how close or strong the flame is.
- Turn the on-board threshold knob to tune when `DOUT` goes HIGH.
