# AGENTS.md — beeptui

A terminal client for Beeper: read, watch, and reply across your chat networks without leaving the
terminal. One monorepo: the app (`apps/cli`) and the marketing site (`apps/www`); the Homebrew tap
(`mitchmalone/homebrew-tap`) is a generated release satellite — fix the generator
(`apps/cli/src/packaging/homebrew.ts`), never the output.

This file carries only this project's **deltas**. The full standard is vendored at
`docs/STANDARDS.md`; where this project knowingly diverges, `DEVIATIONS.md` says how and why.
**`docs/PRD.md` outranks this file on product scope and technical direction** — when they appear
to conflict, follow the PRD and flag it.

Session protocol, docs discipline, TDD, commits, and hooks: as the standard prescribes — orient on
`docs/STATUS.md` and `docs/plans/active/` first; slices live in `docs/plans/`; check
`LEARNINGS.md` for project-specific gotchas.

## Stack

- **Bun** — package manager, runtime, test runner, and compiler (`bun build --compile`); the
  compiled-binary deliverable makes this a Bun repo per the standard. `bun.lock` at the root is
  the only lockfile. Pinned Bun version in CI: see `BUN_VERSION` in the workflows.
- **`apps/cli`** — TypeScript strict, OpenTUI (`@opentui/react`), SQLite via `bun:sqlite`.
  **Version pinning matters**: OpenTUI ships a native Zig core — pin exact `@opentui/*` versions,
  record the tested Bun version, and treat upgrades as deliberate, tested changes
  (quirks → `LEARNINGS.md`).
- **`apps/www`** — Next.js 16 App Router, **static export** (`output: 'export'` — removing it is
  a recorded deviation), React 19, Tailwind CSS 4 (CSS-first: theme tokens live in
  `src/app/globals.css`, there is no `tailwind.config`), shadcn (base-nova style, Base UI,
  lucide; add components with `bunx shadcn@latest add <name>`). Dark mode via `next-themes` +
  CSS variables — no ad-hoc `dark:` forks. Next 16 may differ from your training data: read
  `node_modules/next/dist/docs/` before writing Next-specific code.

## Commands

```bash
bun install                              # deps + lefthook hooks (prepare)
bun run dev                              # launch the TUI
bun run --filter '@beeptui/www' dev      # site dev server on :3000
bun run build                            # compile → apps/cli/dist/beeptui
bun run verify                           # the one gate: typecheck + lint + format:check + test
```

## Invariants — non-negotiable (`apps/cli`)

1. **Beeper is the source of truth for messages; this app is a client.** No new bridge, protocol,
   credential store, or messaging service. The local store holds only non-authoritative UI state
   (drafts, metadata cache, last-view state, token reference).
2. **The TUI calls the Beeper API directly** through the typed adapter. Never spawn or scrape the
   `beeper` CLI.
3. **All Beeper I/O goes through the adapter** (`apps/cli/src/beeper/`). It owns auth, pagination,
   capability detection, and error normalization. No `fetch` to Beeper anywhere else.
4. **All state changes flow through the event reducer.** UI components render state and dispatch
   events; they never mutate state or call the adapter directly.
5. **Never send a message except on an explicit user send action.** Not on launch, reconnect,
   retry-ambiguity, or focus change. Failed sends surface visibly; never silently pretend a send
   succeeded.
6. **No secrets or message content in logs, errors, terminal titles, or shell arguments.** Tokens
   live in the platform credential store. Diagnostics are redacted by default — redaction is not
   a log-level.
7. **No outbound requests except to the configured Beeper endpoint.** No analytics, no telemetry,
   no update checks.
8. **Degrade visibly.** Missing capability, dead endpoint, or unsupported network operation shows
   a named, honest state — never a dead control or a fake success.
9. **Every commit is publishable** (`docs/DECISIONS.md` 2026-07-30). No real conversation content,
   contact names, chat titles, account identifiers, tokens, or personal endpoints in code,
   fixtures, snapshots, docs, plans, or commit messages.

## How to build things here (`apps/cli`)

- **Reducer first.** New behavior starts as events + reducer transitions with unit tests, then
  adapter wiring, then UI. If it can be tested without rendering a terminal, it must be.
- **Fixtures over live calls in tests.** Live Beeper validation is a manual smoke step in a
  slice's acceptance criteria, never a unit-test or CI dependency.
- **Capability detection over assumption.** Anything network- or version-dependent is gated on
  what the API reports, with an explicit fallback state.
- **Keyboard bindings are declared, not scattered** — all through `apps/cli/src/tui/keymap.ts`, so
  the help overlay generates from the same source.
- **Bounded memory.** Message history is paged and capped; never accumulate unbounded messages.
- Errors: normalize Beeper API errors in the adapter into typed values the reducer can represent
  as UI state.

## Website rules (`apps/www`)

- **Content must be true.** `apps/cli` (its `README.md`, `docs/STATUS.md`) is the source of truth
  for what beeptui does. Never advertise a feature that isn't shipped; features pending live
  validation are described as such or omitted.
- **The install command is exactly** `brew install mitchmalone/tap/beeptui` — everywhere it
  appears.
- **Static marketing site.** No backend, no auth, no analytics or tracking, no API routes unless
  Mitch asks. `src/data/release.json` is stamped in each release-prep commit; the release gate
  refuses a tag that disagrees with it.
- **No test runner in `apps/www`** — its correctness gate is typecheck + lint (wired into the
  root `verify`) plus `next build` in CI, and a visual check of affected pages. Site tests would
  be `*.test.ts` files picked up by root `bun test` the day they exist.
- Use the `@/*` aliases (`components.json`, `tsconfig.json`), not relative walks. Demo clips are
  recorded with VHS from `apps/www/demo/` tapes against the app's `--demo` scenarios.

## Publishable-repo hygiene

The repo is public. Beyond invariant 9:

- **Fixtures, snapshots, screenshots, and demo clips are synthetic.** Invent names and bodies; to
  base a fixture on a real API response, scrub everything identifying **before** it is first
  staged — never scrub in a follow-up commit (it's already in history).
- **Validation matrices record network + capability + outcome only.** Real account details go in
  `local/` (gitignored), referenced as "see local notes".
- **`local/` is the escape hatch** for anything private. If in doubt, it goes in `local/`.
- **Close-out includes a leak check:** scan the diff for personal data the same way you'd scan
  for tokens. gitleaks runs pre-commit and in CI, but it can't recognize a contact name.

## Definition of done — project deltas

Beyond the standard's (verify green, tests-first, docs closed out in the same commit, CI checked):

1. No Beeper I/O outside `apps/cli/src/beeper/`; no state mutation outside the reducer.
2. No token, message body, or attachment path in logs or errors.
3. Website claims still trace to shipped behavior after the change.
4. Anything non-obvious learned → dated `docs/JOURNAL.md` entry; durable gotchas → `LEARNINGS.md`.
