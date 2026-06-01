"""RAG knowledge store. PDF chunks live in MongoDB; queries are answered with
Atlas Vector Search when Mongo is connected, or with an in-process index for
local dev.

The agent reaches this through the `search_docs` tool. Indexing is a separate
admin operation (see `scripts/index_pdf.py`)."""

from __future__ import annotations

from dataclasses import dataclass, field

from ..config import get_settings
from ..db.client import COLLECTION_KNOWLEDGE, get_db
from . import mcp_client
from .embeddings import cosine, embed_text
from .pdf_chunker import TextChunk, chunk_pdf_bytes, chunk_pdf_path, chunk_plain_text
from .web_extract import fetch_url_text

KNOWLEDGE_VECTOR_INDEX = "knowledge_embedding_vector"


@dataclass
class KnowledgeHit:
    id: str
    source: str
    page: int
    text: str
    score: float = 0.0


@dataclass
class _InMemoryEntry:
    id: str
    source: str
    page: int
    text: str
    embedding: list[float]


@dataclass
class _MemoryStore:
    entries: list[_InMemoryEntry] = field(default_factory=list)


_MEMORY_STORE = _MemoryStore()


def _doc_id(source: str, chunk_index: int) -> str:
    return f"{source}::{chunk_index:05d}"


async def _index_chunks(source: str, chunks: list[TextChunk]) -> int:
    db = get_db()
    written = 0
    for ch in chunks:
        embedding = await embed_text(ch.text, task_type="RETRIEVAL_DOCUMENT")
        doc_id = _doc_id(source, ch.chunk_index)
        if db is None:
            _MEMORY_STORE.entries = [e for e in _MEMORY_STORE.entries if e.id != doc_id]
            _MEMORY_STORE.entries.append(
                _InMemoryEntry(
                    id=doc_id,
                    source=source,
                    page=ch.page,
                    text=ch.text,
                    embedding=embedding,
                )
            )
        else:
            await db[COLLECTION_KNOWLEDGE].update_one(
                {"_id": doc_id},
                {
                    "$set": {
                        "_id": doc_id,
                        "source": source,
                        "page": ch.page,
                        "chunk_index": ch.chunk_index,
                        "text": ch.text,
                        "embedding": embedding,
                    }
                },
                upsert=True,
            )
        written += 1
    return written


async def index_pdf_path(path: str, source: str) -> int:
    chunks = chunk_pdf_path(path)
    return await _index_chunks(source, chunks)


async def index_pdf_bytes(data: bytes, source: str) -> int:
    chunks = chunk_pdf_bytes(data)
    return await _index_chunks(source, chunks)


async def index_plain_text(text: str, source: str) -> int:
    chunks = chunk_plain_text(text)
    return await _index_chunks(source, chunks)


async def index_url(url: str, source: str | None = None) -> int:
    """Fetch a web page, extract its readable text, and index it.

    `source` defaults to the page title (or the URL) so chunks cite where they
    came from."""
    title, text = await fetch_url_text(url)
    if not text.strip():
        return 0
    label = source or title or url
    # Prefix each chunk's source with the URL so the agent can link back.
    chunks = chunk_plain_text(f"{title}\n\n{text}" if title else text)
    return await _index_chunks(f"{label} ({url})", chunks)


async def index_image(data: bytes, mime_type: str, source: str) -> int:
    """Describe an image with Gemini vision, then index the description.

    Lets a child upload a photo of a wiring diagram or a schematic and have it
    become searchable text. Falls back to indexing just the source label when
    no GCP credentials are present."""
    caption = await _caption_image(data, mime_type)
    body = f"Image: {source}\n\n{caption}".strip()
    chunks = chunk_plain_text(body)
    return await _index_chunks(source, chunks)


