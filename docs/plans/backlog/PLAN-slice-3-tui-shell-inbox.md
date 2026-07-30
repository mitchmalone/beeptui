---
title: Slice 3 — TUI shell & inbox
status: planned
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

- [ ] App runtime: boot sequence (load config → connect adapter → initial chat fetch → dispatch),
      render loop, clean shutdown restoring the terminal.
- [ ] Layout components: left rail, center pane (placeholder), compose strip (placeholder), status
      bar showing connection state and account summary; single-pane fallback for narrow terminals.
- [ ] Inbox rows from the Slice 2 selector: network marker, chat name, last-message preview/time,
      unread indicator where the API exposes it.
- [ ] Keymap: `j`/`k` (and arrows) move, `Enter` opens (dispatches selection; conversation renders
      in Slice 4), `q` quits, `g`/`G` top/bottom. All declared through the keymap layer.
- [ ] Visible degraded states: account unavailable, endpoint down — named in the rail/status bar,
      never a silent empty list.
- [ ] Component/render tests where OpenTUI's test capabilities allow; keymap and runtime logic unit
      tested regardless.

## Acceptance criteria

- [ ] With Beeper Desktop running, launch shows chats from at least two networks and the status bar
      reports connected (PRD acceptance scenario 1, minus conversation view).
- [ ] Inbox is fully navigable by keyboard; selection state survives re-renders and live-ish data
      refreshes.
- [ ] Killing Beeper mid-session shows a visible disconnected state without crashing the TUI.
- [ ] `bun test` green; runtime and keymap logic covered.

## Out of scope

Conversation rendering (Slice 4), compose (Slice 5), live updates (Slice 6 — this slice may use a
manual refresh binding as a stopgap), filters and search (Slices 8/10).

## Risks / open questions

- Inbox ordering source (server-provided sort vs local by last activity) — pick what the API
  supports; journal it.
- How testable OpenTUI components are in `bun test` is unknown — if poor, keep components thin and
  push logic into selectors/runtime; record the pattern in `LEARNINGS.md`.
