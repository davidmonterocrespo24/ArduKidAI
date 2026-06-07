"""Knowledge base (RAG) admin endpoints.

Lets the app ingest documentation into the `knowledge_chunks` collection so the
agent's `search_docs` tool can cite it. Supports PDF, web URL, raw text, and
image sources - all embedded with Gemini (768 dims)."""

from __future__ import annotations

from typing import Annotated

import httpx
from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel

from ..services import knowledge as kb
from ..services import knowledge_files as kbf

router = APIRouter()

_MAX_UPLOAD_BYTES = 50 * 1024 * 1024


class SourceRow(BaseModel):
    source: str
    chunks: int
    # How the UI should show it: image | pdf | document | link | text.
    kind: str = "text"
    content_type: str | None = None
    url: str | None = None


class IngestResult(BaseModel):
    ok: bool
    source: str
    chunks: int


class SourceContent(BaseModel):
    source: str
    text: str


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


@router.post("/document", response_model=IngestResult)
async def ingest_document(
    file: Annotated[UploadFile, File()],
    source: Annotated[str | None, Form()] = None,
) -> IngestResult:
    """Ingest a Word/PowerPoint/Excel/HTML/EPUB/CSV document (converted to
    Markdown via markitdown). Use /pdf for PDFs and /image for images."""
    from ..services.doc_extract import is_supported

    data = await file.read()
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(413, "file too large")
    name = file.filename or "document"
    if not is_supported(name):
        raise HTTPException(400, f"unsupported document type: {name}. Use /pdf or /image for those.")
    label = source or name
    try:
        count = await kb.index_document_bytes(data, filename=name, source=label)
    except Exception as exc:
        raise HTTPException(400, f"could not read document: {exc}") from exc
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


@router.get("/content/{source:path}", response_model=SourceContent)
async def get_content(source: str) -> SourceContent:
    """The indexed plain text of a source, so the UI can preview a note."""
    return SourceContent(source=source, text=await kb.get_source_text(source))


@router.get("/file/{source:path}")
async def get_file(source: str) -> Response:
    """Stream the original file stored for a source (so the UI can preview a PDF,
    image, or document). Public, so an embedded document viewer can fetch it."""
    result = await kbf.get_file(source)
    if result is None:
        raise HTTPException(404, "no file stored for this source")
    content_type, data = result
    return Response(content=data, media_type=content_type)


@router.delete("/{source:path}", response_model=dict)
async def delete_source(source: str) -> dict:
    deleted = await kb.delete_source(source)
    return {"ok": True, "deleted": deleted}