async def _caption_image(data: bytes, mime_type: str) -> str:
    settings = get_settings()
    if not settings.google_cloud_project:
        return ""
    try:
        from google import genai
        from google.genai.types import Part

        client = genai.Client(
            vertexai=True,
            project=settings.google_cloud_project,
            location=settings.ardukid_gemini_location,
        )
        prompt = (
            "You are indexing an image for an Arduino learning assistant. "
            "Describe it in detail for later retrieval: list every component you "
            "see, how they are wired (pins and connections), and transcribe any "
            "visible text, labels, or code. Be factual and concise."
        )
        response = await client.aio.models.generate_content(
            model=settings.ardukid_gemini_model,
            contents=[prompt, Part.from_bytes(data=data, mime_type=mime_type)],
        )
        return (response.text or "").strip()
    except Exception:
        return ""


def _pipeline(query_vector: list[float], limit: int) -> list[dict]:
    return [
        {
            "$vectorSearch": {
                "index": KNOWLEDGE_VECTOR_INDEX,
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": max(limit * 10, 50),
                "limit": limit,
            }
        },
        {
            "$project": {
                "_id": 1,
                "source": 1,
                "page": 1,
                "text": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]


def _to_hit(doc: dict) -> KnowledgeHit:
    return KnowledgeHit(
        id=str(doc.get("_id", "")),
        source=doc.get("source", ""),
        page=int(doc.get("page", 0)),
        text=doc.get("text", ""),
        score=float(doc.get("score", 0.0)),
    )


async def search_docs(query: str, limit: int = 4) -> list[KnowledgeHit]:
    if not query.strip():
        return []
    query_vector = await embed_text(query, task_type="RETRIEVAL_QUERY")
    if mcp_client.mcp_enabled():
        docs = await mcp_client.aggregate(COLLECTION_KNOWLEDGE, _pipeline(query_vector, limit))
        return [_to_hit(doc) for doc in docs]
    db = get_db()
    if db is None:
        return _memory_search(query_vector, limit)
    return await _atlas_search(db, query_vector, limit)


async def _atlas_search(db, query_vector, limit: int) -> list[KnowledgeHit]:
    out: list[KnowledgeHit] = []
    async for doc in db[COLLECTION_KNOWLEDGE].aggregate(_pipeline(query_vector, limit)):
        out.append(_to_hit(doc))
    return out


def _memory_search(query_vector: list[float], limit: int) -> list[KnowledgeHit]:
    scored: list[tuple[float, _InMemoryEntry]] = []
    for entry in _MEMORY_STORE.entries:
        scored.append((cosine(query_vector, entry.embedding), entry))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        KnowledgeHit(
            id=entry.id,
            source=entry.source,
            page=entry.page,
            text=entry.text,
            score=float(score),
        )
        for score, entry in scored[:limit]
    ]


async def list_sources() -> list[dict]:
    """Return one row per indexed source with its chunk count."""
    db = get_db()
    if db is None:
        counts: dict[str, int] = {}
        for entry in _MEMORY_STORE.entries:
            counts[entry.source] = counts.get(entry.source, 0) + 1
        return [{"source": s, "chunks": n} for s, n in sorted(counts.items())]
    pipeline = [
        {"$group": {"_id": "$source", "chunks": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    out: list[dict] = []
    async for row in db[COLLECTION_KNOWLEDGE].aggregate(pipeline):
        out.append({"source": row["_id"], "chunks": int(row["chunks"])})
    return out


async def delete_source(source: str) -> int:
    """Remove every chunk for a source. Returns the number deleted."""
    db = get_db()
    if db is None:
        before = len(_MEMORY_STORE.entries)
        _MEMORY_STORE.entries = [e for e in _MEMORY_STORE.entries if e.source != source]
        return before - len(_MEMORY_STORE.entries)
    result = await db[COLLECTION_KNOWLEDGE].delete_many({"source": source})
    return int(result.deleted_count)


def memory_reset() -> None:
    """Test helper."""
    _MEMORY_STORE.entries.clear()
