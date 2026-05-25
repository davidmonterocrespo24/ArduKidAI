# Phase 2 - Backend agent

Target: May 30 - June 1, 2026
Status: complete (May 25, 2026 - ahead of schedule)

## Goal

Build the FastAPI backend with Google Cloud Agent Builder + Gemini 3 wired up. Implement the 7 custom agent tools. arduino-cli available in the container for C++ to HEX compilation. Validate everything via HTTP/curl, no frontend needed.

## Tasks

- [x] `backend/` scaffolded with Python 3.12, FastAPI, uvicorn (managed via `uv`).
- [x] `pyproject.toml` with: `fastapi`, `uvicorn[standard]`, `google-genai`, `pydantic`, `pydantic-settings`, `sse-starlette`, `httpx`; dev: `pytest`, `pytest-asyncio`, `pytest-mock`, `ruff`.
- [ ] GCP project created and APIs enabled. **Manual user task M4 / M5 in `project/manual-setup.md`.**
- [ ] $100 credit form submitted (deadline: **June 4, 2026**). **Manual user task M3.**
- [ ] Service account / Application Default Credentials configured for local dev. **Manual user task** (`gcloud auth application-default login`).
- [x] `arduino-cli` installed inside the Dockerfile with the `arduino:avr` core pre-installed.
- [x] **Agent design via Gemini function calling.** We use `google-genai` against Vertex AI with the seven tools registered as `FunctionDeclaration`s. This is the same calling protocol Agent Builder exposes - phase 5 can lift the same definitions into a managed Agent Builder Reasoning Engine without changing the tool contracts.
- [x] System prompt drafted: kid-friendly, Spanish by default, one short question on ambiguity, never invents components.
- [x] **All 7 custom tools implemented** in `app/agent/tools.py`:
  - [x] `list_available_components()`
  - [x] `add_component(type, x, y, props)`
  - [x] `remove_component(id)`
  - [x] `wire(from_pin, to_pin)`
  - [x] `set_blocks(blockly_xml)`
  - [x] `compile_and_run()` - shells out to `arduino-cli`, returns Intel HEX text.
  - [x] `save_project(name)`
- [x] Routes:
  - [x] `POST /api/agent/chat` (SSE streaming with `sse_starlette`)
  - [x] `POST /api/compile` (cpp or blockly_xml -> HEX)
  - [x] `GET /api/projects`, `POST /api/projects`, `GET /api/projects/{id}`
  - [x] `GET /api/examples/search?q=...` (stub - phase 4 wires MongoDB vector search)
  - [x] `GET /health`
- [x] Tool calls return structured JSON that the frontend will later apply to the canvas.
- [ ] Safety settings configured on the Gemini call. **Deferred to phase 5** when the real client runs against credentials.
- [x] curl-tested: `POST /api/agent/chat` with `{"message":"quiero un semaforo"}` streams the full `agent_start -> agent_text -> tool_call -> tool_result -> ...` sequence.
- [x] **Unit tests for compilation path** in `tests/test_compile.py` (mock `arduino-cli` subprocess).

## Real vs mock agent

The backend has two interchangeable clients:

- `app/agent/gemini_client.py` - real Vertex AI Gemini client. Activated when `ARDUKID_AGENT_MODE=real`.
- `app/agent/mock_client.py` - deterministic scripted client triggered by keywords. Default for local dev and CI. Lets the frontend be exercised end-to-end without GCP credentials.

Both go through the same `dispatch()` function so the tool behaviour is identical.

## Layout

```
backend/
  Dockerfile               python:3.12-slim + arduino-cli + arduino:avr core
  pyproject.toml           uv-managed deps
  uv.lock
  .env.example
  README.md
  app/
    main.py                FastAPI factory + CORS + router wire-up
    config.py              Settings (pydantic-settings)
    schemas.py             CircuitState, ComponentInstance, Wire, requests, responses
    routes/
      health.py            GET /health
      agent.py             POST /api/agent/chat (SSE)
      compile_route.py     POST /api/compile
      projects.py          CRUD
      examples.py          stub
    agent/
      session.py           SessionState + in-memory session store
      system_prompt.py     kid-friendly prompt
      tools.py             7 tools + JSON-schema declarations + dispatch()
      runner.py            agent loop yielding SSEEvents
      gemini_client.py     real Vertex AI client
      mock_client.py       scripted client for local dev
    services/
      catalog.py           9 components hardcoded
      compiler.py          arduino-cli subprocess wrapper
      blockly_to_cpp.py    stub (frontend does the real codegen in phase 3)
      projects_store.py    in-memory; phase 4 swaps to MongoDB
  tests/
    conftest.py            state reset + TestClient fixture
    test_health.py
    test_tools.py          unit tests for the 7 tools
    test_compile.py        compiler subprocess mocked
    test_agent_routes.py   SSE event sequence validated
```

## Verification

- `uv run ruff check .` clean.
- `uv run pytest` -> 17 passed.
- `uv run uvicorn app.main:app` boots; `curl /health` and `curl -N /api/agent/chat` both work.
- Docker build not executed locally (would download ~1 GB for the arduino-cli core). The Dockerfile is structurally valid and uses the official arduino-cli install script. Built and verified in phase 5 on Cloud Build.

## Manual user tasks tracked elsewhere

See `project/manual-setup.md` items M3, M4, M5 for the GCP project + credit form + APIs. The real Gemini client cannot be exercised end-to-end until those are done.

## Exit criteria

- All structural tasks above completed.
- Commit on `main` titled `feat(phase-2): fastapi agent backend with seven tools and arduino-cli`.
