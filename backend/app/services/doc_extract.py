"""Convert office/web documents to Markdown for the RAG store, via Microsoft's
markitdown (a pure format converter, MIT licensed).

This extends ingestion beyond PDF/URL/text/image to Word, PowerPoint, Excel,
HTML, EPUB, CSV, and more, and yields clean structured Markdown (headings,
tables, lists) that chunks and embeds better than raw text dumps.

Compliance: markitdown here is used ONLY for format conversion. We never pass it
an LLM client and never enable its optional AI features (LLM image captioning,
audio transcription, Azure Document Intelligence) - embeddings stay on Gemini
and image captioning stays on our Gemini-vision path. PDFs keep using pypdf
(page-aware) so citations can still say which page a fact came from."""

from __future__ import annotations

import contextlib
import os
import tempfile
from pathlib import Path

# Formats we accept here. PDFs are handled by the page-aware pypdf path instead,
# and images by the Gemini-vision path, so they are intentionally excluded.
SUPPORTED_EXTS: frozenset[str] = frozenset(
    {".docx", ".pptx", ".xlsx", ".xls", ".html", ".htm", ".epub", ".csv", ".json", ".xml", ".md"}
)

_CONVERTER = None


def _converter():
    """One MarkItDown instance, with plugins and all AI features off."""
    global _CONVERTER
    if _CONVERTER is None:
        from markitdown import MarkItDown

        _CONVERTER = MarkItDown(enable_plugins=False)
    return _CONVERTER


def is_supported(filename: str) -> bool:
    return Path(filename).suffix.lower() in SUPPORTED_EXTS


def extract_markdown(data: bytes, filename: str) -> str:
    """Convert a document's bytes to Markdown text. markitdown selects the right
    converter from the file extension, so we write to a temp file with that
    suffix. Returns empty string if nothing could be extracted."""
    ext = Path(filename).suffix.lower() or ".txt"
    tmp_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        result = _converter().convert(tmp_path)
        return (result.text_content or "").strip()
    finally:
        if tmp_path:
            with contextlib.suppress(OSError):
                os.unlink(tmp_path)
