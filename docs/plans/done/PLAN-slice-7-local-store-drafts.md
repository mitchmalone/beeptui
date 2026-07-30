---
title: Slice 7 — Local store & drafts
status: done
created: 2026-07-30
updated: 2026-07-31
links:
  - ../../PRD.md § Compose and sending (drafts), § Inbox and navigation (view persistence)
  - PLAN-slice-2-state-core.md
  - PLAN-slice-5-compose-send.md
---

# Slice 7 — Local store & drafts

## Goal

Restarting (or crashing) `beeptui` loses nothing that matters: per-chat unsent drafts, last
selected chat, and scroll position come back; chat metadata cache makes the inbox usable fast.

## Context

The PRD specifies a small SQLite store for non-authoritative UI state only — Beeper stays the
source of truth for messages. Pending decision (STATUS #5) assumed here: **metadata/drafts only,
no message-body cache** in v1. Bun ships `bun:sqlite` natively.

## Approach

`src/store/` wraps one SQLite database (`~/.local/state/beeptui/` or platform equivalent) behind a
narrow typed interface: drafts (chat id → text, updated-at), view state (last chat, scroll anchor),
chat metadata cache (for fast inbox paint before the first fetch returns). The runtime hydrates
state from the store at boot and persists on a debounced write-through from reducer changes — no
component talks to SQLite directly. Crash-safety via SQLite's atomicity; schema versioned with
simple forward migrations.

## Steps

- [x] Store module (`src/store/store.ts` + `schema.ts`): open/create DB (`bun:sqlite`), versioned
      forward-migration runner, typed accessors. Tables are `drafts`/`view_state`/`chat_cache`/
      `schema_meta` only — no message bodies, no tokens.
- [x] Draft persistence (`persistence.ts`): debounced write-through on `draft/changed`, delete when
      cleared (which is what a successful send does), restore into reducer state at boot.
- [x] View state: persist last selected chat + scroll-anchor message id; restore selection at boot
      "where safe" (only if the chat still exists in the hydrated cache). _Scroll-anchor restore
      into the loaded page is captured but not yet wired — see Outcome._
- [x] Chat metadata cache: write-through from chat summaries; hydrate inbox at boot (before the live
      bootstrap) so it paints from cache, reconciled when fresh data lands.
- [x] Kill-test: a committed draft survives a simulated crash (reopen without `close()`); WAL
      durability. Loss bound is the debounce window.
- [x] Store + migration + persistence tests against temp DBs; forward-migration test that preserves
      data across an added column.

## Acceptance criteria

- [x] Draft survives full restart, restored into the right chat, never auto-sent (persistence uses
      only `draft/changed`/`chat/selected`/`chats/loaded`; a guard test asserts no `send/requested`).
- [~] Launch-to-usable-inbox on warm cache is fast — the metadata cache hydrates the inbox
  synchronously at boot before any network call. Not timed on live hardware yet (needs a warm
  cache + the parent's Slice 6 live path); left for the Phase-1 validation slice.
- [x] The DB has no message bodies or tokens — asserted by a schema test (exact table set) and a
      content scan of the DB file.
- [x] `bun test` green (16 new store tests; 157 total on this branch).

## Outcome (2026-07-31)

Shipped. `src/store/` is the only SQLite consumer (invariant 1): `schema.ts` (versioned
forward-migration runner), `store.ts` (`openUiStore` → typed `UiStore`: drafts / view-state /
chat-cache), and `persistence.ts` (`attachPersistence` — hydrate at boot + debounced write-through).
`launch.ts` wiring is 3 lines (open store, attach before bootstrap, `flush()` on quit) to keep the
merge with the parallel Slice 6 branch trivial. 16 store tests; full suite 157 green.

**Notes for the parent reconciling with Slice 6:**

- `launch.ts` edits are minimal and localized (imports + the block right after `const store =
createStore()`, plus one line in `onQuit`). Should merge cleanly with Slice 6's runtime edits.
- `attachPersistence` hydrates by dispatching `chats/loaded` (from cache) → `draft/changed` →
  `chat/selected`, and must run **before** `bootstrap` so live data reconciles over the cache. The
  subscribe-side persists the cache on every `chats/loaded`, so live updates keep it warm.
- **Deferred:** the scroll-anchor id is persisted, but _restoring_ it into the loaded page ("where
  safe" — only if the anchor is in the first fetched page) needs a hook in the message-load flow,
  which is Slice 6/runtime territory. Selection restore works today; scroll restore is a small
  follow-up. The warm-cache launch-time target wasn't measured on live hardware (Phase-1 validation).
- Debounce lives in `persistence.ts` (default 400ms); tests drive `flush()` to avoid timer flake.

## Out of scope

Message-body/history caching (revisit post-v1 per pending decision), search indexes (Slice 10's
local fallback may extend the store — design for extension, don't build it).

## Risks / open questions

- Scroll-position restore semantics when history has moved on — "where safe" means: restore chat
  selection always, scroll anchor only if the anchor message is in the first fetched page.
