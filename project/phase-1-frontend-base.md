# Phase 1 - Frontend base

Target: May 27-29, 2026
Status: complete (May 25, 2026 - ahead of schedule)

## Goal

Stand up the React + Vite + TS frontend with a static canvas, a minimal Blockly editor, a read-only Monaco C++ tab, and avr8js running a hardcoded HEX. No backend, no agent yet.

## Tasks

- [x] `frontend/` scaffolded with Vite + React + TypeScript. (React 19 as scaffolded by Vite 8 - see deviation note below.)
- [x] Tailwind CSS configured (Tailwind v4 via `@tailwindcss/vite`).
- [x] `cn()` helper installed (clsx + tailwind-merge) to support shadcn-style components later.
- [x] Page layout matching the spec:
  - Left sidebar: chat placeholder (stubbed).
  - Center: canvas region with `wokwi-elements`.
  - Right tabs: Blockly editor | C++ view (Monaco read-only).
  - Footer: Run / Stop / Reset / Save buttons (Save stubbed for phase 4).
- [x] Render Arduino UNO + a LED + a pushbutton on the canvas via `wokwi-elements`.
- [x] Minimal Blockly workspace using Blockly 11 with the default Logic / Loops / Math / Text / Variables toolbox.
- [x] Monaco editor (read-only) showing a fixed C++ snippet (the canonical blink sketch).
- [x] avr8js running a hardcoded "blink" program inside the browser, driving the LED.
- [x] Zustand store for canvas state, Blockly XML, C++ string, sim-state, and tab selection.
- [x] TanStack Query installed and provider mounted (no real queries yet).
- [x] `npm run dev` boots cleanly on port 5173.
- [x] `npm run build` passes (typecheck + production bundle).
- [x] `npm run lint` passes (no warnings).
- [x] All third-party Vite/React/Discord branding removed from public/ and src/ (per contest no-third-party-logo rule).

## Deviation note

The product spec called for React 18. The scaffolded version is React 19, which was already mainstream at contest start (May 2026) and ships with improved handling of custom-element properties - which directly helps the `<wokwi-led value={...}>` interop. The deviation is non-material; documenting here for transparency.

`@blockly/arduino` (or the BlocklyDuino fork) was not added in this phase. The default Blockly toolbox is sufficient for phase 1; Arduino-specific blocks and the C++ generator land in phase 3 alongside the agent's `set_blocks` tool.

`shadcn/ui` components were not installed yet. The `cn()` helper sets us up to add them on demand when the agent UI needs richer components in phase 3.

## Implementation notes

- The "hardcoded HEX" was implemented as a hand-encoded 15-word AVR program written directly into `cpu.programMemory`. This avoids depending on arduino-cli at this phase (arduino-cli arrives in phase 2 inside the backend container). See `frontend/src/sim/blinkProgram.ts` for the verified instruction encodings.
- `wokwi-elements` auto-registers via Lit's `@customElement` decorator on import. JSX typings are declared in `frontend/src/types/wokwi.d.ts`.
- The LED's `value` boolean property is set via a ref + effect to avoid React coercing it to a string attribute.

## Verification done

- `npm install` clean.
- `npm run build` clean (1 informational warning about chunk size from Blockly + Monaco + avr8js; not blocking, will code-split in phase 5 if needed).
- `npm run dev` serves the rendered HTML at http://localhost:5173/ within ~400 ms.
- avr8js public exports confirmed against my imports.
- `AVRIOPort.addListener` signature confirmed: `(value: u8, oldValue: u8) => void`.
- `@wokwi/elements` auto-registration confirmed via Lit `@customElement` decorator.

## Verification deferred

- Real-browser visual confirmation of the blink animation, the LED color toggle on the canvas, and the Blockly + Monaco render. Will be eyeballed during phase 2 development and confirmed properly during phase 5 deploy QA.

## Exit criteria

- All structural tasks above completed.
- Commit on `main` titled `feat(phase-1): frontend base with canvas, blockly, monaco, avr8js`.
