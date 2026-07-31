---
title: tmux / terminal unread status badge
status: done
created: 2026-07-31
updated: 2026-07-31
links:
  - PLAN-slice-14-polish-packaging.md § Notification hooks
---

# tmux / terminal unread status badge

## Goal

Surface the total unread count in the terminal so it's visible from a tmux status
line without focusing the app: the window shows `1: Beeper [19]` (tmux adds the
`1:` window index; the app sets the window name to `Beeper [19]`).

## Context

Standalone quality-of-life feature (a slice of Slice 14's "notification hooks"),
built independently off `main`. `state.chats[*].unreadCount` already exists.

## Approach

- `selectTotalUnread(state)` — sum of `unreadCount` over **non-archived** chats.
- `src/tui/terminal-status.ts` `createStatusWriter()` — on each unread change:
  writes an OSC 2 title (`Beeper [n]`, the terminal tab title / tmux pane title)
  and, inside tmux, runs `tmux rename-window -t $TMUX_PANE "Beeper [n]"`. Dedupes
  on the count so unrelated state changes (e.g. typing) cost nothing. `restore()`
  unsets the window-local `automatic-rename` on exit, handing the name back to
  tmux. All I/O (env / write / tmux runner) is injectable → unit-tested without a
  tty; also verified end-to-end against a real isolated tmux server.
- `launch.ts` creates the writer, subscribes it to the store, and calls
  `restore()` in `onQuit`.

## Decisions

- **`tmux rename-window`, not OSC-only.** Modern tmux `automatic-rename` follows
  `pane_current_command`, not the pane title, and the `ESC k` rename escape needs
  `allow-rename on` (off by default) — so OSC alone won't set the window name
  without user config. `rename-window` works out of the box. (`DECISIONS.md`.)
- **Count only, never content.** The badge is strictly `Beeper [n]` — no chat
  name, sender, or preview ever reaches a terminal title (CLAUDE.md invariant 6).
- **Total across all networks, excluding archived** (Mitch, 2026-07-31).

## Acceptance criteria

- [x] Inside tmux, the window name becomes `Beeper [n]`; verified end-to-end
      against a real tmux server.
- [x] The count is total unread across non-archived chats; updates on change,
      deduped so typing/navigation don't thrash tmux.
- [x] Exiting restores tmux's automatic window naming.
- [x] Only the app name + count are ever emitted (invariant 6); unit-asserted.
- [x] `bun test` + typecheck + lint green.

## Out of scope

Configurable format/toggle, bell/desktop notifications, per-network badges — all
Slice 14 territory if wanted later.
