# beeptui

A fast, keyboard-first terminal chat client for [Beeper](https://www.beeper.com)'s unified inbox.
Browse conversations across networks, read history, receive live updates, and reply — all from the
terminal, over Beeper's Desktop/Server Client API. Beeper stays the account, sync, and encryption
boundary; this is a local client, not a bridge.

**Status: early scaffold.** Slice 0 (toolchain + a proven OpenTUI render) is done; the Beeper
adapter and real UI land next. See [`docs/STATUS.md`](docs/STATUS.md).

## Docs

| Doc                                      | What it is                                           |
| ---------------------------------------- | ---------------------------------------------------- |
| [`docs/PRD.md`](docs/PRD.md)             | Product requirements — the source of truth           |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)     | Phases broken into agent-sized slices                |
| [`docs/STATUS.md`](docs/STATUS.md)       | Where we are right now                               |
| [`docs/plans/`](docs/plans)              | One plan per slice: `backlog/` → `active/` → `done/` |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Dated decision log                                   |
| [`docs/JOURNAL.md`](docs/JOURNAL.md)     | Append-only learnings                                |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md)     | Hand-run operational procedures                      |
| [`CLAUDE.md`](CLAUDE.md)                 | Operating rules for coding agents                    |
| [`AGENTS.md`](AGENTS.md)                 | Project coding standards (extends global)            |

## Quickstart

Requires [Bun](https://bun.sh) `>=1.3.14` (`brew install bun`) and, for commits,
[`gitleaks`](https://github.com/gitleaks/gitleaks) (`brew install gitleaks`).

```bash
bun install
bun run dev          # launch the TUI (press q to quit)

bun run typecheck    # tsc --noEmit
bun run lint         # eslint
bun run format       # prettier --write
bun test             # bun:test
```

## Install

`beeper-tui` runs against a local Beeper Desktop (with the API enabled in its
settings). Two ways to install:

```bash
# 1. A standalone binary (no Bun needed at runtime) — validated on macOS arm64.
bun run build              # → dist/beeper-tui (a single ~69 MB executable)
./dist/beeper-tui doctor   # verify the connection + auth
./dist/beeper-tui          # launch the TUI

# 2. Directly, if you have Bun.
bunx beeper-tui doctor
```

Commands: `beeper-tui` (TUI), `beeper-tui status`, `beeper-tui doctor` (add
`--json` for machine-readable output).

## Configuration

Optional config lives at `$XDG_CONFIG_HOME/beeper-tui/config.json` (default
`~/.config/beeper-tui/config.json`). It never holds secrets — tokens live in the
platform credential store.

```jsonc
{
  // Point at a non-default endpoint (env BEEPER_TUI_ENDPOINT takes precedence).
  "endpoint": "http://127.0.0.1:23373",
  // Run a command on each new inbound message in a chat you're not reading.
  // The command receives ONE extra argument: "beeper-tui: new message on <Network>".
  // Only the app name + network are ever passed — never a sender, chat, or message body.
  "notify": { "command": ["terminal-notifier", "-title", "Beeper", "-message"] },
  // Rebind keys: command name → key tokens (e.g. "down", "shift+j", "ctrl+n").
  // Unknown commands or empty lists fail fast with a clear error. Press ? for the
  // command list; the help overlay reflects your overrides.
  "keymap": { "quit": ["x"], "refresh": ["ctrl+r"] },
  // Override the per-network accent colours (hex). Unlisted networks keep theirs.
  "theme": { "networkColors": { "WhatsApp": "#25d366", "Slack": "#611f69" } },
}
```

## Stack

TypeScript (strict, ESM) · Bun · OpenTUI (`@opentui/react` + `@opentui/keymap`) · SQLite for local
UI state. See `docs/PRD.md` § Technical approach.

## Working on this repo

Start with `CLAUDE.md`. Every slice is a plan in `docs/plans/backlog/` — pick it up, move it to
`active/`, work it test-first, and close out the docs with the code.
