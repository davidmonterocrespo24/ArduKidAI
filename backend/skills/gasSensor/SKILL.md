---
name: gasSensor
description: Use whenever the circuit detects gas or smoke with an MQ-2 module. Covers the exact wire() pin names (AOUT, DOUT, GND, VCC), which pins are analog vs digital, and how to read the gas level or a gas threshold.
---

# Gas sensor (MQ-2)

An MQ-2 module that detects gas or smoke, reporting a level on an analog output and a threshold on a digital output.

## Pins (use these exact names in wire())

- `AOUT` - analog gas level (wire it to an analog pin, e.g. `UNO.A0`).
- `DOUT` - digital threshold signal (wire it to a digital pin, e.g. `UNO.D2`).
- `GND` - ground (wire it to `UNO.GND`).
- `VCC` - power (wire it to `UNO.5V`).

## Correct wiring

```
wire("GAS<n>.VCC", "UNO.5V")
wire("GAS<n>.GND", "UNO.GND")
wire("GAS<n>.AOUT", "UNO.A0")
wire("GAS<n>.DOUT", "UNO.D2")
```

## Blocks

- `ardukid_analog_read` (field `PIN` = the analog pin, e.g. `A0`) returns `0..1023` for the gas level.
- `ardukid_digital_read` (field `PIN` = the digital pin, e.g. `D2`) returns HIGH when the gas level is above the on-board threshold.
- Combine with `controls_if` and `logic_compare` to act when gas is detected.

## Gotchas

- `AOUT` must go to an analog pin (`UNO.A0`..`UNO.A5`); `DOUT` must go to a digital pin (`UNO.D2`..`UNO.D13`).
- Use `ardukid_analog_read` only on the analog pin; `ardukid_digital_read` only on the digital pin.

## Best practices

- Use `DOUT` + `digital_read` for a simple gas alarm; use `AOUT` + `analog_read` to measure how much gas there is.
- Turn the on-board threshold knob to tune when `DOUT` goes HIGH.
