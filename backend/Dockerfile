FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Install arduino-cli plus the AVR core and the libraries every kid-level
# example here depends on. Without these the LCD / NeoPixel / Servo
# sketches fail at compile time even though the simulator can handle them.
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
    && arduino-cli version

WORKDIR /app

# Install uv to manage Python deps inside the container too.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Install dependencies first so they cache when only app code changes.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY app ./app

ENV PATH="/app/.venv/bin:$PATH" \
    PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
