"""In-process rate limiter.

We protect the two routes that have real cost behind them:
- `POST /api/agent/chat` invokes Gemini, which is metered against the project's
  Vertex AI quota (and burns the $100 hackathon credit).
- `POST /api/compile` shells out to `arduino-cli`, which is CPU-bound and can
  pin a Cloud Run instance.

slowapi keeps counters in memory per worker. For a Cloud Run service with
small concurrency this is enough; if we ever scale to many instances we will
swap the storage to Redis."""

from slowapi import Limiter
from slowapi.util import get_remote_address

CHAT_LIMIT = "20/minute"
COMPILE_LIMIT = "40/minute"

limiter = Limiter(key_func=get_remote_address)
