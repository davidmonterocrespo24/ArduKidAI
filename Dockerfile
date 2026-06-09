# Combined image for the single-service Cloud Run deploy: builds the SPA,
# then bundles it into the FastAPI backend (which serves it at "/") together
# with arduino-cli. The per-service backend/Dockerfile and frontend/Dockerfile
# are still used by the docker-compose dev stack; this root Dockerfile is only
# for `gcloud run deploy --source .`.

# Stage 1 - build the single-page app (same-origin API, no CORS).
FROM node:24-slim AS frontend
WORKDIR /fe
# .npmrc carries legacy-peer-deps=true for the A2UI renderer's over-strict
# peer range; copy it before `npm ci` so the lockfile resolves the same way.
COPY frontend/package.json frontend/package-lock.json frontend/.npmrc ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_BASE=""
RUN npm run build

# Stage 2 - backend + arduino-cli + the bundled SPA.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh \
       | BINDIR=/usr/local/bin sh \
    && arduino-cli core update-index \
    && arduino-cli core install arduino:avr \
    && arduino-cli lib update-index \
    && arduino-cli lib install \
       "LiquidCrystal I2C" \
       "Servo" \
       "Adafruit NeoPixel" \
       "DHT sensor library" \
       "Adafruit Unified Sensor" \
       "Adafruit GFX Library" \
       "Adafruit SSD1306" \
    && arduino-cli version

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Dependencies first so they cache when only app code changes.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

COPY backend/app ./app
COPY backend/skills ./skills
COPY --from=frontend /fe/dist ./static

ENV PATH="/app/.venv/bin:$PATH" \
    ARDUKID_STATIC_DIR=/app/static \
    PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
