"""A MongoDB-backed ADK MemoryService for long-term, cross-session memory.

Each conversation is summarized into one memory document (the turn-by-turn
transcript) embedded with Gemini (768 dims) and stored in `agent_memory`,
scoped by user. `search_memory` runs an Atlas `$vectorSearch` filtered to the
user so the agent (via the `load_memory` tool) can recall relevant things the
child said or built in earlier chats. Reuses the same embedding + vector-search
stack as the document RAG.

Degrades gracefully: with no Atlas, or before the vector index is READY,
search just returns nothing and the agent proceeds without recall."""

from __future__ import annotations

import contextlib
import re
import time

from google.adk.memory.base_memory_service import BaseMemoryService, SearchMemoryResponse
from google.adk.memory.memory_entry import MemoryEntry
from google.adk.sessions.session import Session
from google.genai import types

from ..db.client import COLLECTION_AGENT_MEMORY, get_db
from ..services.embeddings import cosine, embed_text

MEMORY_VECTOR_INDEX = "agent_memory_vector"

_BOARD_NOTE_RE = re.compile(r"^\[Canvas board:.*?\]\n\n", re.DOTALL)


def _session_text(session: Session) -> str:
    lines: list[str] = []
    for e in session.events:
        content = getattr(e, "content", None)
        if not content or not content.parts:
            continue
        text = "".join(p.text or "" for p in content.parts).strip()
        if not text:
            continue
        is_user = getattr(e, "author", "") == "user"
        if is_user:
            text = _BOARD_NOTE_RE.sub("", text).strip()
            if not text:
                continue
        lines.append(f"{'Child' if is_user else 'Tutor'}: {text}")
    return "\n".join(lines)


class MongoMemoryService(BaseMemoryService):
    async def add_session_to_memory(self, session: Session) -> None:
        text = _session_text(session)
        if not text.strip():
            return
        db = get_db()
        if db is None:
            return
        embedding = await embed_text(text[:8000], task_type="RETRIEVAL_DOCUMENT")
        doc = {
            "_id": f"{session.app_name}::{session.user_id}::{session.id}",
            "app_name": session.app_name,
            "user_id": session.user_id,
            "session_id": session.id,
            "text": text,
            "embedding": embedding,
            "updated_at": time.time(),
        }
        with contextlib.suppress(Exception):
            await db[COLLECTION_AGENT_MEMORY].replace_one({"_id": doc["_id"]}, doc, upsert=True)

    async def search_memory(
        self, *, app_name: str, user_id: str, query: str
    ) -> SearchMemoryResponse:
        """Rank the user's stored conversations by cosine similarity to the
        query, computed in Python. This needs only a plain find (no Atlas Search
        index), so it works on the free tier where search-index slots are
        capped, while staying scoped to the user."""
        if not query.strip():
            return SearchMemoryResponse()
        db = get_db()
        if db is None:
            return SearchMemoryResponse()
        try:
            qvec = await embed_text(query, task_type="RETRIEVAL_QUERY")
            scored: list[tuple[float, str]] = []
            cursor = db[COLLECTION_AGENT_MEMORY].find(
                {"app_name": app_name, "user_id": user_id},
                {"text": 1, "embedding": 1, "_id": 0},
            ).limit(200)
            async for d in cursor:
                emb = d.get("embedding")
                if emb:
                    scored.append((cosine(qvec, emb), d.get("text", "")))
            scored.sort(key=lambda x: x[0], reverse=True)
            return SearchMemoryResponse(
                memories=[
                    MemoryEntry(
                        author="memory",
                        content=types.Content(role="model", parts=[types.Part(text=t)]),
                    )
                    for _, t in scored[:5]
                    if t
                ]
            )
        except Exception:
            return SearchMemoryResponse()


_SINGLETON: MongoMemoryService | None = None


def get_memory_service() -> MongoMemoryService:
    global _SINGLETON
    if _SINGLETON is None:
        _SINGLETON = MongoMemoryService()
    return _SINGLETON
