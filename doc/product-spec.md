# Product Specification - ArduKid

## 1. Product in one sentence

A web mini-IDE where an AI agent assembles Arduino UNO circuits and generates block-based code from a natural-language description, designed for kids aged 8 to 14.

## 2. Vision and target audience

- **User:** kids aged 8-14 at home or in robotics classes.
- **Problem:** Wokwi and Tinkercad assume the kid already knows which component to pick and how to wire it. The barrier to entry is high.
- **Solution:** the kid types "I want a traffic light" and the agent picks components, wires them, generates Blockly blocks, compiles to C++, and runs the simulation. The kid can later edit blocks or request changes via chat.
- **Hackathon differentiator:** an agent that executes tasks in a simulated "physical" world, not another chatbot. Hits Quality of Idea and Potential Impact (STEM education).

## 3. Hackathon constraints (binding)

| Constraint | Detail |
| --- | --- |
| LLM | Gemini 3 only, via Google Cloud. No OpenAI / Anthropic / others. |
| Orchestration | Google Cloud Agent Builder required. |
| Partner MCP | MongoDB Atlas via the MongoDB MCP server. |
| Platform | Web (no mobile). |
| License | OSI-approved, visible in About. We use MIT. |
| Hosting | Public HTTPS URL, accessible to judges. |
| Video | 3 minutes max, YouTube/Vimeo, English (or English subtitles). |
| Code | All new, created within the contest period (May 5 - June 11, 2026). Zero copy-paste from prior projects. |
| Name | No reuse of any previous personal product names anywhere (repo, UI, video). |

## 4. Technical stack

