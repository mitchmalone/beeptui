---
title: Slice 4 — Conversation view
status: planned
created: 2026-07-30
updated: 2026-07-30
links:
  - ../../PRD.md § Conversation reading
  - PLAN-slice-3-tui-shell-inbox.md
---

# Slice 4 — Conversation view

## Goal

Open a chat from the inbox and read it: recent messages on open, older history paged in on upward
scroll, with clear author/timestamp/network/delivery-state rendering.

## Context

Slice 2's reducer already models paged message history; Slice 3 renders the shell. This slice fills
the center pane and wires history pagination through the adapter. The PRD requires bounded memory
and honest rendering of what Beeper returns (replies/quotes, edits, delivery/error states when
present).

## Approach

Message list component with its own scroll/anchor model: opening a chat loads the most recent page
and pins to bottom; scrolling up past the loaded top (or an explicit shortcut) dispatches an
older-page fetch, preserving the reading position when the page prepends. Message rendering handles
wrapped multiline text, sender identity, timestamps, reply/quote context, edit markers, and
delivery states — degrading gracefully when fields are absent.

## Steps

- [ ] Conversation header: chat name + source network, always visible.
- [ ] Message list rendering from Slice 2 selectors: sender, timestamp, wrapped body, reply/quote
      treatment, edit and delivery/error markers where present.
- [ ] Scroll model: bottom-pinned on open; `PgUp`/`k` scrolling; anchor preserved across prepends
      and appends; explicit "load older" shortcut.
- [ ] Pagination wiring: upward scroll at loaded-top triggers adapter fetch via dispatch; loading
      and end-of-history states rendered.
- [ ] Attachment placeholders: safe, readable `[image]`/`[file …]` markers (open/download comes in
      Slice 11).
- [ ] Enforce the reducer's bounded history in the view: eviction doesn't break scroll anchors.
- [ ] Tests: scroll/anchor math, pagination trigger logic, rendering of missing/optional fields.

## Acceptance criteria

- [ ] Select a chat, read recent messages, page upward through older history smoothly without
      losing position (PRD acceptance scenario 2, reading half).
- [ ] Messages from a network that omits delivery states or edits render cleanly, no `undefined`
      artifacts.
- [ ] Memory stays bounded when paging deep into a large chat (verified by the history cap tests).
- [ ] `bun test` green.

## Out of scope

Compose/send (Slice 5), live inbound rendering (Slice 6), message search (Slice 10), attachment
open/download (Slice 11).

## Risks / open questions

- Scroll anchoring in a terminal list under prepend is fiddly — budget for it; capture the working
  pattern in `LEARNINGS.md`.
