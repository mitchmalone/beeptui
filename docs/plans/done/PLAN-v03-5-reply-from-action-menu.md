---
title: reply from the action menu, and show what you are replying to
status: done
created: 2026-08-04
updated: 2026-08-04
links:
  - PLAN-v03-release.md # step 5 of the 0.3 ladder
  - PLAN-v03-3-selection-and-focus.md # depends on: cursor vs reply target are separate
  - src/state/reactions.ts (CONVERSATION_ACTIONS)
  - src/tui/components/Compose.tsx
---

# Reply from the action menu, and show what you are replying to

## Goal

Make replying discoverable from the `⏎` dropdown alongside React, and make an in-progress reply
visible in both places it matters: the compose pane says it is a reply, and the message being
replied to is marked in the conversation.

## Context

Replying already works — it is just hidden and under-signalled.

- `r` on the selected message dispatches `reply/started`, which sets `replyTo` and **clears
  `selectedMessageId`** (`src/state/reducer.ts`). Focus moves to compose.
- `Compose` renders `↩ Replying to <sender>: <snippet>  (Esc to cancel)` above the editor, from
  `selectReplyContext`. Leaving compose cancels the reply.
- `send/requested` carries `replyToId`; sending clears `replyTo`.
- The `⏎` action menu (`CONVERSATION_ACTIONS`) has exactly one entry: `React…`. Its own doc comment
  says "delete / reply-from-menu / etc. come later".

What is missing:

1. Reply is not in the dropdown, so a user who found React by pressing `⏎` has no reason to think
   reply exists.
2. The compose pane still says `Compose ●` while replying — the reply is signalled only by the
   quoted line.
3. Nothing in the conversation marks _which_ message is being replied to. `reply/started` actively
   clears the cursor, so the target loses its highlight the moment you start.

## Approach

Add `Reply` as a second `CONVERSATION_ACTIONS` entry, dispatching the same `reply/started` the `r`
key already uses — one code path, two entry points. Keep `r` as the shortcut.

For the signalling, the key idea is that **the cursor and the reply target are different things**.
`selectedMessageId` is where the arrow keys are; `replyTo` is what the draft answers. They are
already separate fields — the conversation just needs to render the second one. Clearing the cursor
on `reply/started` stays correct (focus has left the conversation); the target stays marked because
it is marked from `replyTo`, not from the cursor.

Rendering: the row layout already carries a per-message identity, so the marker is a styling
decision on the target message's rows — distinct from the selection highlight so the two never read
as the same state. Decide the exact treatment while building it in `--demo`; a left marker in the
caret gutter is the cheapest option that cannot be confused with `›`.

Compose title becomes `Replying in thread ●` (and the unfocused variant `Replying in thread`) while
`replyTo` is set.

## Steps

- [x] Add `{ id: 'reply', label: 'Reply' }` to `CONVERSATION_ACTIONS`; unit-test the action list and
      the menu height maths that depends on its length (`menuHeight` in `ConversationView`).
- [x] Wire the menu choice to `reply/started` + focus compose — the same effect as `r`. Test that
      both entry points produce identical state.
- [x] `Compose`: title switches to `Replying in thread ●` when a reply context is present.
- [x] Conversation: mark the `replyTo` message's rows distinctly from the selection highlight.
      Component test on the rendered frame, not just on props.
- [x] Confirm cancel paths still clear it everywhere: `Esc` in compose, blurring compose,
      `chat/selected`, and a successful send.
- [x] Check the action menu still anchors correctly now that it is one row taller.
- [x] Verify live in `--demo`: open the dropdown, choose Reply, see the title change and the target
      marked; cancel; repeat via `r`.

## Acceptance criteria

- [x] `⏎` on a message offers React and Reply; choosing Reply behaves exactly as `r`.
- [x] While replying, the compose pane reads `Replying in thread ●` and the quoted context line
      still shows.
- [x] While replying, the target message is visibly marked in the conversation, and that marking is
      distinguishable from the `›` selection cursor.
- [x] Cancelling or sending clears both the title and the marker.
- [x] `bun run typecheck`, `bun run lint`, `bun test` green.

## Out of scope

- Threaded _display_ (grouping replies under their parent). This marks the target; it does not
  restructure the conversation.
- Jumping to the replied-to message when it is off screen.
- Any other action-menu entries (delete, forward, copy).

## Outcome

Done. `⏎` offers Reply above React; choosing it is identical to `r` because both now go through one
`startReply` helper — the capability gate (a network that reports no reply support gets a named
notice) lives in one place and cannot drift between the two entry points.

The reply target is marked with a `┃` quote bar in the caret gutter, deliberately a different glyph
from the `›` cursor: starting a reply moves focus to compose and clears the cursor, so the two are
almost never the same message and must not read as the same state. The compose pane retitles to
`Replying in thread ●`.

Left alone deliberately: the screenshot's bare-`↩`-with-no-body messages. Looked at it — the reply
marker and read receipt render from a message whose `text` is empty, so this is upstream of the TUI
(either genuinely empty replies or the adapter dropping a body) and diagnosing it is not a rendering
change. Not folded in.

## Risks / open questions

- **`menuHeight` is hard-coded around the action count** and drives the open-up/open-down choice.
  Adding a row must not push the menu off the bottom of a short pane — covered by the existing
  anchoring logic, but test it at a small terminal height.
- **The target may be scrolled out of view** when the reply starts (it usually is not — you just
  selected it — but a live burst can push it). Marking it is still correct; do not try to force it
  back into view.
- The screenshot shows reply messages rendering as a bare `↩` with no body. Worth a look while in
  here — it may be an empty-text reply, or a body the adapter is dropping — but diagnose before
  assuming, and split it out if it is an adapter bug rather than a rendering one.
