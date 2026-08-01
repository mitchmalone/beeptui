# AGENTS.md (project)

Project-specific rules for `beeptui`. These **extend and override** the global `~/.claude/AGENTS.md`
where noted; everything not mentioned here follows the global file. Operating protocol (session
start, plans, docs close-out) lives in `CLAUDE.md`.

## Overrides of the global AGENTS.md

- **Bun, not npm.** Bun is the package manager, runtime, and script runner. `bun.lock` is the
  committed lockfile; there is no `package-lock.json`. Rationale: the PRD mandates Bun + OpenTUI
  (native Zig core built for the Bun runtime). See `docs/DECISIONS.md` 2026-07-30.
- **`bun test`, not Vitest.** Bun's built-in test runner (Jest-compatible API) per the PRD. Test
  files stay `*.test.ts` / `*.test.tsx`; TDD discipline from the global file applies unchanged.
- **Not a Next.js/web project.** This is a terminal app. React 19 function components apply (via
  `@opentui/react`), but no Next.js, no Tailwind, no browser assumptions, no web-vitals lint
  extends.

## Project conventions

- **Stack:** TypeScript (strict, ESM, ES2022+), Bun, OpenTUI (`@opentui/react`; keybindings via
  the in-repo `src/tui/keymap.ts` — see `DECISIONS.md` 2026-07-30), SQLite (`bun:sqlite`) for
  local UI state.
- **Version pinning matters here.** OpenTUI ships a native Zig core — pin exact versions of
  `@opentui/*` and record the tested Bun version. Upgrades are deliberate, tested changes, and any
  quirk found goes in `LEARNINGS.md`.
- **Architecture boundaries** (enforced; see `CLAUDE.md` invariants):
  - `src/beeper/` — the only module that talks to the Beeper API.
  - `src/state/` — pure reducer + selectors; no I/O.
  - `src/tui/` — rendering and input only; dispatches events, never mutates state.
  - `src/store/` — local SQLite persistence for non-authoritative UI state only.
  - `src/cli/` — entrypoints (`run`, `status`, `doctor`, config).
- **Errors:** normalize Beeper API errors in the adapter into typed error values the reducer can
  represent as UI state. Structured logging with context objects; **redact tokens and message
  bodies always** — redaction is not a log-level.
- **Testing:** reducers and adapter logic are unit-tested with fixtures; components tested with
  `bun test` where OpenTUI supports it; live-Beeper checks are manual smoke steps in slice
  acceptance criteria, never CI dependencies.
- **Secrets:** Beeper tokens go in the platform credential store (macOS Keychain first); config
  files hold references, never raw tokens. Nothing secret is ever committed, logged, or passed as
  a CLI argument.

## Publishable-repo hygiene

The repo is treated as public even while private (`docs/DECISIONS.md` 2026-07-30). Rules:

- **Fixtures and snapshots are synthetic.** Invent names ("Ada Lovelace", "#test-channel"), ids,
  and message bodies. To base a fixture on a real API response, scrub every value that identifies
  a person, chat, account, or endpoint **before** the file is first staged — never scrub in a
  follow-up commit.
- **Validation matrices record network + capability + outcome only.** Real account details used
  for live validation go in `local/` (gitignored), referenced from the plan as "see local notes".
- **Docs, journal, learnings, and commit messages** describe API shapes and behaviors — never
  quote real message content, contact names, or personal hostnames/IPs.
- **`local/` is the escape hatch** for anything private. If in doubt whether something is
  publishable, it goes in `local/` and the committed doc links to it by name.
- **Close-out includes a leak check:** before finishing a slice, scan the diff for personal data
  the same way you'd scan for tokens.
