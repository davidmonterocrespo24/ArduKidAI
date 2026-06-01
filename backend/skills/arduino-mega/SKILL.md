---
name: arduino-mega
description: Use when the selected board is the Arduino Mega 2560 (the turn note says id MEGA). A much bigger board than the UNO with 54 digital pins (D0..D53) and 16 analog inputs (A0..A15). Covers the exact pin names for wiring (MEGA.D0..D53, MEGA.A0..A15, MEGA.GND, MEGA.5V).
---

# Arduino Mega 2560

The microcontroller board when the canvas board is the Mega. It is ALREADY on
the canvas with the id `MEGA`. Do NOT call `add_component` for a board. Every
wire to the board uses `MEGA.<pin>`. It has far more pins than the UNO, so you
can drive many outputs at once.

## Pin names (use these exact strings in wire())

- Digital: `MEGA.D0` .. `MEGA.D53`. ALWAYS include the `D` (e.g. `MEGA.D13`, never
  `MEGA.13`) or the component will not light in the simulator. The built-in LED
  is on D13.
- PWM-capable digital pins: D2..D13 and D44..D46.
- Analog: `MEGA.A0` .. `MEGA.A15`. In the simulator analogRead works reliably on
  A0..A7; prefer those for sensors and potentiometers. I2C uses D20 (SDA) and
  D21 (SCL); the extra serial ports are Serial1 (D18/D19), Serial2 (D16/D17),
  Serial3 (D14/D15).
- Ground: `MEGA.GND` (use this exact string every time; multiple wires may share it).
- Power: `MEGA.5V` and `MEGA.3V3`.

## Gotchas

- Digital pins MUST be `MEGA.D<n>`, n from 0 to 53.
- The board id is `MEGA`. Do not add a second board.
- Prefer analog inputs A0..A7 for sensors (A8..A15 are a simulator limitation).

## Best practices

- With 54 digital pins you can give every LED its own pin; still share `MEGA.GND`
  for all grounds.
