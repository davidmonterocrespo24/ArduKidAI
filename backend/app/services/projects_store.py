"""Project persistence. Async API. Uses MongoDB when `MONGODB_URI` is set,
otherwise an in-memory dict keyed by project id."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from ..db.client import COLLECTION_PROJECTS, get_db
from ..schemas import CircuitState, ProjectDetail, ProjectSummary

_MEMORY: dict[str, ProjectDetail] = {}


def _project_id() -> str:
    return uuid.uuid4().hex[:12]


def _now() -> str:
    return datetime.now(UTC).isoformat()


async def list_all() -> list[ProjectSummary]:
    db = get_db()
    if db is None:
        return [
            ProjectSummary(id=p.id, name=p.name, created_at=p.created_at)
            for p in sorted(_MEMORY.values(), key=lambda x: x.created_at, reverse=True)
        ]
    cursor = db[COLLECTION_PROJECTS].find({}, {"circuit": 0}).sort("created_at", -1)
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


async def get(project_id: str) -> ProjectDetail | None:
    db = get_db()
    if db is None:
        return _MEMORY.get(project_id)
    doc = await db[COLLECTION_PROJECTS].find_one({"_id": project_id})
    if doc is None:
        return None
    return ProjectDetail(
        id=str(doc["_id"]),
        name=doc.get("name", ""),
        created_at=doc.get("created_at", ""),
        circuit=CircuitState.model_validate(doc.get("circuit", {})),
    )


async def save(*, name: str, circuit: CircuitState) -> ProjectDetail:
    project_id = _project_id()
    created_at = _now()
    detail = ProjectDetail(id=project_id, name=name, created_at=created_at, circuit=circuit)

    db = get_db()
    if db is None:
        _MEMORY[project_id] = detail
        return detail

    await db[COLLECTION_PROJECTS].insert_one(
        {
            "_id": project_id,
            "name": name,
            "created_at": created_at,
            "circuit": circuit.model_dump(),
        }
    )
    return detail


def clear() -> None:
    """Test helper. Only touches the in-memory dict."""
    _MEMORY.clear()
