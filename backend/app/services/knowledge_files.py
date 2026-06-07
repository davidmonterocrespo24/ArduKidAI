"""Original-file store for the knowledge base, so the UI can preview a source.

The RAG store keeps only the extracted text + embeddings. To let the Knowledge
modal show the actual PDF, image, or Office document, we also keep the original
bytes here, in GridFS (handles files of any size) keyed by the source label. A
small endpoint streams them back; the frontend renders images/PDFs directly and
hands Office documents to the Microsoft Office Online viewer.

Falls back to an in-memory dict when there is no MongoDB (tests / offline dev)."""

from __future__ import annotations

from ..db.client import get_db

_BUCKET = "knowledge_files"
# source -> (content_type, data) when no Mongo is available.
_MEMORY_FILES: dict[str, tuple[str, bytes]] = {}


def _bucket():
    db = get_db()
    if db is None:
        return None
    from motor.motor_asyncio import AsyncIOMotorGridFSBucket

    return AsyncIOMotorGridFSBucket(db, bucket_name=_BUCKET)


async def store_file(source: str, content_type: str, data: bytes) -> None:
    """Save (or replace) the original bytes for a source."""
    bucket = _bucket()
    if bucket is None:
        _MEMORY_FILES[source] = (content_type, data)
        return
    await delete_file(source)  # replace any previous upload for this source
    await bucket.upload_from_stream(source, data, metadata={"content_type": content_type})


async def get_file(source: str) -> tuple[str, bytes] | None:
    """Return (content_type, data) for a source, or None if nothing is stored."""
    bucket = _bucket()
    if bucket is None:
        return _MEMORY_FILES.get(source)
    db = get_db()
    doc = await db[f"{_BUCKET}.files"].find_one({"filename": source}, sort=[("uploadDate", -1)])
    if not doc:
        return None
    stream = await bucket.open_download_stream(doc["_id"])
    data = await stream.read()
    content_type = (doc.get("metadata") or {}).get("content_type", "application/octet-stream")
    return content_type, data


async def delete_file(source: str) -> None:
    bucket = _bucket()
    if bucket is None:
        _MEMORY_FILES.pop(source, None)
        return
    db = get_db()
    async for doc in db[f"{_BUCKET}.files"].find({"filename": source}):
        await bucket.delete(doc["_id"])


async def file_content_types() -> dict[str, str]:
    """Map of source -> stored content_type, so list_sources can tell the UI
    which rows are previewable and what kind they are."""
    db = get_db()
    if db is None:
        return {source: ct for source, (ct, _) in _MEMORY_FILES.items()}
    out: dict[str, str] = {}
    async for doc in db[f"{_BUCKET}.files"].find({}, {"filename": 1, "metadata": 1}):
        out[doc["filename"]] = (doc.get("metadata") or {}).get("content_type", "application/octet-stream")
    return out


def memory_reset() -> None:
    """Test helper."""
    _MEMORY_FILES.clear()
