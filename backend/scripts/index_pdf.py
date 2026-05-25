"""Index a PDF into the knowledge_chunks collection.

Usage:
    cd backend
    uv run python -m scripts.index_pdf path/to/file.pdf --source "Arduino UNO Guide"

Requires MONGODB_URI in the environment (or .env). The script:
  1. Extracts text from each page with pypdf.
  2. Splits each page into ~220-word chunks with 30-word overlap.
  3. Generates a 768-dim Gemini embedding per chunk (or the deterministic
     fallback when GCP credentials are not present).
  4. Upserts each chunk into `knowledge_chunks` keyed by
     `<source>::<chunk_index>` so re-indexing the same source is idempotent.

A separate one-off `--ensure-index` flag (re)creates the Atlas Vector Search
index on `knowledge_chunks.embedding` (768 dims, cosine)."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

from app.db.seed import _create_index
from app.services.knowledge import KNOWLEDGE_VECTOR_INDEX, index_pdf_path


async def main_async(args: argparse.Namespace) -> int:
    if args.ensure_index:
        await _create_index(
            collection="knowledge_chunks",
            name=KNOWLEDGE_VECTOR_INDEX,
            path="embedding",
        )
        print("ensured knowledge vector index")
        return 0

    path = Path(args.pdf)
    if not path.is_file():
        print(f"error: {path} does not exist", file=sys.stderr)
        return 2
    source = args.source or path.stem
    count = await index_pdf_path(str(path), source=source)
    print(f"indexed {count} chunks from {path} as source={source!r}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Index a PDF into the RAG store.")
    parser.add_argument("pdf", nargs="?", help="Path to the PDF file.")
    parser.add_argument(
        "--source",
        help="Source label stored on every chunk. Defaults to the file stem.",
    )
    parser.add_argument(
        "--ensure-index",
        action="store_true",
        help="Only (re)create the Atlas Vector Search index and exit.",
    )
    args = parser.parse_args()
    if not args.pdf and not args.ensure_index:
        parser.error("provide a PDF path or use --ensure-index")
    raise SystemExit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    # Allow running as a module from the backend directory.
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    main()
