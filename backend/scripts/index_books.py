"""Download and index free, openly-licensed Arduino PDF books into the RAG store.

Each book is fetched once into data/, then indexed: chunked (500-word) for
retrieval AND its original PDF stored so the Knowledge modal can preview it.
Re-running is idempotent (delete + re-index per source). Only books with a clear
free / Creative-Commons license are listed; search_docs cites source + page,
which satisfies CC attribution.

Usage:
    cd backend
    uv run python -m scripts.index_books
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import httpx

from app.db.seed import _create_index
from app.services import knowledge

_DATA = Path(__file__).resolve().parents[2] / "data"

# (download url, local filename, citation label)
BOOKS: list[tuple[str, str, str]] = [
    (
        "https://archive.org/download/arduino_notebook/arduino_notebook.pdf",
        "arduino-programming-notebook.pdf",
        "Arduino Programming Notebook (Brian W. Evans, CC BY-SA)",
    ),
    (
        "https://www.programmingelectronics.com/wp-content/uploads/2017/06/"
        "Arduino-Course-for-Absolute-Beginners-V4.pdf",
        "arduino-course-absolute-beginners.pdf",
        "Arduino Course for Absolute Beginners (programmingelectronics.com, CC)",
    ),
    (
        "https://archive.org/download/UltimateArduinoHandbook_201709/Ultimate_Arduino_Handbook.pdf",
        "ultimate-arduino-handbook.pdf",
        "Ultimate Arduino Handbook (Mark Maffei, CC BY-SA)",
    ),
]


async def _ensure(url: str, filename: str) -> Path | None:
    path = _DATA / filename
    if path.is_file() and path.stat().st_size > 10_000:
        return path
    _DATA.mkdir(parents=True, exist_ok=True)
    async with httpx.AsyncClient(follow_redirects=True, timeout=180) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        path.write_bytes(resp.content)
    return path


async def main() -> int:
    for url, filename, source in BOOKS:
        try:
            path = await _ensure(url, filename)
        except Exception as exc:
            print(f"download failed ({source}): {exc}")
            continue
        if path is None or not path.read_bytes()[:5].startswith(b"%PDF"):
            print(f"skip (not a PDF): {source}")
            continue
        await knowledge.delete_source(source)
        count = await knowledge.index_pdf_path(str(path), source)
        print(f"indexed {count} chunks + stored original: {source}", flush=True)
    await _create_index(
        collection="knowledge_chunks", name=knowledge.KNOWLEDGE_VECTOR_INDEX, path="embedding"
    )
    print("done", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
