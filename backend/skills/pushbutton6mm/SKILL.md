---
name: pushbutton6mm
description: Use whenever the circuit reads a 6mm tactile pushbutton press. Covers the exact wire() pin names (1a, 1b, 2a, 2b), how to wire it with INPUT_PULLUP, and reading LOW while pressed.
---

# Pushbutton 6mm (tactile)

A small momentary tactile pushbutton. It is open by default and closes (connects) while pressed.

## Pins (use these exact names in wire())

- `1a` - one side, contact A (internally joined to `1b`).
- `1b` - one side, contact B (internally joined to `1a`).
- `2a` - other side, contact A (internally joined to `2b`).
- `2b` - other side, contact B (internally joined to `2a`).

Pressing the button connects the `1` side to the `2` side.

## Correct wiring

```
wire("B<n>.1a", "UNO.D2")
wire("B<n>.2b", "UNO.GND")
```

Use one leg on the `1` side for the signal and the diagonal leg on the `2` side for ground.

## Blocks

- In `ardukid_setup`: `ardukid_pin_mode` (PIN = the signal pin, MODE = `INPUT_PULLUP`).
- In the loop: `controls_if` with `logic_compare` comparing `ardukid_digital_read` (PIN = the signal pin) to `LOW` to detect a press.

## Gotchas

- With `INPUT_PULLUP`, `ardukid_digital_read` returns `LOW` while the button is pressed and `HIGH` when released. Do not test for `HIGH` to mean pressed.
- Wire the signal leg and the ground leg on diagonally opposite sides (`1a` and `2b`), not on the same side, or the press will never register.

## Best practices

- Always set `INPUT_PULLUP` in setup so no external resistor is needed.
- One pushbutton needs one signal digital pin plus a shared `UNO.GND`.
