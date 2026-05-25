"""Example circuits service.

Two query paths:

- **Atlas Vector Search** when MongoDB is connected. Embeds the query with
  Gemini (or the deterministic fallback), then runs a `$vectorSearch`
  aggregation against the `examples.intent_embedding` index.
- **In-memory fallback** for local dev: embeds the query, embeds each seeded
  example on the fly, and ranks by cosine similarity.

Both paths return the same `ExampleHit` shape so the route does not branch."""

from __future__ import annotations

from ..db.client import COLLECTION_EXAMPLES, get_db
from ..db.seed import VECTOR_INDEX_NAME
from ..db.seed_data import EXAMPLES_SEED
from ..schemas import ExampleHit
from .embeddings import cosine, embed_text


async def search_similar(query: str, limit: int = 5) -> list[ExampleHit]:
    if not query.strip():
        return []
    query_vector = await embed_text(query)
    db = get_db()
    if db is None:
        return await _fallback_search(query_vector, limit)
    return await _atlas_vector_search(db, query_vector, limit)


async def _atlas_vector_search(db, query_vector, limit: int) -> list[ExampleHit]:
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": "intent_embedding",
                "queryVector": query_vector,
                "numCandidates": max(limit * 10, 50),
                "limit": limit,
            }
        },
        {
            "$project": {
                "_id": 1,
                "title": 1,
                "intent_text_en": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]
    out: list[ExampleHit] = []
    async for doc in db[COLLECTION_EXAMPLES].aggregate(pipeline):
        out.append(
            ExampleHit(
                id=str(doc.get("_id", "")),
                title=doc.get("title", ""),
                intent=doc.get("intent_text_en", ""),
                score=float(doc.get("score", 0.0)),
            )
        )
    return out


async def _fallback_search(query_vector: list[float], limit: int) -> list[ExampleHit]:
    scored: list[tuple[float, dict]] = []
    for item in EXAMPLES_SEED:
        intent = f"{item['intent_en']} | {item['intent_es']}"
        vec = await embed_text(intent)
        scored.append((cosine(query_vector, vec), item))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        ExampleHit(
            id=item["id"],
            title=item["title"],
            intent=item["intent_en"],
            score=float(score),
        )
        for score, item in scored[:limit]
    ]
