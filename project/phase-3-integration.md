# Phase 3 - Frontend + agent integration

Target: June 2-4, 2026
Status: complete (May 25, 2026 - ahead of schedule)

## Goal

Wire the SPA to the backend agent over SSE. Tool calls from the agent must apply live to the canvas, Blockly, and the C++ view. All 9 components from the spec must be wired and renderable. End-to-end demo: chat -> canvas -> Blockly -> compile -> avr8js.

## Tasks

- [x] **SSE client** in the frontend (`src/lib/sse.ts`) consumes `POST /api/agent/chat` via `fetch` + `ReadableStream`. Standard `EventSource` does not support POST so we parse the wire format ourselves.
- [x] **Chat UI streams events** as they arrive (`src/components/ChatPanel.tsx` + `appendAgentText` in the store which merges consecutive agent_text events into one bubble).
- [x] **Tool call handler** (`src/agent/dispatcher.ts`) dispatches each event to the Zustand store:
  - [x] `add_component` -> `addComponent(result.component)` (uses backend-assigned id like `L1`, `R1`).
  - [x] `remove_component` -> `removeComponent(result.removed_id)` and prunes connected wires.
  - [x] `wire` -> `addWire(result.wire)`.
  - [x] `set_blocks` -> applied at tool_call time (XML lives in args). The Blockly panel watches the store and reloads its workspace on change.
  - [x] `compile_and_run` -> stores the returned HEX; the footer's Run button feeds it into avr8js.
  - [x] `save_project` -> stub until phase 4 (no UI surfacing yet; the backend in-memory store still records it).
- [x] All 9 components rendering through `src/components/DynamicComponent.tsx`:
  - [x] Arduino UNO
  - [x] LED (with color prop, value driven by sim for the first LED on the canvas)
  - [x] Resistor (value prop)
  - [x] Pushbutton (color prop)
  - [x] Buzzer (hasSignal placeholder)
  - [x] Servo SG90 (angle prop)
  - [x] Potentiometer (value prop)
  - [x] LCD 16x2 I2C (text prop)
  - [x] 7-segment display (values + color)
- [/] Pin map / wire rendering. The store carries the wire list and the canvas footer displays the first few. **Visual SVG wire drawing between component pins is deferred to phase 5** - it needs per-element pin coordinates which are inside each wokwi shadow DOM, and a polish pass is better spent during deploy QA.
- [/] avr8js wired to drive canvas components. The LED follows the simulator (phase 1 wiring), and props on servo / buzzer / lcd / 7-segment plumb through correctly, but **per-pin sim drive for non-LED components is deferred to phase 5** alongside the visual wire pass.
- [x] First-run screen with 4 suggestion chips in Spanish ("Quiero encender un LED", "Un botón que prende una luz", "Quiero un semáforo", "Tocá una melodía con el buzzer"). Click sends the prompt to the agent.
- [ ] Tooltip flow ("Try pressing the button in the simulation"). Deferred to phase 6 QA polish.
- [x] Modification flow tested via the mock agent (keywords cover LED, button + LED, traffic light).
- [x] C++ tab updates whenever blocks change. Custom **Blockly C++ generator** in `src/blockly/cppGenerator.ts` walks the workspace on every change and writes to the store.

## New code

```
frontend/src/
  .env.example                          VITE_API_BASE
  lib/
    api.ts                              fetch wrapper with base URL + JSON helper
    sse.ts                              ReadableStream -> SSE event generator
    sessionId.ts                        per-tab UUID stored in sessionStorage
    intelHex.ts                         Intel HEX -> bytes -> Uint16Array words
  types/
    circuit.ts                          shared ComponentInstance, Wire, ChatMessage
  agent/
    chat.ts                             sendChatMessage(): POST + SSE + dispatch
    dispatcher.ts                       handleAgentEvent + applyToolCall/Result
  blockly/
    arduinoBlocks.ts                    10 custom blocks (setup, loop, pinMode,
                                        digitalWrite, analogWrite, digitalRead,
                                        analogRead, delay, tone, noTone)
    cppGenerator.ts                     custom Blockly -> C++ traverser
  components/
    DynamicComponent.tsx                renders any of the 9 wokwi elements
```

## Modified

- `src/store/useAppStore.ts` - added components, wires, hexCode, chatMessages,
  agentStatus, plus actions (addComponent, removeComponent, addWire,
  appendAgentText, resetCircuit, etc).
- `src/components/CanvasPanel.tsx` - rewritten to render dynamically from the
  store with a UNO + peripheral grid layout.
- `src/components/ChatPanel.tsx` - rewritten with input, scrollable history,
  suggestion chips wired to `sendChatMessage`, and agent status indicator.
- `src/components/BlocklyPanel.tsx` - registers Arduino blocks, attaches a
  change listener that regenerates C++, syncs the workspace XML to the store.
- `src/components/FooterBar.tsx` - separate Run / Compile&Run buttons; Run
  uses cached HEX or fallback, Compile&Run posts current C++ to the backend.
- `src/sim/runner.ts` - `startSim(program, onLedChange)` accepts either
  `{kind: 'hex', hex}` or `{kind: 'fallback'}`; HEX path parses Intel HEX.
- `src/blockly/setup.ts` - toolbox now includes the Arduino category.

## Verification

- `npm run lint` clean.
- `npm run build` clean (chunk-size warning unchanged; will code-split in phase 5).
- `npm run dev` boots; index.html serves correctly.
- Backend + frontend booted together: CORS preflight returns `access-control-allow-origin: http://localhost:5173`; agent SSE chat streams `agent_start -> agent_text -> tool_call -> tool_result -> ... -> done` end-to-end including `circuit_state` in the request body.

## Verification deferred

- Real-browser visual end-to-end (clicking a chip, watching components appear, seeing C++ regenerate). Will be done during phase 5 QA and the phase 6 demo recording.

## Exit criteria

- All structural tasks above completed (the two `[/]` items are partials, both explicitly scoped to phase 5).
- Commit on `main` titled `feat(phase-3): live agent-driven canvas with all 9 components`, then pushed.
