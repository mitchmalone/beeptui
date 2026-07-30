---
title: Slice 12 — Remaining networks & capability messaging
status: planned
created: 2026-07-30
updated: 2026-07-30
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

- [ ] Run the full validation matrix on Discord, Instagram DMs, X DMs; record per-capability
      results in this plan in redacted form (network + capability + outcome only — AGENTS.md
      publishable-repo hygiene; account specifics stay in `local/`).
- [ ] Fix scoped breakages; journal/backlog anything that belongs to Phase 3.
- [ ] Capability-message audit: inventory every gated action, route all of them through one
      unavailable-state pattern fed by adapter capability data; tests over the mapping.
- [ ] Scroll-behavior polish pass across networks (PRD Phase 2 names "stable scroll behavior") —
      verify anchors under bursts of live events on busy channels (Discord/Slack).
- [ ] Update smoke fixtures to include one capability-limited network profile.

## Acceptance criteria

- [ ] All seven day-one networks list chats and read messages where Beeper exposes them; send
      validated individually; every unsupported operation is clearly reported (PRD success
      criterion).
- [ ] PRD acceptance scenario 6 passes: an account whose API forbids an operation names the
      unavailable capability and its source — no dead controls anywhere (audit checklist in this
      plan, complete).
- [ ] Busy-channel live bursts don't break reading position (manual check + smoke where feasible).
- [ ] `docs/STATUS.md` declares Phase 2 complete.

## Out of scope

New features — this slice validates and hardens what exists. Reactions/receipts display (Slice 14).

## Risks / open questions

- Instagram and X bridges are historically the flakiest — expect matrix gaps that are Beeper-side,
  not ours; the deliverable is honest reporting, not fixing Beeper.
