---
title: v1 polish — optional follow-ups
status: backlog
created: 2026-08-01
updated: 2026-08-01
links:
  - ../done/PLAN-slice-14-polish-packaging.md
  - ../../PRD.md § Phased delivery (Phase 3)
  - ../../PERF.md
---

# v1 polish — optional follow-ups

> Optional, fuzzy-scoped polish carried out of the (now closed) Slice 14. **None of these block
> v1** — Slices 0–14 are code-complete and green. **Most of this landed on `main` (2026-08-01, PRs
> #27 + #28)**; the residual items below are what genuinely needs hardware/infra we don't have.

## Goal

Nice-to-haves that raise the quality bar past "works and is installable" but weren't part of the
v1 definition of done.

## Candidate scope

- [x] **Layout densities** — compact/comfortable toggle (`D`) for the inbox + conversation panes,
      seeded from `config.theme.density`. Done on `feat/v1-polish`.
- [x] **Performance profiling (state)** — `src/state/perf.test.ts` benchmarks reducer event
      application + selectors at 5000 chats / 2000 live messages; results + methodology in
      `docs/PERF.md`. The parts we own sit 3–4 orders of magnitude inside the PRD budgets.
- [~] **Richer media preview** — `src/tui/media-preview.ts` does protocol detection (kitty /
  iTerm2 / WezTerm), image-attachment ID, and escape-sequence building (all unit-tested);
  `doctor` reports support honestly. **Residual:** in-TUI rendering (coordinating with the
  OpenTUI native framebuffer) — can't be validated headlessly; attachments degrade visibly to
  the text placeholder + open/save until then.
- [~] **brew tap / versioned releases** — `src/packaging/homebrew.ts` renders a validated formula
  and `release.yml` publishes `sha256sums.txt` + a guarded tap-publish job (both on `main`, PRs #27
  - #28). **Residual:** create the `homebrew-tap` repo, set `HOMEBREW_TAP_REPO` +
    `HOMEBREW_TAP_TOKEN`, and cut a real `v*` tag to exercise the workflow end-to-end (only ever run
    structurally so far).

## Residual / still open

- **In-TUI image rendering** — wire `buildImageSequence` into a render path that cooperates with the
  OpenTUI renderer; validate in a real kitty / iTerm2 session.
- **Live render-loop profiling** — instrument `createCliRenderer` frame timing under a synthetic
  burst (needs the live renderer; see `docs/PERF.md`).
- **First real release** — configure the tap, push a `v*` tag, confirm binaries + checksums + the
  formula land and `brew install` works.

## Out of scope

- Anything already shipped in Slice 14 (reactions, receipts, notify hooks, keymap/colour config,
  standalone binary + release workflow).
- Production live-validation runs — those are tracked in `TODO.md`, not here.
