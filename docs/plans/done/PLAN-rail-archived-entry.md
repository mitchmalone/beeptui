---
title: Net rail — dedicated Archived toggle entry
status: done
created: 2026-08-03
updated: 2026-08-03
links:
  - src/state/selectors.ts (selectNetworkRail, matchesFilter)
  - src/tui/components/NetworkRail.tsx
---

# Net rail — dedicated Archived toggle entry

## Goal

Surface the already-working archived view as a **navigable entry at the bottom of the Net rail**:
j/k lands on "Archived", Enter toggles it. It's a **toggle** (not a scope), so it composes with the
current scope — archived works at **All** and at **each network** (`matchesFilter` already gates on
`scope` AND `archived`). `a` keeps working as the shortcut.

## Decision

- Mitch chose the "dedicated Archived rail entry, Enter to toggle" option (2026-08-03), accepting that
  j/k navigation now includes it.
- Because Archived is a toggle, the **rail cursor decouples from the active scope**: the cursor can
  rest on Archived while a network remains the active scope. Moving the cursor onto a _scope_ entry
  still live-selects that scope (preserves current behaviour); moving onto Archived leaves the scope.

## Approach

- **State:** add `railCursor: 'all' | accountId | 'archived'` (init `'all'`). Kept in sync with
  `filter.scope` whenever the scope changes (scope moves, `[`/`]` cycle, focus→rail), and set freely
  when the cursor rests on `'archived'`.
- **Reducer:** `rail/cursorMoved {direction}` cycles `['all', ...accountOrder, 'archived']`, sets
  `railCursor`, and sets `filter.scope` too when the new cursor is a scope. `focus/changed → rail`
  syncs `railCursor = filter.scope`. `filter/scopeSelected` + `filter/scopeCycled` also set
  `railCursor`.
- **Selector:** `selectNetworkRail` marks each entry `isCursor` and appends an `archived` entry
  (`kind: 'archived'`, `active: filter.archived`).
- **App (rail focus):** j/k → `rail/cursorMoved`; Enter/l/→ → toggle archived when the cursor is on
  Archived, else drill into the inbox.
- **NetworkRail:** render the `›` caret on `isCursor` (not scope), keep the active-scope highlight,
  and render the Archived entry with an on/off glyph. Drop the now-redundant `arc` footer (keep
  `unr`).

## Steps

- [x] State + reducer (`railCursor`, `rail/cursorMoved`, sync points) + tests
- [x] `selectNetworkRail`: `isCursor` + appended `archived` entry + tests
- [x] App rail-focus wiring (j/k cursor, Enter toggles archived vs drills in)
- [x] NetworkRail render (cursor caret, active-scope highlight, Archived on/off) + test
- [x] Docs (STATUS/JOURNAL); commit on its own

## Acceptance criteria

- [x] In the rail, j/k reaches an "Archived" entry; Enter toggles the archived view; the active
      network scope is unchanged while doing so
- [x] Archived composes with scope: on a network + Archived on → that network's archived chats
- [x] The rail shows which entry the cursor is on vs the active scope, and Archived's on/off state
- [x] `bun run typecheck`, `bun run lint`, `bun test` green

## Out of scope

- Turning Archived into a real scope / global-archived view (it stays a per-scope toggle).
- Changing the `a` global shortcut or the unread-only (`U`) toggle.
