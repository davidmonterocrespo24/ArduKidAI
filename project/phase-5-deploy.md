# Phase 5 - Production deploy

Target: June 7, 2026
Status: pending

## Goal

Deploy the backend and frontend to GCP behind a public HTTPS URL. Everything reproducible via Cloud Build.

## Tasks

### GCP

- [ ] Artifact Registry repository created for Docker images.
- [ ] Cloud Build trigger on push to `main` for backend image.
- [ ] Backend deployed to **Cloud Run** with:
  - [ ] MongoDB MCP server sidecar (or separate Cloud Run service).
  - [ ] `arduino-cli` baked into the image with `arduino:avr` core preinstalled.
  - [ ] Secrets pulled from Secret Manager at startup.
  - [ ] Min instances = 0, max = 3, CPU only during request, request timeout = 300s for SSE.
- [ ] Frontend deployed to **Firebase Hosting** (or Cloud Run if SSR is needed; we are pure SPA so Firebase Hosting is fine).
- [ ] Custom domain (or default `*.run.app` / `*.web.app` URL) verified HTTPS-only.

### CORS, security

- [ ] Backend CORS allows frontend origin only.
- [ ] Rate limiting on `POST /api/agent/chat` (per-IP, simple in-memory or Cloud Armor).
- [ ] Gemini safety settings reviewed (kid-safe).
- [ ] No service account keys in the repo; Cloud Run uses its default SA with least-privilege roles.

### Verification

- [ ] End-to-end run in production: open URL, type "traffic light", verify everything works.
- [ ] Load test with 10 concurrent users (light, only to confirm no cold-start issues during demo).
- [ ] Confirmed `LICENSE` is detected by GitHub and shown in the repo About section.

## Deliverables

- Public HTTPS URL accessible to judges.
- README updated with the live URL.

## Exit criteria

- The hosted URL is live and remains live through the judging period (June 22 - July 6, 2026).
- Commit on `main` titled `feat(phase-5): production deployment on cloud run + firebase hosting`.
