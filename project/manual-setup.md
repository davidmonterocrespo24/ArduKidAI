# Manual setup tracker

Things only the user can do. Claude cannot create accounts, fill external forms, generate API keys, upload videos, or click consent buttons in the GCP console.

Update the status column as items complete. When a step produces an artifact Claude needs (project ID, connection string, etc.), paste it into the relevant phase file or into the secret manager - then mention it in chat so the agent can pick it up.

## Critical path (do these first)

| # | Task | URL | Deadline | Output Claude needs | Status |
| --- | --- | --- | --- | --- | --- |
| M1 | Sign up / sign in to Devpost and register for the hackathon | https://rapid-agent.devpost.com/ | open | Devpost username | [x] |
| M2 | Confirm a Google Cloud account (free trial or existing) | https://cloud.google.com/free | open | - | [x] |
| M3 | Submit the $100 GCP credit request form | https://forms.gle/xfv9vQzfRfNCCVbG7 | **2026-06-04** | confirmation email | [x] (credit received) |
| M4 | Create a new GCP project for ArduKid | https://console.cloud.google.com/projectcreate | before Phase 2 | project ID (paste in `backend/.env.example`) | [x] project: `ardukid-ai` |
| M5 | Enable APIs in the GCP project: Vertex AI, Cloud Run, Cloud Build, Artifact Registry, Secret Manager | https://console.cloud.google.com/apis/library | before Phase 2 | - | [x] Vertex AI confirmed (embeddings call OK); re-verify run/build/artifactregistry/secretmanager before deploy |
| M6 | Sign up for MongoDB Atlas, create an M0 cluster, create a database user | https://www.mongodb.com/cloud/atlas/register | before Phase 4 | connection string -> Secret Manager | [x] M0 on GCP, cluster0.llkmqjs, user davidmonterocrespo24_db_user |
| M7 | Configure Atlas network access (allow Cloud Run egress, or 0.0.0.0/0 for dev) | Atlas console | **NOW (Cloud Run deploy)** | - | [ ] **ACTION: add `0.0.0.0/0`** - Cloud Run has no static egress IP, so the deployed backend cannot reach Atlas without it |
| M8 | Create the Atlas Vector Search index on `examples.intent_embedding` (768 dims, cosine) | Atlas console (or skip - the seeder creates it) | before Phase 4 | - | [x] index `intent_embedding_vector` READY |
| M8b | Run the seeder once after Atlas is up: `cd backend && MONGODB_URI=... uv run python -m scripts.seed_db` | local shell | before Phase 5 | confirmation log "seeded 9 components and 30 examples" | [x] seeded 9 components + 30 examples (real Gemini embeddings) |
| M8c | (optional) Index a PDF into the RAG store: `cd backend && MONGODB_URI=... uv run python -m scripts.index_pdf path/to/file.pdf --source "Arduino UNO Guide"` | local shell | any time | confirmation log "indexed N chunks" | [ ] |

## Dev deploy (moontero.com)

| # | Task | URL | Deadline | Output Claude needs | Status |
| --- | --- | --- | --- | --- | --- |
| D1 | Clone repo on the host into a working directory | host shell | any time | path | [ ] |
| D2 | `cp .env.example .env` and set `JWT_SECRET` to a long random string (also `MONGODB_URI` if Atlas is up) | host shell | any time | - | [ ] |
| D3 | `sudo cp deploy/nginx-ardukidai.conf.sample /etc/nginx/sites-available/ardukidai && sudo ln -s /etc/nginx/sites-available/ardukidai /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx` | host shell | any time | - | [ ] |
| D4 | `sudo certbot --nginx -d ArduKidAI.moontero.com` | host shell | any time | - | [ ] |
| D5 | `docker compose up -d --build` (add `--profile mcp` once Atlas + MCP_ENABLED are wanted) | host shell | any time | - | [ ] |
| D6 | Visit https://ArduKidAI.moontero.com and click a suggestion chip; the mock agent should assemble a circuit | browser | any time | screenshot for the demo video | [ ] |

## Cloud Run deploy

Single Cloud Run service in `us-central1` (backend serves the SPA + API + arduino-cli).
Full recipe in [`deploy/cloud-run.md`](../deploy/cloud-run.md). Most of this is automated.

| # | Task | URL | Deadline | Output Claude needs | Status |
| --- | --- | --- | --- | --- | --- |
| M9 | Artifact Registry repo `ardukid` | GCP console | done | - | [x] created (us-central1) |
| M9b | Secret Manager: `ardukid-mongodb-uri`, `ardukid-jwt-secret` + SA accessor | GCP | done | - | [x] |
| M9c | Runtime SA granted `roles/aiplatform.user` | GCP | done | - | [x] |
| M10 | Atlas Network Access `0.0.0.0/0` (see M7) | Atlas console | **NOW** | - | [ ] **ACTION** |
| M11 | (Optional) Custom domain mapping for the Cloud Run URL | Cloud Run console | later | domain | [ ] |
| M12 | Confirm the public URL stays reachable through Jul 6 (judging) | browser | through Jul 6 | - | [ ] |

## Submission (Phase 6)

| # | Task | URL | Deadline | Output Claude needs | Status |
| --- | --- | --- | --- | --- | --- |
| M13 | Record the 3-minute demo video (with English subtitles) | local | **2026-06-09** | YouTube/Vimeo public URL | [ ] |
| M14 | Upload video to YouTube as Public | https://youtube.com | **2026-06-09** | YouTube URL | [ ] |
| M15 | Complete the Devpost submission form | https://rapid-agent.devpost.com | **2026-06-11 14:00 PT** | confirmation screenshot | [ ] |
| M16 | Verify `LICENSE` appears in the GitHub repo About section | https://github.com/davidmonterocrespo24/ArduKidAI | Phase 6 | - | [ ] |
| M17 | Verify hosted URL is reachable from a fresh browser (incognito) | hosted URL | Phase 6 | - | [ ] |

## Notes

- The `$100 credit form` deadline of **June 4, 2026** is the most time-sensitive thing on this list. Approval takes 1-5 business days. Submit before May 30 to be safe.
- The judges' verification period runs through July 6, 2026 - the hosted URL must stay up through that date, not just on June 11.
- Devpost field answers Claude has already drafted (initial idea, what would help you succeed, partner integration) live in the chat log of the assistant session, not in the repo. Re-ask the assistant if you need them again.
