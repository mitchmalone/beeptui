# CLAUDE.md

This file is read at the start of every session. Keep it lean and behavioural — it tells you (the
coding agent) how to work in this repo. **`docs/PRD.md` is the source of truth for product scope and
technical direction; this file is the operating rules.** When they appear to conflict, follow the
PRD and flag it.

Coding standards live in the global `~/.claude/AGENTS.md` plus this repo's `AGENTS.md` (project
overrides — notably: **Bun**, not npm; **`bun test`**, not Vitest). Read both. Check `LEARNINGS.md`
for project-specific gotchas.

---

## Start here — every session

1. **Orient.** Read `docs/STATUS.md` and anything in `docs/plans/active/` before doing anything
   else.
2. **Pick up the work.** Slices live as plans in `docs/plans/backlog/`. To start one: move it to
   `docs/plans/active/`, set `status: active`, update the `updated` date, and branch off `main`
   (`feat/slice-<n>-<kebab-slug>` or `fix/…` per global conventions). Only one slice is `active`
   at a time unless Mitch says otherwise.
3. **Plan before non-trivial work** that isn't already a slice: copy `docs/plans/_TEMPLATE.md` into
   `docs/plans/active/` and fill it in (goal, approach, step checklist, acceptance criteria,
   out-of-scope) _before_ writing code. Trivial changes skip this.
4. **Work the plan, TDD.** Failing test first, minimum code to green, refactor. Keep the plan's
   checklist current as steps land.
5. **Close out — in the same PR/commit series as the code:**
   - Update `docs/STATUS.md` to reflect reality.
   - Append a dated entry to `docs/JOURNAL.md` for anything non-obvious you learned; add durable
     gotchas to `LEARNINGS.md`.
   - Move the finished plan to `docs/plans/done/` and set `status: done`.
   - Record any decision beyond the PRD in `docs/DECISIONS.md` (append-only, newest at top).

> The docs are fast feedback; a slice is not done until the docs reflect it.

---

## Invariants — non-negotiable

1. **Beeper is the source of truth for messages; this app is a client.** No new bridge, protocol,
   credential store, or messaging service. The local store holds only non-authoritative UI state
   (drafts, metadata cache, last-view state, token reference).
2. **The TUI calls the Beeper API directly** through the typed adapter. Never spawn or scrape the
   `beeper` CLI.
3. **All Beeper I/O goes through the adapter** (`src/beeper/` once it exists). It owns auth,
   pagination, capability detection, and error normalization. No `fetch` to Beeper anywhere else.
4. **All state changes flow through the event reducer.** UI components render state and dispatch
   events; they never mutate state or call the adapter directly. This is what keeps the app
   deterministic and testable without a terminal.
5. **Never send a message except on an explicit user send action.** Not on launch, reconnect,
   retry-ambiguity, or focus change. Failed sends surface visibly; never silently pretend a send
   succeeded.
6. **No secrets or message content in logs, errors, terminal titles, or shell arguments.** Tokens
   live in the platform credential store. Diagnostics are redacted by default.
7. **No outbound requests except to the configured Beeper endpoint.** No analytics, no telemetry,
   no update checks in v1.
8. **Degrade visibly.** Missing capability, dead endpoint, or unsupported network operation shows a
   named, honest state — never a dead control or a fake success.
9. **Every commit is publishable.** The repo may be open-sourced; treat it as public now
   (`docs/DECISIONS.md` 2026-07-30). No real conversation content, contact names, chat titles,
   account identifiers, tokens, or personal endpoints in code, fixtures, snapshots, docs, plans,
   or commit messages — fixtures are synthetic/scrubbed, validation results are redacted. Private
   working notes go in `local/` (gitignored).

---

## How to build things here

- **Reducer first.** New behavior starts as events + reducer transitions with unit tests, then the
  adapter wiring, then the UI. If it can be tested without rendering a terminal, it must be.
- **Fixtures over live calls in tests.** The adapter is tested against recorded/synthetic API
  fixtures. Live Beeper validation is a manual/smoke step in each slice's acceptance, not a unit
  test dependency.
- **Capability detection over assumption.** Anything network- or version-dependent (edits,
  receipts, reactions, search scope) is gated on what the API reports, with an explicit fallback
  state.
- **Keyboard bindings are declared, not scattered.** All bindings go through the keymap layer
  (`src/tui/keymap.ts` — see `docs/DECISIONS.md` 2026-07-30) so the help overlay can be generated
  from the same source.
- **Bounded memory.** Message history is paged and capped; never accumulate an unbounded array of
  messages or an entire account's history.

---

## Commands

```bash
bun install         # deps (bun.lock is the lockfile)
bun run dev         # launch the TUI locally
bun run typecheck   # tsc --noEmit
bun run lint        # ESLint
bun run format      # Prettier --write
bun test            # bun:test — unit + component tests
```

(Defined in Slice 0; keep this block current as scripts land.)

---

## Repo map

```
src/beeper/    # Typed Beeper API adapter: HTTP + WebSocket, auth, capabilities, error normalization.
src/state/     # Event reducer, normalized entities, selectors. Pure, no I/O.
src/tui/       # @opentui/react components, keymap, layout. Rendering + input only.
src/store/     # Local SQLite store: drafts, metadata cache, last-view state.
src/cli/       # run / status / doctor / config entrypoints.
docs/          # PRD, STATUS, ROADMAP, JOURNAL, DECISIONS, RUNBOOK, plans/ — see protocol above.
```

(Planned layout — created by Slice 0; adjust here if it lands differently.)

---

## Commits & PRs

- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`), enforced by
  commitlint. Explain the why; subject < 72 chars.
- Husky hooks: pre-commit lint-staged, commit-msg commitlint, pre-push `bun test`. Never
  `--no-verify`.
- One slice = one PR (or one clean commit series if working without PRs). Doc updates ship _with_
  the code, not in a follow-up.
- Squash merge to `main`. After pushing, check the GitHub Actions run — don't assume green.

---

## Definition of done

1. `bun run typecheck` passes (strict mode, no `any` escapes).
2. ESLint + Prettier clean.
3. `bun test` green; new reducer/adapter behavior has tests written test-first.
4. No Beeper I/O outside `src/beeper/`; no state mutation outside the reducer.
5. No token, message body, or attachment path in logs or errors.
6. The slice plan's acceptance criteria are checked off, and `docs/STATUS.md`, `docs/JOURNAL.md`,
   and the plan are updated in the same change.

---

## Don't

- Don't call the Beeper API outside the adapter, or shell out to the `beeper` CLI.
- Don't put state logic in TUI components or I/O in the reducer.
- Don't write production code without a failing test first.
- Don't auto-send, auto-retry a send ambiguously, or swallow a send failure.
- Don't log or echo secrets or message content; don't add telemetry.
- Don't commit anything unpublishable — real chats, contacts, ids, captured API responses — and
  don't scrub after the fact; it's already in history (invariant 9).
- Don't add a dependency a Bun/standard-library API covers.
- Don't finish a slice without updating `docs/`.
