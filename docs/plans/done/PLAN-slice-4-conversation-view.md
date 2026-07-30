---
title: Slice 4 — Conversation view
status: done
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

- [x] Conversation header: chat name + source network, always visible.
- [x] Message list rendering from Slice 2 selectors: sender, timestamp, wrapped body, reply/quote
      treatment, edit and delivery/error markers where present.
- [x] Scroll model: bottom-pinned on open; `PgUp`/`k` scrolling; anchor preserved across prepends
      and appends; explicit "load older" shortcut.
- [x] Pagination wiring: upward scroll at loaded-top triggers adapter fetch via dispatch; loading
      and end-of-history states rendered.
- [x] Attachment placeholders: safe, readable `[image]`/`[file …]` markers (open/download comes in
      Slice 11).
- [x] Enforce the reducer's bounded history in the view: eviction doesn't break scroll anchors.
- [x] Tests: scroll/anchor math, pagination trigger logic, rendering of missing/optional fields.

## Acceptance criteria

- [~] Select a chat, read recent messages, page upward through older history without losing
  position (PRD scenario 2, reading half). **Wiring done + fixture-tested** (open → initial page,
  `u` → older page via cursor, computed bottom-pinned window, `k`/`j`/`g`/`G` scroll); _smooth
  live paging_ needs a running Beeper — deferred.
- [x] Messages from a network that omits delivery states or edits render cleanly, no `undefined`
      artifacts.
- [x] Memory stays bounded when paging deep into a large chat (verified by the history cap tests).
- [x] `bun test` green.

## Outcome (2026-07-30)

Shipped. The center pane renders the selected chat's history: header, `formatMessage`/`messageLine`
(graceful on absent fields — reply/edited/attachment markers, delivery status), and a computed
bottom-pinned window. Focus model (inbox ↔ conversation) + scroll (`k`/`j`/`g`/`G`), history paging
(`u`, cursor threaded adapter → runtime → state), and `h`/`←`/`Esc` back — all fixture/render tested
(122 tests). Enriched the domain `MessageSummary` (attachments/edited/reply) in the adapter.

**Scroll deviation:** used a computed visible-window over the messages rather than OpenTUI
`<scrollbox>` — its `stickyStart` bottom-pin misrenders short content headlessly. Deterministic and
testable; recorded in `LEARNINGS.md`. The `direction: 'older'` token for cursor paging is a guess
until live validation (Slice 6) — journalled.

## Out of scope

Compose/send (Slice 5), live inbound rendering (Slice 6), message search (Slice 10), attachment
open/download (Slice 11).

## Risks / open questions

- Scroll anchoring in a terminal list under prepend is fiddly — budget for it; capture the working
  pattern in `LEARNINGS.md`.
