---
title: Slice 6 — Live updates & reconnect
status: planned
created: 2026-07-30
updated: 2026-07-30
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

- [ ] Watch/WebSocket client: connect, subscribe, parse events (new message, edit, receipt, chat
      summary), normalized errors; fixture/replay tests (synthetic/scrubbed fixtures only —
      AGENTS.md publishable-repo hygiene).
- [ ] Reconnect state machine: connected → degraded → reconnecting with backoff; connection events
      dispatched to the reducer; status bar reflects each state.
- [ ] Gap resync on reconnect, deduplicated by message id (tests for replayed and out-of-order
      events).
- [ ] Polling fallback when watch is unsupported, clearly indicated in the status bar.
- [ ] "New messages" affordance when the conversation is scrolled up; jump-to-latest binding;
      bottom-pinned view follows new messages live.
- [ ] Inbox rows update (preview, time, unread) from live events without stealing selection.
- [ ] Verify typing in compose is never interrupted by event application (no cursor/focus loss).

## Acceptance criteria

- [ ] PRD acceptance scenario 3: an inbound Slack message renders live; when scrolled up, the
      affordance appears and reading position holds.
- [ ] PRD acceptance scenario 4: quitting Beeper mid-draft shows disconnected, keeps the draft,
      resumes on return, sends nothing automatically.
- [ ] Inbound message appears in conversation + inbox row within 2s of Beeper receipt (manual
      timing check on live smoke).
- [ ] Reconnect storm produces no duplicate messages in state (tests).
- [ ] `bun test` green.

## Out of scope

Draft persistence to disk (Slice 7 — this slice only proves in-memory drafts survive disconnect),
notification hooks (Slice 14).

## Risks / open questions

- The actual watch protocol (WebSocket? SSE? long-poll?) and its event vocabulary are unverified —
  step 1 of Slice 1 should have journaled this; adjust the design here if reality differs.
