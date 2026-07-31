---
title: Slice 12 — Remaining networks & capability messaging
status: active
created: 2026-07-30
updated: 2026-07-31
links:
  - ../../PRD.md § Phased delivery (Phase 2), § Acceptance scenarios (6)
  - PLAN-slice-9-phase1-validation.md
---

# Slice 12 — Remaining networks & capability messaging

## Goal

Discord, Instagram DMs, and X DMs validated and polished, and a systematic "this network can't do
that, because Beeper/provider says so" UX everywhere a capability is missing. Closes Phase 2.

## Context

Slice 9 built the validation matrix and harness for four networks; this slice runs the same
playbook for the remaining three and hardens the capability-unavailable UX that Slices 3–11 added
piecemeal into one consistent treatment.

## Approach

Extend the live validation matrix to Discord/Instagram/X (list, read, live inbound, send, reply,
search, attachments), fixing Phase-1/2-scoped issues it surfaces. Then audit every
capability-gated action and normalize the unavailable state: one shared component/pattern naming
the capability and its source ("Reactions aren't available for Signal via Beeper"), driven from
the adapter's capability data — no ad hoc strings scattered through the UI.

## Steps

- [~] Run the full validation matrix on Discord, Instagram DMs, X DMs. **Blocked — those three
  networks aren't connected on this Beeper** (only WhatsApp/Facebook/Beeper are). Ran a redacted
  capability probe on the **connected** networks instead (see matrix below); the Discord/IG/X
  matrix is a manual gate for Mitch once connected.
- [x] Fix scoped breakages; journal/backlog anything that belongs to Phase 3. (None surfaced by the
      connected-network probe; reply/archive plumbing reads real flags correctly.)
- [x] Capability-message audit: routed the only two gated actions (reply, archive) through one shared
      `checkCapability` / `capabilityUnavailableMessage` (`src/state/capabilities.ts`), fed by adapter
      capability flags; tests over the mapping (`capabilities.test.ts`). Removed the two ad-hoc strings.
- [x] Scroll-behavior polish: added a burst smoke scenario (12 rapid inbound while scrolled up) —
      reading position holds, offset grows with the burst, affordance shown, no snap (scenario 3b).
- [x] Smoke fixtures include a capability-limited profile: Slack chat with `canReply: false`
      (scenario 8b asserts the shared unavailable message).

### Live capability matrix (redacted, connected networks, 2026-07-31)

Over 100 chats / 3 networks (✓ supported · ✗ reported-unsupported · ? not reported → attempt-then-degrade):

| Network           | reply          | archive        |
| ----------------- | -------------- | -------------- |
| WhatsApp (34)     | ✓ all          | ? all          |
| Facebook (65)     | ✓ all          | ? all          |
| Beeper/Matrix (1) | ? (unreported) | ? (unreported) |

Findings: **reply capability is reported** by WhatsApp + Facebook (supported), grounding the reply
gate in real data. **Archive is not reported** by any connected network → the app relies on
attempt-then-degrade there (the explicit-`false` unsupported path is fixture-covered, not live-hit).

## Acceptance criteria

- [~] All seven day-one networks list chats and read messages; send/reply/search/attachments per
  network. **Connected networks (WhatsApp/Facebook/Beeper) exercised** across Slices 9–11;
  Discord/Instagram/X **pending connection** (manual gate).
- [x] PRD acceptance scenario 6: a capability-limited account names the unavailable capability and
      its source ("Replies not available for Slack via Beeper") — one shared pattern, no dead
      controls; audited (reply + archive are the only gated actions today).
- [x] Busy-channel live bursts don't break reading position (smoke scenario 3b).
- [~] `docs/STATUS.md` declares Phase 2 complete. **Held** — Phase 2 close needs the Discord/IG/X
  live matrix, which is blocked on those networks being connected.

## Out of scope

New features — this slice validates and hardens what exists. Reactions/receipts display (Slice 14).

## Risks / open questions

- Instagram and X bridges are historically the flakiest — expect matrix gaps that are Beeper-side,
  not ours; the deliverable is honest reporting, not fixing Beeper.
