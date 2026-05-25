# ArduKid - Phase Tracker

Master tracker. Each phase has its own checklist file under `project/phase-N-*.md`. After completing a phase, mark it here and commit.

## Contest dates

- Contest period: **May 5, 2026 - June 11, 2026 14:00 PT** (18:00 GMT-3)
- $100 credit request deadline: **June 4, 2026**
- Judging period: June 22 - July 6, 2026
- Winners notified: on or about July 7, 2026

## Phases

| # | Phase | Target dates | Status | File |
| --- | --- | --- | --- | --- |
| 0 | Project bootstrap | May 25, 2026 | done | [phase-0-bootstrap.md](./phase-0-bootstrap.md) |
| 1 | Frontend base | May 27-29, 2026 | done (May 25, 2026 - ahead) | [phase-1-frontend-base.md](./phase-1-frontend-base.md) |
| 2 | Backend agent | May 30 - Jun 1, 2026 | done (May 25, 2026 - ahead) | [phase-2-backend-agent.md](./phase-2-backend-agent.md) |
| 3 | Frontend + agent integration | Jun 2-4, 2026 | done (May 25, 2026 - ahead) | [phase-3-integration.md](./phase-3-integration.md) |
| 4 | MongoDB MCP + vector search | Jun 5-6, 2026 | done (May 25, 2026 - ahead) | [phase-4-mongodb-mcp.md](./phase-4-mongodb-mcp.md) |
| 5 | Production deploy | Jun 7, 2026 | pending | [phase-5-deploy.md](./phase-5-deploy.md) |
| 6 | QA, video, submission | Jun 8-10, 2026 | pending | [phase-6-qa-submission.md](./phase-6-qa-submission.md) |

Margin day: **Jun 11, 2026** - submit on Devpost before 14:00 PT.

## Side trackers

- [`manual-setup.md`](./manual-setup.md) - things only the user can do (GCP project, $100 credit form by **June 4**, MongoDB Atlas signup, Devpost form, video upload).
- [`velxio-reference-index.md`](./velxio-reference-index.md) - paths in `/home/dave/velxio` to read for patterns. Reference only, never copy.

## Commit rules

- One commit per phase completion (minimum). Multiple incremental commits within a phase are fine.
- Every commit author must be **davidmonterocrespo24@gmail.com**.
- All commits must fall within the Contest Period (May 5 - June 11, 2026).
- Use conventional, English commit messages: `feat(phase-N): ...`, `chore(phase-N): ...`, `fix: ...`, `docs: ...`.

## Non-negotiables (do-not list)

- No LLMs other than Gemini 3 via Google Cloud (no OpenAI, Anthropic, DeepSeek, Mistral, even for utility tasks like embeddings).
- No Arduino simulators other than avr8js.
- No copy-paste from any pre-existing project. All code originates here.
- No mention of any prior personal product name (in repo, app, video, README, or Devpost submission).
- No emojis in UI, code, comments, commits, README, or video. Inline SVG only for visual symbols.
- No features beyond the MVP scope until after submission.
- No commits authored by anyone other than `davidmonterocrespo24@gmail.com`.
- No push to remote with a different git user. Always verify with `git config user.email`.
