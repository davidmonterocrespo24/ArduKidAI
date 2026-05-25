# Phase 4 - MongoDB MCP + vector search

Target: June 5-6, 2026
Status: complete (May 25, 2026 - ahead of schedule)

## Goal

Connect the agent to the MongoDB MCP server. Seed ~30 examples with Gemini embeddings. Configure Atlas Vector Search. Implement project save/load.

## Tasks

### MongoDB Atlas (manual)

- [ ] Atlas M0 cluster provisioned. **User task M6.**
- [ ] Database user created. **User task.**
- [ ] Network access rule. **User task M7.**
- [ ] Connection string in Secret Manager. **User task (phase 5).**

### Collections + seed

- [x] `components_catalog` schema defined. Static list of 9 components.
- [x] `examples` schema defined. **30 example projects** authored in `app/db/seed_data.py`, each with bilingual EN/ES intent, tags, difficulty, and a short C++ hint.
- [x] `projects` collection wired (empty until users save).
- [x] **Seeder script** (`app/db/seed.py`, CLI entry `scripts/seed_db.py`). Idempotent upserts by `_id`. Computes embeddings via `embed_text` for each example. Creates the Atlas Vector Search index (silently skips if it already exists).
- [ ] Seeder executed against the real Atlas cluster. **User task once M6 is done** - run `uv run python -m scripts.seed_db` with `MONGODB_URI` set.

### Vector search

- [x] Atlas Vector Search index definition on `examples.intent_embedding` (768 dims, cosine), created by the seeder.
- [x] **Gemini embedding wrapper** (`services/embeddings.py`) using `google-genai` `embed_content` with `text-embedding-005`. Falls back to a deterministic L2-normalised hashed bag-of-words when no GCP credentials are available, so local dev and unit tests work end-to-end without network calls.
- [x] **Vector search service** (`services/examples.py`) with two query paths:
  - Atlas `$vectorSearch` aggregation when Mongo is connected.
  - In-memory cosine ranking against the 30 seed entries when no Mongo.
- [x] `/api/examples/search?q=...&limit=N` returns ranked `ExampleHit`s with scores. Verified: query "three LEDs traffic light" ranks Traffic light 1st, Christmas lights 2nd, Binary counter 3rd.

### MCP-shaped agent tools

- [x] `find_similar_example(query, limit)` - calls the vector search service.
- [x] `list_saved_projects()` - lists summaries from the projects store.
- [x] `load_project(project_id)` - recalls a project into the active session.
- [x] System prompt updated to mention the three library/recall tools.
- [x] Mock client gets `parecido`/`similar`/`find me`/`buscame` keyword routing so the demo is end-to-end without GCP credentials.

### MCP server sidecar (deferred to phase 5)

The three tools above are documented as **MongoDB MCP server operations**: `find_similar_example` maps to `$vectorSearch`, `list_saved_projects` maps to `find` on projects, `load_project` maps to `findOne`. In phase 5 we add the `mongodb-mcp-server` sidecar container and a `MCP_ENABLED=true` switch so these tools route through the official MCP protocol instead of calling our Motor client directly. The agent contract does not change.

### Service layer refactor

- [x] `services/catalog.py` reads from Mongo when available, else from seed data. `CATALOG_TYPES` exposed as a sync constant for the FunctionDeclaration enum.
- [x] `services/projects_store.py` async API, Motor-backed when available, in-memory fallback otherwise.
- [x] `routes/projects.py` and `routes/examples.py` are now fully async.

### Frontend save / load

- [x] `agent/projects.ts` - fetch helpers for `/api/projects`.
- [x] `components/SaveProjectDialog.tsx` - modal triggered by the footer Save button.
- [x] `components/SavedProjectsList.tsx` - renders on the first-run screen below the suggestion chips; clicking a project hydrates the canvas, Blockly, and code panels.
- [x] `FooterBar.tsx` - Save button enabled, opens the dialog, surfaces a system chat message on success.

### Tests

- [x] `tests/test_embeddings.py` - shape, determinism, similarity gradient.
- [x] `tests/test_examples_search.py` - ranking and empty-query handling.
- [x] `tests/test_projects_persistence.py` - save/list/get round trip + `load_project` agent tool replaces session circuit.
- [x] Existing `tests/test_tools.py` and `tests/test_agent_routes.py` updated for the new tool count.
- [x] **28 tests pass** under `uv run pytest`.

## Verification

- `uv run ruff check .` clean.
- `uv run pytest` -> 28 passed.
- `npm run lint` and `npm run build` clean in the frontend.
- Backend smoke test:
  - `/api/examples/search?q=three+LEDs+traffic+light` -> Traffic light first.
  - `/api/projects` POST + GET round-trips a circuit with a single LED.
  - Chat with "buscame algo parecido a un servo" emits `find_similar_example` tool_call and tool_result with `Potentiometer controls a servo` as the top hit.

## Manual user tasks tracked elsewhere

See `project/manual-setup.md` items M3, M6, M7, M8. Add: **after Atlas is up, run `uv run python -m scripts.seed_db` once to populate the cluster and create the vector index.**

## Exit criteria

- All structural tasks above completed (sidecar MCP server explicitly deferred to phase 5 deploy).
- Commit on `main` titled `feat(phase-4): mongodb mcp tools and atlas vector search`, then pushed.
