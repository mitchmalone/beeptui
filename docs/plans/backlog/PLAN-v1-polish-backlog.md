---
title: v1 polish — optional follow-ups
status: backlog
created: 2026-08-01
updated: 2026-08-03
links:
  - ../done/PLAN-slice-14-polish-packaging.md
  - ../../PRD.md § Phased delivery (Phase 3)
  - ../../PERF.md
  - PLAN-inline-image-rendering.md
  - PLAN-release-hygiene-versioning.md
  - PLAN-login-guard-local-endpoint.md
---

# v1 polish — optional follow-ups

> Optional, fuzzy-scoped polish carried out of the (now closed) Slice 14. **None of these block
> v1** — Slices 0–14 are code-complete and green. **Most of this landed on `main` (PRs #27–#31, and
> the first release `v0.1.0`)**; the remaining items are each carved into their own ready-to-work
> plan (see links above). This file is the index of what's done vs. open.

## Goal

Nice-to-haves that raise the quality bar past "works and is installable" but weren't part of the
v1 definition of done.

## Candidate scope

- [x] **Layout densities** — compact/comfortable toggle (`D`) for the inbox + conversation panes,
      seeded from `config.theme.density`. Done on `feat/v1-polish`.
- [x] **Performance profiling** — **state:** `src/state/perf.test.ts` benchmarks reducer + selectors
      at 5000 chats / 2000 live messages. **Render loop:** `src/tui/profile.ts` harness
      (`src/tui/frame-profiler.ts` maths is unit-tested) replays a 300-message burst on a 3000-chat
      inbox and measures inter-frame times — steady ~18 ms/frame (~56 fps). Results + methodology in
      `docs/PERF.md`. Everything sits well inside the PRD budgets.
- [~] **Richer media preview** — foundation done: `src/tui/media-preview.ts` (detection +
  escape-sequence builders, unit-tested) and honest `doctor` reporting are on `main`. In-TUI
  rendering is a scoped slice → **`PLAN-inline-image-rendering.md`** (spike confirmed feasible;
  `docs/PERF.md`).
- [x] **brew tap / versioned releases — DONE (v0.1.0, 2026-08-02).** `src/packaging/homebrew.ts`
      renders the formula and `release.yml` publishes per-target binaries + `sha256sums.txt` and
      pushes the formula to the tap. Exercised end-to-end by the **first real release**: tag
      `v0.1.0` → both binaries + checksums on the GitHub Release → `Formula/beeper-tui.rb` committed
      to `mitchmalone/homebrew-tap` with matching SHA-256s. `brew install mitchmalone/tap/beeper-tui`
      resolves.

## Ready-to-work plans (open)

Each is a standalone plan, ordered roughly by value/effort:

1. **`PLAN-login-guard-local-endpoint.md`** — `login` should refuse on a local / remote-access-off
   endpoint instead of opening a dead browser tab (invariant 8). Small, testable, no hardware.
2. **`PLAN-release-hygiene-versioning.md`** — fix `--version` (`0.0.0` → tag), stamp the version from
   the tag in CI, bump the Node-20 GitHub Actions; cut `v0.1.1`.
3. **`PLAN-inline-image-rendering.md`** — render image attachments inline (native protocol first;
   iTerm2/kitty), honest fallback elsewhere.

## Out of scope

- Anything already shipped in Slice 14 (reactions, receipts, notify hooks, keymap/colour config,
  standalone binary + release workflow).
- Production live-validation runs — those are tracked in `TODO.md`, not here.
