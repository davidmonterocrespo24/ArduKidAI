# Dev deploy on a single Docker host

This is the recipe used to expose the project at `https://ArduKidAI.moontero.com` (or any wildcard subdomain pointed at the host). The same recipe works for Cloud Run later - the only piece that changes is the reverse proxy.

## Pieces

- `docker-compose.yml` at the repo root brings up three services:
  - `backend` (FastAPI + arduino-cli) on `127.0.0.1:8080`
  - `frontend` (nginx serving the built SPA) on `127.0.0.1:8081`
  - `mongo-mcp` (the official `mongodb-mcp-server` over HTTP) - **disabled by default**, opt in with the `mcp` compose profile.
- The host's nginx terminates TLS and routes `ArduKidAI.moontero.com` to the two app containers. See `deploy/nginx-ardukidai.conf.sample`.

## First-time setup

1. **Clone the repo on the host** to whatever path you like.
2. **Copy and edit env**:
   ```bash
   cp .env.example .env
   # at minimum set JWT_SECRET to a long random string
   # optionally set MONGODB_URI to the Atlas connection string
   ```
3. **Drop the nginx site**:
   ```bash
   sudo cp deploy/nginx-ardukidai.conf.sample /etc/nginx/sites-available/ardukidai
   sudo ln -s /etc/nginx/sites-available/ardukidai /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```
4. **Issue a TLS cert with Certbot**:
   ```bash
   sudo certbot --nginx -d ArduKidAI.moontero.com
   ```
   Certbot will rewrite the sample file in place to point at the issued cert.
5. **Build and start the containers**:
   ```bash
   docker compose up -d --build
   ```
6. **Verify**: visit `https://ArduKidAI.moontero.com`. The agent should answer the chat using the mock client (no GCP credentials needed).

## With MongoDB MCP server

When `MONGODB_URI` is set in `.env` and you want the agent to route through the official MCP server:

```bash
docker compose --profile mcp up -d --build
```

This adds the `mongo-mcp` sidecar. Set `MCP_ENABLED=true` in `.env` once you have verified `docker compose logs mongo-mcp` shows the server listening on `:3030`.

## Updating

```bash
git pull
docker compose up -d --build
```

The frontend container rebuilds the static bundle on every `up --build`. The backend reuses cached layers as long as `pyproject.toml`/`uv.lock` have not changed.

## Logs and health

```bash
docker compose logs -f backend
docker compose logs -f frontend
curl https://ArduKidAI.moontero.com/health
```

## Stopping

```bash
docker compose down       # stop + remove containers
docker compose down -v    # also remove anonymous volumes
```

## Cloud Run later

The same `backend/Dockerfile` works under Cloud Run. The frontend goes to Firebase Hosting (or its own Cloud Run service). The `deploy/nginx-ardukidai.conf.sample` is replaced by Google's L7 load balancer routing rules. Phase 5 of `project/phases.md` covers the migration.
