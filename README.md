# beeptui

A fast, keyboard-first terminal chat client for [Beeper](https://www.beeper.com)'s unified inbox.
Browse conversations across networks, read history, receive live updates, and reply — all from the
terminal, over Beeper's Desktop/Server Client API. Beeper stays the account, sync, and encryption
boundary; this is a local client, not a bridge.

**Status: pre-code.** Docs are scaffolded; implementation starts with Slice 0.

## Docs

| Doc                                | What it is                                         |
| ---------------------------------- | -------------------------------------------------- |
| [`docs/PRD.md`](docs/PRD.md)       | Product requirements — the source of truth         |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phases broken into agent-sized slices            |
| [`docs/STATUS.md`](docs/STATUS.md) | Where we are right now                             |
| [`docs/plans/`](docs/plans)        | One plan per slice: `backlog/` → `active/` → `done/` |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Dated decision log                           |
| [`docs/JOURNAL.md`](docs/JOURNAL.md) | Append-only learnings                            |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Hand-run operational procedures                  |
| [`CLAUDE.md`](CLAUDE.md)           | Operating rules for coding agents                  |
| [`AGENTS.md`](AGENTS.md)           | Project coding standards (extends global)          |

## Stack

TypeScript (strict, ESM) · Bun · OpenTUI (`@opentui/react` + `@opentui/keymap`) · SQLite for local
UI state. See `docs/PRD.md` § Technical approach.

## Working on this repo

Start with `CLAUDE.md`. Every slice is a plan in `docs/plans/backlog/` — pick it up, move it to
`active/`, work it test-first, and close out the docs with the code.
