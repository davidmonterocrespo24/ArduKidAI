---
name: hcSr04
description: Use whenever the circuit measures distance with an HC-SR04 ultrasonic sensor. Covers the exact wire() pin names (VCC, TRIG, ECHO, GND), the two digital pins, and the ultrasonic distance block.
---

# HC-SR04 ultrasonic distance sensor

Measures the distance to an object by sending an ultrasonic pulse and timing its
echo. It uses two digital pins: a trigger output and an echo input.

## Pins (use these exact names in wire())

- `VCC` - power (wire it to `UNO.5V`).
- `TRIG` - trigger output (wire it to a digital pin, e.g. `UNO.D9`).
- `ECHO` - echo input (wire it to another digital pin, e.g. `UNO.D10`).
- `GND` - ground (wire it to `UNO.GND`).

## Correct wiring

```
wire("US<n>.VCC", "UNO.5V")
wire("US<n>.TRIG", "UNO.D9")
wire("US<n>.ECHO", "UNO.D10")
wire("US<n>.GND", "UNO.GND")
```

## Blocks

- Read distance in centimetres with `ardukid_ultrasonic_cm` (field `TRIG` = the
  trigger pin, e.g. `9`; field `ECHO` = the echo pin, e.g. `10`).
- This returns a number; print it or compare it (e.g. light an LED when close).

## Gotchas

- `TRIG` and `ECHO` must be two different digital pins.
- Set the block fields `TRIG` and `ECHO` to those same pin numbers you wired.

## Best practices

- Keep the two pin numbers in the block matching the two wired pins.
- Read once per loop and store the value if you use it more than once.
