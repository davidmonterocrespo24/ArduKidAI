"""CLI entry point for seeding MongoDB Atlas with components and examples.

    cd backend
    uv run python -m scripts.seed_db

Requires `MONGODB_URI` in the environment (or in `.env`). Idempotent."""

from __future__ import annotations

import asyncio

from app.db.seed import run

if __name__ == "__main__":
    asyncio.run(run())
