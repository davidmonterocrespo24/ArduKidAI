---
name: led
description: Use whenever the circuit includes an LED (a light). Covers the exact wire() pin names (anode, cathode), the required resistor-and-ground wiring so it lights in the simulator, and the blocks that turn it on and off.
---

# LED

An LED is a small light that turns on when its pin is driven HIGH. It is polarized
and must always be driven through a resistor.

## Pins (use these exact names in wire())

- `anode` - the positive (+) leg. Connects to the digital pin THROUGH a resistor.
- `cathode` - the negative (-) leg. Connects to `UNO.GND`.

(The raw names `A` / `C` also work, but prefer `anode` / `cathode`.)

## Correct wiring

For an LED `L<n>` driven from digital pin 13, with its resistor `R<n>`:

```
wire("UNO.D13", "R<n>.a")        # digital pin -> resistor leg a
wire("R<n>.b",  "L<n>.anode")    # resistor leg b -> LED anode (+)
wire("L<n>.cathode", "UNO.GND")  # LED cathode (-) -> ground
```

The simulator only lights the LED when the path is pin -> resistor (an id starting
with `R`) -> anode, and the cathode goes to `UNO.GND`. Always write digital pins
with the `D` prefix (`UNO.D13`, not `UNO.13`), or the LED stays dark in the sim.

## Blocks that drive it

- In `ardukid_setup`: one `ardukid_pin_mode` with `MODE=OUTPUT` for the pin.
- In `ardukid_loop`: `ardukid_digital_write` (`VALUE=HIGH` to light, `LOW` to turn off)
  and `ardukid_delay` for timing.

## Gotchas

- Never wire the anode straight to a digital pin without a resistor (it can burn out).
- One resistor per LED. Add and wire the resistor before the LED.
- Do not forget the cathode -> `UNO.GND` wire, or the LED never lights.

## Best practices

- Use a 220 ohm resistor (the default) for a normal LED.
- After wiring, call `validate_circuit` and fix anything it reports.
