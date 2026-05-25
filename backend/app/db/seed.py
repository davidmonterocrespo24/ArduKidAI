"""Atlas seeder.

Run with:

    uv run python -m scripts.seed_db

Requires MONGODB_URI to be set. The script is idempotent: existing documents
are overwritten by `_id`. It also (re)creates the Atlas Vector Search index
on `examples.intent_embedding`. The index call uses the Atlas Search admin
API exposed through the `motor` client and is a no-op against a free-tier
cluster that already has the index in place."""

from __future__ import annotations

import asyncio

from ..services.embeddings import EMBEDDING_DIMS, embed_text
from ..services.knowledge import KNOWLEDGE_VECTOR_INDEX
from .client import COLLECTION_COMPONENTS, COLLECTION_EXAMPLES, COLLECTION_KNOWLEDGE, get_db
from .seed_data import COMPONENTS_CATALOG, EXAMPLES_SEED

VECTOR_INDEX_NAME = "intent_embedding_vector"


async def seed_components() -> int:
    db = get_db()
    if db is None:
        raise RuntimeError("MONGODB_URI not set; cannot seed components catalog")
    coll = db[COLLECTION_COMPONENTS]
    for item in COMPONENTS_CATALOG:
        await coll.update_one(
            {"_id": item["type"]},
            {"$set": {**item, "_id": item["type"]}},
            upsert=True,
        )
    return len(COMPONENTS_CATALOG)


async def seed_examples() -> int:
    db = get_db()
    if db is None:
        raise RuntimeError("MONGODB_URI not set; cannot seed examples")
    coll = db[COLLECTION_EXAMPLES]
    written = 0
    for item in EXAMPLES_SEED:
        intent_for_embedding = f"{item['intent_en']} | {item['intent_es']}"
        embedding = await embed_text(intent_for_embedding)
        await coll.update_one(
            {"_id": item["id"]},
            {
                "$set": {
                    "_id": item["id"],
                    "title": item["title"],
                    "intent_text_en": item["intent_en"],
                    "intent_text_es": item["intent_es"],
                    "intent_embedding": embedding,
                    "tags": item["tags"],
                    "difficulty": item["difficulty"],
                    "cpp_hint": item.get("cpp_hint", ""),
                }
            },
            upsert=True,
        )
        written += 1
    return written


async def ensure_vector_index() -> None:
    db = get_db()
    if db is None:
        raise RuntimeError("MONGODB_URI not set; cannot create vector index")
    await _create_index(
        collection=COLLECTION_EXAMPLES,
        name=VECTOR_INDEX_NAME,
        path="intent_embedding",
    )
    await _create_index(
        collection=COLLECTION_KNOWLEDGE,
        name=KNOWLEDGE_VECTOR_INDEX,
        path="embedding",
    )


async def _create_index(*, collection: str, name: str, path: str) -> None:
    db = get_db()
    if db is None:
        return
    try:
        await db.command(
            {
                "createSearchIndexes": collection,
                "indexes": [
                    {
                        "name": name,
                        "type": "vectorSearch",
                        "definition": {
                            "fields": [
                                {
                                    "type": "vector",
                                    "path": path,
                                    "numDimensions": EMBEDDING_DIMS,
                                    "similarity": "cosine",
                                }
                            ]
                        },
                    }
                ],
            }
        )
    except Exception as exc:
        # Atlas Search index creation returns an error when an index of the
        # same name already exists. We log and continue.
        print(f"vector index {name} create skipped: {exc}")


async def run() -> None:
    components = await seed_components()
    examples = await seed_examples()
    await ensure_vector_index()
    print(f"seeded {components} components and {examples} examples")


if __name__ == "__main__":
    asyncio.run(run())
