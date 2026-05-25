"""RAG knowledge store. PDF chunks live in MongoDB; queries are answered with
Atlas Vector Search when Mongo is connected, or with an in-process index for
local dev.

The agent reaches this through the `search_docs` tool. Indexing is a separate
admin operation (see `scripts/index_pdf.py`)."""

from __future__ import annotations

from dataclasses import dataclass, field

from ..db.client import COLLECTION_KNOWLEDGE, get_db
from .embeddings import cosine, embed_text
from .pdf_chunker import TextChunk, chunk_pdf_bytes, chunk_pdf_path

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
        embedding = await embed_text(ch.text)
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
    from .pdf_chunker import chunk_plain_text

    chunks = chunk_plain_text(text)
    return await _index_chunks(source, chunks)


async def search_docs(query: str, limit: int = 4) -> list[KnowledgeHit]:
    if not query.strip():
        return []
    query_vector = await embed_text(query)
    db = get_db()
    if db is None:
        return _memory_search(query_vector, limit)
    return await _atlas_search(db, query_vector, limit)


async def _atlas_search(db, query_vector, limit: int) -> list[KnowledgeHit]:
    pipeline = [
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
    out: list[KnowledgeHit] = []
    async for doc in db[COLLECTION_KNOWLEDGE].aggregate(pipeline):
        out.append(
            KnowledgeHit(
                id=str(doc.get("_id", "")),
                source=doc.get("source", ""),
                page=int(doc.get("page", 0)),
                text=doc.get("text", ""),
                score=float(doc.get("score", 0.0)),
            )
        )
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


def memory_reset() -> None:
    """Test helper."""
    _MEMORY_STORE.entries.clear()
