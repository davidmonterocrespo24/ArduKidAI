"""In-memory project store for phase 2. Phase 4 swaps this module's body for a
Motor (async MongoDB) implementation. Keep the public function names stable."""

import uuid
from datetime import UTC, datetime

from ..schemas import CircuitState, ProjectDetail, ProjectSummary

_PROJECTS: dict[str, ProjectDetail] = {}


def list_all() -> list[ProjectSummary]:
    return [
        ProjectSummary(id=p.id, name=p.name, created_at=p.created_at)
        for p in _PROJECTS.values()
    ]


def get(project_id: str) -> ProjectDetail | None:
    return _PROJECTS.get(project_id)


def save(*, name: str, circuit: CircuitState) -> ProjectDetail:
    project_id = uuid.uuid4().hex[:12]
    detail = ProjectDetail(
        id=project_id,
        name=name,
        created_at=datetime.now(UTC).isoformat(),
        circuit=circuit,
    )
    _PROJECTS[project_id] = detail
    return detail


def clear() -> None:
    """Test helper."""
    _PROJECTS.clear()
