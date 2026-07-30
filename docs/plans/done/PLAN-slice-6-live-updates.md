---
title: Slice 6 — Live updates & reconnect
status: done
created: 2026-07-30
updated: 2026-07-31
links:
  - ../../PRD.md § Live updates and unread state
  - PLAN-slice-1-beeper-adapter-doctor.md
  - PLAN-slice-2-state-core.md
---

# Slice 6 — Live updates & reconnect

## Goal

New messages appear in the active conversation and update inbox rows within seconds, without manual
refresh, without disrupting typing or scroll — and a Beeper disconnect degrades visibly and
recovers automatically.

## Context

The adapter (Slice 1) covers HTTP; this slice adds its WebSocket/watch client. The reducer
(Slice 2) already defines live-event shapes. PRD rules: fall back to bounded polling only when
watch is unavailable; a scrolled-up view gets a "new messages" affordance instead of snapping to
bottom; a disconnect must not crash or lose a draft; reconnect with backoff; connection state
always visible.

## Approach

Extend `src/beeper/` with a watch client that owns subscription lifecycle, heartbeat/liveness, and
exponential backoff with jitter, emitting the same typed events the reducer consumes. On
reconnect, resync (refetch chat summaries + active-chat tail) to close the gap window —
reconciled by id so replays can't duplicate messages or trigger sends. Polling fallback reuses the
same event pipeline at a bounded interval.

## Steps

- [x] Watch/WebSocket client (`watch.ts` + `watch-protocol.ts`): connect, subscribe
      (`subscriptions.set`), parse `message.upserted`/`chat.upserted`/`*.deleted`/`error`, normalized.
      Pure protocol + fake-socket client tests; **protocol confirmed live** (probe).
- [x] Reconnect state machine: connecting → connected → reconnecting with exponential backoff +
      jitter; status dispatched to the reducer → status bar. Fake-socket + fake-scheduler tests.
- [x] Gap resync on reconnect (`resyncAfterReconnect`): refetch summaries + active tail, deduped by
      id in the reducer (replay is a no-op — tested).
- [~] Polling fallback when watch is unsupported — **deferred**: this Beeper build supports the
  WebSocket (validated), so the fallback is unnecessary for now. Noted for a capability-gated
  revisit if a build lacks `/v1/ws`.
- [x] "New messages" affordance when scrolled up (`newMessagesBelow`): reading position preserved
      (offset bumped on append), affordance shown, `G`/scroll-to-bottom jumps to latest + dismisses.
- [x] Inbox rows update from live events without stealing selection (`chat.upserted` → refetch that
      row; `message/received` doesn't touch selection). Reducer-level; tested.
- [x] Typing in compose is never interrupted: live events dispatch to the store; the compose editor
      holds its state in a `useRef` (Slice 5), so re-renders don't disturb the cursor/text.

## Acceptance criteria

- [x] Scenario 3 (reading side): an inbound message renders live and, when scrolled up, the
      affordance appears and reading position holds — reducer-tested; **live-validated** end-to-end
      (real self-message flowed socket → store).
- [~] Scenario 4: disconnect shows a degraded state and keeps the draft, sends nothing automatically
  — the connection state + reconnect + invariant-5 replay-safety are tested; the full
  quit-Beeper-mid-draft-and-resume dance is a manual live check (deferred to Slice 9).
- [x] Inbound message reaches conversation + store within ~seconds of receipt — live smoke confirmed.
- [x] Reconnect/replay produces no duplicate messages in state (dedup-by-id tests + live: 3 status
      upserts → 1 stored message).
- [x] `bun test` green (161 tests).

## Outcome (2026-07-31)

Shipped and **live-validated**. `src/beeper/watch-protocol.ts` (pure parse/subscribe/backoff) +
`watch.ts` (`startWatch` socket client with backoff reconnect, injectable socket for tests) feed
`runtime.applyWatchEvent`/`resyncAfterReconnect`; `launch.ts` subscribes on boot and resyncs on
reconnect. The reducer gained the `newMessagesBelow` affordance (offset-preserving on append).
Probed the real `/v1/ws` to nail the protocol (`subscriptions.set`, `message.upserted` with full
`entries` → `mapMessage`) — see `LEARNINGS.md`. End-to-end live smoke: a self-message flowed socket →
`message/received` → store, deduped.

**Deferred:** polling fallback (this build has the WS); the quit-Beeper-mid-draft manual dance
(Slice 9); message/chat _delete_ events (parsed but not yet applied — the reducer has no delete
transition). Send-echo reconciliation relies on dedup-by-id (the optimistic id = `pendingMessageID`);
confirm id equality holds across networks during Slice 9 validation.

## Out of scope

Draft persistence to disk (Slice 7 — this slice only proves in-memory drafts survive disconnect),
notification hooks (Slice 14).

## Risks / open questions

- The actual watch protocol (WebSocket? SSE? long-poll?) and its event vocabulary are unverified —
  step 1 of Slice 1 should have journaled this; adjust the design here if reality differs.
