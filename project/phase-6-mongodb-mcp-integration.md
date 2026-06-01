# Phase 6 - MongoDB MCP server integration

Priority: P0 (compliance - the partner-track requirement). Status: pending.
Reference: [agent-v2-architecture.md](./agent-v2-architecture.md) section 3.

## Goal

Route the agent's MongoDB data access through the **official `mongodb-mcp-server`**
(via ADK `McpToolset`), instead of calling Motor directly. Gemini computes the
768-dim query vector; the MCP server's `aggregate` tool runs the `$vectorSearch`.

## Tasks

- [ ] Run the sidecar locally for dev: `npx -y mongodb-mcp-server@latest --transport http
      --httpHost 0.0.0.0 --httpPort 3030 --readOnly` with `MDB_MCP_CONNECTION_STRING` set.
- [ ] Add an MCP client layer: ADK `McpToolset(StreamableHTTPConnectionParams(url=".../mcp"),
      tool_filter=["find","aggregate","count","collection-indexes","insert-many","update-one"])`.
      Close it on FastAPI shutdown (lifespan).
- [ ] Implement pattern (b): when `MCP_ENABLED=true`, `find_similar_example` / `list_saved_projects`
      / `load_project` / `save_project` embed with Gemini (where needed) and call the MCP server;
      when false, fall back to Motor. Same return shapes either way.
  - [ ] `find_similar_example` / `search_docs`: build `$vectorSearch` pipeline with the Gemini
        `queryVector` and call MCP `aggregate`.
  - [ ] `list_saved_projects` -> MCP `find`; `load_project` -> MCP `find`; `save_project` -> MCP
        `insert-many` / `update-one` (note: no `insert-one`).
- [ ] Do NOT use the server's `--voyageApiKey` auto-embed (Voyage AI is banned).
- [ ] Tests: a path that exercises the MCP client against the local sidecar (skipped if not present),
      plus the Motor fallback path stays hermetic.

## Exit criteria

- With `MCP_ENABLED=true` + local sidecar, the agent's similar-example search and project save/load
  all flow through the MongoDB MCP server (verified in logs), returning correct results.
- Motor fallback still works with `MCP_ENABLED=false`.
- Commit `feat(phase-6): route data tools through mongodb mcp server`.
