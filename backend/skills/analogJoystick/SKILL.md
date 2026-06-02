---
name: analogJoystick
description: Use whenever the circuit reads an analog joystick. Covers the exact wire() pin names (VCC, VERT, HORZ, SEL, GND), wiring the two axes to analog pins and the button to a digital pin, and reading the values.
---

# Analog joystick

A two-axis stick with a push button. Each axis produces an analog value from 0 to 1023 (about 512 when centered), read with `analogRead`.

## Pins (use these exact names in wire())

- `VCC` - power (wire it to `UNO.5V`).
- `VERT` - vertical axis signal (wire it to an ANALOG pin, `UNO.A0`..`UNO.A5`).
- `HORZ` - horizontal axis signal (wire it to another ANALOG pin, `UNO.A0`..`UNO.A5`).
- `SEL` - push-button signal (wire it to a DIGITAL pin, `UNO.D2`..`UNO.D13`).
- `GND` - ground (wire it to `UNO.GND`).

## Correct wiring

```
wire("JOY<n>.VCC", "UNO.5V")
wire("JOY<n>.GND", "UNO.GND")
wire("JOY<n>.VERT", "UNO.A0")    # vertical axis -> analog pin
wire("JOY<n>.HORZ", "UNO.A1")    # horizontal axis -> another analog pin
wire("JOY<n>.SEL", "UNO.D2")     # button -> digital pin
```

## Blocks

- Read `VERT` and `HORZ` with `ardukid_analog_read` (field `PIN`=A0..A5). Each is 0 to 1023, about 512 when centered.
- In `ardukid_setup`, use `ardukid_pin_mode` to set the `SEL` digital pin to `INPUT_PULLUP`.
- Read the button with `ardukid_digital_read`; it reads `LOW` when the stick is pressed.

## Gotchas

- `VERT` and `HORZ` go to ANALOG pins (`UNO.A0`..`UNO.A5`), and each `ardukid_analog_read` field `PIN` must match the A-pin you wired that axis to.
- Use two DIFFERENT analog pins for `VERT` and `HORZ`.
- `SEL` goes to a DIGITAL pin and needs `INPUT_PULLUP`; it reads `LOW` (not `HIGH`) when pressed.

## Best practices

- Treat readings near 512 as centered and add a small dead zone so tiny drift does not trigger movement.
