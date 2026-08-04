---
title: history pages itself when the cursor reaches the top
status: planned
created: 2026-08-04
updated: 2026-08-04
links:
  - PLAN-v03-release.md # step 4 of the 0.3 ladder
  - PLAN-v03-3-selection-and-focus.md # depends on: selection is the only cursor
  - src/tui/keymap.ts (load-older binding)
  - src/tui/app.tsx (conversation key handler)
---

# History pages itself when the cursor reaches the top

## Goal

One way to move through a conversation: the arrow keys. Reaching the oldest loaded message and
pressing `↑` again loads the next batch and continues, instead of stopping dead until the user knows
to press `u`.

## Context

The conversation currently offers two overlapping mechanisms:

- `↑`/`↓` (and `k`/`j`) move the message cursor; the viewport follows it
  (`messageSelection/moved` → `offsetToShowMessage`).
- `u` explicitly pages older history (`load-older` → `onLoadOlder(chatId, cursor)`).

`u` is a mode the user has to know about, and it does nothing visible if they have not already
scrolled to the top. Mitch's call: drop it, and make the arrow keys page on demand.

Worth knowing before starting:

- **`conversation/scrolled` is dispatched nowhere.** The reducer handles it and tests exercise it,
  but no key binding produces it — a leftover from before the message cursor existed. It is dead
  code, and this slice is where it goes.
- `g`/`G` (top/bottom) clamp to the _loaded_ edges via `messageSelection/moved` with a large delta.
  They stay, but "top" now means "oldest loaded", which is worth a look once paging is automatic.
- `hasMoreOlder` and `olderCursor` already live in `state.messagesByChat[id]`, and the top hint
  already distinguishes "— press u to load older —" from "— start of history —". That hint text
  changes with this slice.

## Approach

Make paging a consequence of cursor movement, not a separate command.

When `↑` is pressed and the cursor is already on the oldest loaded message:

- If `hasMoreOlder` is false → do nothing (already at the start of history; the hint says so).
- If `hasMoreOlder` is true → request the next page, and once it lands, place the cursor on the
  **last message of the newly loaded batch** — i.e. one older than where it was — so the keypress
  moves by exactly one message, as it would anywhere else in the list.

The fetch is async and lives in the App (the reducer never does I/O — invariant 4). So the reducer
needs to record that a page was requested and what to select when it arrives; the App observes that
and calls `onLoadOlder`. The mechanism should make the intent explicit rather than inferring it from
a coincidence of state — e.g. a `pendingOlderPage` marker the `messages/loaded` handler consumes to
position the cursor.

Keep it honest while loading: the top hint should say something is in flight, and a second `↑` while
a page is pending must not stack requests.

## Steps

- [ ] Reducer tests first: `↑` at the oldest loaded message with `hasMoreOlder` true marks a page
      request; with it false, nothing happens; a second `↑` while pending is a no-op.
- [ ] Add the request marker to `AppState` and the `messages/loaded` handler that consumes it,
      selecting the last message of the older batch.
- [ ] Wire the App: observe the marker, call `onLoadOlder(chatId, cursor)`, clear it on arrival or
      failure. Failure must clear the marker and surface honestly (invariant 8) — never leave the
      conversation stuck in "loading".
- [ ] Remove the `load-older` binding (`u`) from `src/tui/keymap.ts` and its handler in the
      conversation switch; update `MESSAGE_SELECT_HELP` and the help overlay.
- [ ] Update the top hint: replace "— press u to load older —" with a loading/more-history wording
      that matches the new behaviour.
- [ ] Delete the dead `conversation/scrolled` event, its reducer case, and its tests.
- [ ] Verify live in `--demo` and against a real chat with enough history to page more than once.

## Acceptance criteria

- [ ] Holding `↑` walks continuously from the newest message back through several fetched pages,
      moving one message per press, with no separate key.
- [ ] At the true start of history, `↑` stops and the hint says so.
- [ ] `u` is gone from the keymap, the help overlay, and the status bar.
- [ ] A failed page load clears the pending state and says so; it does not wedge the pane.
- [ ] `bun run typecheck`, `bun run lint`, `bun test` green.

## Out of scope

- Paging _newer_ history (the live path already appends).
- Changing `g`/`G` semantics — noted below as a question, not a change.
- Prefetching the next page before the user reaches the top.

## Risks / open questions

- **The cursor must not jump.** After an older page prepends, the message the user was on shifts
  index; positioning has to be by **message id**, not index, or the view lurches. The row-based
  viewport (`offsetToShowMessage`) already works in ids — keep it that way.
- **Latency.** Between the keypress and the page arriving, the cursor has nowhere to go. Decide:
  leave it on the current oldest and move when data lands (simplest, honest), versus a spinner
  state. Prefer the former, with the hint carrying the "loading" signal.
- `g` (top) currently means "oldest loaded". Once paging is automatic, should `g` page repeatedly to
  the true start? Probably not — unbounded fetching from one keypress. Leave as-is and note it.
