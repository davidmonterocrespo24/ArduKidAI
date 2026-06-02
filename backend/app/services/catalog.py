"""Component catalog. Reads from MongoDB when available, otherwise returns
the static seed list. The list of supported types is exposed as a sync
constant so it can feed agent tool JSON-schema enums at import time."""

from __future__ import annotations

from typing import Any

from ..db.client import COLLECTION_COMPONENTS, get_db
from ..db.seed_data import COMPONENTS_CATALOG

CATALOG_TYPES: list[str] = [c["type"] for c in COMPONENTS_CATALOG]


async def list_components() -> list[dict[str, Any]]:
    db = get_db()
    if db is None:
        return [dict(c) for c in COMPONENTS_CATALOG]
    docs = []
    async for doc in db[COLLECTION_COMPONENTS].find({}):
        doc.pop("_id", None)
        docs.append(doc)
    # Merge in any catalog parts not yet seeded into Atlas, so newly added
    # components (e.g. the OLED) are advertised to the agent without a re-seed.
    present = {d.get("type") for d in docs}
    for c in COMPONENTS_CATALOG:
        if c["type"] not in present:
            docs.append(dict(c))
    return docs


async def get_component(component_type: str) -> dict[str, Any] | None:
    db = get_db()
    if db is not None:
        doc = await db[COLLECTION_COMPONENTS].find_one({"_id": component_type})
        if doc is not None:
            doc.pop("_id", None)
            return doc
    return next((dict(c) for c in COMPONENTS_CATALOG if c["type"] == component_type), None)
