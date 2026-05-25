"""Motor (async MongoDB) client wrapper.

The backend can run in two modes:

1. **No Mongo** (`MONGODB_URI=""`): in-memory stores back the catalog,
   projects, and examples services. Useful for local dev without an Atlas
   cluster, and for unit tests.
2. **Atlas-backed** (`MONGODB_URI` set): a singleton Motor client is created
   on first use and shared across the app.

We expose collection accessors as constants so service modules do not import
`motor` directly."""

from __future__ import annotations

from functools import lru_cache

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase

from ..config import get_settings


@lru_cache(maxsize=1)
def get_client() -> AsyncIOMotorClient | None:
    settings = get_settings()
    if not settings.mongodb_uri:
        return None
    return AsyncIOMotorClient(settings.mongodb_uri)


def get_db() -> AsyncIOMotorDatabase | None:
    client = get_client()
    if client is None:
        return None
    settings = get_settings()
    return client[settings.mongodb_db]


def get_collection(name: str) -> AsyncIOMotorCollection | None:
    db = get_db()
    return db[name] if db is not None else None


COLLECTION_COMPONENTS = "components_catalog"
COLLECTION_EXAMPLES = "examples"
COLLECTION_PROJECTS = "projects"
COLLECTION_KNOWLEDGE = "knowledge_chunks"
COLLECTION_USERS = "users"


def reset() -> None:
    """Test helper: drop the cached client so a new MONGODB_URI takes effect."""
    get_client.cache_clear()
