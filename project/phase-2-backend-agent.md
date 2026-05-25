# Phase 2 - Backend agent

Target: May 30 - June 1, 2026
Status: pending

## Goal

Build the FastAPI backend with Google Cloud Agent Builder + Gemini 3 wired up. Implement the 7 custom agent tools. arduino-cli available in the container for C++ to HEX compilation. Validate everything via HTTP/curl, no frontend needed.

## Tasks

- [ ] `backend/` scaffolded with Python 3.12, FastAPI, uvicorn.
- [ ] `pyproject.toml` or `requirements.txt` with: `fastapi`, `uvicorn`, `google-cloud-aiplatform`, `pymongo`, `motor`, `pydantic`, `sse-starlette`.
- [ ] GCP project created and APIs enabled: Vertex AI, Cloud Run, Artifact Registry, Secret Manager.
- [ ] $100 credit form submitted (deadline: **June 4, 2026**).
- [ ] Service account configured for local dev (no key in repo; use ADC).
- [ ] `arduino-cli` installed inside the Dockerfile, with `arduino:avr` core preinstalled.
- [ ] Agent Builder agent created with Gemini 3 backend.
- [ ] System prompt drafted per spec (kid-friendly, short, asks before tools, etc.).
- [ ] **7 custom tools implemented:**
  - [ ] `list_available_components()`
  - [ ] `add_component(type, x, y)`
  - [ ] `remove_component(id)`
  - [ ] `wire(from_pin, to_pin)`
  - [ ] `set_blocks(blockly_xml)`
  - [ ] `compile_and_run()` - shells out to arduino-cli, returns HEX
  - [ ] `save_project(name)`
- [ ] Routes:
  - [ ] `POST /api/agent/chat` (SSE streaming)
  - [ ] `POST /api/compile` (Blockly XML or C++ to HEX)
  - [ ] `GET /api/projects`, `POST /api/projects`
  - [ ] `GET /api/examples/search?q=...` (stub, no MongoDB yet)
- [ ] Tool calls return structured JSON that the frontend will later apply.
- [ ] Safety settings configured on the Gemini call.
- [ ] curl-tested: `curl -N localhost:8000/api/agent/chat -d '{"message":"turn on a led"}'` returns a streamed response with tool calls.
- [ ] Unit tests for the compilation path (Blockly XML to C++ to HEX round trip).

## Deliverables

- `docker build` produces a runnable backend image.
- All 7 tools invokable via curl integration test.

## Exit criteria

- `docker run` works locally end-to-end.
- Commit on `main` titled `feat(phase-2): fastapi backend with agent builder and 7 tools`.
