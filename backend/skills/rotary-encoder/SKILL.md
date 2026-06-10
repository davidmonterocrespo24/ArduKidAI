---
name: rotary-encoder
description: Use whenever the circuit reads a turning knob with a KY-040 rotary encoder. Covers the exact wire() pin names (CLK, DT, SW, VCC, GND), which pins are digital, and how to tell turn direction and detect the push.
---

# Rotary encoder (KY-040)

A knob you can turn either way and also press. CLK and DT report the turning; SW is the push button.

## Pins (use these exact names in wire())

- `CLK` - clock signal (wire it to a digital pin, e.g. `UNO.D2`).
- `DT` - data signal (wire it to another digital pin, e.g. `UNO.D3`).
- `SW` - push button (wire it to a digital pin, e.g. `UNO.D4`; use `INPUT_PULLUP`, LOW when pressed).
- `VCC` - power (wire it to `UNO.5V`).
- `GND` - ground (wire it to `UNO.GND`).

## Correct wiring

```
wire("ENC<n>.VCC", "UNO.5V")
wire("ENC<n>.GND", "UNO.GND")
wire("ENC<n>.CLK", "UNO.D2")
wire("ENC<n>.DT", "UNO.D3")
wire("ENC<n>.SW", "UNO.D4")
```

## Blocks

- In `ardukid_setup`: `ardukid_pin_mode` with `MODE` = `INPUT_PULLUP` on the `SW` pin.
- `ardukid_digital_read` (field `PIN`) on `CLK` and `DT`; compare them with `logic_compare` to tell which way the knob turned.
- `ardukid_digital_read` on `SW` is LOW when the knob is pressed.
- Use `controls_if` to react to a turn or a press.

## Gotchas

- `CLK`, `DT`, and `SW` are all digital signals and must go to digital pins (`UNO.D2`..`UNO.D13`).
- `SW` needs `INPUT_PULLUP`; it reads LOW (not HIGH) while pressed.

## Best practices

- Read `CLK` and `DT` together: when `CLK` changes, the value of `DT` relative to `CLK` tells you the direction.
- Keep `CLK` and `DT` on two separate digital pins so direction can be detected.
