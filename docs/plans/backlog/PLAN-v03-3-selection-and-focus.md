---
title: selection and focus — what is highlighted, and when
status: planned
created: 2026-08-04
updated: 2026-08-04
links:
  - PLAN-v03-release.md # step 3 of the 0.3 ladder
  - PLAN-v03-4-history-paging-on-scroll.md # builds on this
  - PLAN-v03-5-reply-from-action-menu.md # builds on this
  - src/state/reducer.ts (chats/loaded, messages/loaded, focus/changed)
---

# Selection and focus — what is highlighted, and when

## Goal

Make the app's highlight state obvious and correct at every moment: something is always selected in
the active column, entering the conversation lands the cursor on the newest message, and the message
cursor gets out of the way while composing.

## Context

Three defects, all in when-selection-happens rather than how it renders.

**1. Nothing is selected on first load.** `initialState` has `selectedChatId: null` and
`focus: 'inbox'`. `chats/loaded` populates the list but selects nothing, so the Chats column opens
with no highlight and the user must press `j` before anything responds. The Net rail is already
correct (`railCursor: 'all'`, scope `all`).

**2. Opening a chat leaves the conversation unhighlighted.** `focus/changed → conversation`
auto-selects the newest message — but only if messages are already loaded:

```ts
if (event.focus === 'conversation' && state.selectedMessageId === null) {
  const items = activeItems(state)      // ← empty at this instant
  const newest = items[items.length - 1]
  if (newest !== undefined) { … }
}
```

Pressing `⏎` on a chat dispatches `chat/selected` + `focus/changed` and _then_ loads messages
asynchronously. At focus time `activeItems` is empty, so nothing is selected; when
`messages/loaded` lands, nothing re-selects. This is exactly the screenshot Mitch reported — a
populated conversation with no cursor.

**3. The message cursor stays lit while composing.** Tabbing to compose leaves `selectedMessageId`
set, so a message keeps its highlight and caret while the user types somewhere else — two things
look active at once.

Note the exception: while replying, the target message _should_ stay marked. That marking is
specified in `PLAN-v03-5-reply-from-action-menu.md`; this plan only has to not fight it.

## Approach

Treat "the active column always has a cursor" as a reducer invariant rather than something the view
or the keymap arranges.

- Seed the inbox cursor when the chat list first arrives (`chats/loaded`), not on first keypress.
  Highlight only — do **not** open the chat; opening stays an explicit `⏎`.
- Make conversation auto-select fire on whichever event completes last. `focus/changed` keeps its
  current behaviour, and `messages/loaded` gains the mirror: if the conversation is focused and
  nothing is selected, select the newest.
- Clear the message cursor when focus moves to compose, and restore it on the way back.

Selection-clearing on compose and the reply marker are different concerns and must stay separable:
`selectedMessageId` is the _cursor_, `replyTo` is the _reply target_. Do not overload one for the
other.

## Steps

- [ ] Reducer tests first for each case below, then the changes.
- [ ] `chats/loaded`: when no chat is selected, select the first row of the current filter view.
      Respect the active scope/archived filter — select the first _visible_ chat, not
      `chatOrder[0]`.
- [ ] `messages/loaded`: when `focus === 'conversation'` and `selectedMessageId === null`, select
      the newest, reusing the same helper `focus/changed` uses.
- [ ] `focus/changed → compose`: clear `selectedMessageId` (leave `replyTo` untouched).
- [ ] `focus/changed → conversation` from compose: re-select the newest if nothing is selected —
      already the current behaviour; add the test that pins it.
- [ ] Component test on the real render: after load, the first chat row carries the highlight; after
      `⏎`, the newest message carries the `›`; after Tab to compose, no message carries it.
- [ ] Check the status-bar hint and `MESSAGE_SELECT_HELP` still describe reality.

## Acceptance criteria

- [ ] On launch with chats loaded: "All" is the active scope, the first chat is highlighted, Chats
      is the focused column, and the conversation pane is empty (nothing opened without `⏎`).
- [ ] Pressing `⏎` on a chat lands the `›` cursor on the newest message once history arrives,
      whichever order the events land in.
- [ ] Tabbing to compose removes the message highlight; tabbing back restores it.
- [ ] `bun run typecheck`, `bun run lint`, `bun test` green; verified live in `--demo`.

## Out of scope

- The reply marker on the target message (`PLAN-v03-5-...`).
- Any change to how the highlight _looks_ — colours and the caret column are settled.
- Auto-opening a chat on launch. First load highlights; it does not open.

## Risks / open questions

- **Seeding the inbox cursor changes what `chats/upserted` and filter changes mean.** If the
  selected chat scrolls out of the current filter (e.g. toggling Archived), the selection may point
  at a hidden chat. Decide and test: re-seed to the first visible row, or leave it and let the view
  show no highlight. Prefer re-seeding — an active column with no cursor is the bug being fixed.
- Selecting on `messages/loaded` must not fight a user who has already moved the cursor; guard on
  `selectedMessageId === null` only, never on "is the newest".
