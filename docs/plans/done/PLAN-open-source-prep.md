---
title: Open-source prep — security + quality audit
status: done
created: 2026-08-01
updated: 2026-08-01
links:
  - docs/DECISIONS.md 2026-07-30 (publishable repo), pending decision #6 (public flip)
---

# Open-source prep — security + quality audit

## Goal

Get the repo into a state where it can be flipped public and explored by an outside technical
audience (including Beeper folks): no publishability violations, no security findings on the
auth/adapter surface, and code/docs that read well to a first-time visitor.

## Context

Decision 2026-07-30 already treats the repo as publishable; this pass verifies that holds and
fixes what doesn't. Runs outside the slice sequence (Mitch-directed, 2026-08-01) while Slice 14
re-plan is pending.

## Approach

Three passes: (1) publishability sweep — secrets, personal identifiers, git history, large blobs;
(2) security review of `src/beeper` + `src/cli` (OAuth, token stores, loopback server, notify
command execution); (3) code-quality review of `src/state`, `src/store`, `src/tui`, `src/cli`
plus a docs/README polish pass. Findings verified before fixing; all gates stay green.

## Steps

- [x] Publishability sweep (tracked files, git history, commit messages, URLs)
- [x] Untrack the 59 MB `.bun-build` binary committed in PR #12
- [x] Replace real account handle in `reducer.test.ts` / `JOURNAL.md` with synthetic name
- [x] Remove private Notion URL from `PRD.md`
- [x] Security review of `src/beeper` + `src/cli`; fix confirmed findings (https floor, armed
      loopback, callback sanitization, collision-safe saves, honest `openFile`, scheme checks)
- [x] Code-quality review of `src/state`, `src/store`, `src/tui`, `src/cli`; apply fixes (bounded
      live buffering, eviction pagination honesty, keymap-honest rebinds, windowed search palette,
      CLI error handler + `--version`, `Store` → `src/state`, slice-comment sweep, barrel removed)
- [x] Docs/README polish for outside readers (plain-language status, keymap-layer corrections,
      stale references fixed, synthetic mockup handle)
- [x] LICENSE decision (Mitch) + add file — MIT, 2026-08-01
- [x] Close out: STATUS/JOURNAL/DECISIONS updated, PR opened

## Acceptance criteria

- [x] No invariant-9 violations in tracked files (personal identifiers, private URLs, real content)
- [x] No unfixed security findings at high/critical severity
- [x] `bun run typecheck`, `bun run lint`, `bun test` all green (429 tests)
- [x] README stands alone for a first-time outside reader

## Out of scope

- The actual public flip (decision #6 stays open — Mitch's call)
- History rewrite execution (recommended for the 59 MB blob; needs Mitch's sign-off)
- Slice 14 remaining features (densities, perf profiling, media preview, brew tap)

## Risks / open questions

- The `.bun-build` blob and the Notion URL remain in git history; a `git filter-repo` pass before
  the public flip would remove both. Rewrites `main` — Mitch decides.
- License choice is open (MIT/Apache-2.0/other) — blocks the public flip, not this cleanup.
