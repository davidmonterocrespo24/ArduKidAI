"""PDF text extraction + chunking for the RAG index.

We use pypdf (MIT, pure Python) so the backend container does not need
poppler or any native deps. The chunker walks the document page by page,
splits long runs of text into ~target-word chunks with a small overlap, and
records the originating page so the agent can cite it back to the kid.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from pypdf import PdfReader

_DEFAULT_CHUNK_WORDS = 220
_DEFAULT_OVERLAP_WORDS = 30
_WS_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class TextChunk:
    text: str
    page: int
    chunk_index: int


def _normalise(text: str) -> str:
    return _WS_RE.sub(" ", text).strip()


def _split_words(text: str, chunk_words: int, overlap_words: int) -> list[str]:
    words = text.split()
    if not words:
        return []
    if len(words) <= chunk_words:
        return [" ".join(words)]
    step = max(1, chunk_words - overlap_words)
    out: list[str] = []
    for start in range(0, len(words), step):
        piece = words[start : start + chunk_words]
        if not piece:
            break
        out.append(" ".join(piece))
        if start + chunk_words >= len(words):
            break
    return out


def chunk_pdf_bytes(
    data: bytes,
    *,
    chunk_words: int = _DEFAULT_CHUNK_WORDS,
    overlap_words: int = _DEFAULT_OVERLAP_WORDS,
) -> list[TextChunk]:
    reader = PdfReader_from_bytes(data)
    chunks: list[TextChunk] = []
    running_index = 0
    for page_index, page in enumerate(reader.pages, start=1):
        raw = page.extract_text() or ""
        cleaned = _normalise(raw)
        if not cleaned:
            continue
        for piece in _split_words(cleaned, chunk_words, overlap_words):
            chunks.append(TextChunk(text=piece, page=page_index, chunk_index=running_index))
            running_index += 1
    return chunks


def chunk_pdf_path(
    path: str,
    *,
    chunk_words: int = _DEFAULT_CHUNK_WORDS,
    overlap_words: int = _DEFAULT_OVERLAP_WORDS,
) -> list[TextChunk]:
    with open(path, "rb") as f:
        return chunk_pdf_bytes(f.read(), chunk_words=chunk_words, overlap_words=overlap_words)


def PdfReader_from_bytes(data: bytes) -> PdfReader:
    import io

    return PdfReader(io.BytesIO(data))


# Exported for tests that want to exercise chunking without a real PDF.
def chunk_plain_text(
    text: str,
    *,
    chunk_words: int = _DEFAULT_CHUNK_WORDS,
    overlap_words: int = _DEFAULT_OVERLAP_WORDS,
    page: int = 1,
) -> list[TextChunk]:
    cleaned = _normalise(text)
    out: list[TextChunk] = []
    for i, piece in enumerate(_split_words(cleaned, chunk_words, overlap_words)):
        out.append(TextChunk(text=piece, page=page, chunk_index=i))
    return out
