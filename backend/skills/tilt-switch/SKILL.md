---
name: tilt-switch
description: Use whenever the circuit detects tilting or movement with a tilt switch. Covers the exact wire() pin names (GND, VCC, OUT), how to wire it, and reading the digital output when tilted.
---

# Tilt switch

A sensor that changes its digital output when the module is tilted or moved.

## Pins (use these exact names in wire())

- `GND` - ground (wire it to `UNO.GND`).
- `VCC` - power (wire it to `UNO.5V`).
- `OUT` - digital output (wire it to a digital pin).

## Correct wiring

```
wire("TILT<n>.VCC", "UNO.5V")
wire("TILT<n>.GND", "UNO.GND")
wire("TILT<n>.OUT", "UNO.D2")
```

## Blocks

- In `ardukid_setup`: `ardukid_pin_mode` (PIN = the `OUT` pin, MODE = `INPUT`).
- In the loop: `controls_if` with `logic_compare` comparing `ardukid_digital_read` (PIN = the `OUT` pin) to `HIGH` or `LOW` to detect a change.

## Gotchas

- The reading from `ardukid_digital_read` changes (between `HIGH` and `LOW`) when the sensor is tilted or moved.
- Always wire `VCC` to `UNO.5V` and `GND` to `UNO.GND`; the module needs power to drive `OUT`.

## Best practices

- Compare the current reading against the previous one in your logic to detect movement rather than a fixed level.
- One tilt switch needs one signal digital pin plus shared `UNO.5V` and `UNO.GND`.
