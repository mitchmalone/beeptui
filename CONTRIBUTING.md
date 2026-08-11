# Contributing to beeptui

Thanks for your interest! beeptui is a keyboard-first terminal client for
[Beeper](https://www.beeper.com)'s unified inbox. Before writing code, skim the
[README](README.md) and [`CLAUDE.md`](CLAUDE.md) — the invariants there are the project's
constitution, and PRs that violate them won't merge.

## Setup

```bash
brew install bun gitleaks   # Bun ≥1.3.14 (runtime); gitleaks (pre-commit secret scan)
bun install
bun run typecheck && bun run lint && bun test   # should all pass before you start
```

Running the TUI needs [Beeper Desktop](https://www.beeper.com) signed in with API access — see
the README's Getting started. Tests, typecheck, and lint need no Beeper at all.

## How we work

- **Test-first.** New behavior lands as a failing test, then the minimum code to green. Reducer
  and adapter logic must be testable without rendering a terminal.
- **Respect the boundaries.** All Beeper I/O goes through `src/beeper/`; all state changes go
  through the reducer in `src/state/`; `src/tui/` renders and dispatches only.
- **Honesty over polish.** A missing capability shows a named state — never a dead control or a
  fake success. A message is only ever sent on an explicit user action.
- **Conventional Commits** (`feat:`, `fix:`, `docs:`, …), enforced by commitlint. Lefthook hooks
  run lint/format, gitleaks, and the full verify gate — don't bypass them. PRs are squash-merged.

## Privacy — non-negotiable

Never include **real conversation content, contact names, chat titles, account identifiers,
tokens, or captured API responses** in code, fixtures, tests, docs, issues, or PRs. Use clearly
synthetic data (the existing fixtures — Ada, Grace, `beeper.example` — show the style). Redact
screenshots and logs before attaching them. If you accidentally push something private, say so
immediately — history rewrites are much cheaper early.

## Reporting security issues

Please use **GitHub's private vulnerability reporting** (Security tab → "Report a vulnerability")
rather than a public issue. The auth/token surface (`src/beeper/oauth*`, `token-store`,
`keychain`) is the sensitive area; reports there are especially appreciated.

## License

By contributing you agree your contributions are licensed under the [MIT License](LICENSE).
