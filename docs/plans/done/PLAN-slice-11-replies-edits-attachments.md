---
title: Slice 11 — Replies, edits & attachments
status: done
created: 2026-07-30
updated: 2026-08-01
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

- [x] Message selection cursor + keymap (`v` enters, `j`/`k` move, `Esc` clears); selected row is
      highlighted, and a footer hints the reply/open/save keys. Reducer-driven (`selectedMessageId`),
      cleared on chat change.
- [x] Reply flow: `r` on the selected message → compose shows a quoted context header (sender +
      snippet), cancellable (blur cancels), adapter carries `replyToMessageID`, capability-gated on
      `chat.canReply` (`capabilities.reply >= 1`) with a named unsupported notice; reducer + tests.
- [x] Edit events render in place with the `(edited)` marker — `mergeMessages` replaces by id, so an
      inbound edit updates the existing row (no duplicate); reducer test proves it.
- [x] Attachment metadata rendering (kind, name, size where present); `o`/`s` open/save via the
      adapter `assets.download`; progress + failure notices; temp-file hygiene — the OS side-effects
      are injected (`os-open.ts`), and no attachment path appears in a notice or log (test-asserted).
- [x] Per-network smoke additions: reply on a supporting network (threads with `replyToId`),
      unavailable-state on a non-supporting one, and attachment open/save (scenarios 8, 8b, 9).

## Acceptance criteria

- [~] Reply to a selected message lands threaded/quoted on a supporting network; a non-supporting
  network names the missing capability instead of a dead control. **Automated path proven** —
  smoke scenario 8 threads the reply (`replyToId` on the optimistic bubble), 8b shows the named
  unsupported notice; the adapter's `replyToMessageID` param shape is **live-confirmed against
  Beeper**. **Live send is a manual step** (invariant 5 forbids auto-sending a real message to a
  contact): send a reply from the TUI on a supporting network and confirm it lands threaded.
- [x] An edited inbound message updates in place with an edit marker (reducer test).
- [x] An image attachment opens in the OS viewer from the placeholder; failures are visible; no
      attachment path appears in logs/notices (test-asserted). **Attachment download endpoint
      live-validated** (redacted read-only run: `assets.download` returns a local path).
- [x] `bun test` + smoke suite green (315 tests; scenarios 8/8b/9 added).

## Out of scope

Sending attachments, inline image preview/media gallery (Phase 3 "richer media preview" at
earliest), reactions (Slice 14, read-only).

## Risks / open questions

- Reply semantics differ per network (thread vs quote vs unsupported) — render what Beeper
  reports; document per-network behavior in `LEARNINGS.md`. **Per-network reply rendering is
  still to be observed live** (needs real replies sent/received on each network); the capability
  gate (`canReply`) is in place so unsupported networks degrade honestly meanwhile.

## Follow-up (manual, Mitch)

- [x] **Live reply send** — done 2026-08-01. Mitch sent real replies from the TUI on a connected
      network and confirmed it works. This was the one acceptance item that requires an explicit user
      send (invariant 5). **Slice 11 is now fully closed.**
