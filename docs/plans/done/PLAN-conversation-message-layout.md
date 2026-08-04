---
title: Conversation message layout — header row, gutter column, row-exact scrolling
status: done
created: 2026-08-04
updated: 2026-08-04
links:
  - ../../STATUS.md # "line-aware HTML menu anchoring" deferred item this closes
  - ../../PRD.md
  - ../done/PLAN-tui-ux-pass.md
---

# Conversation message layout

## Goal

Restyle the conversation pane so each message reads as a block — `Name` left / `HH:MM` right on
its own line, body beneath it, a blank line of relief between messages — and make every line after
the first align with the name instead of drifting 2 columns left. Doing this correctly forces the
scroll model to become row-exact rather than message-counting, which also fixes the pre-existing
bug where multi-line messages overflow the viewport and mis-anchor the floating action menu.

## Context

Today the pane renders one `<text>` per message (`ConversationView.tsx:124-138`):

- Ordinary messages take a single-line path — `` `${caret} ${messageLine(message)}` `` — producing
  `› 14:32 Alice: hello`.
- Messages carrying HTML take `MessageView.tsx`, whose line 0 holds the header and whose lines 1+
  are body-only.

Three problems follow from that shape:

1. **The caret gutter is part of the string, not the layout.** `` `${caret} ` `` is prefixed to
   line 0 only (`ConversationView.tsx:135`, `MessageView.tsx:47`). Every later line — an explicit
   `<br>` break (`MessageView.tsx:73` renders `''` for `i > 0`) or a line produced by opentui's
   word wrap — starts at column 0 of the text element. Hence the reported 2-column drift. opentui
   exposes `wrapMode` on `<text>` but no hanging-indent option (`TextBufferRenderable` has a
   protected `_firstLineOffset`, not surfaced as a prop), so this cannot be fixed in the string.
2. **One message = one row is baked into the scroll model, on both sides.**
   `visibleMessages(messages, capacity, offset)` (`conversation-scroll.ts:59`) slices the array by
   _message count_ while `capacity` is `height - CHROME_ROWS` — _rows_. `app.tsx:151` feeds the
   same number to the reducer as `viewport/measured`, and `offsetForSelection`
   (`reducer.ts:25-31`) uses it for viewport-follow. The two agree only because the units are
   assumed identical. That assumption is already false for multi-line HTML messages.
3. **The floating menu inherits the same assumption** — `menuRow` is an index into `visible` used
   directly as a row offset (`ConversationView.tsx:99-106`). This is the deferred "line-aware HTML
   menu anchoring" item in `STATUS.md`.

`messageLine`/`formatMessage` are used _only_ by `ConversationView`, so reformatting does not
ripple into the inbox previews.

## Approach

**Lay messages out in pure state, render the result.** A new `src/state/message-layout.ts` turns a
`MessageEntity` plus a content width into an ordered list of rows (header, wrapped body lines,
trailing blank). The reducer and the view both consume that layout, so they agree on row counts by
construction instead of by coincidence.

Wrapping is done by us, not by opentui, because the reducer must be able to predict height without
a terminal. To keep that prediction honest we need a display-width function (`src/state/
text-width.ts`): code points, combining marks 0, East-Asian Wide/Fullwidth and emoji-presentation
2, else 1. **Deliberately err narrow** — if our width estimate disagrees with the terminal grid we
want our lines to be _shorter_ than the box, never longer. Then opentui's own `wrapMode: 'word'`
stays on as a safety net but never actually fires, so our row count remains exact and an
exotic-grapheme disagreement degrades to a slightly short line rather than a clipped or
double-wrapped one.

The gutter stops being a string prefix and becomes a real flex column:

```
<box flexDirection="row">
  <box style={{ width: 2 }}><text>{caret}</text></box>   ← caret column
  <box style={{ flexGrow: 1, flexDirection: 'column' }}> ← content column
    <box style={{ flexDirection: 'row' }}>               ← header row
      <text>{sender}</text>
      <box style={{ flexGrow: 1 }} />                    ← spacer
      <text>{time}</text>                                ← right-aligned, resize-safe
    </box>
    …body rows…
  </box>
</box>
```

Everything in the content column starts at column 2 and stays there. The right-aligned timestamp
uses a flex spacer rather than manual padding so it survives terminal resize.

The scroll model then moves from "window of messages" to "window of rows over laid-out messages":
`visibleRows` walks heights, and `offsetToShowIndex` becomes row-based. `viewport/measured` grows a
`cols` field (`app.tsx` already has `useTerminalDimensions()`), because layout height now depends
on width.

Alternative considered and rejected: keep the message-counting model and just divide capacity by a
fixed per-message row count. That is only correct while every message is exactly N rows — already
false today — and it would leave the menu-anchoring bug in place.

## Steps

