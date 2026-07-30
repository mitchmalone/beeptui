---
title: Slice 3 — TUI shell & inbox
status: done
created: 2026-07-30
updated: 2026-07-30
links:
  - ../../PRD.md § Inbox and navigation, § Vision
  - PLAN-slice-1-beeper-adapter-doctor.md
  - PLAN-slice-2-state-core.md
---

# Slice 3 — TUI shell & inbox

## Goal

Launch `beeptui` and see the real inbox: three-pane layout, chat list loaded from Beeper via the
adapter + reducer, keyboard navigation, and a status bar. First slice where the product exists on
screen.

## Context

Slice 1 provides data, Slice 2 provides state. This slice builds the `src/tui/` shell: layout,
focus model, keymap wiring, and the inbox pane. The PRD vision sketch (left rail inbox, center
conversation, bottom compose) is the layout contract; center/bottom are placeholders until
Slices 4–5.

## Approach

An app runtime module connects adapter → dispatch → reducer → React state (single store, no
external state library). `@opentui/keymap` declares bindings centrally so the help overlay
(Slice 8) can be generated later. Three-pane responsive layout with a compact single-pane fallback
below a width threshold.

## Steps

- [x] App runtime (`runtime.ts` + `store.ts`): boot sequence (config → connect → info/accounts/chats
      → dispatch), observable store, clean shutdown (`q` restores terminal, PTY-verified exit 0).
- [x] Layout components: left rail (`InboxPane`), center placeholder (`ConversationPane`), status
      bar (`StatusBar`) with connection state + account summary; single-pane fallback below 80 cols.
- [x] Inbox rows from `selectInboxRows`: network marker (WA/SL/…), chat name, unread indicator,
      mute glyph, selection highlight. (Last-message preview lands with message data in Slice 4.)
- [x] Keymap (`keymap.ts`): `j`/`k`/arrows move, `g`/`G` top/bottom, `⏎` open (Slice 4), `r`
      refresh, `q` quit — one declarative table (help-overlay ready). Real keyboard nav test-covered.
- [x] Visible degraded states: `unreachable`/`unauthorized`/`connecting` named in the status bar;
      empty inbox reads "No chats to show." — never a silent empty list (PTY-verified).
- [x] Render + keyboard tests via `testRender` + `mockInput.pressKey`; runtime/store/keymap/nav unit
      tested. (Resolved the OpenTUI-testability risk — see `LEARNINGS.md`.)

## Acceptance criteria

- [x] Inbox is fully navigable by keyboard; selection lives in the reducer, so it survives re-renders
      and data refreshes (test-covered).
- [x] `bun test` green (92 total); runtime, store, keymap, navigation, and components all covered.
- [x] Degraded state shows without crashing: boot against a closed endpoint renders "unreachable" +
      "No chats", and `q` still exits cleanly (PTY-verified). _Mid-session kill detection_ (vs.
      boot-time) arrives with live updates in Slice 6.
- [ ] _(Deferred, needs live Beeper)_ With Beeper Desktop running, launch shows chats from ≥2
      networks and the status bar reports connected (PRD scenario 1) — manual smoke once set up.

## Outcome (2026-07-30)

Shipped. `src/tui/` now renders the product: an observable `store` over the reducer, a `runtime`
boot sequence (fake-gateway tested), a declarative `keymap`, pure `navigation` helpers, and
presentational components (`InboxPane`/`ConversationPane`/`StatusBar`) composed by `App` with a
narrow single-pane fallback. `launch.ts` wires the real adapter → store → render and kicks off
`bootstrap`. Verified: render content, real keyboard nav (`mockInput.pressKey`), degraded state, and
clean `q` exit (PTY). Deviation: bindings use a thin in-repo keymap, not `@opentui/keymap`
(`DECISIONS.md`). Live smoke deferred with the rest until Beeper Desktop is set up.

## Out of scope

Conversation rendering (Slice 4), compose (Slice 5), live updates (Slice 6 — this slice may use a
manual refresh binding as a stopgap), filters and search (Slices 8/10).

## Risks / open questions

- Inbox ordering source (server-provided sort vs local by last activity) — pick what the API
  supports; journal it.
- How testable OpenTUI components are in `bun test` is unknown — if poor, keep components thin and
  push logic into selectors/runtime; record the pattern in `LEARNINGS.md`.
