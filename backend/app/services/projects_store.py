"""Project persistence. Async API. Uses MongoDB when `MONGODB_URI` is set,
otherwise an in-memory dict keyed by project id.

Projects can be saved anonymously (no user_id, scoped to a browser tab) or
attached to an authenticated user. The list/get APIs filter accordingly so
one account's projects never leak into another's first-run screen."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from ..db.client import COLLECTION_PROJECTS, get_db
from ..schemas import CircuitState, ProjectDetail, ProjectSummary
from . import mcp_client


class _MemoryEntry:
    __slots__ = ("detail", "user_id")

    def __init__(self, detail: ProjectDetail, user_id: str | None):
        self.detail = detail
        self.user_id = user_id


_MEMORY: dict[str, _MemoryEntry] = {}


def _project_id() -> str:
    return uuid.uuid4().hex[:12]


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _matches_user(entry_user: str | None, query_user: str | None) -> bool:
    return entry_user == query_user


async def list_all(user_id: str | None = None) -> list[ProjectSummary]:
    if mcp_client.mcp_enabled():
        docs = await mcp_client.find(
            COLLECTION_PROJECTS,
            filter={"user_id": user_id},
            projection={"circuit": 0},
            sort={"created_at": -1},
        )
        return [
            ProjectSummary(
                id=str(doc.get("_id")),
                name=doc.get("name", ""),
                created_at=doc.get("created_at", ""),
            )
            for doc in docs
        ]
    db = get_db()
    if db is None:
        entries = [
            e for e in _MEMORY.values() if _matches_user(e.user_id, user_id)
        ]
        entries.sort(key=lambda e: e.detail.created_at, reverse=True)
        return [
            ProjectSummary(id=e.detail.id, name=e.detail.name, created_at=e.detail.created_at)
            for e in entries
        ]
    cursor = (
        db[COLLECTION_PROJECTS]
        .find({"user_id": user_id}, {"circuit": 0})
        .sort("created_at", -1)
    )
    out: list[ProjectSummary] = []
    async for doc in cursor:
        out.append(
            ProjectSummary(
                id=str(doc.get("_id")),
                name=doc.get("name", ""),
                created_at=doc.get("created_at", ""),
            )
        )
    return out


async def get(project_id: str, user_id: str | None = None) -> ProjectDetail | None:
    if mcp_client.mcp_enabled():
        docs = await mcp_client.find(
            COLLECTION_PROJECTS, filter={"_id": project_id, "user_id": user_id}, limit=1
        )
        if not docs:
            return None
        doc = docs[0]
        return ProjectDetail(
            id=str(doc["_id"]),
            name=doc.get("name", ""),
            created_at=doc.get("created_at", ""),
            circuit=CircuitState.model_validate(doc.get("circuit", {})),
        )
    db = get_db()
    if db is None:
        entry = _MEMORY.get(project_id)
        if entry is None or not _matches_user(entry.user_id, user_id):
            return None
        return entry.detail
    doc = await db[COLLECTION_PROJECTS].find_one({"_id": project_id, "user_id": user_id})
    if doc is None:
        return None
    return ProjectDetail(
        id=str(doc["_id"]),
        name=doc.get("name", ""),
        created_at=doc.get("created_at", ""),
        circuit=CircuitState.model_validate(doc.get("circuit", {})),
    )


async def save(
    *,
    name: str,
    circuit: CircuitState,
    user_id: str | None = None,
) -> ProjectDetail:
    project_id = _project_id()
    created_at = _now()
    detail = ProjectDetail(id=project_id, name=name, created_at=created_at, circuit=circuit)

    if mcp_client.mcp_enabled():
        await mcp_client.insert_one(
            COLLECTION_PROJECTS,
            {
                "_id": project_id,
                "name": name,
                "created_at": created_at,
                "circuit": circuit.model_dump(),
                "user_id": user_id,
            },
        )
        return detail

    db = get_db()
    if db is None:
        _MEMORY[project_id] = _MemoryEntry(detail=detail, user_id=user_id)
        return detail

    await db[COLLECTION_PROJECTS].insert_one(
        {
            "_id": project_id,
            "name": name,
            "created_at": created_at,
            "circuit": circuit.model_dump(),
            "user_id": user_id,
        }
    )
    return detail


def clear() -> None:
    """Test helper. Only touches the in-memory dict."""
    _MEMORY.clear()
