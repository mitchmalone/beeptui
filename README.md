# beeptui

A fast, keyboard-first terminal chat client for [Beeper](https://www.beeper.com)'s unified inbox.
Browse conversations across networks, read history, receive live updates, and reply — all from the
terminal, over Beeper's Desktop/Server Client API. Beeper stays the account, sync, and encryption
boundary; this is a local client, not a bridge.

**Status: Phase 1 complete, Phase 2 in progress.** You can browse your unified inbox, read history,
receive live updates over WebSocket, and send real messages today. Filters, a network rail, and
message search landed in Slice 10. See [`docs/STATUS.md`](docs/STATUS.md).

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

## Getting started

### 1. Prerequisites

- [**Bun**](https://bun.sh) `>=1.3.14` — the runtime and package manager (`brew install bun`).
- [**Beeper Desktop**](https://www.beeper.com), running and signed in. beeptui is a client for its
  local API — it never talks to your networks directly, so Beeper has to be open.
- macOS is the tested platform (the token can live in the Keychain). Other platforms work via the
  environment variable below.
- For committing to the repo only: [`gitleaks`](https://github.com/gitleaks/gitleaks)
  (`brew install gitleaks`) — the pre-commit hook uses it to block secrets.

### 2. Install dependencies

```bash
bun install
```

### 3. Get a Beeper access token

In **Beeper Desktop → Settings → Integrations → Approved connections**, create a token. beeptui
reads it from either (env var wins):

```bash
# Simplest — an environment variable (works on any platform):
export BEEPER_ACCESS_TOKEN="paste-your-token-here"

# Or, on macOS, store it in the Keychain once (service/account are fixed).
# With -w and no value, security prompts for the token instead of taking it on
# the command line — so it stays out of your shell history:
security add-generic-password -s beeper-tui -a access-token -w
```

The token never gets written to a config file, log, or the repo. The default endpoint is
`http://127.0.0.1:23373`; override it with `BEEPER_TUI_ENDPOINT` if your Beeper API listens
elsewhere.

### 4. Verify the setup

```bash
bun run src/cli/index.ts doctor    # checks: Beeper reachable, token present, authenticated, accounts
```

`doctor` tells you exactly what's missing (Beeper not running, no token, auth failure, no accounts)
and how to fix it. `bun run src/cli/index.ts status` prints the endpoint, auth state, and a summary
of connected accounts.

### 5. Launch

```bash
bun run dev
```

Keys once you're in: `?` help overlay · `/` fuzzy-filter the inbox · `S` message search · `[` / `]`
cycle the network rail · `a` archived · `U` unread-only · `q` quit.

## Development

```bash
bun run typecheck    # tsc --noEmit (strict)
bun run lint         # eslint
bun run format       # prettier --write
bun test             # bun:test — unit + component tests
```

## Stack

TypeScript (strict, ESM) · Bun · OpenTUI (`@opentui/react` + `@opentui/keymap`) · SQLite for local
UI state. See `docs/PRD.md` § Technical approach.

## Working on this repo

Start with `CLAUDE.md`. Every slice is a plan in `docs/plans/backlog/` — pick it up, move it to
`active/`, work it test-first, and close out the docs with the code.