- [x] `src/state/text-width.ts` — pure `displayWidth(text)`; tests cover ASCII, CJK, combining
      marks, emoji, and the err-narrow bias.
- [x] `src/state/message-layout.ts` — `layOutMessage(message, width, opts)` → `{ rows }` with
      styled runs preserved across wrap boundaries; header row (sender + time), body rows,
      trailing blank separator. Test-first, no terminal.
- [x] Fold the HTML and plain-text paths together: `hasHtml` messages go through
      `htmlToStyledLines` first, plain messages become a single styled run. One layout path, not
      two render paths.
- [x] Rewrite `src/state/conversation-scroll.ts` to be row-based (`visibleRows`, row-based
      `offsetToShowIndex`/`clampOffset`/`maxScrollOffset`). Rewrite
      `conversation-scroll.test.ts` (87 lines) against the new contract.
- [x] Extend `viewport/measured` with `cols`; thread it through `types.ts`, `reducer.ts`
      (`offsetForSelection`), and `app.tsx:151-154`. Reducer tests first.
- [x] Rebuild `ConversationView` rendering on the layout: caret column, content column, flex header
      row, pre-wrapped body rows with `wrapMode: 'word'` retained as a net.
- [x] Retire/absorb `MessageView` into the layout-driven renderer; update
      `MessageView.test.tsx` + `ConversationView.test.tsx`.
- [x] Re-anchor the floating action menu on layout row offsets instead of visible-index
      (`ConversationView.tsx:99-106`).
- [x] Verify live in tmux via `beeptui --demo` at a couple of terminal widths, including a resize.
- [x] Close out: `STATUS.md`, `JOURNAL.md`, `LEARNINGS.md` (width/wrap gotchas), move this plan to
      `done/`, `DECISIONS.md` entry for the pre-wrap-in-state decision.

## Acceptance criteria

- [x] Each message renders as: line 1 `Name` left / `HH:MM` right; lines 2+ the body; one blank
      line between messages.
- [x] Every body line — including wrapped ones — starts at the same column as the name. No
      2-character drift at any terminal width.
- [x] The bottom-pinned viewport shows whole messages that fit the pane: nothing renders past the
      bottom border, at any mix of short and multi-line messages.
- [x] ↑/↓ viewport-follow keeps the cursor on screen when messages have unequal heights.
- [x] The floating action menu anchors to the selected message's actual row.
- [x] `bun test` green (539+ tests), `bun run typecheck` and `bun run lint` clean.
- [x] Verified live in `--demo` under tmux, including a terminal resize.

## Out of scope

- Sender-change / time-gap message _grouping_ (blank line goes between every message for now;
  grouping is a follow-up if the density proves annoying).
- Avatars, colour-per-sender, or any other new visual affordance.
- The inbox pane's preview line — `messageLine` stays as-is for that path if it is ever reused.
- In-TUI image rendering (tracked in `PLAN-inline-image-rendering.md`).

## Outcome

Delivered as planned, plus three things the plan did not anticipate:

- **`CHROME_ROWS` was wrong by two** (9 → 11). With one `<text>` per message an over-count clipped
  invisibly; with fixed-height row boxes it made rows paint on top of each other. Fixed, and pinned
  against a real render in `smoke.test.tsx`.
- **The bottom hint row had to become unconditional** (blank when idle). A conditional chrome row
  means no capacity constant can be true.
- **The perf benchmark was measuring nothing** — it never dispatched `viewport/measured`, so the
  reducer skipped the layout path. Now covered: ~2.5ms per scrolled-up arrival, ~1.5ms per cursor
  move at a near-full window.

Found and **not** fixed (pre-existing, orthogonal): at a full message window an arrival evicts the
oldest, so `added` is 0 and the `message/received` branch that holds reading position and raises the
new-messages affordance never runs.

Density was checked live in `--demo` before shipping: three rows per message reads well at normal
terminal sizes, so the grouping fallback was not needed.

## Risks / open questions

- **Width fidelity.** Our `displayWidth` will not agree with every terminal's grid for exotic
  graphemes (ZWJ emoji sequences, regional indicators). Mitigated by erring narrow + keeping
  opentui word-wrap as a net; worst case is a short line, not a broken layout. Record findings in
  `LEARNINGS.md`.
- **Density cost.** Three rows minimum per message (header + body + blank) is a big change in how
  much history fits a short terminal. If it reads as too airy in `--demo`, the fallback is
  grouping (out of scope above) — flag to Mitch rather than silently tuning.
- **Test churn.** `conversation-scroll.test.ts`, `ConversationView.test.tsx` and
  `MessageView.test.tsx` all assert the old shape and will be rewritten, not patched. Expect the
  diff to look larger than the behaviour change.
- **Compact density.** `CHROME_ROWS_COMPACT` assumes the old row budget; confirm it still holds
  once messages are multi-row, and whether compact should drop the blank separator.
