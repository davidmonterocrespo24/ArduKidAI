---
name: resistor
description: Use whenever the circuit needs a resistor (almost always paired with an LED). Covers the exact wire() pin names (a, b) and how a resistor sits between a digital pin and an LED to limit current.
---

# Resistor (220 ohm)

A resistor limits current so an LED does not burn out. It is non-polar, so either
leg can face either way.

## Pins (use these exact names in wire())

- `a` - one leg (wire it to the digital pin).
- `b` - the other leg (wire it to the LED anode).

(The raw names `1` / `2` also work, but prefer `a` / `b`.)

## Correct wiring

```
wire("UNO.D13", "R<n>.a")      # digital pin -> resistor leg a
wire("R<n>.b",  "L<n>.anode")  # resistor leg b -> LED anode
```

## Gotchas

- The simulator only traces the LED's drive pin THROUGH a component whose id starts
  with `R`. So the resistor must sit between the pin and the LED anode.
- Add one resistor per LED.

## Best practices

- Pair every LED with its own resistor and wire the resistor first.
