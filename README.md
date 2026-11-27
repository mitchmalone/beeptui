# beeptui

[![CI](https://github.com/mitchmalone/beeptui/actions/workflows/ci.yml/badge.svg)](https://github.com/mitchmalone/beeptui/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/mitchmalone/beeptui?logo=github)](https://github.com/mitchmalone/beeptui/releases/latest)
[![Homebrew](https://img.shields.io/badge/homebrew-mitchmalone%2Ftap%2Fbeeptui-2e2a24?logo=homebrew&logoColor=fbb040)](https://github.com/mitchmalone/homebrew-tap)
[![Bun](https://img.shields.io/badge/runtime-Bun%20%E2%89%A5%201.3.14-14151a?logo=bun)](https://bun.sh)
[![License: MIT](https://img.shields.io/github/license/mitchmalone/beeptui)](LICENSE)

A fast, keyboard-first terminal chat client for [Beeper](https://www.beeper.com)'s unified inbox.
Browse conversations across networks, read history, receive live updates, and reply — all from the
terminal, over Beeper's Desktop/Server Client API. Beeper stays the account, sync, and encryption
boundary; this is a local client, not a bridge.

**Status: usable daily against a local Beeper Desktop.** Browse your unified inbox, read history,
receive live updates over WebSocket, and send real messages. Image attachments render inline as
half-block thumbnails in any terminal (tmux included), with one-key open in the OS viewer. Also
built: a network rail with archived/unread filters, message search, replies, edits, attachment
open/save, reactions, read receipts, honest per-network capability messaging, an OAuth 2.0 + PKCE
flow for remote endpoints with cross-platform token storage, config for keymap/colours/notification
hooks, and a standalone binary. Remaining work is gated on live validation (more networks, a real remote host) and a couple
of product decisions.

## Install

Homebrew (macOS and Linux) is the default:

```bash
brew install mitchmalone/tap/beeptui
```

Alternatives:

- **Standalone binary** — download the binary for your OS from
  [GitHub Releases](https://github.com/mitchmalone/beeptui/releases) (no Bun needed at runtime),
  verify it against the release's `sha256sums.txt`, then make it executable:

  ```bash
  shasum -a 256 -c sha256sums.txt
  chmod +x beeptui-darwin-arm64    # or beeptui-linux-x64
  ```

- **From source** — with [Bun](https://bun.sh) `>=1.3.14` and a checkout of this repo:

  ```bash
  bun install
  bun run apps/cli/src/cli/index.ts    # run directly, or:
  bun run build               # compile → apps/cli/dist/beeptui (a single ~69 MB executable)
  ```

## Getting started

### 1. Run Beeper Desktop

[**Beeper Desktop**](https://www.beeper.com) must be running and signed in — beeptui is a client
for its local API and never talks to your networks directly. macOS is the tested platform (the
token can live in the Keychain); other platforms work via the environment variable below.

### 2. Get a Beeper access token

In **Beeper Desktop → Settings → Integrations → Approved connections**, create a token. beeptui
reads it from either (env var wins):

```bash
# Simplest — an environment variable (works on any platform):
export BEEPER_ACCESS_TOKEN="paste-your-token-here"

# Or, on macOS, store it in the Keychain once (service/account are fixed).
# With -w and no value, security prompts for the token instead of taking it on
# the command line — so it stays out of your shell history:
security add-generic-password -s beeptui -a access-token -w
```

The token never gets written to a config file, log, or the repo. The default endpoint is
`http://127.0.0.1:23373`; override it with `BEEPTUI_ENDPOINT` if your Beeper API listens
elsewhere.

### 3. Verify the setup

```bash
beeptui doctor    # checks: Beeper reachable, token present, authenticated, accounts
```

`doctor` tells you exactly what's missing (Beeper not running, no token, auth failure, no
accounts) and how to fix it. `beeptui status` prints the endpoint, auth state, and a summary of
connected accounts.

### 4. Launch

```bash
beeptui
```

Keys once you're in: `?` help overlay · `/` fuzzy-filter the inbox · `S` message search · `[` / `]`
cycle the network rail · `a` archived · `U` unread-only · `q` quit.

All commands: `beeptui` (TUI), `beeptui status`, `beeptui doctor` (add `--json` for
machine-readable output), and — for a remote endpoint — `beeptui login` / `beeptui logout`
(OAuth 2.0 + PKCE; tokens are stored in the OS credential store via `Bun.secrets`, never in a
file or on a command line).

## Docs

| Doc                                      | What it is                                           |
| ---------------------------------------- | ---------------------------------------------------- |
| [`docs/PRD.md`](docs/PRD.md)             | Product requirements — the source of truth           |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Dated decision log                                   |
| [`docs/LEARNINGS.md`](docs/LEARNINGS.md) | Gotchas worth knowing before you change things       |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md)     | Hand-run operational procedures                      |
| [`docs/PERF.md`](docs/PERF.md)           | Performance budgets and measurements                 |
| [`AGENTS.md`](AGENTS.md)                 | Project rules for agents and humans: deltas only     |
| [`docs/STANDARDS.md`](docs/STANDARDS.md) | The vendored jig standard this repo runs on          |
| [`DEVIATIONS.md`](DEVIATIONS.md)         | Where this repo knowingly diverges from the standard |

## Development

Working from a checkout needs [Bun](https://bun.sh) `>=1.3.14` (`brew install bun`) and, for
committing, [`gitleaks`](https://github.com/gitleaks/gitleaks) (`brew install gitleaks`) — the
pre-commit hook uses it to block secrets.

```bash
bun run dev          # launch the TUI from source
bun run typecheck    # tsc --noEmit (strict)
bun run lint         # eslint
bun run format       # prettier --write
bun test             # bun:test — unit + component tests
bun run build        # compile the standalone binary → apps/cli/dist/beeptui
```

**Releases & Homebrew.** Pushing a `v*` tag runs
`.github/workflows/release.yml`, which builds the per-target binaries on native
runners, publishes a GitHub Release with `sha256sums.txt`, and — when a tap is
configured — updates the formula. It also stamps the released version into the
website repo (`src/data/release.json`, repo variable `WEB_REPO` + secret
`WEB_REPO_TOKEN`) so beeptui.com always shows the shipped version. To enable the tap, create a `homebrew-tap`
repo, then set the repo variable `HOMEBREW_TAP_REPO` (`owner/homebrew-tap`) and
the secret `HOMEBREW_TAP_TOKEN` (a token that can push to it). Without those, the
release still publishes and the tap step is skipped. The formula is generated by
`apps/cli/src/packaging/homebrew.ts` (no static file to hand-edit).

## Configuration

Optional config lives at `$XDG_CONFIG_HOME/beeptui/config.json` (default
`~/.config/beeptui/config.json`). It never holds secrets — tokens live in the
platform credential store.

```jsonc
{
  // Point at a non-default endpoint — a URL, or the name of one below.
  // env BEEPTUI_ENDPOINT (a URL or a name) takes precedence.
  "endpoint": "local",
  // Named endpoints to switch between (e.g. local Desktop vs a remote box).
  "endpoints": {
    "local": "http://127.0.0.1:23373",
    "remote": "https://beeper.example.com",
  },
  // Run a command on each new inbound message in a chat you're not reading.
  // The command receives ONE extra argument: "beeptui: new message on <Network>".
  // Only the app name + network are ever passed — never a sender, chat, or message body.
  "notify": { "command": ["terminal-notifier", "-title", "Beeper", "-message"] },
  // Rebind keys: command name → key tokens (e.g. "down", "shift+j", "ctrl+n").
  // Unknown commands or empty lists fail fast with a clear error. Press ? for the
  // command list; the help overlay reflects your overrides.
  "keymap": { "quit": ["x"], "refresh": ["ctrl+r"] },
  // Theme: per-network accent colours (hex; unlisted networks keep theirs) and
  // the initial layout density ("comfortable" | "compact"). Press D to toggle
  // density at runtime; both keys are optional.
  "theme": {
    "networkColors": { "WhatsApp": "#25d366", "Slack": "#611f69" },
    "density": "comfortable",
  },
}
```

## Stack

TypeScript (strict, ESM) · Bun · OpenTUI (`@opentui/react`; keybindings live in an in-repo keymap
layer, `apps/cli/src/tui/keymap.ts`) · SQLite for local UI state. See `docs/PRD.md` § Technical approach.

## Working on this repo

New here? Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), then [`AGENTS.md`](AGENTS.md) and
[`docs/LEARNINGS.md`](docs/LEARNINGS.md). Work is test-first and every change passes `bun run verify`.
The maintainer's backlog and session notes live outside the repo; open an issue to propose work.

## License

[MIT](LICENSE)
