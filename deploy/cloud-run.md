# Cloud Run deploy (single service)

ArduKid ships as **one** Cloud Run service: the FastAPI backend serves the API,
the built SPA (at `/`), and runs `arduino-cli`. One public URL, no CORS, and the
Cloud Run request timeout covers the agent's long SSE stream (Firebase Hosting
would cut it at 60s).

Region: `us-central1`. Project: `ardukid-ai`.

## One-time setup (done)

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com aiplatform.googleapis.com secretmanager.googleapis.com

# Secrets
printf '%s' "<ATLAS_URI>"  | gcloud secrets create ardukid-mongodb-uri --data-file=-
printf '%s' "<RANDOM_JWT>" | gcloud secrets create ardukid-jwt-secret  --data-file=-

# Runtime service account (PROJECT_NUMBER-compute@developer.gserviceaccount.com)
gcloud projects add-iam-policy-binding ardukid-ai \
  --member="serviceAccount:$SA" --role="roles/aiplatform.user"
gcloud secrets add-iam-policy-binding ardukid-mongodb-uri \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding ardukid-jwt-secret \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"

# Artifact Registry
gcloud artifacts repositories create ardukid \
  --repository-format=docker --location=us-central1
```

**Atlas Network Access:** add `0.0.0.0/0` (Cloud Run egress IPs are not static).
Without this the deployed backend cannot reach Atlas.

## Build + deploy

From the repo root (the root `Dockerfile` builds the combined image):

```bash
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/ardukid-ai/ardukid/ardukid:v1 \
  --timeout=2400 .

gcloud run deploy ardukid \
  --image us-central1-docker.pkg.dev/ardukid-ai/ardukid/ardukid:v1 \
  --region us-central1 --allow-unauthenticated \
  --memory 2Gi --cpu 2 --timeout 600 --concurrency 8 \
  --set-env-vars "ARDUKID_AGENT_MODE=real,GOOGLE_CLOUD_PROJECT=ardukid-ai,GOOGLE_CLOUD_LOCATION=us-central1,ARDUKID_GEMINI_MODEL=gemini-3-flash-preview,ARDUKID_GEMINI_LOCATION=global,MONGODB_DB=ardukid,MCP_ENABLED=false" \
  --set-secrets "MONGODB_URI=ardukid-mongodb-uri:latest,JWT_SECRET=ardukid-jwt-secret:latest"
```

Re-deploy after a code change: re-run both commands (bump the image tag).

## Phase 2 - MongoDB MCP sidecar (partner integration in prod)

Flip recall + RAG to route through the official MongoDB MCP server by running it
as a Cloud Run sidecar in the same service and setting `MCP_ENABLED=true`,
`MCP_SERVER_URL=http://localhost:3030`. The backend already falls back to the
direct Atlas driver if the sidecar is unreachable.

## Verify

```bash
URL=$(gcloud run services describe ardukid --region us-central1 --format='value(status.url)')
curl "$URL/health"          # {"status":"ok","agent_mode":"real",...}
open "$URL"                  # the app loads; a suggestion chip builds a circuit
```
