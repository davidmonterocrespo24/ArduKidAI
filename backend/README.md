# ArduKid - Backend

FastAPI service that orchestrates Gemini 3 (via Google Cloud Agent Builder) over the seven agent tools that drive the frontend canvas, and wraps `arduino-cli` for C++ to HEX compilation.

## Quick start (local)

```bash
# 1. Install uv if you do not have it
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Install deps
cd backend
uv sync

# 3. Copy env, leave ARDUKID_AGENT_MODE=mock for now
cp .env.example .env

# 4. Run dev server
uv run uvicorn app.main:app --reload --port 8080
```

The mock agent mode lets you exercise the SSE chat endpoint without GCP credentials. Switch to `ARDUKID_AGENT_MODE=real` after configuring `GOOGLE_CLOUD_PROJECT` and Application Default Credentials.

## Quick start (container)

```bash
docker build -t ardukid-backend .
docker run --rm -p 8080:8080 --env-file .env ardukid-backend
```

The container ships `arduino-cli` with the `arduino:avr` core pre-installed so `/api/compile` works out of the box.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/health` | Liveness probe. |
| POST | `/api/agent/chat` | Server-Sent Events stream of the agent loop (text, tool_call, tool_result, done events). |
| POST | `/api/compile` | Compile C++ (or trivially-wrapped Blockly XML) to an Intel HEX string. |
| GET  | `/api/projects` | List saved projects (in-memory until phase 4). |
| POST | `/api/projects` | Save a project. |
| GET  | `/api/examples/search?q=...` | Search example circuits (stubbed until phase 4 MongoDB vector search). |

## Agent tools

The seven custom tools exposed to Gemini are declared in `app/agent/tools.py`. Each tool returns a JSON-serialisable dict that the agent runner streams to the frontend as a `tool_call` event:

| Tool | Effect |
| --- | --- |
| `list_available_components` | Returns the catalog (9 supported components). |
| `add_component` | Picks the next ID and tells the frontend to render a component. |
| `remove_component` | Removes a component by ID. |
| `wire` | Creates a wire between two pins. |
| `set_blocks` | Replaces the Blockly XML in the editor. |
| `compile_and_run` | Compiles the current C++ to HEX and asks the frontend to load it into avr8js. |
| `save_project` | Persists the current session (in-memory in phase 2). |

## Tests

```bash
uv run pytest
```

`tests/test_compile.py` mocks `arduino-cli` subprocess calls; `tests/test_agent_routes.py` exercises the SSE endpoint with the mock client. No network calls in CI.
