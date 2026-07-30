---
title: Slice 2 — State core (event reducer)
status: done
created: 2026-07-30
updated: 2026-07-30
links:
  - ../../PRD.md § Technical approach (application state)
  - PLAN-slice-1-beeper-adapter-doctor.md
---

# Slice 2 — State core (event reducer)

## Goal

A pure, fully unit-tested event reducer and normalized state model — accounts, chats, messages,
drafts, selection, connection state, optimistic sends — that Slices 3–8 render and drive. No UI in
this slice.

## Context

CLAUDE.md invariant 4: all state changes flow through the reducer; UI dispatches events and renders
state. The adapter (Slice 1) produces typed data and errors; this slice defines how they become
application state deterministically.

## Approach

Single `AppState` shape with normalized entity maps (accounts/chats by id, messages by chat id with
ordered, bounded pages) and a discriminated-union `AppEvent` type covering adapter results, live
events (shape defined now, fed in Slice 6), and user intents. Reducer is `(state, event) => state`,
pure and exhaustive. Selectors for derived views (inbox ordering, unread, active conversation).
Optimistic sends: a pending message with a client id, reconciled or failed by later events.

## Steps

- [x] Define `AppState`, entity types (derived from the adapter's models — don't duplicate), and
      the `AppEvent` union.
- [x] Reducer: chats loaded/updated, messages page loaded (prepend older / append newer), selection
      and navigation events, connection state transitions.
- [x] Optimistic send lifecycle: `send-requested` → pending message → `send-succeeded` (reconcile
      by client id) / `send-failed` (visible failed state, retry event). Never duplicate on
      reconnect.
- [x] Draft events per chat (state only; persistence is Slice 7).
- [x] Bounded history: page cap per chat with eviction rules that preserve scroll anchoring info.
- [x] Selectors: inbox rows (order, unread, network marker data), active conversation view,
      connection banner.
- [x] Exhaustive `bun test` coverage, written test-first: every event type, ordering edge cases
      (out-of-order pages, unknown chat ids), and optimistic-send races.

## Acceptance criteria

- [x] Reducer and selectors are pure modules with zero I/O imports (no adapter, no OpenTUI).
- [x] Every `AppEvent` variant has at least one test; optimistic-send race cases (success after
      failure, duplicate event, reconnect replay) are covered.
- [x] `bun test` green; mutation of prior state is impossible (frozen in tests or verified by
      reference checks).

## Outcome (2026-07-30)

Shipped. `src/state/` is `types.ts` (AppState + `AppEvent` union + `initialState`), `reducer.ts`
(pure `reduce(state, event)`), and `selectors.ts` — 24 tests, all pure. Purity verified: every
`@/beeper` import is `import type` (erased); no adapter or OpenTUI runtime. Optimistic-send races
(success-after-failure, duplicate succeeded, live echo of the same server id) and immutability are
covered.

**Design notes:** messages are an ordered, bounded window per chat (cap `MAX_MESSAGES_PER_CHAT`,
deduped by id); pending sends sort last via a sentinel key until the server echo reconciles them by
`clientId`. The message-identity reconciliation (clientId ↔ server id ↔ live echo) is the risk
flagged below — validate against real API behavior in Slice 6 and journal any surprises.

## Out of scope

Rendering, live WebSocket wiring, persistence, search.

## Risks / open questions

- Message identity across optimistic send and server echo (client id vs server id vs live event) —
  design for reconciliation now; validate against real API behavior in Slice 6 and journal it.
