# Phase 5 - Agent migration to Google ADK

Priority: P0 (compliance). Status: pending.
Reference: [agent-v2-architecture.md](./agent-v2-architecture.md) sections 1, 2, 2a.

## Goal

Replace the hand-rolled `google-genai` function-calling loop with a **Google ADK**
agent (`LlmAgent` + `Runner`) running as a library inside our FastAPI app, keeping
the existing SSE wire contract and the browser-driven tool model. No feature change
to the frontend; this is a framework swap that makes us "Agent Builder"-compliant.

## Tasks

- [ ] Add `google-adk` (pin `2.1.x`) to `backend/pyproject.toml`; `uv sync`.
- [ ] Re-probe models in `ardukid-ai`: `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite`,
      `gemini-3-flash-preview` (global). Pin the best available Gemini 3 in config; update [[gemini-model-availability]].
- [ ] Set ADK Vertex env: `GOOGLE_GENAI_USE_VERTEXAI=TRUE`, project, `GOOGLE_CLOUD_LOCATION=global`.
- [ ] Build `LlmAgent` with `instruction=SYSTEM_PROMPT` and the existing tool set re-expressed as ADK tools:
  - [ ] Browser tools (`add_component`, `remove_component`, `wire`, `set_blocks`, `compile_and_run`)
        as **`LongRunningFunctionTool`** (server returns `{"status":"pending"}`; real exec is client-side).
  - [ ] Server tools (`list_available_components`, `find_similar_example`, `list_saved_projects`,
        `load_project`, `save_project`, `search_docs`) as plain `FunctionTool`s reusing existing services.
- [ ] New `Runner` + `InMemorySessionService`; thread circuit state via `tool_context.state` and our `SessionState`.
- [ ] Rewrite the SSE route over `runner.run_async`, mapping ADK events
      (`partial`, `get_function_calls`, `long_running_tool_ids`, `is_final_response`) to the
      frontend's existing event names (`agent_text`, `tool_call`, `tool_result`, `done`).
- [ ] Implement the pause/resume bridge: emit long-running `function_call` over SSE; accept the
      browser's result on a follow-up POST; resume `run_async` with a `function_response` Part (same id).
- [ ] Keep `ARDUKID_AGENT_MODE=mock` path working for tests; update `conftest`/tests as needed.
- [ ] Remove/retire `app/agent/gemini_client.py` once ADK path is at parity.

## Exit criteria

- "Make a traffic light" builds the full circuit end-to-end through ADK (components + wires + blocks
  + compile_and_run) with the browser executing the canvas tools.
- All backend tests green in mock mode; lint clean.
- Commit `feat(phase-5): migrate agent to google adk (vertex, gemini 3)`.
