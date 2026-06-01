# ArduKid

An AI-powered mini-IDE for the Arduino UNO, designed for kids aged 8 to 14. A
child describes what they want in plain language and an AI agent assembles the
circuit, writes a block-based program, compiles it to C++, and runs it in an
in-browser AVR simulation - no real hardware required.

Built for the [Google Cloud Rapid Agent Hackathon](https://rapid-agent.devpost.com/),
MongoDB partner track.

**Live demo:** https://ardukid-626067361949.us-central1.run.app

## What it does

A kid types `"I want a traffic light"`. The agent, in one turn:

1. Loads the relevant component skills (LED, resistor, ...) for exact pins and wiring.
2. Recalls a similar example from MongoDB Atlas Vector Search and looks up the docs (RAG).
3. Adds all the parts and wires them on the canvas in batched tool calls.
4. Writes the Blockly program and generates read-only Arduino C++.
5. Compiles to a HEX file and runs it in the browser AVR emulator.
6. Validates the circuit (loose parts, missing ground, an LED without a resistor, short circuits) and fixes what it finds.

The kid can then say `"make it blink faster"` or `"add a buzzer"` and the agent
edits the circuit and program in place. They can also attach a photo of a real
circuit to the chat, or add their own reference PDFs, web links, and notes to the
agent's knowledge base.

## Key features

- **Agent on Google ADK + Gemini 3.** A single `LlmAgent` (Agent Development Kit
  on Vertex AI) drives the whole build through structured tools, capped at 200
  tool calls per turn so it can handle complex circuits.
- **Component skills.** Filesystem skills (one per component, plus program and
  project-pattern skills) the agent activates on demand for exact pin names and
  correct wiring, so it does not guess.
- **MongoDB MCP + Atlas Vector Search (partner integration).** Example recall and
  documentation RAG run as `$vectorSearch` aggregations through the official
  `mongodb-mcp-server`. Query vectors are Gemini embeddings (768 dims), never a
  third-party provider.
- **Multimodal RAG.** Index reference PDFs, web links, pasted notes, and images
  (images are described by Gemini vision) into the knowledge base; the agent
  cites them via a `search_docs` tool.
- **Google-native web tools.** `search_web` (Google Search grounding) and
  `read_web_page` (URL context) run as ADK sub-agents; `watch_youtube` answers
  from a tutorial video - all Gemini/Google, no third-party search.
- **In-browser simulation with avr8js.** The compiled HEX runs locally on an
  emulated ATmega328P; LEDs, buzzer (tone), servo (PWM), potentiometer (ADC),
  I2C LCD, pushbutton interrupts, and the serial monitor are all live.
- **Self-correcting circuits.** A `validate_circuit` tool reports issues the
  agent must fix before telling the child the build is ready.

## Architecture

```
Browser SPA (React + Zustand + Vite)
  chat  |  agent-controlled canvas (wokwi-elements)  |  Blockly + read-only C++
  avr8js runs the HEX locally - the simulation never round-trips to the backend
        |  HTTPS / SSE
        v
FastAPI backend
  Google ADK LlmAgent (Gemini 3 on Vertex AI)
  tools: list/add/remove components, wire, set_blocks, compile_and_run,
         validate_circuit, save_project (canvas, applied in the browser)
         find_similar_example, search_docs, list/load_project (recall)
         search_web, read_web_page, watch_youtube (Google web)
  filesystem skills toolset  |  arduino-cli (Blockly XML -> C++ -> HEX)
        |                                   |
        v                                   v
  mongodb-mcp-server  ---------------->  MongoDB Atlas
  (HTTP MCP sidecar)   $vectorSearch     examples (intent_embedding, 768d)
                                         knowledge_chunks (embedding, 768d)
                                         projects, components_catalog
  embeddings: Gemini text-embedding-005 (768 dims)
```

The backend is dual-mode: every data service talks to MongoDB through the MCP
server when `MCP_ENABLED=true`, falls back to a direct Atlas driver, and finally
to an in-memory store, so local development and tests run without any cloud
credentials.

## Hackathon compliance

- **LLM:** Gemini 3 (`gemini-3-flash-preview`) via Google Cloud / Vertex AI only.
- **Embeddings:** Gemini `text-embedding-005` (768 dims) only - no Voyage AI.
- **Partner:** MongoDB Atlas Vector Search through the official MongoDB MCP server.
- **Simulator:** avr8js only.
- **Agent framework:** Google ADK (Agent Development Kit).

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Zustand, Blockly,
  `@wokwi/elements`, avr8js, Monaco.
- **Backend:** Python 3.12, FastAPI, Google ADK, google-genai, Motor (MongoDB),
  the MCP Python client, and arduino-cli.
- **Cloud:** Google Cloud (Vertex AI), MongoDB Atlas. Deployment targets Cloud
  Run + Firebase Hosting with the MCP server as a sidecar container.

## Local development

Frontend:

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Backend (requires uv and arduino-cli; runs in mock mode with no cloud creds):

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8080
```

To run the real agent, set `ARDUKID_AGENT_MODE=real`, `GOOGLE_CLOUD_PROJECT`,
and `MONGODB_URI` in `backend/.env` and authenticate with Google ADC.

### Seeding and the knowledge base

```bash
cd backend
uv run python -m scripts.seed_db          # components + example circuits (Atlas)
uv run python -m scripts.index_sources    # index reference docs into the RAG store
```

Reference sources can also be added at runtime from the in-app Knowledge panel
(PDF, web link, note, or image), or via `POST /api/knowledge/{pdf,url,text,image}`.

### Running with the MongoDB MCP server

```bash
docker compose --profile mcp up -d        # backend + frontend + mongodb-mcp-server
```

This sets `MCP_ENABLED=true` so all recall and RAG queries route through the MCP
server. See [`deploy/README.md`](./deploy/README.md) for the full recipe.

## Repository layout

```
doc/         Hackathon rules, resources, and product specification
project/     Phase-by-phase implementation plan and progress tracker
frontend/    React + Vite single-page app
backend/     FastAPI agent service (ADK, tools, services, skills)
deploy/      Docker Compose and reverse-proxy configuration
```

## License

MIT. See [LICENSE](./LICENSE).
