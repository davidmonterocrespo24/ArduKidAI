---
name: arduino-uno
description: Use at the start of every circuit. The Arduino UNO board is the brain and is ALREADY on the canvas with id UNO - never add another. Covers the exact pin names for wiring (UNO.D0..D13, UNO.A0..A5, UNO.GND, UNO.5V).
---

# Arduino UNO

The microcontroller board. It is ALREADY on the canvas with the id `UNO`.
Do NOT call `add_component("uno")` - there is only one board, and its id is `UNO`
(not `UNO1`). Every wire to the board uses `UNO.<pin>`.

## Pin names (use these exact strings in wire())

- Digital: `UNO.D0` .. `UNO.D13`. ALWAYS include the `D` (e.g. `UNO.D13`, never
  `UNO.13`) or the component will not light in the simulator. PWM-capable digital
  pins: D3, D5, D6, D9, D10, D11.
- Analog: `UNO.A0` .. `UNO.A5`. I2C uses A4 (SDA) and A5 (SCL).
- Ground: `UNO.GND` (use this exact string every time, even for many parts -
  multiple wires may share it).
- Power: `UNO.5V` and `UNO.3V3`.

## Gotchas

- Digital pins MUST be `UNO.D<n>`.
- The board id is `UNO`. Do not add a second UNO.

## Best practices

- Wire each output device to its own digital pin; share `UNO.GND` for all grounds.
