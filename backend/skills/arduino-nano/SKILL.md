---
name: arduino-nano
description: Use when the selected board is the Arduino Nano (the turn note says id NANO). Same ATmega328P brain as the UNO but a smaller form factor with two extra analog-only inputs. Covers the exact pin names for wiring (NANO.D0..D13, NANO.A0..A7, NANO.GND, NANO.5V).
---

# Arduino Nano

The microcontroller board when the canvas board is the Nano. It is ALREADY on the
canvas with the id `NANO`. Do NOT call `add_component` for a board. Every wire to
the board uses `NANO.<pin>`. Same ATmega328P chip as the UNO, so the program and
the simulation behave identically.

## Pin names (use these exact strings in wire())

- Digital: `NANO.D0` .. `NANO.D13`. ALWAYS include the `D` (e.g. `NANO.D13`, never
  `NANO.13`) or the component will not light in the simulator. PWM-capable digital
  pins: D3, D5, D6, D9, D10, D11.
- Analog: `NANO.A0` .. `NANO.A7`. The Nano breaks out two MORE analog inputs than
  the UNO: A6 and A7 are analog-INPUT ONLY (they cannot be digital outputs). I2C
  uses A4 (SDA) and A5 (SCL).
- Ground: `NANO.GND` (use this exact string every time; multiple wires may share it).
- Power: `NANO.5V` and `NANO.3V3`.

## Gotchas

- Digital pins MUST be `NANO.D<n>`.
- The board id is `NANO`. Do not add a second board.
- A6 and A7 are analog read only - do not use them for digitalWrite outputs.

## Best practices

- Wire each output device to its own digital pin; share `NANO.GND` for all grounds.
