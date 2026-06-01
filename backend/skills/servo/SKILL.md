---
name: servo
description: Use whenever the circuit moves a servo motor to an angle. Covers the exact wire() pin names (PWM, VCC, GND), which pins give an accurate angle, and the servo blocks.
---

# Servo motor

A servo rotates to an angle between 0 and 180 degrees. It is driven on a PWM pin.

## Pins (use these exact names in wire())

- `PWM` - the signal leg (wire it to a digital PWM pin; D9 or D10 give the most
  accurate angle in the simulator).
- `VCC` - power (wire it to `UNO.5V`).
- `GND` - ground (wire it to `UNO.GND`).

## Correct wiring

```
wire("UNO.D9", "S<n>.PWM")    # PWM pin -> servo signal
wire("S<n>.VCC", "UNO.5V")    # power
wire("S<n>.GND", "UNO.GND")   # ground
```

## Blocks

- In `ardukid_setup`: `ardukid_servo_attach` (field `PIN`).
- To move it: `ardukid_servo_write` (field `PIN`; value `ANGLE` as a `math_number`).

## Gotchas

- Prefer D9 or D10 so the live angle tracks in the simulator.

## Best practices

- Attach once in setup; write angles in the loop.
