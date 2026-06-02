---
name: dipSwitch8
description: Use whenever the circuit reads an 8-position DIP switch. Covers the exact wire() pin names (1a..8a and 1b..8b), how to wire each switch with INPUT_PULLUP, and reading LOW when a switch is ON.
---

# DIP switch (8 switches)

A block of 8 independent on/off switches. Switch number `k` connects its `<k>a` pin to its `<k>b` pin when set to ON.

## Pins (use these exact names in wire())

- `1a` .. `8a` - one side of switches 1 through 8.
- `1b` .. `8b` - other side of switches 1 through 8.

Switch `k` connects `<k>a` to `<k>b` when ON.

## Correct wiring

```
wire("DIP<n>.1a", "UNO.D2")
wire("DIP<n>.1b", "UNO.GND")
wire("DIP<n>.2a", "UNO.D3")
wire("DIP<n>.2b", "UNO.GND")
```

Give each switch its own `<k>a` signal pin and tie every `<k>b` to ground.

## Blocks

- In `ardukid_setup`: one `ardukid_pin_mode` per used switch (PIN = that switch's `a` pin, MODE = `INPUT_PULLUP`).
- In the loop: `controls_if` with `logic_compare` comparing `ardukid_digital_read` (PIN = that switch's `a` pin) to `LOW` to detect that the switch is ON.

## Gotchas

- With `INPUT_PULLUP`, `ardukid_digital_read` returns `LOW` when that switch is ON and `HIGH` when OFF.
- Each switch needs its own digital pin on the `a` side; the `b` side always goes to `UNO.GND`.

## Best practices

- Always set `INPUT_PULLUP` in setup for each used switch so no external resistors are needed.
- Only wire the switches you actually read; each one consumes one digital pin.
