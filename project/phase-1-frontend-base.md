# Phase 1 - Frontend base

Target: May 27-29, 2026
Status: pending

## Goal

Stand up the React + Vite + TS frontend with a static canvas, a minimal Blockly editor, a read-only Monaco C++ tab, and avr8js running a hardcoded HEX. No backend, no agent yet.

## Tasks

- [ ] `frontend/` scaffolded with Vite + React 18 + TypeScript.
- [ ] Tailwind CSS + shadcn/ui configured.
- [ ] Page layout matching the spec:
  - Left sidebar: chat placeholder (stubbed).
  - Center: canvas region with `wokwi-elements`.
  - Right tabs: Blockly editor | C++ view (Monaco read-only).
  - Footer: Run / Stop / Reset / Save buttons (stubbed).
- [ ] Render Arduino UNO + a LED + a button on the canvas via `wokwi-elements`.
- [ ] Minimal Blockly workspace using Blockly 11 with the `@blockly/arduino` (or equivalent) block set.
- [ ] Monaco editor (read-only) showing a fixed C++ snippet.
- [ ] avr8js running a hardcoded HEX (precompiled "blink" sketch) inside the browser, driving the LED.
- [ ] Zustand store for canvas state, Blockly XML, C++ string, and run-state.
- [ ] TanStack Query installed (no real queries yet).
- [ ] `npm run dev` boots cleanly.
- [ ] Lint + typecheck pass.

## Deliverables

- A locally runnable SPA where the LED blinks via avr8js without any backend.

## Exit criteria

- `cd frontend && npm install && npm run dev` shows the working blink.
- Commit on `main` titled `feat(phase-1): frontend base with canvas, blockly, monaco, avr8js`.
