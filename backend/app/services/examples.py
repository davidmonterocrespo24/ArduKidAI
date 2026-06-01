"""Example circuits service.

Query paths (first match wins):

- **MongoDB MCP server** when `MCP_ENABLED=true`: embed the query with Gemini,
  then run the `$vectorSearch` aggregation through the partner's MCP `aggregate`
  tool (the partner-track integration).
- **Atlas Vector Search via Motor** when MongoDB is connected but MCP is off.
- **In-memory fallback** for local dev: embed the query, embed each seeded
  example on the fly, and rank by cosine similarity.

All paths return the same `ExampleHit` shape so the route does not branch."""

from __future__ import annotations

from typing import Any

from ..db.client import COLLECTION_EXAMPLES, get_db
from ..db.seed import VECTOR_INDEX_NAME
from ..db.seed_data import EXAMPLES_SEED
from ..schemas import ExampleHit
from . import mcp_client
from .embeddings import cosine, embed_text


def _pipeline(query_vector: list[float], limit: int) -> list[dict[str, Any]]:
    return [
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


def _to_hit(doc: dict[str, Any]) -> ExampleHit:
    return ExampleHit(
        id=str(doc.get("_id", "")),
        title=doc.get("title", ""),
        intent=doc.get("intent_text_en", ""),
        score=float(doc.get("score", 0.0)),
    )


async def search_similar(query: str, limit: int = 5) -> list[ExampleHit]:
    if not query.strip():
        return []
    query_vector = await embed_text(query)
    if mcp_client.mcp_enabled():
        try:
            docs = await mcp_client.aggregate(COLLECTION_EXAMPLES, _pipeline(query_vector, limit))
            return [_to_hit(doc) for doc in docs]
        except Exception:
            # MCP sidecar unreachable: fall back to the direct Atlas driver so
            # recall keeps working (same Atlas Vector Search query).
            pass
    db = get_db()
    if db is None:
        return await _fallback_search(query_vector, limit)
    return await _atlas_vector_search(db, query_vector, limit)


async def _atlas_vector_search(db, query_vector, limit: int) -> list[ExampleHit]:
    out: list[ExampleHit] = []
    async for doc in db[COLLECTION_EXAMPLES].aggregate(_pipeline(query_vector, limit)):
        out.append(_to_hit(doc))
    return out


async def _fallback_search(query_vector: list[float], limit: int) -> list[ExampleHit]:
    scored: list[tuple[float, dict]] = []
    for item in EXAMPLES_SEED:
        vec = await embed_text(item["intent_en"])
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
