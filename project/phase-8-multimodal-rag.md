# Phase 8 - Multimodal RAG (PDF / link / text / image)

Priority: P1. Status: in progress (2026-06-01).
Reference: [agent-v2-architecture.md](./agent-v2-architecture.md) section 5.

## Goal

Populate the agent's knowledge base from Arduino docs so `search_docs` (RAG over
MongoDB Atlas, queried through the MCP `$vectorSearch`) returns real references.
Ingest PDFs, web links, raw text, and images - all embedded with Gemini, one
768-dim text index.

## Sources to index (for the comprehensive test)

- `data/arduinoprojecthandbook.pdf` (Arduino Project Handbook, ~18 MB) - exists.
- Project lists from duino4projects.com (link + short description per project):
  - https://duino4projects.com/arduino-project-list-pages
  - https://duino4projects.com/arduino-project-lists/
  - https://duino4projects.com/arduino-uno-based-projects-list/

## Tasks

- [x] PDF + plain-text ingestion already exist (`knowledge.index_pdf_path`, `index_plain_text`).
- [ ] `index_url(url, source)`: fetch HTML (httpx) -> extract main text (BeautifulSoup) ->
      `chunk_plain_text` -> `_index_chunks`.
- [ ] `index_image(data, source)`: Gemini vision -> structured caption/OCR -> embed the caption.
- [ ] Embedding quality: pass `task_type=RETRIEVAL_DOCUMENT` on indexing and
      `RETRIEVAL_QUERY` on search (asymmetric).
- [ ] Backend admin route `POST /api/knowledge/{pdf,url,text,image}` + list/delete; ensure the
      `knowledge_chunks` vector index exists after the first ingest.
- [ ] `scripts/index_sources.py`: index the PDF + the 3 duino4projects pages, then ensure the
      knowledge vector index. Run once against Atlas.
- [ ] (Optional) minimal in-app "Knowledge" panel to upload/list/delete sources.

## Exit criteria

- `search_docs("...")` returns relevant chunks from the PDF and duino4projects with citations.
- Commit `feat(phase-8): multimodal rag ingestion (pdf, url, text, image) + indexed sources`.
