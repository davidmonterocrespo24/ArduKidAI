"""Index the demo knowledge sources into `knowledge_chunks`.

Indexes the bundled Arduino handbook PDF and the duino4projects project-list
pages, then ensures the Atlas Vector Search index exists.

Usage:
    cd backend
    uv run python -m scripts.index_sources            # index everything
    uv run python -m scripts.index_sources --ensure-index   # index only

Requires MONGODB_URI (and, for real Gemini embeddings, GOOGLE_CLOUD_PROJECT)
in the environment or backend/.env. Re-running is idempotent (upsert by id)."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from app.db.seed import _create_index
from app.services.knowledge import KNOWLEDGE_VECTOR_INDEX, index_pdf_path, index_url

# Repo root is two levels up from backend/scripts/.
_REPO_ROOT = Path(__file__).resolve().parents[2]
_PDF_PATH = _REPO_ROOT / "data" / "arduinoprojecthandbook.pdf"

_URLS: list[tuple[str, str]] = [
    ("https://duino4projects.com/arduino-uno-based-projects-list/", "duino4projects: UNO projects"),
    ("https://duino4projects.com/arduino-project-lists/", "duino4projects: project lists"),
    ("https://duino4projects.com/arduino-project-list-pages", "duino4projects: project pages"),
]


async def main_async(args: argparse.Namespace) -> int:
    if not args.skip_index:
        # URLs first - they are small and fast, so they land even if the long
        # PDF run later hits a transient network blip.
        for url, label in _URLS:
            print(f"indexing URL {url} ...", flush=True)
            try:
                n = await index_url(url, source=label)
                print(f"  indexed {n} chunks")
            except Exception as exc:
                print(f"  failed: {exc}", file=sys.stderr)

        if _PDF_PATH.is_file():
            print(f"indexing PDF {_PDF_PATH.name} ...", flush=True)
            try:
                n = await index_pdf_path(str(_PDF_PATH), source="Arduino Project Handbook")
                print(f"  indexed {n} chunks")
            except Exception as exc:
                print(f"  failed: {exc}", file=sys.stderr)
        else:
            print(f"warning: {_PDF_PATH} not found, skipping PDF", file=sys.stderr)

    print("ensuring knowledge vector index ...", flush=True)
    await _create_index(
        collection="knowledge_chunks",
        name=KNOWLEDGE_VECTOR_INDEX,
        path="embedding",
    )
    print("done")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Index the demo RAG sources.")
    parser.add_argument(
        "--ensure-index",
        dest="skip_index",
        action="store_true",
        help="Only (re)create the vector index, do not ingest.",
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()
