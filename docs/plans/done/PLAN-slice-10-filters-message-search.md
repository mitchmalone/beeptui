---
title: Slice 10 — Network rail, filters & message search
status: done
created: 2026-07-30
updated: 2026-07-31
links:
  - ../../PRD.md § Vision (left rail), § Inbox and navigation (filters), § Search (message search)
  - PLAN-slice-8-chat-search-help.md
  - PLAN-slice-9-phase1-validation.md
---

# Slice 10 — Network rail, filters & message search

## Goal

Give the inbox a persistent, `slk`-style **leftmost network rail** for switching scope (All /
per-network), with archived and unread views layered on top, and find messages by content through
Beeper's search — landing in the right conversation with context.

## Context

Phase 2 begins. Today the TUI is two columns: chat list (`InboxPane`, `src/tui/app.tsx`) + a
conversation/compose pane. Slice 10 was originally "filter state + an invisible keybinding cycle";
Mitch's `slk`-inspired feedback (2026-07-31) upgrades that into a **third, leftmost column** that
makes the active network always visible instead of a hidden mode — the workspace-switcher analog.

Layout becomes three columns:

```
┌─┬ Chats ───────────┬ Conversation ──────────────┐
│●│ › WA  Sarah       │ Sarah · WhatsApp           │
│A│   WA  #product    │                            │
│W│   FB  Tom         │ 09:41 Sarah  Friday?       │
│F│                   │ 09:42 You    Yep — 10am.   │
│T│                   │ ────────────────────────── │
│…│                   │ > compose                  │
├─┤ [j/k] move        │                            │
│▤│ (archived)        │                            │
└─┴──────────────────┴────────────────────────────┘
 ↑ rail: All + one entry per network, unread dots, archive indicator
```

PRD: filter by all / unread / account / archive; message search goes through Beeper, scoped to the
active chat when selected, with a local-history fallback where the endpoint is capped or ignores
scope; results navigate to the conversation/message where the API supports it.

## Design decisions (from Mitch's feedback, 2026-07-31)

1. **The rail is quick-key driven, not a focus target.** The existing `inbox → conversation →
compose` focus flow is untouched. `[` / `]` cycle the network scope (prev/next, wrapping through
   `All`); `Shift+U` toggles unread-only; `a` toggles archived. (Optional stretch: digit keys
   `1..9` jump directly to a rail entry.) Exact keys are provisional — the help overlay is generated
   from the keymap, so they self-document.
2. **The rail holds networks only.** Entries: `All` on top, then one per connected account/network,
   built from `state.accountOrder`. Unread is shown as a **per-network dot/badge on the rail**, not
   a separate rail row; unread-only is an orthogonal toggle.
3. **Archive is view-only this slice.** We read Beeper's per-chat archive state and let the user
   switch between active and archived views, honoring the network's archive state. We do **not**
   archive/unarchive from the TUI (that's an adapter write + per-network capability gate — deferred;
   see Out of scope).
4. **Archive is a toggle that composes with the selected scope** (`a`): archived-in-WhatsApp,
   archived-in-All, etc. — more useful than a global "Archived" pseudo-network and keeps the rail
   about networks.

## Approach

### Part A — Network rail + filters (the headline)

Filter state lives in the reducer as a small `inboxFilter` shape: `{ scope: 'all' | <accountId>,
archived: boolean, unreadOnly: boolean }`. New events (`filter/scopeCycled`,
`filter/scopeSelected`, `filter/archivedToggled`, `filter/unreadToggled`) transition it; nothing
else mutates it (invariant 4). `selectInboxRows` becomes filter-aware. A new `selectNetworkRail`
selector derives the rail model — `[{ id, label, marker, unreadCount, isSelected }]` — from
`accountOrder` + account metadata + unread counts. A new `NetworkRail` component renders it (narrow
fixed width, marker + unread dot, selected highlight, archived-mode indicator at the foot). Bindings
go through `keymap.ts` so the help overlay picks them up.

Archive requires the chat entity to carry archive state. If it isn't already surfaced by the adapter
(`src/beeper/`), add it to the normalized chat + mapping (fixture-tested); the rail/selectors read
it, they don't set it.

### Part B — Message search (unchanged intent)

Reuse the Slice 8 palette in a "messages" mode: query → adapter search call (scoped when a chat is
active) → results with sender/time/snippet context → `Enter` opens the chat and jumps to/near the
message. Local fallback searches only what's already in memory/metadata cache and labels itself
partial — honest about coverage. Capability detection gates scope-honoring vs. capped endpoints.

