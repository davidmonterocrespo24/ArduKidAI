---
name: heart-beat-sensor
description: Use whenever the circuit reads a pulse with a heart-beat sensor. Covers the exact wire() pin names (GND, VCC, OUT), wiring the output to an analog pin, and reading the value.
---

# Heart-beat (pulse) sensor

A pulse sensor whose analog reading rises and falls with each heartbeat, read with `analogRead`.

## Pins (use these exact names in wire())

- `GND` - ground (wire it to `UNO.GND`).
- `VCC` - power (wire it to `UNO.5V`).
- `OUT` - analog pulse signal (wire it to an ANALOG pin, `UNO.A0`..`UNO.A5`).

## Correct wiring

```
wire("HBR<n>.VCC", "UNO.5V")
wire("HBR<n>.GND", "UNO.GND")
wire("HBR<n>.OUT", "UNO.A0")    # analog signal -> analog pin
```

## Blocks

- Read it with `ardukid_analog_read` (field `PIN`=A0..A5). The value rises and falls with each beat.
- Compare it against a threshold with `logic_compare` inside `controls_if` to detect each pulse peak.

## Gotchas

- `OUT` goes to an ANALOG pin (`UNO.A0`..`UNO.A5`), never a digital one.
- The `ardukid_analog_read` field `PIN` must be the same A-pin you wired `OUT` to.

## Best practices

- Read often in `ardukid_loop` so you catch the fast rise and fall of each beat.
