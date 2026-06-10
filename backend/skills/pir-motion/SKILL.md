---
name: pir-motion
description: Use whenever the circuit detects motion with a PIR sensor. Covers the exact wire() pin names (VCC, OUT, GND), how to wire it, and reading HIGH while motion is detected.
---

# PIR motion sensor

A passive infrared sensor that detects nearby movement of people or animals.

## Pins (use these exact names in wire())

- `VCC` - power (wire it to `UNO.5V`).
- `OUT` - digital output (wire it to a digital pin).
- `GND` - ground (wire it to `UNO.GND`).

## Correct wiring

```
wire("PIR<n>.VCC", "UNO.5V")
wire("PIR<n>.GND", "UNO.GND")
wire("PIR<n>.OUT", "UNO.D2")
```

## Blocks

- In `ardukid_setup`: `ardukid_pin_mode` (PIN = the `OUT` pin, MODE = `INPUT`).
- In the loop: `controls_if` with `logic_compare` comparing `ardukid_digital_read` (PIN = the `OUT` pin) to `HIGH` to act when motion is detected.

## Gotchas

- `ardukid_digital_read` returns `HIGH` while motion is detected and `LOW` when the area is still.
- Always wire `VCC` to `UNO.5V` and `GND` to `UNO.GND`; the sensor needs power to drive `OUT`.

## Best practices

- Test against `HIGH` to mean "motion detected"; do not invert it.
- One PIR sensor needs one signal digital pin plus shared `UNO.5V` and `UNO.GND`.
