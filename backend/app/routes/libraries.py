"""Library management endpoints. Wraps `services.libraries` so the
frontend has a small REST surface for the install-library modal."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services import libraries as lib_service

router = APIRouter()


class LibraryItem(BaseModel):
    name: str
    version: str | None = None
    sentence: str | None = None
    author: str | None = None


class LibraryInstallRequest(BaseModel):
    name: str


def _to_item(summary: lib_service.LibrarySummary) -> LibraryItem:
    return LibraryItem(
        name=summary.name,
        version=summary.version,
        sentence=summary.sentence,
        author=summary.author,
    )


@router.get("", response_model=list[LibraryItem])
async def list_libraries() -> list[LibraryItem]:
    try:
        installed = await lib_service.list_installed()
    except FileNotFoundError as exc:
        raise HTTPException(503, "arduino-cli not available") from exc
    except RuntimeError as exc:
        raise HTTPException(500, str(exc)) from exc
    return [_to_item(s) for s in installed]


@router.get("/search", response_model=list[LibraryItem])
async def search_libraries(q: str = "") -> list[LibraryItem]:
    try:
        hits = await lib_service.search(q)
    except FileNotFoundError as exc:
        raise HTTPException(503, "arduino-cli not available") from exc
    except RuntimeError as exc:
        raise HTTPException(500, str(exc)) from exc
    return [_to_item(s) for s in hits]


@router.post("/install", response_model=LibraryItem)
async def install_library(payload: LibraryInstallRequest) -> LibraryItem:
    try:
        installed = await lib_service.install(payload.name)
    except FileNotFoundError as exc:
        raise HTTPException(503, "arduino-cli not available") from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(500, str(exc)) from exc
    return _to_item(installed)


@router.post("/uninstall", response_model=dict)
async def uninstall_library(payload: LibraryInstallRequest) -> dict:
    try:
        await lib_service.uninstall(payload.name)
    except FileNotFoundError as exc:
        raise HTTPException(503, "arduino-cli not available") from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(500, str(exc)) from exc
    return {"ok": True}
