# Phase 0 - Project bootstrap

Target: May 25, 2026
Status: in progress

## Goal

Establish the repository skeleton, license, hackathon documentation, and phase tracker so that the rest of the build can start cleanly.

## Tasks

- [x] Git repository initialized.
- [x] Local git user set to `davidmonterocrespo24@gmail.com`.
- [x] MIT `LICENSE` at repo root.
- [x] `.gitignore` covering Node, Python, GCP, Arduino, IDE noise.
- [x] `README.md` at repo root describing the project, stack, and structure.
- [x] `doc/hackathon-overview.md` with hackathon overview.
- [x] `doc/hackathon-rules.md` with official rules (verbatim, organized).
- [x] `doc/hackathon-resources.md` with hackathon resource links.
- [x] `doc/mongodb-resources.md` with MongoDB partner deep dive.
- [x] `doc/product-spec.md` with the full product specification.
- [x] `project/phases.md` master tracker.
- [x] `project/phase-{0..6}-*.md` individual phase trackers.
- [ ] Initial bootstrap commit on `main`.

## Open questions / decisions deferred

- GitHub remote name / visibility: confirmed public, will be set during Phase 5 (or earlier if needed for CI access).
- Product name: **ArduKid** (confirmed; matches directory `ArduKidAI`).

## Exit criteria

- All files above exist.
- `git log` shows one bootstrap commit authored by `davidmonterocrespo24@gmail.com`.
- `git status` is clean.
