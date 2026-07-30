---
title: Slice 7 — Local store & drafts
status: planned
created: 2026-07-30
updated: 2026-07-30
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

- [ ] Store module: open/create DB, schema + migration scaffold, typed accessors; no message
      bodies, no tokens.
- [ ] Draft persistence: debounced save on compose changes, delete on successful send, restore into
      reducer state at boot.
- [ ] View state: persist last selected chat + scroll anchor; restore on launch "where safe" (fall
      back to inbox top when the chat no longer exists).
- [ ] Chat metadata cache: write-through from chat summaries; hydrate inbox at boot before live
      fetch, visually reconciled when fresh data lands.
- [ ] Kill-test: `kill -9` during editing loses at most the debounce window (tested via store-level
      simulation).
- [ ] Store unit tests against a temp DB; migration test from an older schema fixture.

## Acceptance criteria

- [ ] PRD acceptance scenario 4's persistence half: a draft survives full restart, restored into
      the right chat, never auto-sent.
- [ ] Launch-to-usable-inbox on warm cache is fast (PRD target ≤ 3s on healthy setup; measure and
      journal).
- [ ] The DB contains no message bodies or tokens (asserted in tests by schema + content scan).
- [ ] `bun test` green.

## Out of scope

Message-body/history caching (revisit post-v1 per pending decision), search indexes (Slice 10's
local fallback may extend the store — design for extension, don't build it).

## Risks / open questions

- Scroll-position restore semantics when history has moved on — "where safe" means: restore chat
  selection always, scroll anchor only if the anchor message is in the first fetched page.
