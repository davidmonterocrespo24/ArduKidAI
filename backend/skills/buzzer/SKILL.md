---
name: buzzer
description: Use whenever the circuit makes sound or plays a melody with a buzzer. Covers the exact wire() pin names (1 signal, 2 ground) and the tone blocks that play notes.
---

# Buzzer

A buzzer makes tones. Drive its signal leg from a digital pin with `tone()`.

## Pins (use these exact names in wire())

- `1` - the signal leg (wire it to a digital pin).
- `2` - the ground leg (wire it to `UNO.GND`).

## Correct wiring

```
wire("UNO.D8", "BZ<n>.1")     # digital pin -> buzzer signal
wire("BZ<n>.2", "UNO.GND")    # buzzer ground -> ground
```

## Blocks

- `ardukid_tone` (field `PIN`; value inputs `FREQ` and `DURATION`, each a
  `math_number`) plays a note. `ardukid_no_tone` stops it.
- Separate notes with a short `ardukid_delay` so they are distinct.

## Gotchas

- `FREQ` and `DURATION` are value inputs - give them `math_number` children, not fields.

## Best practices

- For a melody, play a sequence of `ardukid_tone` blocks with delays between them.