## Steps

**Part A — rail & filters**

- [x] Reducer: `inboxFilter` state + events (scope cycle/select, archived toggle, unread toggle),
      unit tests first.
- [x] Selectors: `selectInboxRows` respects scope + archived + unreadOnly; new `selectNetworkRail`
      derives rail entries + unread counts; tests.
- [x] Adapter/entity: surface per-chat archive state from the API into the normalized chat if not
      already present; fixture tests.
- [x] Keymap: `[`/`]` cycle, `a` archived, `Shift+U` unread-only (context-tagged so help documents
      them); wire in `app.tsx`.
- [x] `NetworkRail` component: rail entries, unread dots, selected highlight, archived indicator;
      render tests.
- [x] Layout: three columns wide; **narrow-terminal collapse story** — rail hides/condenses below
      `NARROW_WIDTH`, scope still cyclable by key. Tests for the collapse.

**Part B — message search**

- [x] Adapter search endpoint: request shape, scoping, pagination/caps, capability detection;
      fixture tests including a scope-ignoring server.
- [x] Search palette "messages" mode with result-context rendering.
- [x] Result navigation: open chat, load surrounding context, highlight/focus the match where the
      API permits; graceful "opened chat, couldn't deep-link" fallback otherwise.
- [x] Local fallback path, clearly labeled partial, used only when the API is capped/unsupported.

**Close-out**

- [x] Smoke-test additions: network-scope switch + archived view (Part A) and the search golden path
      (Part B).

## Acceptance criteria

- [x] The leftmost rail shows `All` + one entry per connected network, with the active scope visibly
      indicated and per-network unread dots; `[`/`]` cycle it and the chat list re-filters correctly
      against fixture data (tests).
- [x] `a` switches between active and archived chats for the current scope, honoring Beeper's
      per-chat archive state; `Shift+U` shows unread-only. All keyboard-driven and visibly
      indicated (tests).
- [x] Rail collapses/condenses gracefully on a narrow terminal without losing scope switching.
- [x] PRD acceptance scenario 5: find a known message, select the result, land in the right
      conversation. Covered by the smoke harness (fixture) + unit tests, **and live-validated against
      the real Beeper search endpoint 2026-07-31** (redacted run over the 3 connected networks —
      WhatsApp/Facebook/Beeper; Discord not connected on this setup, but the endpoint _semantics_ were
      the unknown). Verified: the server honors both **chat scope** (hits all in the requested chat)
      and **account scope** (hits all in the requested account); results **cap/paginate** (`capped`
      detected); every hit carries `id`+`chatId`+`accountId`, so **deep-linking is supported** — a hit
      opens the right chat and loads its recent page. Anchoring to an _older_ off-page message stays
      Slice 11 territory.
- [x] Scope-ignoring or capped search endpoints produce the fallback, labeled as such — never
      silently wrong results.
- [x] `bun test` + smoke suite green; help overlay auto-lists the new bindings.

## Follow-up (2026-07-31, from live-use feedback)

Two "Out of scope" items below were **pulled in after Mitch tested the build** (see `DECISIONS.md`):

- **Rail is now a focus target** — `Esc`/`h`/`←` walks conversation → list → rail; `l`/`→`/`Enter`
  drills back in; `j`/`k` switch networks. (Reverses "quick-keys only".)
- **`Shift+A` archives/unarchives the open chat** via `chats.archive`, gated on
  `chat.capabilities.archive` (named notice when unsupported), then returns to the list. (Reverses
  "archive is view-only".) Added a `notice` status-bar primitive.

## Out of scope

- ~~Archive/unarchive actions~~ — **done in the follow-up above** (capability-gated).
- Full-text indexing of message bodies locally (would violate the v1 cache decision).
- ~~Making the rail a focusable/arrowable pane~~ — **done in the follow-up above.**

## Risks / open questions

- **Scope creep.** Rail redesign + archive + unread + message search is a large slice. If Part A
  lands clean but Part B's endpoint probing drags, split Part B into Slice 10b rather than stall.
- Real search endpoint semantics (caps, scoping honor, deep-link support) per network are unknown
  until probed — validate early and shape the fallback accordingly.
- Whether the adapter already surfaces per-chat archive state is unverified — confirm before
  building the archived toggle; if the API doesn't expose it, the toggle degrades visibly (invariant 8) rather than guessing.
- Narrow-terminal three-column layout needs a real collapse rule (rail → single-char strip, or fold
  into a scope indicator in the status bar) — decide during Part A.
