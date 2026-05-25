# Phase 4 - MongoDB MCP + vector search

Target: June 5-6, 2026
Status: pending

## Goal

Connect the agent to the MongoDB MCP server. Seed ~30 examples with Gemini embeddings. Configure Atlas Vector Search. Implement project save/load.

## Tasks

### MongoDB Atlas

- [ ] Atlas M0 cluster provisioned (free tier).
- [ ] Database user created.
- [ ] Network access rule for the backend egress (Cloud Run static IPs or 0.0.0.0/0 for dev).
- [ ] Connection string stored in Secret Manager.

### Collections

- [ ] `components_catalog` - seeded with the 9 components (pins, props, defaults).
- [ ] `examples` - seeded with ~30 hand-curated example projects.
- [ ] `projects` - empty, ready for save/load.

### Vector search

- [ ] Atlas Vector Search index on `examples.intent_embedding`:
  ```json
  {
    "fields": [{
      "type": "vector",
      "path": "intent_embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    }]
  }
  ```
- [ ] Embedding generation script using Gemini's text embedding model (768 dims). NO Voyage AI, NO OpenAI.

### MCP server

- [ ] `mongodb-mcp-server` running as a sidecar container in the same Cloud Run service (or as a separate Cloud Run service).
- [ ] Backend agent connects to MCP via its standard protocol.
- [ ] Agent can issue:
  - [ ] `find` on `examples` (filter by tags or title).
  - [ ] `vector_search` on `examples.intent_embedding`.
  - [ ] `find` and `insert` on `projects`.

### Wire-up

- [ ] `list_available_components()` reads from `components_catalog`.
- [ ] `save_project(name)` writes to `projects`.
- [ ] User can ask "find me something with a motor" -> agent issues vector search -> assembles a matched example.
- [ ] "My projects" panel on the first-run screen loads from `projects`.

## Deliverables

- The "find me something similar" flow works end-to-end and shows the MCP call in the agent trace.

## Exit criteria

- Commit on `main` titled `feat(phase-4): mongodb mcp with vector search and project persistence`.
