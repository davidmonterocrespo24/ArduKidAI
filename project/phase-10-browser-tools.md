# Phase 10 - Browser-tool hardening + UX

Priority: P1. Status: pending.
Reference: [agent-v2-architecture.md](./agent-v2-architecture.md) sections 2, 2a.

## Goal

Make the browser-executed tool loop robust and let the agent perceive the result
of its actions in the simulator, so it can self-correct - the difference between a
demo that "draws a circuit" and one that "builds a working project and checks it".

## Tasks

- [ ] Harden the `LongRunningFunctionTool` pause/resume bridge: correlate by call id, handle the
      client posting results out of order, timeouts, and user cancel mid-turn.
- [ ] Frontend dispatcher: apply each streamed `function_call`, then POST a structured result
      (`{status, ...}`) back so the agent resumes; surface per-step progress in the chat UI.
- [ ] New browser-read tools: `read_sim_state` (pin states / serial output from avr8js) and
      optionally `screenshot_canvas`, so the agent can verify its circuit actually ran.
- [ ] Feed `compile_and_run` results (HEX ok / compile errors) back to the agent so it can fix code.
- [ ] Streaming UX: token streaming, tool-call chips, error states, "thinking" indicator.
- [ ] Resilience: SSE reconnect, guard against partial/duplicate events, abort on new user message.

## Exit criteria

- Agent builds a project, runs it, reads back the sim/serial state, and corrects a deliberate error
  without the user intervening.
- Commit `feat(phase-10): robust browser tool loop and sim-state perception`.
