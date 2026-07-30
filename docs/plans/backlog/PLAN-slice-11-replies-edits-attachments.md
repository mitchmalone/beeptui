---
title: Slice 11 — Replies, edits & attachments
status: planned
created: 2026-07-30
updated: 2026-07-30
links:
  - ../../PRD.md § Conversation reading, § Compose and sending (reply)
  - PLAN-slice-5-compose-send.md
---

# Slice 11 — Replies, edits & attachments

## Goal

Reply to a specific selected message, see edits rendered faithfully, and open/download attachments
from readable placeholders.

## Context

Slice 4 renders reply/quote context and edit markers read-only, and shows attachment placeholders;
Slice 5 sends plain messages. This slice completes the interaction side, gated per-network on
capability detection (Slice 1).

## Approach

Add a message-selection mode in the conversation (move a cursor across messages, distinct from
scroll): `r` starts a reply to the selected message — compose shows a quoted context header,
cancellable — and the send call carries the reply reference where the network supports it, with an
honest "replies not supported on this network" state where it doesn't. Edits update in place via
existing live events, with an edited marker. Attachments get `o`pen (download to a temp/cache path
via the adapter, then OS `open`) and `s`ave-to-downloads actions, with delivery/error states; paths
never leak into logs.

## Steps

- [ ] Message selection cursor + keymap (navigate, clear); visual selection treatment.
- [ ] Reply flow: compose reply context UI, cancel, adapter send-with-reply-ref, capability gating
      with named unavailable state; reducer + tests.
- [ ] Edit events render in place with marker (verify against live fixtures per network).
- [ ] Attachment metadata rendering (type, name, size where present); `o`/`s` actions via adapter
      download; progress + failure states; temp-file hygiene (cache dir, no logging of paths).
- [ ] Per-network smoke additions: reply on a supporting network, unavailable-state on a
      non-supporting one (PRD acceptance scenario 6 pattern).

## Acceptance criteria

- [ ] Reply to a selected message lands threaded/quoted on a supporting network (validated live);
      a non-supporting network names the missing capability instead of a dead control.
- [ ] An edited inbound message updates in place with an edit marker.
- [ ] An image attachment opens in the OS viewer from the placeholder; failures are visible; no
      attachment path appears in logs (test-asserted).
- [ ] `bun test` + smoke suite green.

## Out of scope

Sending attachments, inline image preview/media gallery (Phase 3 "richer media preview" at
earliest), reactions (Slice 14, read-only).

## Risks / open questions

- Reply semantics differ per network (thread vs quote vs unsupported) — render what Beeper
  reports; document per-network behavior in `LEARNINGS.md`.