### Frontend

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui for components
- Blockly 11 with a custom C++ generator (based on `@blockly/arduino` or by forking BlocklyDuino blocks)
- `wokwi-elements` (BSD-3, https://github.com/wokwi/wokwi-elements) - SVG web components for LED, button, servo, LCD, etc.
- `avr8js` (MIT, https://github.com/wokwi/avr8js) - AVR emulator for the Arduino UNO, runs in the browser
- Monaco editor (read-only) for the C++ view
- Zustand for state management
- TanStack Query for fetching

### Backend

- Python 3.12 + FastAPI
- `google-cloud-aiplatform` + Agent Builder SDK
- `mongodb-mcp-server` (official MongoDB MCP) running as a sidecar
- `pymongo` + `motor` (async)
- `arduino-cli` inside the container for C++ to HEX compilation

### GCP infrastructure

- Cloud Run for the backend (FastAPI + arduino-cli)
- Cloud Run or Firebase Hosting for the static frontend
- Secret Manager for API keys (MongoDB connection string, etc.)
- Artifact Registry for Docker images
- MongoDB Atlas M0 (free tier, enough for the demo)
- Cloud Build for CI

## 5. Architecture

```
[Browser SPA]
  - Left sidebar: chat with agent (SSE streaming)
  - Center: canvas with wokwi-elements (drag/drop is locked; agent assembles everything)
  - Right tabs: Blockly editor | C++ view (Monaco read-only)
  - Footer: Run | Stop | Reset | Save
  - avr8js runs the HEX directly in the browser (no simulation backend)
       |
       v HTTPS
[Cloud Run: FastAPI]
  - POST /api/agent/chat (SSE streaming)
  - POST /api/compile (Blockly XML or C++ to HEX via arduino-cli)
  - GET/POST /api/projects (CRUD)
  - GET /api/examples/search?q=... (proxy to vector search)
       |
       v
[Agent Builder + Gemini 3]
  - Custom tools (defined in code): add_component, wire, set_blocks, ...
  - MCP client -> [MongoDB MCP server] -> [MongoDB Atlas]
                                            - examples (vector search)
                                            - projects (per user)
                                            - components_catalog
```

## 6. The agent - complete definition

### System prompt (summary)

- Speaks Spanish by default, switches to the user's language.
- Friendly tone for kids, short sentences, minimal technical jargon.
- **Before** calling a tool, explains in one sentence what it will do ("I'm going to add a LED and a button, and connect them to pins 7 and 2").
- If the request is ambiguous, asks **one** specific question ("What color do you want the LED?").
- If the request is not feasible with UNO + available components, says so and proposes an alternative.
- Never invents components that are not in `components_catalog`.

### Agent custom tools (defined in backend)

| Tool | Arguments | Effect |
| --- | --- | --- |
| `list_available_components()` | - | Returns the catalog from MongoDB |
| `add_component(type, x, y)` | type from catalog | Adds to canvas |
| `remove_component(id)` | id in canvas | Removes |
| `wire(from_pin, to_pin)` | two refs `componentId.pinName` | Creates wire |
| `set_blocks(blockly_xml)` | valid XML | Replaces program |
| `compile_and_run()` | - | Blockly -> C++ -> HEX -> load into avr8js |
| `save_project(name)` | - | Persists to MongoDB |

### Tools via MongoDB MCP

The agent also accesses the MongoDB MCP server to:

- `find` on `examples` (search by tags or title)
- `vector_search` on `examples.intent_embedding` (semantic search for similar projects - this is the partner "wow")
- `find` / `insert` on `projects` for save and recall

## 7. Arduino components - initial library (MVP)

Only these 9 elements. Do not add more before the deadline.

| Component | wokwi-element | Typical use |
| --- | --- | --- |
| Arduino UNO | `wokwi-arduino-uno` | Base board, always present |
| LED | `wokwi-led` | `color` property (red, green, blue, yellow) |
| Resistor | `wokwi-resistor` | 220 ohm, auto-added with LEDs |
| Pushbutton | `wokwi-pushbutton` | Internal pull-up by default |
| Buzzer | `wokwi-buzzer` | Passive, for tones |
| Servo SG90 | `wokwi-servo` | 0 to 180 degrees |
| Potentiometer | `wokwi-potentiometer` | Connected to A0 by default |
| LCD 16x2 I2C | `wokwi-lcd1602` | SDA/SCL on A4/A5 |
| 7-segment display | `wokwi-7segment` | Single-digit display |

## 8. MongoDB Atlas - schema and data

### Collection `examples` (pre-loaded with ~30 examples)

```json
{
  "_id": "ObjectId",
  "title": "Three-LED traffic light",
  "intent_text_en": "traffic light with red, yellow, green LEDs",
  "intent_text_es": "semaforo con LEDs rojo, amarillo y verde",
  "intent_embedding": [768 floats],
  "components": [{"type": "led", "id": "L1", "props": {"color": "red"}}],
  "wires": [{"from": "L1.anode", "to": "UNO.7"}],
  "blockly_xml": "<xml>...</xml>",
  "cpp_code": "void setup() {...}",
  "tags": ["traffic", "leds", "timing"],
  "difficulty": 2
}
```

### Vector search index

```json
{
  "fields": [{
    "type": "vector",
    "path": "intent_embedding",
    "numDimensions": 768,
    "similarity": "cosine"
  }]
}
```

### Collections `projects` and `components_catalog`

- `projects`: per-user saved projects (anonymous via fingerprint or Google Sign-In).
- `components_catalog`: specs of the 9 components (pins, properties, defaults). The agent reads this before wiring.

## 9. UI/UX - key flows

### Flow 1: kid opens the app for the first time

1. Centered chat screen with 4 clickable chips: "Turn on a LED", "Button that turns on a light", "Traffic light", "Play a melody".
2. Click -> agent assembles everything in 3-5 seconds -> simulation runs automatically.
3. Floating tooltip: "Try pressing the button in the simulation".

### Flow 2: kid asks for something new

- "Make it blink faster" -> agent edits the `delay` block, recompiles, keeps running.
- "Add a buzzer" -> adds component, wires it, adds blocks.

### Flow 3: view the C++ code

- "Arduino Code" tab with Monaco read-only.
- Top banner: "This is what your Arduino understands".
- "Copy" button so the kid can take it to a real Arduino.

### Flow 4: save and return

- "Save" button prompts for a name -> saved to MongoDB.
- The initial screen shows "My projects" below the suggestions.

## 10. Devpost submission deliverables

1. Public GitHub repo with:
   - `LICENSE` (MIT) visible in About
   - `README.md` in English with: what it does, demo URL, video URL, architecture, how to run locally, stack
   - Tags: `gemini`, `mongodb`, `google-cloud`, `agent-builder`, `arduino`, `blockly`, `education`, `hackathon`
2. Deployed app with a public HTTPS URL.
3. Public 3-minute YouTube video:
   - 0:00-0:20: the problem (kid staring at an Arduino with no idea what to do)
   - 0:20-1:30: main flow demo (traffic light from chat)
   - 1:30-2:20: modification flow + vector search demo ("find me something similar")
   - 2:20-2:50: architecture (10-second diagram) + why MongoDB MCP
   - 2:50-3:00: CTA
4. Complete Devpost form with screenshots, long description, lessons learned.

## 11. Suggested timeline (17 days, May 25 - June 11)

| Days | Block | Deliverable |
| --- | --- | --- |
| May 25-26 | Setup | Repos, GCP project, Atlas cluster, $100 credit approved, empty Cloud Run up |
| May 27-29 | Frontend base | Canvas with LED + UNO + button, minimal Blockly, avr8js running a hardcoded HEX |
| May 30 - Jun 1 | Backend agent | FastAPI + Agent Builder + the 7 tools, tested via curl/HTTP |
| Jun 2-4 | Integration | Frontend talks to agent, tool calls apply to canvas live, all 9 components ready |
| Jun 5-6 | MongoDB MCP | 30 examples seeded with embeddings, vector search working, save/load |
| Jun 7 | Production deploy | Cloud Run + Firebase Hosting, HTTPS domain, e2e in prod |
| Jun 8 | Real-user QA | Test with a 10-year-old, take notes, fix |
| Jun 9 | Video | Record, edit, English subtitles, upload to YouTube |
| Jun 10 | Submission | Final README, Devpost form, polish |
| Jun 11 | Margin + submit before 14:00 PT (18:00 GMT-3) | - |

## 12. Do-not list

- **No** OpenAI, Anthropic, DeepSeek, Mistral - not even for auxiliary tasks (Blockly to C++ codegen, embeddings, anything). Gemini only.
- **No** other Arduino simulators (Proteus, SimulIDE, embedded Tinkercad). avr8js only.
- **No** copy-paste from any prior project. Every commit must fall within the contest period.
- **No** mention of any prior personal product name in the repo, app, video, README, or Devpost submission.
- **No** emojis in UI, code, comments, commits, README, or video. Use inline SVG for visual symbols if needed.
- **No** features outside the MVP (ESP32, extra sensors, collaborative mode, etc.), no matter how tempting. Scope is already tight.
- **No** commits before May 5, 2026. If any slip in by mistake, regenerate the repo from scratch.
- **No** direct editing of the C++ code - it is read-only. Editing happens via Blockly or chat.

## 13. Product name

**ArduKid** - direct to the audience, easy to search, kid-friendly.
