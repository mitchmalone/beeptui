---
title: v1 polish — optional follow-ups
status: backlog
created: 2026-08-01
updated: 2026-08-01
links:
  - ../done/PLAN-slice-14-polish-packaging.md
  - ../../PRD.md § Phased delivery (Phase 3)
---

# v1 polish — optional follow-ups

> Optional, fuzzy-scoped polish carried out of the (now closed) Slice 14. **None of these block
> v1** — Slices 0–14 are code-complete and green. Pull an item into `active/` only when it's worth
> doing on its own; plan it properly at that point (this file is a parking lot, not a spec).

## Goal

Nice-to-haves that raise the quality bar past "works and is installable" but weren't part of the
v1 definition of done.

## Candidate scope

- [ ] **Layout densities** — a compact/comfortable toggle for the inbox + conversation panes.
- [ ] **Performance profiling** — profile the render loop and event application under large
      inboxes / busy channels; confirm the build hits or beats the PRD timing criteria consistently
      (launch-to-usable was ~29 ms at Slice 9; verify it holds under load).
- [ ] **Richer media preview** — inline images where the terminal supports it (Kitty / iTerm2 image
      protocols), capability-detected with an honest fallback.
- [ ] **brew tap / versioned releases** — a Homebrew tap and versioned GitHub Releases beyond the
      structural `release.yml` (which is exercised only on a `v*` tag push).

## Out of scope

- Anything already shipped in Slice 14 (reactions, receipts, notify hooks, keymap/colour config,
  standalone binary + release workflow).
- Production live-validation runs — those are tracked in `TODO.md`, not here.
