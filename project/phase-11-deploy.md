# Phase 11 - Production deploy (Cloud Run + Firebase + MCP sidecar)

Priority: P0. Status: pending.
Reference: [agent-v2-architecture.md](./agent-v2-architecture.md) sections 1, 3.

## Goal

Deploy the ADK backend + MongoDB MCP sidecar to Cloud Run, and the SPA to Firebase
Hosting, behind a public HTTPS URL that stays live through the judging period
(June 22 - July 6, 2026). Reproducible via Cloud Build.

## GCP prerequisites (verify)

- [ ] APIs enabled: `aiplatform`, `run`, `cloudbuild`, `artifactregistry`, `secretmanager`
      (Vertex AI already confirmed; verify the rest).
- [ ] Artifact Registry Docker repo created.
- [ ] Secret Manager secrets: `MONGODB_URI`, `MDB_MCP_CONNECTION_STRING` (same Atlas string),
      `JWT_SECRET` (long random).
- [ ] Grant the Cloud Run runtime service account **Vertex AI User** (for Gemini) and
      **Secret Manager Secret Accessor**.
- [ ] Atlas Network Access includes `0.0.0.0/0` (Cloud Run egress is dynamic).

## Backend - Cloud Run (multi-container)

- [ ] Cloud Run **service YAML** with two containers:
  - [ ] ingress = FastAPI + ADK backend (`arduino-cli` + cores baked in; listens on `$PORT`).
  - [ ] sidecar = `mongodb-mcp-server --transport http --httpHost 0.0.0.0 --httpPort 3030 --readOnly`,
        `MDB_MCP_CONNECTION_STRING` from Secret Manager; backend reaches it at `http://localhost:3030/mcp`.
  - [ ] `dependsOn` + startup probe so the backend waits for the MCP sidecar.
- [ ] Backend env: `ARDUKID_AGENT_MODE=real`, `GOOGLE_GENAI_USE_VERTEXAI=TRUE`,
      `GOOGLE_CLOUD_PROJECT=ardukid-ai`, `GOOGLE_CLOUD_LOCATION=global` (agent),
      embeddings location `us-central1`, `MCP_ENABLED=true`, `MCP_SERVER_URL=http://localhost:3030/mcp`,
      `ARDUKID_CORS_ORIGINS=https://ardukid-ai.web.app`.
- [ ] Service settings: min instances 0, max 3, request timeout >= 300s (SSE), CPU during request.
- [ ] `cloudbuild.yaml`: build + push backend image to Artifact Registry, deploy the service.
- [ ] (Optional) Cloud Build trigger on push to `main`.

## Frontend - Firebase Hosting

- [ ] `firebase.json` + `.firebaserc` (project `ardukid-ai`).
- [ ] Build with `VITE_API_BASE=<cloud run backend url>` (frontend talks directly to Cloud Run so
      SSE streams without proxy buffering).
- [ ] Deploy `firebase deploy --only hosting`; confirm `https://ardukid-ai.web.app`.

## Data + verification

- [ ] Seed Atlas once for prod (idempotent): components + examples + skills + knowledge indexes,
      with real Gemini embeddings.
- [ ] End-to-end in prod: open the URL, "make a traffic light", confirm canvas + sim + MCP search work.
- [ ] Confirm `LICENSE` shows in the GitHub About section.
- [ ] Note the credit expires ~June 29 - keep billing enabled (scale-to-zero cost is ~$0).

## Exit criteria

- Public HTTPS URL live and working end-to-end; remains live through July 6, 2026.
- README updated with the live URL.
- Commit `feat(phase-11): production deploy on cloud run + firebase with mongodb mcp sidecar`.
