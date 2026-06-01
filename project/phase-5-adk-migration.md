# Phase 5 - Agent migration to Google ADK

Priority: P0 (compliance). Status: **done** (2026-05-31).
Reference: [agent-v2-architecture.md](./agent-v2-architecture.md) sections 1, 2, 2a.

## Goal

Replace the hand-rolled `google-genai` function-calling loop with a **Google ADK**
agent (`LlmAgent` + `Runner`) running as a library inside our FastAPI app, keeping
the existing SSE wire contract and the browser-mirror tool model. Framework swap
that makes us "Agent Builder"-compliant, no frontend change.

## Tasks

- [x] Add `google-adk` (pinned `>=2.1,<3`, resolved 2.1.0) to `pyproject`; `uv sync`.
      Note: ADK 2.1 requires `google-genai>=1.72,<2`, so google-genai was pinned to 1.x (1.75).
- [x] Model: using **`gemini-3-flash-preview`** on `global` (user decision: flash, not pro - cheaper,
      Gemini 3 satisfies the theme). `gemini-2.5-flash` is the fallback. Re-probing 3.1-pro skipped.
- [x] ADK Vertex env set in `AdkAgentClient.__init__`: `GOOGLE_GENAI_USE_VERTEXAI=TRUE`, project,
      `GOOGLE_CLOUD_LOCATION=global`. Embeddings keep their own explicit `us-central1` client.
- [x] `LlmAgent` with `instruction=SYSTEM_PROMPT` and all 11 tools re-expressed as ADK function
      tools that delegate to the existing `dispatch(name, session, args)`.
- [x] Per-tool session resolution via `ToolContext` (`tool_context.session.id` -> global
      `get_or_create_session`) - concurrency-safe, no context-variable juggling.
- [x] `Runner` + `InMemorySessionService` as a lazy **singleton** so conversation history persists
      across turns (v1 lost it). New SSE bridge maps ADK events
      (`get_function_calls`/`get_function_responses`/text) to `tool_call`/`tool_result`/`agent_text`.
- [x] `ARDUKID_AGENT_MODE=mock` path untouched; 39 tests green; ruff clean.
- [x] Forbid emojis in the system prompt (the model had emitted one - hackathon violation).
- [x] Removed `app/agent/gemini_client.py` (v1 retired).

## Deferred to phase 10 (by design - parity first)

- Canvas tools currently execute **server-side** (parity with v1; the frontend mirrors the streamed
  events). True browser-side execution via **`LongRunningFunctionTool`** + client post-back, plus
  sim-state read-back, moves to phase 10.

## Exit criteria

- [x] "Make a traffic light" builds the full circuit end-to-end through ADK (7 components, 9 wires,
      set_blocks, compile_and_run) - verified; agent text emoji-free.
- [x] Tests green in mock mode; lint clean.
- [ ] Commit `feat(phase-5): migrate agent to google adk (vertex, gemini 3)`.
