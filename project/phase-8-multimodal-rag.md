# Phase 8 - Multimodal RAG (PDF / link / text / image)

Priority: P1. Status: pending.
Reference: [agent-v2-architecture.md](./agent-v2-architecture.md) section 5.

## Goal

Let users feed the agent knowledge from Arduino docs and tutorials in any form -
PDFs, web links, raw text, and images - all embedded with Gemini and stored in
MongoDB Atlas (one 768-dim text index), searchable via the MCP `$vectorSearch` path.

## Tasks

- [ ] Generalize `knowledge.py` into `index_pdf`, `index_url`, `index_text`, `index_image`,
      all funneling into `_index_chunks -> embed_text -> Atlas` (add a `kind` field per doc).
- [ ] **Image** ingest: Gemini vision -> structured JSON (summary, OCR'd text, components, keywords)
      via `response_schema` -> embed the caption text.
- [ ] **URL** ingest: httpx + trafilatura/BeautifulSoup -> main text -> `chunk_plain_text` -> embed.
- [ ] **PDF** ingest: keep pypdf; add Gemini-native transcription fallback for scanned/low-text pages.
- [ ] Embedding quality: pass `task_type=RETRIEVAL_DOCUMENT` (index) and `RETRIEVAL_QUERY` (search);
      optionally move to `gemini-embedding-001` at `output_dimensionality=768`.
- [ ] Backend endpoints to add/list/delete knowledge sources; ensure the `knowledge_chunks` vector
      index exists (seeder already attempts it).
- [ ] Frontend "Knowledge" panel: upload PDF / paste link / paste text / upload image; list + delete.
- [ ] Wire `search_docs` to the same MCP `aggregate` `$vectorSearch` path.

## Exit criteria

- A user can upload a PDF, a link, a text snippet, and an image; the agent then answers a question
  using `search_docs` with a correct citation (source + page/url).
- Commit `feat(phase-8): multimodal rag ingestion (pdf, link, text, image)`.
