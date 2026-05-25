# ArduKid

An AI-powered mini-IDE for Arduino UNO, designed for kids aged 8 to 14. Describe what you want to build in plain language and the agent assembles the circuit, generates the block-based program, compiles it to C++, and runs it in an in-browser AVR simulation.

Built for the [Google Cloud Rapid Agent Hackathon](https://rapid-agent.devpost.com/) in the MongoDB partner track.

## What it does

A kid types `"I want a traffic light"`. The agent:

1. Picks the components from the catalog (3 LEDs, resistors, Arduino UNO).
2. Wires them on the canvas.
3. Generates the Blockly program for the timing logic.
4. Compiles to C++ and produces a HEX file.
5. Loads the HEX into a browser-based AVR emulator and runs it.

The kid can then ask `"make it blink faster"` or `"add a buzzer"` and the agent edits the circuit and program in place. The Arduino C++ code is shown read-only so the kid can copy it to a real board.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind, shadcn/ui, Blockly 11, wokwi-elements, avr8js, Monaco.
- **Backend:** Python 3.12, FastAPI, arduino-cli.
- **AI:** Gemini 3 via Google Cloud Agent Builder.
- **Data:** MongoDB Atlas with Vector Search, accessed through the official MongoDB MCP server.
- **Infra:** Cloud Run, Firebase Hosting, Secret Manager, Artifact Registry, Cloud Build.

## Status

In active development for the contest period (May 5 - June 11, 2026). See [`project/phases.md`](./project/phases.md) for the phase tracker.

## Repository layout

```
doc/         Hackathon rules, resources, and product specification
project/     Phase-by-phase implementation plan and progress tracker
frontend/    React + Vite SPA (Phase 1+)
backend/     FastAPI agent service (Phase 2+)
infra/       GCP deployment configuration (Phase 5)
```

## License

MIT. See [LICENSE](./LICENSE).
