"""RAG knowledge store. PDF chunks live in MongoDB; queries are answered with
Atlas Vector Search when Mongo is connected, or with an in-process index for
local dev.

The agent reaches this through the `search_docs` tool. Indexing is a separate
admin operation (see `scripts/index_pdf.py`)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from ..config import get_settings
from ..db.client import COLLECTION_KNOWLEDGE, get_db
from . import knowledge_files, mcp_client
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


async def _upsert_chunk(db, doc_id: str, doc: dict, *, attempts: int = 5) -> None:
    """Upsert one chunk, retrying transient Atlas/DNS hiccups with backoff.

    Long ingests can span a flaky DNS window; a single failed write should not
    abort hundreds of already-embedded chunks."""
    import asyncio

    from pymongo.errors import PyMongoError

    last: Exception | None = None
    for attempt in range(attempts):
        try:
            await db[COLLECTION_KNOWLEDGE].update_one(
                {"_id": doc_id}, {"$set": doc}, upsert=True
            )
            return
        except PyMongoError as exc:
            last = exc
            await asyncio.sleep(min(2**attempt, 8))
    if last is not None:
        raise last


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
            await _upsert_chunk(
                db,
                doc_id,
                {
                    "_id": doc_id,
                    "source": source,
                    "page": ch.page,
                    "chunk_index": ch.chunk_index,
                    "text": ch.text,
                    "embedding": embedding,
                },
            )
        written += 1
    return written


async def index_pdf_path(path: str, source: str) -> int:
    with open(path, "rb") as fh:
        await knowledge_files.store_file(source, "application/pdf", fh.read())
    chunks = chunk_pdf_path(path)
    return await _index_chunks(source, chunks)


async def index_pdf_bytes(data: bytes, source: str) -> int:
    await knowledge_files.store_file(source, "application/pdf", data)
    chunks = chunk_pdf_bytes(data)
    return await _index_chunks(source, chunks)


async def index_plain_text(text: str, source: str) -> int:
    chunks = chunk_plain_text(text)
    return await _index_chunks(source, chunks)


async def index_document_bytes(data: bytes, filename: str, source: str) -> int:
    """Index a Word/PowerPoint/Excel/HTML/EPUB/... document by converting it to
    Markdown with markitdown, then chunking like any other text. PDFs and images
    have their own (page-aware / vision) paths."""
    import mimetypes

    from .doc_extract import extract_markdown

    text = extract_markdown(data, filename)
    if not text.strip():
        return 0
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    await knowledge_files.store_file(source, content_type, data)
    return await _index_chunks(source, chunk_plain_text(text))


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
    await knowledge_files.store_file(source, mime_type, data)
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
    """Hybrid retrieval: semantic (Atlas Vector Search) + keyword, fused with
    reciprocal rank fusion. Vector search alone misses exact tokens a child
    types (pin "D13", "HC-SR04", "tone"); keyword search alone misses synonyms
    and concepts. Fusing both ranks higher-quality results to the top. This runs
    free on an Atlas M0 - it needs no extra full-text search index (so it never
    hits the M0 search-index cap) and no $rankFusion preview feature."""
    if not query.strip():
        return []
    query_vector = await embed_text(query, task_type="RETRIEVAL_QUERY")
    pool = max(limit * 3, 10)
    vector_hits = await _vector_hits(query_vector, pool)
    keyword_hits = await _keyword_hits(query, pool)
    return _rrf_fuse(vector_hits, keyword_hits, limit)


async def _vector_hits(query_vector: list[float], limit: int) -> list[KnowledgeHit]:
    if mcp_client.mcp_enabled():
        try:
            docs = await mcp_client.aggregate(COLLECTION_KNOWLEDGE, _pipeline(query_vector, limit))
            return [_to_hit(doc) for doc in docs]
        except Exception:
            # MCP sidecar unreachable: fall back to the direct Atlas driver.
            pass
    db = get_db()
    if db is None:
        return _memory_search(query_vector, limit)
    return await _atlas_search(db, query_vector, limit)


# Drop noise words and tiny tokens so the keyword arm matches on meaningful
# terms (component names, pins, function names) rather than "how"/"the".
_STOPWORDS = frozenset(
    ["a", "an", "and", "are", "as", "at", "be", "by", "do", "does", "for", "from", "how", "i", "in", "is", "it", "my", "of", "on", "or", "that", "the", "this", "to", "use", "using", "want", "what", "when", "where", "which", "why", "with", "you", "your", "make", "build"]
)


def _terms(query: str) -> list[str]:
    out: list[str] = []
    for tok in re.findall(r"[a-z0-9]+", query.lower()):
        if (len(tok) >= 3 and tok not in _STOPWORDS) or any(ch.isdigit() for ch in tok):
            out.append(tok)
    # De-duplicate, keep order, cap so the regex stays small.
    seen: set[str] = set()
    uniq = [t for t in out if not (t in seen or seen.add(t))]
    return uniq[:8]


def _score_keyword(docs: list[dict], terms: list[str], limit: int) -> list[KnowledgeHit]:
    scored: list[tuple[int, KnowledgeHit]] = []
    for doc in docs:
        text = str(doc.get("text", "")).lower()
        score = sum(1 for t in terms if t in text)
        if score:
            scored.append((score, _to_hit(doc)))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [hit for _, hit in scored[:limit]]


def _keyword_pipeline(regex: str, limit: int) -> list[dict]:
    return [
        {"$match": {"text": {"$regex": regex, "$options": "i"}}},
        {"$limit": limit},
        {"$project": {"_id": 1, "source": 1, "page": 1, "text": 1}},
    ]


async def _keyword_hits(query: str, limit: int) -> list[KnowledgeHit]:
    terms = _terms(query)
    if not terms:
        return []
    regex = "|".join(re.escape(t) for t in terms)
    # Pull a wider candidate pool, then rank by how many distinct terms matched.
    candidate_limit = limit * 4
    if mcp_client.mcp_enabled():
        try:
            docs = await mcp_client.aggregate(
                COLLECTION_KNOWLEDGE, _keyword_pipeline(regex, candidate_limit)
            )
            return _score_keyword(docs, terms, limit)
        except Exception:
            pass
    db = get_db()
    if db is None:
        return _memory_keyword(terms, limit)
    docs = [doc async for doc in db[COLLECTION_KNOWLEDGE].aggregate(_keyword_pipeline(regex, candidate_limit))]
    return _score_keyword(docs, terms, limit)


def _memory_keyword(terms: list[str], limit: int) -> list[KnowledgeHit]:
    docs = [
        {"_id": e.id, "source": e.source, "page": e.page, "text": e.text}
        for e in _MEMORY_STORE.entries
    ]
    return _score_keyword(docs, terms, limit)


def _rrf_fuse(
    vector_hits: list[KnowledgeHit], keyword_hits: list[KnowledgeHit], limit: int, k: int = 60
) -> list[KnowledgeHit]:
    """Reciprocal rank fusion: a doc's score is the sum of 1/(k + rank) across
    the lists it appears in, so items ranked highly by either arm - and
    especially by both - rise to the top."""
    scores: dict[str, float] = {}
    hits: dict[str, KnowledgeHit] = {}
    for ranked in (vector_hits, keyword_hits):
        for rank, hit in enumerate(ranked):
            scores[hit.id] = scores.get(hit.id, 0.0) + 1.0 / (k + rank + 1)
            hits.setdefault(hit.id, hit)
    order = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    out: list[KnowledgeHit] = []
    for doc_id, score in order:
        hit = hits[doc_id]
        hit.score = float(score)
        out.append(hit)
    return out


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


_URL_RE = re.compile(r"https?://[^\s)]+")


def _classify(source: str, file_content_types: dict[str, str]) -> dict:
    """Tell the UI how to handle a source: preview a stored file (image/pdf/
    document), open a link, or just text."""
    content_type = file_content_types.get(source)
    if content_type:
        if content_type.startswith("image/"):
            kind = "image"
        elif content_type == "application/pdf":
            kind = "pdf"
        else:
            kind = "document"
        return {"kind": kind, "content_type": content_type}
    match = _URL_RE.search(source)
    if match:
        return {"kind": "link", "url": match.group(0).rstrip(").,")}
    return {"kind": "text"}


async def list_sources() -> list[dict]:
    """Return one row per indexed source with its chunk count and how to view it
    (kind: image | pdf | document | link | text, plus content_type or url)."""
    file_content_types = await knowledge_files.file_content_types()
    db = get_db()
    if db is None:
        counts: dict[str, int] = {}
        for entry in _MEMORY_STORE.entries:
            counts[entry.source] = counts.get(entry.source, 0) + 1
        rows = [{"source": s, "chunks": n} for s, n in sorted(counts.items())]
    else:
        pipeline = [
            {"$group": {"_id": "$source", "chunks": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
        ]
        rows = []
        async for row in db[COLLECTION_KNOWLEDGE].aggregate(pipeline):
            rows.append({"source": row["_id"], "chunks": int(row["chunks"])})
    for row in rows:
        row.update(_classify(row["source"], file_content_types))
    return rows


async def get_source_text(source: str) -> str:
    """Reassemble a source's indexed text from its chunks (in order), so the UI
    can preview a plain-text note (which has no original file to render)."""
    db = get_db()
    if db is None:
        entries = sorted((e for e in _MEMORY_STORE.entries if e.source == source), key=lambda e: e.id)
        return "\n\n".join(e.text for e in entries)
    cursor = (
        db[COLLECTION_KNOWLEDGE]
        .find({"source": source}, {"text": 1, "chunk_index": 1})
        .sort("chunk_index", 1)
    )
    return "\n\n".join([doc.get("text", "") async for doc in cursor])


async def delete_source(source: str) -> int:
    """Remove every chunk for a source. Returns the number deleted."""
    await knowledge_files.delete_file(source)
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
