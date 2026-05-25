# Velxio reference index (paths only)

The user maintains a prior personal Arduino emulator at `/home/dave/velxio`. By their explicit instruction, this repo can be **read for patterns** when solving similar problems (avr8js wiring, wokwi rendering, arduino-cli pipelines, etc).

**Do not copy code from velxio into ArduKidAI.** Hackathon rules require every line to be newly created within the contest period (May 5 - June 11, 2026), and the prior product name must never appear in this repo, the app, the video, the README, or the Devpost form.

This file is just a map. It contains no velxio source - read the files in place.

## Frontend simulation (avr8js, I2C, port wiring)

| File | What it solves |
| --- | --- |
| `frontend/src/simulation/AVRSimulator.ts` | Main avr8js orchestration: CPU boot, port listeners, timing loop. |
| `frontend/src/simulation/I2CBusManager.ts` | I2C bus simulation for LCD and other I2C peripherals. |
| `frontend/vite.config.ts` | Build-time handling of avr8js / wokwi assets. |

## Frontend wokwi-elements integration

| File | What it solves |
| --- | --- |
| `frontend/src/components/DynamicComponent.tsx` | Renders an arbitrary wokwi component from a data descriptor. |
| `frontend/src/components/ComponentPickerModal.tsx` | UI for selecting which component to drop on the canvas. |
| `frontend/src/data/examples-*.ts` | Shape of "an example circuit + program" as data. Useful reference for our `examples` MongoDB collection schema. |

## Backend (FastAPI + MCP)

| File | What it solves |
| --- | --- |
| `backend/app/` | FastAPI app layout. |
| `backend/mcp_server.py` | Reference MCP server stub. |
| `backend/mcp_sse_server.py` | SSE transport for MCP. |
| `backend/requirements.txt` | Python dependency baseline. |
| `backend/sdk/` | SDK-style abstractions to mimic. |

## Build / compilation pipeline

| File | What it solves |
| --- | --- |
| `Dockerfile.standalone` | arduino-cli inside a container, core preinstall pattern. |
| `Dockerfile.espidf-toolchain` | ESP-IDF (out of scope for ArduKid - UNO only). |
| `docker-compose.yml` | Sidecar arrangement for local dev. |

## How to use this index

When stuck on a problem ArduKid shares with velxio:

1. `cat` or `Read` the relevant velxio file.
2. Write a one-line summary of the pattern in your own words.
3. Re-implement in ArduKid from scratch using different identifiers and structure.
4. Do not commit the velxio path or any quoted snippet into ArduKid.
