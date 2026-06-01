# Phase 6 - MongoDB MCP server integration

Priority: P0 (compliance - the partner-track requirement). Status: **done** (2026-05-31).
Reference: [agent-v2-architecture.md](./agent-v2-architecture.md) section 3.

## Goal

Route the agent's MongoDB data access through the official `mongodb-mcp-server`
instead of Motor. Gemini computes the 768-dim query vector; the MCP server's
`aggregate` tool runs the `$vectorSearch`. Pattern (b): the data services call the
MCP server when `MCP_ENABLED=true`, with Motor as the fallback.

## What was built

- [x] `app/services/mcp_client.py`: a streamable-HTTP MCP client (`aggregate`, `find`,
      `insert_one`). Per-call sessions (simple/robust for the demo). Parses the server's
      `<untrusted-user-data>` wrapper to recover JSON.
- [x] Routed through MCP (gated on `mcp_enabled()`), Motor fallback preserved:
  - [x] `examples.search_similar` -> `aggregate` `$vectorSearch` on `examples`.
  - [x] `knowledge.search_docs` -> `aggregate` `$vectorSearch` on `knowledge_chunks`.
  - [x] `projects_store.list_all`/`get` -> `find`; `save` -> `insert-many`.
- [x] Gemini stays the embedder; the server's `--voyageApiKey` auto-embed is NOT used (Voyage banned).
- [x] Hermetic unit tests for the result parser (`tests/test_mcp_client.py`); 42 tests green, ruff clean.

## Verified live (against `npx mongodb-mcp-server --transport http --httpPort 3030`)

- `find_similar_example` via MCP returns the same ranked hits as Motor (e.g. melody -> Happy Birthday 0.91).
- `save -> list -> load` round-trips a project through `insert-many` + `find`.

## Findings / notes for deploy

- mcp 1.27: use `streamable_http_client` (not the deprecated `streamablehttp_client`); endpoint is `/mcp`.
- Tools: `insert-many` (no `insert-one`), `update-many` (no `update-one`); `aggregate` runs `$vectorSearch`.
- The server wraps query results in `<untrusted-user-data-UUID>` tags AND repeats those tag names in
  its warning text, so the parser must scan all matches and pick the JSON one (guarded by a unit test).
- Local `.env` keeps `MCP_ENABLED=false` (Motor fallback, no sidecar needed for dev). Deploy (phase 11)
  flips it to `true` with the sidecar and `MDB_MCP_CONNECTION_STRING` from Secret Manager.
- A persistent MCP session (vs per-call) is a future optimization; `--readOnly` for the query path is a
  deploy-time hardening (writes go through the same server for `save`).

## Exit criteria

- [x] With `MCP_ENABLED=true` + sidecar, similar-example search and project save/load flow through MCP.
- [x] Motor fallback still works with `MCP_ENABLED=false`; tests green.
- [ ] Commit `feat(phase-6): route data tools through mongodb mcp server`.
