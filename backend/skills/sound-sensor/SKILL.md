---
name: sound-sensor
description: Use whenever the circuit reacts to sound or noise with the big sound sensor board. Covers the exact wire() pin names (AOUT, GND, VCC, DOUT), which pins are analog vs digital, and how to read loudness or a loud-noise threshold.
---

# Sound sensor (big board)

A microphone module that reports loudness on an analog output and a loud-noise threshold on a digital output.

## Pins (use these exact names in wire())

- `AOUT` - analog loudness signal (wire it to an analog pin, e.g. `UNO.A0`).
- `GND` - ground (wire it to `UNO.GND`).
- `VCC` - power (wire it to `UNO.5V`).
- `DOUT` - digital threshold signal (wire it to a digital pin, e.g. `UNO.D2`).

## Correct wiring

```
wire("SND<n>.VCC", "UNO.5V")
wire("SND<n>.GND", "UNO.GND")
wire("SND<n>.AOUT", "UNO.A0")
wire("SND<n>.DOUT", "UNO.D2")
```

## Blocks

- `ardukid_analog_read` (field `PIN` = the analog pin, e.g. `A0`) returns `0..1023` for how loud the sound is.
- `ardukid_digital_read` (field `PIN` = the digital pin, e.g. `D2`) returns HIGH when a loud noise crosses the on-board threshold.
- Combine with `controls_if` and `logic_compare` to act when the sound is loud enough.

## Gotchas

- `AOUT` must go to an analog pin (`UNO.A0`..`UNO.A5`); `DOUT` must go to a digital pin (`UNO.D2`..`UNO.D13`).
- Use `ardukid_analog_read` only on the analog pin; `ardukid_digital_read` only on the digital pin.

## Best practices

- Use `AOUT` + `analog_read` to measure how loud it is; use `DOUT` + `digital_read` for a simple loud/quiet trigger.
- Turn the on-board threshold knob to tune when `DOUT` goes HIGH.
