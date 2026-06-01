# Phase 7 - Skills: component know-how + best practices

Priority: P1. Status: pending.
Reference: [agent-v2-architecture.md](./agent-v2-architecture.md) section 4.

## Goal

Give the agent packaged, trustworthy domain knowledge it loads on demand: how each
component is used (wiring, a tiny example, gotchas, safety) and best-practice
playbooks for recurring projects - so it advises correctly instead of guessing.

## Tasks

- [ ] Define the skill schema: `{type, title, purpose, wiring (pins + 220R rule etc.),
      mini_example (blocks/C++), common_mistakes[], safety[], tags[]}`.
- [ ] Author **component skills** for the 9 catalog parts (LED, resistor, pushbutton, buzzer,
      servo, potentiometer, LCD1602, 7-seg, UNO).
- [ ] Author **project playbooks**: traffic light, melody/buzzer, sensor read, LCD display, button
      debounce, current-limiting, avoid blocking `delay()` - "things to watch out for".
- [ ] Store in a `skills` collection (Atlas), idempotent seeder; also embed into `knowledge_chunks`
      so they are reachable by semantic search.
- [ ] Tool `get_component_skill(type)` (exact lookup) returning the structured skill.
- [ ] Update the system prompt: consult the relevant skill before wiring an unfamiliar part or
      before giving a "best practice" answer; keep language kid-friendly.

## Exit criteria

- Asking the agent to use any of the 9 components yields correct wiring + a gotcha/best-practice note
  drawn from the seeded skill (not hallucinated).
- Commit `feat(phase-7): component skills and project best-practice playbooks`.
