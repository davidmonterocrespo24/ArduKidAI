# Phase 6 - QA, video, submission

Target: June 8-10, 2026 (June 11 as margin / submit)
Status: pending

## Goal

Real-user QA, record and publish the demo video, finalize the README, and submit on Devpost.

## Tasks

### Real-user QA (June 8)

- [ ] Test with a 10-year-old kid (target audience).
- [ ] Note every confusion point, every wait that feels too long, every wrong agent response.
- [ ] Fix the top issues. Defer anything non-critical.
- [ ] Run the four canonical first-run chips end-to-end and confirm each works.

### Video (June 9)

- [ ] 3-minute demo script in English.
- [ ] Storyboard following the spec:
  - 0:00-0:20: the problem (kid staring at an Arduino with no idea what to do).
  - 0:20-1:30: main flow demo (traffic light from chat).
  - 1:30-2:20: modification flow + vector search ("find me something similar").
  - 2:20-2:50: architecture diagram + why MongoDB MCP.
  - 2:50-3:00: call to action.
- [ ] Record screen captures of the live hosted URL.
- [ ] Voiceover (English).
- [ ] English subtitles burned in (required by rules).
- [ ] Edit, export at 1080p.
- [ ] Upload to YouTube as **public** (not unlisted). Verify embed works.
- [ ] No third-party logos, no copyrighted music, no slogans.

### README finalization (June 10)

- [ ] Live demo URL added.
- [ ] Video URL added.
- [ ] Architecture diagram inline (SVG, no emojis).
- [ ] Local development instructions.
- [ ] Stack table.
- [ ] Acknowledgments section (Google Cloud, Gemini, MongoDB, Wokwi for open-source `avr8js` and `wokwi-elements`, BlocklyDuino).
- [ ] License section.
- [ ] Tags: `gemini`, `mongodb`, `google-cloud`, `agent-builder`, `arduino`, `blockly`, `education`, `hackathon`.

### Devpost submission (June 10, with June 11 as buffer)

- [ ] Devpost form fields:
  - [ ] Track: **MongoDB**.
  - [ ] Hosted Project URL.
  - [ ] Code repository URL (public).
  - [ ] Video URL.
  - [ ] Text description: features, technologies used, data sources, findings and learnings.
  - [ ] Screenshots.
- [ ] All team members added (if any).
- [ ] Verified all written content is in English.
- [ ] Verified LICENSE is visible in the repo About section.
- [ ] Verified all commits are between May 5 and June 11, 2026, authored by `davidmonterocrespo24@gmail.com`.

### Compliance final check

- [ ] No emojis anywhere (UI, code, comments, commits, README, video, Devpost).
- [ ] No mention of any prior personal product name.
- [ ] No competing services (no OpenAI / Anthropic / etc.).
- [ ] Hosted URL responds and runs the agent flow successfully.

## Submit

- [ ] **Submit on Devpost before June 11, 2026 14:00 PT (18:00 GMT-3).**
- [ ] Take a screenshot of the confirmation page.

## Exit criteria

- Devpost confirmation received.
- Commit on `main` titled `chore(phase-6): final readme, video link, devpost submission`.
