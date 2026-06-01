---
name: seg7
description: Use whenever the circuit shows a digit on a 7-segment display. Covers the exact wire() pin names (A-G, DP, COM), the common-cathode wiring, and how to light segments.
---

# 7-segment display (common cathode)

Shows a digit using seven segments `A`-`G` plus a decimal point `DP`.

## Pins (use these exact names in wire())

- `A`, `B`, `C`, `D`, `E`, `F`, `G` - each segment; wire each to its own digital pin
  (through a resistor).
- `DP` - the decimal point segment (to a digital pin).
- `COM` - the common cathode; wire it to `UNO.GND`.

## Correct wiring

```
wire("UNO.D2", "SEG<n>.A")    # one digital pin per segment (A..G, DP)
# ... repeat for B..G, DP on other digital pins ...
wire("SEG<n>.COM", "UNO.GND") # common cathode -> ground
```

## Blocks

- Drive each segment with `ardukid_digital_write` (HIGH lights that segment).

## Gotchas

- Common-cathode: `COM` goes to `UNO.GND`, and a segment lights when its pin is HIGH.

## Best practices

- A resistor per segment keeps the brightness even.
