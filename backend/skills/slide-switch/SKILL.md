---
name: slide-switch
description: Use whenever the circuit reads a slide switch position. Covers the exact wire() pin names (1, 2, 3), how to wire the common pin with INPUT_PULLUP, and reading LOW when 1-2 are connected.
---

# Slide switch

A two-position slide switch. The middle pin is the common contact; sliding connects it to one outer pin or the other.

## Pins (use these exact names in wire())

- `1` - one outer contact.
- `2` - common / middle contact.
- `3` - other outer contact.

## Correct wiring

```
wire("SW<n>.2", "UNO.D2")
wire("SW<n>.1", "UNO.GND")
```

Wire the common (`2`) to the digital signal pin and one outer pin (`1`) to ground.

## Blocks

- In `ardukid_setup`: `ardukid_pin_mode` (PIN = the signal pin, MODE = `INPUT_PULLUP`).
- In the loop: `controls_if` with `logic_compare` comparing `ardukid_digital_read` (PIN = the signal pin) to `LOW` to detect the connected position.

## Gotchas

- With `INPUT_PULLUP`, `ardukid_digital_read` returns `LOW` when the slider connects `1` to `2`, and `HIGH` otherwise.
- The common contact is the middle pin `2`. Wiring an outer pin to the signal will not read both positions correctly.

## Best practices

- Always set `INPUT_PULLUP` in setup so no external resistor is needed.
- One slide switch needs one signal digital pin plus a shared `UNO.GND`.
