---
name: led-bar-graph
description: Use whenever the circuit lights a row of LEDs as a level meter with a 10-segment LED bar graph. Covers the exact wire() pin names (A1..A10 anodes, C1..C10 cathodes), the per-segment resistors, and the digital write block.
---

# LED bar graph (10 segments)

Ten small LEDs in a row. Each segment has its own anode (A) and cathode (C), so
you can light any subset to show a level. You do not need to wire all ten; wire
only the segments you use.

## Pins (use these exact names in wire())

- `A1`..`A10` - anodes (each wired through a resistor to a digital pin).
- `C1`..`C10` - cathodes (each wired to `UNO.GND`).

## Correct wiring

Add one resistor per used segment; wire its anode through the resistor to a
digital pin and its cathode to ground. Example for 3 segments on pins 2, 3, 4:

```
wire("BAR<n>.A1", "R1.1")
wire("R1.2", "UNO.D2")
wire("BAR<n>.C1", "UNO.GND")
wire("BAR<n>.A2", "R2.1")
wire("R2.2", "UNO.D3")
wire("BAR<n>.C2", "UNO.GND")
wire("BAR<n>.A3", "R3.1")
wire("R3.2", "UNO.D4")
wire("BAR<n>.C3", "UNO.GND")
```

## Blocks

- In `ardukid_setup`: one `ardukid_pin_mode` per used pin (mode OUTPUT).
- Light a segment with `ardukid_digital_write` (field `PIN` = the pin its anode
  is wired to, field `VALUE` = `HIGH`). Use `LOW` to turn it off.

## Gotchas

- Each lit segment needs its own resistor; sharing one across anodes dims them.
- The anode goes to the digital pin (through a resistor); the cathode goes to GND.
- Use a different digital pin per segment you want to control independently.

## Best practices

- Wire only the segments you need; for a 3-bar meter, three segments is enough.
- Set each used pin to OUTPUT in setup before writing to it.
