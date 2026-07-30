---
title: Slice 0 — Project scaffold & toolchain
status: planned
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

- [ ] `bun init` with strict `tsconfig.json` (ES2022+, `strict`, `noUnusedLocals`,
      `noUnusedParameters`, `noImplicitReturns`, `@/*` path alias), `"type": "module"`.
- [ ] Add `@opentui/react` + `@opentui/keymap` at exact pinned versions; record tested Bun version.
- [ ] Minimal hello-world TUI: three-pane static layout renders, `q` quits cleanly, terminal state
      restored on exit. This validates the Zig core on macOS arm64.
- [ ] `src/` skeleton per CLAUDE.md repo map (`beeper/`, `state/`, `tui/`, `store/`, `cli/`) with
      index stubs.
- [ ] ESLint 9 flat config + Prettier (global config: single quotes, es5 trailing commas), scripts:
      `dev`, `typecheck`, `lint`, `format`, `test`.
- [ ] One trivial `bun:test` test proving the runner works (e.g. a reducer stub).
- [ ] Husky + lint-staged + commitlint (conventional commits): pre-commit lint-staged, commit-msg
      commitlint, pre-push `bun test`.
- [ ] Secret/leak scanning enforced mechanically: gitleaks (or equivalent) on pre-commit and as a
      CI job, so tokens or personal data never enter history (CLAUDE.md invariant 9).
- [ ] GitHub Actions CI: `bun install --frozen-lockfile`, typecheck, lint, test on macOS arm64
      (and ubuntu if cheap).
- [ ] Update `docs/RUNBOOK.md` and CLAUDE.md Commands/Repo map to match what actually landed.

## Acceptance criteria

- [ ] `bun run dev` on a fresh clone (after `bun install`) renders the hello-world TUI in Ghostty
      or iTerm2 on macOS arm64 and exits cleanly with `q`.
- [ ] `bun run typecheck`, `bun run lint`, `bun test` all pass locally and in CI.
- [ ] Commit with a bad message is rejected; commit with unformatted staged code gets formatted.
- [ ] All `@opentui/*` versions exact-pinned; `bun.lock` committed.
- [ ] Any OpenTUI/Bun install or rendering quirk recorded in `LEARNINGS.md`.

## Out of scope

Any Beeper API interaction, real UI, state model, or CLI subcommands. No packaging/distribution.

## Risks / open questions

- OpenTUI is young; its React reconciler or Zig binary may have platform issues — surface them in
  `LEARNINGS.md` and, if blocking, escalate before working around with forks.
- Terminal-baseline decision (STATUS pending decision 3) affects which terminals CI/smoke targets —
  assume rich terminals until decided.
