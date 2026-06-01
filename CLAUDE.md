# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

**ArduKid** is a hackathon submission for the [Google Cloud Rapid Agent Hackathon](https://rapid-agent.devpost.com/), MongoDB partner track. It is a web mini-IDE where an AI agent assembles Arduino UNO circuits and generates block-based code from a kid's natural-language description, simulated in the browser. Target audience is children aged 8 to 14.

Authoritative product spec: [`doc/product-spec.md`](./doc/product-spec.md).
Phase-by-phase plan and status: [`project/phases.md`](./project/phases.md).
Hackathon rules verbatim: [`doc/hackathon-rules.md`](./doc/hackathon-rules.md).

## Hackathon non-negotiables (hard constraints)

These are not personal style preferences - they come directly from the contest rules. Violations risk disqualification.

- **LLM: Gemini 3 via Google Cloud Agent Builder ONLY.** No OpenAI, Anthropic, DeepSeek, Mistral, Voyage AI, or any other LLM/embedding provider - not even for utility tasks like embedding generation.
- **Partner integration: MongoDB MCP server with Atlas Vector Search.** Vector embeddings must come from Gemini (768 dims), not Voyage AI.
- **Simulator: avr8js only.** No Proteus / SimulIDE / Tinkercad / Wokwi-hosted simulation.
- **All code authored within the Contest Period: May 5, 2026 12:00 PT - June 11, 2026 14:00 PT.** No copy-paste from any prior project.
- **No mention of any prior personal product name** in the repo, app, video, README, or Devpost submission.
- **No emojis** anywhere - UI, code, comments, commits, README, video. Use inline SVG if a visual symbol is needed.
- **English only** for code, comments, identifiers, docs, commits, and PR/issue text.
- **No third-party logos** in the shipped app (already removed from the Vite scaffold).

## Git constraints

- **Local git is configured to `David Montero Crespo <davidmonterocrespo24@gmail.com>`.** Verify with `git config user.email` before committing - never let it default to a different identity.
- **Never push as another user.** Remote is `https://github.com/davidmonterocrespo24/ArduKidAI`.
- **All commit timestamps must fall within the Contest Period.** Check with `git log --format='%ai | %ae'`.
- One commit per phase completion (minimum); incremental commits within a phase are fine. Use `feat(phase-N): ...`, `chore(phase-N): ...`, `fix: ...`, `docs: ...`.
- **Push after every commit.** The user opted in to "every commit goes to origin". After `git commit`, run `git push origin main`. For force-push, use `--force-with-lease`, and only after a Git author check.

## Environment setup

Node is **not installed system-wide**. It lives under `~/.nvm/versions/node/`. Every Bash invocation must load it. Two equivalent options:

```bash
# Option A - source nvm
. ~/.nvm/nvm.sh

# Option B - prepend PATH (faster, no shell init cost)
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
```

Always do this once per Bash tool call. The Claude Code Bash tool spawns a fresh shell each time, so PATH does not persist across calls.

The git repo also lives in a default shell where `cd` does not persist between Bash calls - operate from absolute paths or chain `cd dir && cmd` in a single call.

## Common commands

All frontend commands run from `frontend/`:

```bash
npm install               # one time, after clone
npm run dev               # Vite dev server on http://localhost:5173
npm run build             # tsc -b && vite build (also typechecks)
npm run lint              # eslint
```

Backend (Phase 2+) will follow conventional FastAPI + uvicorn patterns - see [`project/phase-2-backend-agent.md`](./project/phase-2-backend-agent.md) when it exists.

There is no test suite yet. When tests are added, the convention will be `npm run test` (frontend, Vitest) and `pytest` (backend).

## Architecture

### High-level shape

```
Browser SPA  (frontend/)
  - chat sidebar (talks to /api/agent/chat over SSE)
  - canvas of wokwi-elements (agent-controlled, not user-draggable)
  - Blockly editor and Monaco read-only C++ view
  - avr8js running locally - simulation never round-trips to backend
        |
        v  HTTPS
Cloud Run  (backend/, planned phase 2)
  - FastAPI + Google Cloud Agent Builder + Gemini 3
  - Seven custom tools (add_component, wire, set_blocks, ...)
  - arduino-cli inside the container for Blockly XML -> C++ -> HEX
        |
        v
MongoDB MCP sidecar  ->  MongoDB Atlas
  - examples (with intent_embedding vector index)
  - projects (user save/load)
  - components_catalog (component specs)
```

The detailed reference is [`doc/product-spec.md`](./doc/product-spec.md) section 5.

### Frontend architecture cues

- **State lives in Zustand.** `frontend/src/store/useAppStore.ts` is the single source of truth for sim status, LED state, current Blockly XML, generated C++ code, and right-tab selection. Components subscribe to slices via the `useAppStore` hook; do not introduce React context or prop drilling for shared state.
- **Wokwi web components register themselves on import.** `import '@wokwi/elements'` in `frontend/src/main.tsx` triggers Lit's `@customElement` decorators globally. JSX typings are declared in `frontend/src/types/wokwi.d.ts`; extend this file rather than casting to `any` when adding more wokwi elements.
- **Custom-element boolean props need ref-based assignment.** React still coerces non-string attributes inconsistently for unknown elements. The `Led` component in `CanvasPanel.tsx` shows the pattern: use a `useRef` + `useEffect` to set `el.value = on` as a JS property, not a JSX attribute. Replicate this for any wokwi element that exposes boolean/numeric live properties.
- **avr8js runs in `requestAnimationFrame` batches.** `frontend/src/sim/runner.ts` executes ~50,000 instructions per frame between `requestAnimationFrame` ticks so the JS event loop stays responsive. The CPU is created with a freshly allocated `Uint16Array(0x4000)` program memory; the program is `set()`ed in directly without going through Intel HEX parsing.
- **Phase 1 ships a hand-encoded blink program** in `frontend/src/sim/blinkProgram.ts`. Each entry is a verified 16-bit ATmega328P instruction word with the mnemonic in a comment. This is throwaway and will be replaced by HEX from arduino-cli in Phase 3. If you need to modify the program at this phase, edit the opcodes directly (the encodings are documented in the file header).
- **Blockly toolbox in `frontend/src/blockly/setup.ts`** is intentionally minimal (Logic / Loops / Math / Text / Variables). Arduino-specific blocks and the C++ generator land in Phase 3 - do not preempt that work here.

### Backend architecture cues (Phase 2+)

The agent's seven canvas tools (`list_available_components`, `add_component`, `remove_component`, `wire`, `set_blocks`, `compile_and_run`, `save_project`) and three MongoDB-MCP-shaped tools (`find_similar_example`, `list_saved_projects`, `load_project`) must each return structured JSON that the frontend's tool-call dispatcher can apply to the Zustand store. The shape of these payloads is the contract between phases 2 and 3 - design them with the frontend handler in mind.

- **Services are dual-mode.** `services/catalog.py`, `services/projects_store.py`, `services/examples.py` each call Motor when `MONGODB_URI` is set and fall back to in-memory / seed-data otherwise. Always preserve this fallback so unit tests and local dev keep working without an Atlas cluster.
- **Embeddings are dual-mode.** `services/embeddings.py` uses Gemini `text-embedding-005` when GCP creds are present, else a deterministic L2-normalised hashed bag-of-words. Both return 768-dim vectors so downstream code never branches.
- **MongoDB MCP server.** In phase 4 the MCP-shaped tools call our Motor services directly. Phase 5 deploy adds the `mongodb-mcp-server` sidecar container and flips `MCP_ENABLED=true`; the same tool surface routes through MCP at that point. Do not duplicate query logic - any new MCP-style tool should also work with the local fallback.
- **The seeder is idempotent.** `scripts/seed_db.py` upserts by `_id` and silently no-ops if the vector-search index already exists. Re-run safely after schema changes.

## Phase tracker workflow

Every phase has a checklist file in `project/phase-N-*.md`. The flow is:

1. Read `project/phases.md` to see current state.
2. Move the active phase to `in progress` in the master tracker and use TaskUpdate in the harness.
3. Work through the phase's checklist; tick items as you go.
4. When all exit criteria are met, mark the phase done in both the per-phase file and `project/phases.md`.
5. Commit with a `feat(phase-N): ...` or `chore(phase-N): ...` message, then push.

Do not start a new phase before the previous one's exit criteria are met. Do not pre-implement features from later phases.

## Manual setup

- **`project/manual-setup.md`** is the canonical checklist of things only the user can do (create accounts, request credits, generate keys, fill the Devpost form, upload the video). Append to it whenever a phase needs an action you cannot take. Each entry records why, the URL, the deadline, and what artifact the user must paste back.

## Dev deploy

The app runs on the user's own Docker host (currently `ArduKidAI.moontero.com`). The full recipe is in `deploy/README.md`. Briefly:

- `docker-compose.yml` at the repo root brings up backend (8080) + frontend (8081) + an optional `mongodb-mcp-server` sidecar (compose profile `mcp`).
- The host's nginx (TLS via Certbot) reverse-proxies `/api/*` to the backend and `/` to the frontend. Sample config at `deploy/nginx-ardukidai.conf.sample`.
- The frontend is built with `VITE_API_BASE=""` so all SPA requests are same-origin - no CORS dance needed in dev.

Local `npm run dev` + `uv run uvicorn` still works for fast iteration; the Docker stack is purely for the deployed demo.
