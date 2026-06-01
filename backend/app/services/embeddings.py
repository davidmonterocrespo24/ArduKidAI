"""Text embeddings for the `examples.intent_embedding` vector field.

Production path uses Gemini's `text-embedding-005` (or its successor) via
google-genai against Vertex AI, producing a 768-dimensional vector that
matches the Atlas Vector Search index we create on the same field.

Local-dev fallback: a deterministic, content-aware fake embedding so unit
tests and pre-credential development can run. The fallback is intentionally
shaped like the real output (length 768, L2-normalised) so service code does
not branch on the source."""

from __future__ import annotations

import hashlib
import re

import numpy as np

from ..config import get_settings

EMBEDDING_DIMS = 768
GEMINI_EMBEDDING_MODEL = "text-embedding-005"

_WORD_RE = re.compile(r"[a-z0-9]+")


def _fake_embedding(text: str) -> list[float]:
    """Bag-of-words hashed into a 768-dim sphere.

    The same input always produces the same vector. Semantically similar
    inputs (sharing words) end up closer in cosine space than unrelated ones,
    which is enough to let the vector search demo behave sensibly without a
    Gemini API call."""

    vec = np.zeros(EMBEDDING_DIMS, dtype=np.float32)
    tokens = _WORD_RE.findall(text.lower()) or ["empty"]
    for token in tokens:
        digest = hashlib.md5(token.encode("utf-8")).digest()
        for byte_index in range(0, len(digest), 2):
            idx = int.from_bytes(digest[byte_index : byte_index + 2], "big") % EMBEDDING_DIMS
            sign = 1.0 if (digest[byte_index] & 1) == 0 else -1.0
            vec[idx] += sign
    norm = float(np.linalg.norm(vec))
    if norm == 0.0:
        vec[0] = 1.0
    else:
        vec /= norm
    return vec.tolist()


async def embed_text(text: str, *, task_type: str | None = None) -> list[float]:
    """Embed `text` into a 768-dim vector.

    `task_type` (e.g. "RETRIEVAL_DOCUMENT" when indexing, "RETRIEVAL_QUERY"
    when searching) lets Gemini produce asymmetric embeddings tuned for
    retrieval. It is ignored by the deterministic fallback."""

    settings = get_settings()
    if not settings.google_cloud_project:
        return _fake_embedding(text)

    try:
        from google import genai
        from google.genai.types import EmbedContentConfig

        client = genai.Client(
            vertexai=True,
            project=settings.google_cloud_project,
            location=settings.google_cloud_location,
        )
        config = EmbedContentConfig(
            output_dimensionality=EMBEDDING_DIMS,
            task_type=task_type,
        )
        response = await client.aio.models.embed_content(
            model=GEMINI_EMBEDDING_MODEL,
            contents=text,
            config=config,
        )
        # google-genai returns a list of Embedding objects; first one's `values`.
        embeddings = getattr(response, "embeddings", None) or []
        if embeddings and hasattr(embeddings[0], "values"):
            values = list(embeddings[0].values)
            if len(values) == EMBEDDING_DIMS:
                return values
    except Exception:
        # Fall through to the deterministic fallback - we never want embedding
        # generation to crash the app.
        pass

    return _fake_embedding(text)


def cosine(a: list[float], b: list[float]) -> float:
    va = np.asarray(a, dtype=np.float32)
    vb = np.asarray(b, dtype=np.float32)
    na = float(np.linalg.norm(va))
    nb = float(np.linalg.norm(vb))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))
