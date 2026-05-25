# Phase 3 - Frontend + agent integration

Target: June 2-4, 2026
Status: pending

## Goal

Wire the SPA to the backend agent over SSE. Tool calls from the agent must apply live to the canvas, Blockly, and the C++ view. All 9 components from the spec must be wired and renderable. End-to-end demo: chat -> canvas -> Blockly -> compile -> avr8js.

## Tasks

- [ ] SSE client in the frontend consuming `POST /api/agent/chat`.
- [ ] Chat UI streams tokens as they arrive.
- [ ] Tool call handler that dispatches to the Zustand store:
  - [ ] `add_component` -> appends to canvas state.
  - [ ] `remove_component` -> removes by id.
  - [ ] `wire` -> draws a wire on the canvas.
  - [ ] `set_blocks` -> loads XML into Blockly workspace.
  - [ ] `compile_and_run` -> calls `POST /api/compile`, loads HEX into avr8js, starts simulation.
  - [ ] `save_project` -> stub until phase 4.
- [ ] All 9 components rendering correctly:
  - [ ] Arduino UNO
  - [ ] LED (with color prop)
  - [ ] Resistor (220 ohm)
  - [ ] Pushbutton
  - [ ] Buzzer
  - [ ] Servo SG90
  - [ ] Potentiometer
  - [ ] LCD 16x2 I2C
  - [ ] 7-segment display
- [ ] Pin map / wire rendering correct for each.
- [ ] avr8js wired to drive the actual canvas components (LED on/off, servo angle, buzzer tone, etc.).
- [ ] First-run screen with 4 suggestion chips: "Turn on a LED", "Button that turns on a light", "Traffic light", "Play a melody".
- [ ] Tooltip flow ("Try pressing the button in the simulation").
- [ ] Modification flow tested: "make it blink faster", "add a buzzer".
- [ ] C++ tab updates whenever blocks change.

## Deliverables

- A user can type "I want a traffic light" and the agent assembles components, generates blocks, compiles, and runs the simulation, all in the browser.

## Exit criteria

- End-to-end demo recorded locally.
- Commit on `main` titled `feat(phase-3): live agent-driven canvas with all 9 components`.
