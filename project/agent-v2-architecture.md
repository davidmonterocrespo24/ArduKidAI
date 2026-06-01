# ArduKid Agent v2 - Architecture and implementation analysis

Status: design approved 2026-05-31. This is the reference for phases 5-12.
All facts here are grounded in official Google / MongoDB docs (sources at the end);
where our own GCP project (`ardukid-ai`) differs from the docs, the project wins
and is flagged as "verify".

## Why v2 (the two compliance gaps + the sophistication goal)

The hackathon (MongoDB track) requires an agent "powered by Gemini **and Google
Cloud Agent Builder** that **integrates a Partner Entity's MCP server**". The v1
code has two gaps:

1. **Agent framework.** v1 is a hand-rolled function-calling loop on the raw
   `google-genai` SDK. It works and uses Gemini on Vertex (so it meets the hard
   "Google Cloud AI tools" rule), but it does not use Agent Builder / ADK. v2
   migrates to **Google ADK** (part of Vertex AI Agent Builder).
2. **MCP server.** v1 only has `MCP_ENABLED`/`MCP_SERVER_URL` settings and
   aspirational comments; there is **no MCP client**. The data tools call Motor
   directly. v2 wires a **real MongoDB MCP server** via ADK `McpToolset`.

On top of compliance, v2 makes the agent genuinely sophisticated:
**skills** (curated component know-how + project best practices), **multimodal
RAG** (PDF / link / text / image ingestion), and **web + YouTube** tools - all
Google-native so they stay within the rules.

## Decisions at a glance

| Area | Decision | Why |
| --- | --- | --- |
| Agent framework | **Google ADK** (`google-adk`, pin 2.1.x) run as a **library inside our FastAPI** | Satisfies "Agent Builder"; keeps our SSE + browser-driven tools |
| Runtime | **Cloud Run** (not managed Agent Engine) | Agent Engine breaks browser-executed tools + has a 10-min stream cap |
| Model | **Gemini 3 on Vertex, `location=global`** | Gemini 3 is global-endpoint only; confirmed `gemini-3-flash-preview` works in `ardukid-ai` |
| Embeddings | **Gemini `text-embedding-005`, 768-dim, `us-central1`** | Already working; rules forbid Voyage/other providers |
| Vector store | **MongoDB Atlas Vector Search** | Partner-track requirement; do NOT use Vertex RAG Engine (no Atlas backend) |
| Partner MCP | **`mongodb-mcp-server`** sidecar, ADK `McpToolset` over HTTP | Required integration; `aggregate` runs `$vectorSearch` with our Gemini vector |
| Browser tools | **`LongRunningFunctionTool`** (pause -> client executes -> resume) | Canvas + avr8js live in the browser |
| Web search / read | **sub-agent** with `google_search` + `url_context` via `AgentTool` | Built-in tools can't mix with function tools on one agent |
| Web fetch (raw) | plain `fetch_url` FunctionTool (httpx, no AI) | Simplest, always compliant |
| YouTube | **sub-agent**: Gemini multimodal on the YouTube URL | Google-native transcription, no third-party ASR |

## 1. Agent framework: ADK as a library in FastAPI

- Package `google-adk` (pin `2.1.x`; 2.x is a breaking change vs 1.x - ignore 1.x tutorials).
- Vertex config via env (ADK reuses the `google-genai` config we already set):
  `GOOGLE_GENAI_USE_VERTEXAI=TRUE`, `GOOGLE_CLOUD_PROJECT=ardukid-ai`,
  `GOOGLE_CLOUD_LOCATION=global`.
- Core objects: `LlmAgent(model=..., name=..., instruction=..., tools=[...])`,
  `Runner(app_name, agent, session_service)`, stream with `runner.run_async(...)`.
