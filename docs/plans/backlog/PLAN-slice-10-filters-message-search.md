---
title: Slice 10 — Filters & message search
status: planned
created: 2026-07-30
updated: 2026-07-30
links:
  - ../../PRD.md § Inbox and navigation (filters), § Search (message search)
  - PLAN-slice-8-chat-search-help.md
  - PLAN-slice-9-phase1-validation.md
---

# Slice 10 — Filters & message search

## Goal

Slice the inbox by all/unread/account/archive, and find messages by content through Beeper's search
— landing in the right conversation with context.

## Context

Phase 2 begins. The inbox selector (Slice 2) and palette primitive (Slice 8) exist. PRD: message
search goes through Beeper, scoped to the active chat when selected, with a local-history fallback
where the endpoint is capped or ignores scope; results navigate to the conversation/message where
the API supports it.

## Approach

Filters are pure selector + keymap work: a filter state in the reducer, cycle/select bindings, and
a visible current-filter indicator in the rail. Message search reuses the Slice 8 palette in a
"messages" mode: query → adapter search call (scoped when a chat is active) → results with
sender/time/snippet context → `Enter` opens the chat and jumps to/near the message. The local
fallback searches only what's already in memory/metadata cache and labels itself as partial —
honest about its coverage.

## Steps

- [ ] Filter state + selectors (all / unread / per-account / archived) with tests; keymap bindings
      and rail indicator.
- [ ] Adapter search endpoint support: request shape, scoping, pagination/caps, capability
      detection; fixture tests including a scope-ignoring server.
- [ ] Search palette "messages" mode with result context rendering.
- [ ] Result navigation: open chat, load surrounding context, highlight/focus the match where the
      API permits; graceful "opened chat, couldn't deep-link" fallback otherwise.
- [ ] Local fallback path, clearly labeled partial, used only when the API is capped/unsupported.
- [ ] Smoke-test additions for the search golden path.

## Acceptance criteria

- [ ] PRD acceptance scenario 5: find a known message in a Discord chat, select the result, land in
      the right conversation with surrounding context where the API permits.
- [ ] Filters are keyboard-cyclable, visibly indicated, and correct against fixture data (tests).
- [ ] Scope-ignoring or capped search endpoints produce the fallback, labeled as such — never
      silently wrong results.
- [ ] `bun test` + smoke suite green.

## Out of scope

Full-text indexing of message bodies locally (would violate the v1 cache decision), archive
_actions_ (archiving is Beeper's job; we only filter by its state).

## Risks / open questions

- Real search endpoint semantics (caps, scoping honor, deep-link support) per network are unknown
  until probed — validate early in the slice and shape the fallback accordingly.
