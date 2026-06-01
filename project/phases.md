# ArduKid - Phase Tracker

Master tracker. Each phase has its own checklist file under `project/phase-N-*.md`.
After completing a phase, mark it here and commit.

Architecture reference for phases 5-12: [`agent-v2-architecture.md`](./agent-v2-architecture.md).

## Contest dates

- Contest period: **May 5, 2026 - June 11, 2026 14:00 PT** (18:00 GMT-3)
- $100 credit request deadline: ~~June 4, 2026~~ done (credit received)
- Judging period: June 22 - July 6, 2026
- Winners notified: on or about July 7, 2026

## Phases

### v1 - shipped (custom agent, MongoDB direct)

| # | Phase | Status | File |
| --- | --- | --- | --- |
| 0 | Project bootstrap | done | [phase-0-bootstrap.md](./phase-0-bootstrap.md) |
| 1 | Frontend base | done | [phase-1-frontend-base.md](./phase-1-frontend-base.md) |
| 2 | Backend agent (custom loop) | done | [phase-2-backend-agent.md](./phase-2-backend-agent.md) |
| 3 | Frontend + agent integration | done | [phase-3-integration.md](./phase-3-integration.md) |
| 4 | MongoDB + vector search (direct) | done | [phase-4-mongodb-mcp.md](./phase-4-mongodb-mcp.md) |

### v2 - professional agent (ADK + real MCP + skills + multimodal RAG + web)

| # | Phase | Priority | Status | File |
| --- | --- | --- | --- | --- |
| 5 | Agent migration to Google ADK | P0 (compliance) | **done** | [phase-5-adk-migration.md](./phase-5-adk-migration.md) |
| 6 | MongoDB MCP server integration | P0 (compliance) | **done** | [phase-6-mongodb-mcp-integration.md](./phase-6-mongodb-mcp-integration.md) |
| 7 | Skills: component know-how + best practices | P1 | **done** | [phase-7-skills.md](./phase-7-skills.md) |
| 8 | Multimodal RAG (PDF / link / text / image) | P1 | **in progress** | [phase-8-multimodal-rag.md](./phase-8-multimodal-rag.md) |
| 9 | Web + YouTube tools (Google-native) | P2 | next | [phase-9-web-youtube-tools.md](./phase-9-web-youtube-tools.md) |
| 10 | Browser-tool hardening + UX | P1 | **done** | [phase-10-browser-tools.md](./phase-10-browser-tools.md) |
| 11 | Production deploy (Cloud Run + Firebase + MCP sidecar) | P0 | pending | [phase-11-deploy.md](./phase-11-deploy.md) |
| 12 | QA, video, Devpost submission | P0 | pending | [phase-12-qa-submission.md](./phase-12-qa-submission.md) |

Priority key: **P0** = required to comply / submit; **P1** = makes it win-worthy; **P2** = high-value stretch.

Recommended order for the remaining time: 5 -> 6 -> 10 -> 11 (a deployable, compliant ADK+MCP
build first), then 7 -> 8 -> 9 (depth), then 12 (submission). Re-deploy (11) and re-record as depth lands.

Margin day: **Jun 11, 2026** - submit on Devpost before 14:00 PT.

## Setup status (manual, see manual-setup.md)

- GCP project `ardukid-ai` + $100 credit: done. APIs: Vertex AI confirmed.
- ADC auth (local): done. MongoDB Atlas M0 (GCP/us-central1) + seeded with real Gemini embeddings: done.
- Vector search verified working. Real Gemini agent (v1 custom loop) verified working on `gemini-3-flash-preview` (global).

## Side trackers

- [`agent-v2-architecture.md`](./agent-v2-architecture.md) - the v2 design and compliance analysis.
- [`manual-setup.md`](./manual-setup.md) - things only the user can do (now: deploy console steps, video, Devpost).

## Commit rules

- One commit per phase completion (minimum). Multiple incremental commits within a phase are fine.
- Every commit author must be **davidmonterocrespo24@gmail.com**. Push after every commit.
- All commits must fall within the Contest Period (May 5 - June 11, 2026).
- Conventional English messages: `feat(phase-N): ...`, `fix: ...`, `docs: ...`.

## Non-negotiables (do-not list)

- No LLMs/embeddings other than Gemini via Google Cloud (no OpenAI, Anthropic, Voyage AI, etc.).
- No agent framework other than Google ADK / Vertex AI Agent Builder for the agent itself.
- No Arduino simulators other than avr8js.
- No vector store other than MongoDB Atlas Vector Search (no Vertex RAG Engine - it can't use Atlas).
- No copy-paste from any pre-existing project. No prior personal product name anywhere.
- No emojis in UI, code, comments, commits, README, or video. Inline SVG only.
- English only for code, comments, identifiers, docs, commits, PR/issue text.