- We keep **our own SSE route** over `run_async` (not ADK's generic `/run_sse`) so the
  frontend's tool-call dispatcher keeps its exact wire format. Bridge each event:
  `yield f"data: {event.model_dump_json(exclude_none=True, by_alias=True)}\n\n"`.
- Event flags we use: `event.partial`, `event.turn_complete`, `event.get_function_calls()`,
  `event.get_function_responses()`, `event.long_running_tool_ids`, `event.is_final_response()`.
- Sessions: `InMemorySessionService` for the demo (note: Cloud Run scale-to-zero / multi-instance
  loses it; acceptable for the demo). No first-party MongoDB session store - if we ever need
  persistence use `DatabaseSessionService` (SQL), and keep Mongo for app data.
- Canvas state threads into tools via `tool_context: ToolContext` -> `tool_context.state`.

**Keep a mock path** (env `ARDUKID_AGENT_MODE=mock`) for hermetic tests and credential-free dev.

## 2. Tool taxonomy (the heart of v2)

```
root_agent (Gemini 3 on Vertex/global)
  # --- browser-executed (LongRunningFunctionTool: pause -> SSE -> client -> resume) ---
  add_component, remove_component, wire, set_blocks, compile_and_run
  read_sim_state (new), screenshot_canvas (new, optional)
  # --- server-executed (plain FunctionTool, run in-process) ---
  list_available_components, get_component_skill (new),
  find_similar_example, list_saved_projects, load_project, save_project, search_docs,
  fetch_url (new, httpx, no AI)
  # --- MongoDB partner MCP (ADK McpToolset over HTTP to the sidecar) ---
  (the data tools above route through MCP when MCP_ENABLED=true)
  # --- sub-agents wrapped as AgentTool (built-in-tool isolation) ---
  AgentTool(search_agent)   # tools = [google_search, url_context]
  AgentTool(youtube_agent)  # Gemini multimodal on a YouTube URL
```

### 2a. Browser interaction model (critical)
The circuit and simulator live in the browser, so the "real" execution of canvas
tools is client-side. Flow per browser tool call:
1. Agent calls e.g. `add_component`; ADK lists its id in `event.long_running_tool_ids`
   and **pauses** (does not run it server-side).
2. Our SSE pushes the `function_call` (name + args + id) to the SPA.
3. The SPA mutates the Zustand store / canvas / avr8js, then **POSTs the result back**.
4. Backend resumes `run_async` with a `types.Part(function_response=...)` carrying the
   **same call id** and the real result dict.
The backend still keeps a `SessionState` for stable id assignment and validation.

## 3. MongoDB MCP integration

- Sidecar: `npx -y mongodb-mcp-server@latest --transport http --httpHost 0.0.0.0 --httpPort 3000`,
  connection via env **`MDB_MCP_CONNECTION_STRING`** (from Secret Manager), `--readOnly` for the
  query path. Tools we use: `find`, `aggregate`, `count`, `collection-indexes`, `insert-many`,
  `update-one`. (Note: there is **no `insert-one`** - use `insert-many`.)
- ADK side: `from google.adk.tools.mcp_tool import McpToolset, StreamableHTTPConnectionParams`,
  `url="http://localhost:3000/mcp"`, `tool_filter=[...]`. Close it on FastAPI shutdown (lifespan).
- **Embeddings stay on Gemini.** Do NOT use the server's `--voyageApiKey` auto-embed (Voyage is
  banned and it's Atlas-Local only). We compute the 768-dim query vector with Gemini and pass it
  into a `$vectorSearch` stage handed to the MCP `aggregate` tool.
- **Chosen pattern (b):** keep `find_similar_example`/`list_saved_projects`/`load_project`/
  `save_project` as ADK FunctionTools, but their bodies embed with Gemini and call the MCP server
  (instead of Motor) when `MCP_ENABLED=true`; Motor remains the fallback. Least churn, keeps the
  frontend contract, still "routes all data access through the partner MCP server".
- Cloud Run: multi-container service (backend ingress + mongo-mcp sidecar), `dependsOn` + startup
  probe so the backend waits for MCP.

## 4. Skills system (component know-how + best practices)

A "skill" here = packaged domain knowledge the agent loads on demand, so it gives correct,
kid-safe, best-practice guidance instead of hallucinating wiring.

- **Component skills**: for each of the 9 catalog parts - purpose, correct wiring (pins, the 220R
  rule, etc.), a tiny block/C++ example, common mistakes, and safety notes.
- **Project playbooks**: best practices for recurring projects (traffic light, melody, sensor read,
  LCD), and "things to watch out for" (debounce, current limits, blocking delays).
- **Storage**: a `skills` collection in Atlas (structured docs), optionally also embedded into
  `knowledge_chunks` so they're reachable by RAG. Seeded idempotently like the examples.
- **Tool**: `get_component_skill(type)` (exact lookup) plus the existing `search_docs` (semantic).
  System prompt instructs the agent to consult the skill before wiring an unfamiliar part.

## 5. Multimodal RAG ingestion (PDF / link / text / image)

- One pipeline, one 768-dim text index. Generalize `knowledge.py` into `index_pdf`, `index_url`,
  `index_text`, `index_image`, all funneling into `_index_chunks -> embed_text -> Atlas`.
- **Image** -> Gemini vision returns structured JSON (summary, OCR'd text, components, keywords)
  -> embed the caption text. Keeps everything in one space (no second index).
- **URL** -> httpx + trafilatura/BeautifulSoup to extract main text -> chunk -> embed.
- **PDF** -> pypdf (have it); Gemini-native transcription fallback for scanned pages.
- **Quality**: pass `task_type=RETRIEVAL_DOCUMENT` when indexing and `RETRIEVAL_QUERY` when
  searching. Optionally migrate to `gemini-embedding-001` at `output_dimensionality=768` to keep
  the existing index.
- **Admin surface**: backend endpoints + a small in-app "Knowledge" panel to upload PDFs / paste
  links / paste text / upload images, and list/delete sources. Search runs via the MCP `aggregate`
  `$vectorSearch` path.

## 6. Web and YouTube tools (all Google-native)

- `search_agent` (sub-agent, `AgentTool`): `google_search` + `url_context` together (they co-exist).
  `url_context`: up to 20 public URLs/request; on Vertex it's experimental on `global` - **verify**.
- `fetch_url` (root FunctionTool): plain `httpx.get` of a public page; no AI, always compliant; the
  deterministic fallback for arbitrary pages.
- `youtube_agent` (sub-agent, `AgentTool`): `generate_content` with
  `Part.from_uri(file_uri="https://youtube.com/watch?v=...", mime_type="video/mp4")`. Vertex preview:
  public video, one per request. Google-native transcription -> no third-party ASR.
- A dedicated "YouTube MCP" is unnecessary (and risks a non-Google ASR); Gemini multimodal is cleaner
  and compliant.

## 7. Compliance mapping (rules -> how v2 satisfies them)

| Rule | v2 |
| --- | --- |
| Gemini + Google Cloud Agent Builder | ADK (Agent Builder) + Gemini 3 on Vertex |
| Integrate Partner MCP server | `mongodb-mcp-server` via ADK `McpToolset` (sidecar) |
| Only Google Cloud AI tools | Gemini (chat/vision/embeddings), Google Search grounding, url_context; web fetch is non-AI |
| No competing providers | No Voyage AI (Gemini embeds), no Bing/OpenAI; web fetch is a plain HTTP GET |
| Web platform, public HTTPS | Cloud Run + Firebase Hosting |
| Atlas Vector Search (partner data) | examples + knowledge_chunks vector indexes, queried via MCP `aggregate` |

## 8. Risks and open items (verify before/while building)

- **Model id**: re-probe `gemini-3.1-pro-preview` and `gemini-3.1-flash*` in `ardukid-ai`
  (`gemini-3-pro*` 404s today; `gemini-3-flash-preview` works on `global`). Pick the best
  available Gemini 3 and pin it. See [[gemini-model-availability]].
- **`url_context` on Vertex** is experimental/global - confirm it's live, else rely on `fetch_url`.
- **ADK 2.x** breaking changes - pin the version; some online snippets are 1.x.
- **LongRunningFunctionTool** has rough edges with multiple consecutive client tools and under
  `run_live` - stay on `run_async`, one client round-trip per step where possible.
- **Timeline**: submission 2026-06-11. Prioritize compliance (ADK + MCP + deploy + submission);
  treat skills/RAG/web/youtube depth as high-value but staged.

## Sources
- ADK: https://adk.dev (docs), https://github.com/google/adk-python , https://pypi.org/project/google-adk/
- ADK MCP tools: https://adk.dev/tools-custom/mcp-tools/
- ADK function tools / LongRunningFunctionTool: https://adk.dev/tools-custom/function-tools/
- google_search / url_context / limitations: https://adk.dev/integrations/google-search/ , https://cloud.google.com/vertex-ai/generative-ai/docs/url-context , https://adk.dev/tools/limitations/
- Deploy: https://adk.dev/deploy/cloud-run/ , https://cloud.google.com/run/docs/deploying-multiple-containers
- Vertex locations/models: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations
- Embeddings + task types: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings , .../task-types
- YouTube video understanding: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/video-understanding
- MongoDB MCP: https://github.com/mongodb-js/mongodb-mcp-server , https://www.mongodb.com/docs/mcp-server/tools/
