---
name: pushbutton
description: Use whenever the circuit includes a push button or momentary switch. Covers the exact wire() pin names (1a, 1b, 2a, 2b), the INPUT_PULLUP wiring to ground, and the block to read it.
---

# Push button

A momentary switch. The simplest, most reliable way to read it is with
`INPUT_PULLUP`: the pin reads HIGH when released and LOW when pressed - no extra
resistor needed.

## Pins (use these exact names in wire())

- `1a`, `1b` - the first contact pair.
- `2a`, `2b` - the second contact pair (internally joined to the first when pressed).

(The raw names `1.l` / `1.r` / `2.l` / `2.r` also work.)

## Correct wiring

```
wire("UNO.D2", "B<n>.1a")     # digital pin -> one side
wire("B<n>.2a", "UNO.GND")    # the other side -> ground
```

## Blocks

- In `ardukid_setup`: `ardukid_pin_mode` with `MODE=INPUT_PULLUP` for the pin.
- To read it: `ardukid_digital_read` (returns true when the pin is HIGH; with a
  pull-up, pressed reads LOW, so test for "not pressed" = HIGH).

## Gotchas

- Use `INPUT_PULLUP` and wire the other side to `UNO.GND`; do not add a resistor.

## Best practices

- Debounce in code if you toggle a state on each press.
