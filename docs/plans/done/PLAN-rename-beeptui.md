---
title: Rename beeper-tui → beeptui
status: done
created: 2026-08-03
updated: 2026-08-03
links:
  - ../DECISIONS.md (2026-07-30 name lock — this reverses it)
---

# Rename beeper-tui → beeptui

## Goal

The app's canonical name is `beeptui`, not `beeper-tui`. Rename it everywhere — package,
binary, config/state paths, keychain service, env var, Homebrew formula, CLI text, and docs —
so the shipped surface matches the name.

## Context

`docs/DECISIONS.md` 2026-07-30 locked the name as `beeper-tui` (repo stays `beeptui`). Mitch has
reversed that: package/CLI/config/formula all become `beeptui`. 146 references across code, tests,
config, packaging, CI, and docs.

## Approach

Scripted, whole-word string replacement across tracked files for the three patterns:
`beeper-tui` → `beeptui`, `BEEPER_TUI_ENDPOINT` → `BEEPTUI_ENDPOINT`, `BeeperTui` → `Beeptui`.
Rewrite historical docs too (per Mitch). Add a new `DECISIONS.md` entry reversing the 2026-07-30
lock. Then typecheck / lint / test green.

## Steps

- [x] Replace all three patterns across code, tests, config, packaging, CI, docs
- [x] Add new DECISIONS.md entry (2026-08-03) reversing the name lock
- [x] Update STATUS.md to reflect the rename
- [x] Regenerate bun.lock name field / verify install
- [x] `bun run typecheck`, `bun run lint`, `bun test` green
- [x] JOURNAL entry; move this plan to done/

## Acceptance criteria

- [x] No `beeper-tui` / `BEEPER_TUI_ENDPOINT` / `BeeperTui` left in tracked files (except where
      historically quoting the old name is intentional — none planned)
- [x] `bun test` green; typecheck + lint clean
- [x] Homebrew formula renders `class Beeptui`, installs binary `beeptui`, formula file `beeptui.rb`

## Out of scope

- Backward-compat shims for the old config dir / keychain service / env var (pre-release; hard break
  is acceptable).
- Renaming the git repo (already `beeptui`).

## Risks / open questions

- Existing local installs lose their keychain token / config under the old service+dir names. Pre-1.0,
  acceptable — users re-run `login` / `doctor`.
