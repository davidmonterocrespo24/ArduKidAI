# Phase 7 - Skills: component know-how + best practices

Priority: P1. Status: **done** (2026-05-31).
Reference: [agent-v2-architecture.md](./agent-v2-architecture.md) section 4.

## Goal

Give the agent packaged, trustworthy domain knowledge it loads on demand, so it
wires parts with the exact pin names and writes valid blocks instead of guessing.

## What was built (ADK-native skills)

- [x] Filesystem skills under `backend/skills/<name>/SKILL.md` (agentskills.io format:
      YAML frontmatter `name`+`description` matching the dir, markdown body):
      `arduino-uno`, `led`, `resistor`, `pushbutton`, `buzzer`, `servo`, `potentiometer`,
      `lcd1602`, `seg7`, `blockly-programming`, `project-patterns` (11 skills).
- [x] Each component skill gives the EXACT `wire()` pin names, the correct wiring
      pattern, the blocks that drive it, gotchas, and best practices.
- [x] `blockly-programming` skill: the exact block-type vocabulary, XML format rules,
      and two verified examples (blink + traffic light).
- [x] Loaded via ADK's `SkillToolset` (`backend/app/services/skills.py:load_adk_skills`)
      attached to the `LlmAgent` -> the agent uses `list_skills` / `load_skill` to
      **activate the relevant skill dynamically** based on what it is building.

## Verified

Real-agent build of a traffic light: agent called `list_skills` + `load_skill` x4,
added 3 LEDs + 3 resistors (no duplicate UNO), 9 correct wires (`UNO.D13` etc.,
LED->resistor->GND), valid blocks, and `validate_circuit` returned is_valid=True.

## Exit criteria

- [x] Agent loads relevant skills and builds a correct, complete circuit + valid blocks.
- [ ] Commit (combined with the tool-validation work).
