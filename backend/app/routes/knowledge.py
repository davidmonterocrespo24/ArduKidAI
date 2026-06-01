"""Knowledge base (RAG) admin endpoints.

Lets the app ingest documentation into the `knowledge_chunks` collection so the
agent's `search_docs` tool can cite it. Supports PDF, web URL, raw text, and
image sources - all embedded with Gemini (768 dims)."""

from __future__ import annotations

from typing import Annotated

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from ..services import knowledge as kb

router = APIRouter()

_MAX_UPLOAD_BYTES = 50 * 1024 * 1024


class SourceRow(BaseModel):
    source: str
    chunks: int


class IngestResult(BaseModel):
    ok: bool
    source: str
    chunks: int


class UrlIngestRequest(BaseModel):
    url: str
    source: str | None = None


class TextIngestRequest(BaseModel):
    text: str
    source: str


@router.get("", response_model=list[SourceRow])
async def list_sources() -> list[SourceRow]:
    rows = await kb.list_sources()
    return [SourceRow(**row) for row in rows]


@router.post("/url", response_model=IngestResult)
async def ingest_url(payload: UrlIngestRequest) -> IngestResult:
    try:
        count = await kb.index_url(payload.url, source=payload.source)
    except httpx.HTTPError as exc:
        raise HTTPException(400, f"could not fetch url: {exc}") from exc
    label = payload.source or payload.url
    return IngestResult(ok=count > 0, source=label, chunks=count)


@router.post("/text", response_model=IngestResult)
async def ingest_text(payload: TextIngestRequest) -> IngestResult:
    count = await kb.index_plain_text(payload.text, source=payload.source)
    return IngestResult(ok=count > 0, source=payload.source, chunks=count)


@router.post("/pdf", response_model=IngestResult)
async def ingest_pdf(
    file: Annotated[UploadFile, File()],
    source: Annotated[str | None, Form()] = None,
) -> IngestResult:
    data = await file.read()
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(413, "file too large")
    label = source or (file.filename or "uploaded.pdf")
    try:
        count = await kb.index_pdf_bytes(data, source=label)
    except Exception as exc:
        raise HTTPException(400, f"could not read pdf: {exc}") from exc
    return IngestResult(ok=count > 0, source=label, chunks=count)


@router.post("/image", response_model=IngestResult)
async def ingest_image(
    file: Annotated[UploadFile, File()],
    source: Annotated[str | None, Form()] = None,
) -> IngestResult:
    data = await file.read()
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(413, "file too large")
    label = source or (file.filename or "image")
    mime = file.content_type or "image/png"
    count = await kb.index_image(data, mime_type=mime, source=label)
    return IngestResult(ok=count > 0, source=label, chunks=count)


@router.delete("/{source:path}", response_model=dict)
async def delete_source(source: str) -> dict:
    deleted = await kb.delete_source(source)
    return {"ok": True, "deleted": deleted}
