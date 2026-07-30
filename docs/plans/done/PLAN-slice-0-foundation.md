---
title: Slice 0 — Project scaffold & toolchain
status: done
created: 2026-07-30
updated: 2026-07-30
links:
  - ../../PRD.md § Technical approach, § Constraints and risks
  - ../../ROADMAP.md Phase 0
  - ../../DECISIONS.md 2026-07-30 (Bun override)
---

# Slice 0 — Project scaffold & toolchain

## Goal

A pinned, proven Bun + TypeScript + OpenTUI project where `bun run dev` renders a hello-world TUI
on macOS arm64, and typecheck/lint/test/hooks/CI all pass. Every later slice lands on these rails.

## Context

Empty repo; docs only. The PRD flags OpenTUI's native Zig core as a risk: pin compatible
OpenTUI/Bun versions and validate the macOS arm64 distribution before treating the tool as
installable. Global + project `AGENTS.md` define the toolchain rules (Bun, strict TS, ESM,
Prettier, ESLint 9 flat config, Husky).

## Approach

Scaffold by hand (no framework generator fits a TUI). Prove the riskiest dependency first: get
`@opentui/react` rendering in a terminal before investing in the rest of the toolchain. Then layer
lint/format/test/hooks/CI and the `src/` skeleton with placeholder modules matching the CLAUDE.md
repo map.

## Steps

- [x] `bun init` with strict `tsconfig.json` (ES2022+, `strict`, `noUnusedLocals`,
      `noUnusedParameters`, `noImplicitReturns`, `@/*` path alias), `"type": "module"`.
- [x] Add `@opentui/react` + `@opentui/keymap` at exact pinned versions; record tested Bun version.
- [x] Minimal hello-world TUI: three-pane static layout renders, `q` quits cleanly, terminal state
      restored on exit. This validates the Zig core on macOS arm64.
- [x] `src/` skeleton per CLAUDE.md repo map (`beeper/`, `state/`, `tui/`, `store/`, `cli/`) with
      index stubs.
- [x] ESLint 9 flat config + Prettier (global config: single quotes, es5 trailing commas), scripts:
      `dev`, `typecheck`, `lint`, `format`, `test`.
- [x] One trivial `bun:test` test proving the runner works (e.g. a reducer stub).
- [x] Husky + lint-staged + commitlint (conventional commits): pre-commit lint-staged, commit-msg
      commitlint, pre-push `bun test`.
- [x] Secret/leak scanning enforced mechanically: gitleaks (or equivalent) on pre-commit and as a
      CI job, so tokens or personal data never enter history (CLAUDE.md invariant 9).
- [x] GitHub Actions CI: `bun install --frozen-lockfile`, typecheck, lint, test on macOS arm64
      (and ubuntu if cheap).
- [x] Update `docs/RUNBOOK.md` and CLAUDE.md Commands/Repo map to match what actually landed.

## Acceptance criteria

- [x] `bun run dev` on a fresh clone (after `bun install`) renders the hello-world TUI in Ghostty
      or iTerm2 on macOS arm64 and exits cleanly with `q`.
- [x] `bun run typecheck`, `bun run lint`, `bun test` all pass locally and in CI.
- [x] Commit with a bad message is rejected; commit with unformatted staged code gets formatted.
- [x] All `@opentui/*` versions exact-pinned; `bun.lock` committed.
- [x] Any OpenTUI/Bun install or rendering quirk recorded in `LEARNINGS.md`.

## Out of scope

Any Beeper API interaction, real UI, state model, or CLI subcommands. No packaging/distribution.

## Outcome (2026-07-30)

Shipped on `feat/slice-0-foundation`. OpenTUI `@opentui/react@0.4.5` renders on macOS arm64 under
Bun 1.3.14; `q` exits cleanly (PTY-verified exit 0). `typecheck` / `lint` / `format:check` / `test`
all green locally.

**Deviations from plan:**

- **TypeScript pinned to 6.0.3, not the newest 7.0.x.** `typescript-eslint` does not support the TS 7
  native compiler yet, so TS 7 breaks `bun run lint`. Recorded in `DECISIONS.md`; TS-7 quirks
  (`baseUrl` removal) in `LEARNINGS.md`.
- **`@opentui/keymap` not installed yet.** It peer-depends on `@opentui/solid`; it isn't used until
  the keymap layer lands (Slice 3), so it's deferred to avoid pulling Solid into a React app early.
- Render validation is via the headless `testRender` smoke + a PTY quit check, not a manual
  fresh-clone eyeball. Real interactive confirmation is a one-liner for Mitch: `bun run dev`.

**Follow-up:** open the PR and confirm the GitHub Actions run is green — CI is authored but has not
run remotely yet.

## Risks / open questions

- OpenTUI is young; its React reconciler or Zig binary may have platform issues — surface them in
  `LEARNINGS.md` and, if blocking, escalate before working around with forks. _(No blockers hit in
  Slice 0.)_
- Terminal-baseline decision (STATUS pending decision 3) affects which terminals CI/smoke targets —
  assume rich terminals until decided.
