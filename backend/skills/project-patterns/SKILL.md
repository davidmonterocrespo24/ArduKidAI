---
name: project-patterns
description: Use when planning a common kid project (traffic light, melody, sensor reading, button-controlled LED) to follow a proven recipe and avoid common mistakes.
---

# Project patterns (playbooks)

Recipes for the most common projects. Combine with the per-component skills for
exact pins and the blockly-programming skill for the program.

## Traffic light

Three LEDs: red on D13, yellow on D12, green on D11, each through its own resistor
to `UNO.GND`. In the loop: red HIGH (others LOW) for 3s, then yellow HIGH for 1s,
then green HIGH for 3s, repeat. Watch out for: one resistor per LED, and every
cathode wired to `UNO.GND`.

## Melody / buzzer

Buzzer signal (`BZ1.1`) to a digital pin, ground (`BZ1.2`) to `UNO.GND`. Play notes
with `ardukid_tone` at different FREQ values, each followed by a short
`ardukid_delay` so the notes are distinct.

## Read a sensor (potentiometer / analog)

Signal to an analog pin (`UNO.A0`..`A5`), power to `UNO.5V`, ground to `UNO.GND`.
Read with `ardukid_analog_read`; scale with `ardukid_map` if needed (e.g. to dim an
LED with `ardukid_analog_write`).

## Button controls an LED

Button with `INPUT_PULLUP`: one side to a digital pin, the other to `UNO.GND`. LED on
another digital pin through a resistor to `UNO.GND`. In the loop, read the button and
set the LED. Remember: with a pull-up, pressed reads LOW.

## Always

After building any circuit, call `validate_circuit` and fix every issue it reports
(loose components, missing ground, an LED without a resistor, etc.) before telling
the child it is ready.
