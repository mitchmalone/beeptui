---
title: live arrivals are ignored once the message window is full
status: done
created: 2026-08-04
updated: 2026-08-04
links:
  - PLAN-v03-release.md # step 2 of the 0.3 ladder
  - ../../JOURNAL.md 2026-08-04 (found while benchmarking the row-layout path)
  - src/state/reducer.ts (message/received)
---

# Live arrivals are ignored once the message window is full

## Goal

Make a live inbound message behave the same on a chat with 200 loaded messages as it does on one
with 5. Today, at a full window, three separate behaviours silently stop working.

## Context

`MAX_MESSAGES_PER_CHAT` is 200 (`src/state/types.ts`). `message/received` decides whether anything
arrived by comparing list **lengths** before and after the merge:

```ts
const added = (next.messagesByChat[chatId]?.items.length ?? 0) - before
if (chatId === state.selectedChatId && added > 0) { … }
```

Once the window is full, `mergeMessages` evicts the oldest to make room, so the length is 200 both
sides and `added` is 0. The whole branch is skipped, which loses:

1. **Reading position.** Scrolled up, `conversationOffset` never gets its row bump, so the content
   under the cursor shifts by (rows added − rows evicted).
2. **The new-messages affordance.** `newMessagesBelow` is never set, so "— ↓ new messages — press G
   for latest —" never appears. The user is not told a message arrived.
3. **Cursor follow.** Pinned at the bottom with the cursor on the previous newest, the `›` cursor no
   longer moves to the new newest — it strands on the second-newest.

The arithmetic _inside_ the branch is correct (it was made row-based in the layout slice); the bug
is purely that the branch does not run. Reachability is moderate: 200 loaded in one chat takes a few
history pages or a long live session on a busy chat.

Found while writing the row-layout perf benchmark, where the same guard made the benchmark vacuous —
it measured a code path that never executed.

## Approach

Stop inferring "something arrived" from the length delta. `mergeMessages` already knows: it builds a
map, reconciles optimistic echoes, and sorts. Have it report what actually changed — at minimum
whether any incoming id was new to the window — and branch on that instead.

Keep the eviction itself as-is; bounded memory is an invariant. Only the _detection_ is wrong.

The row bump already computes `totalRows(next) - totalRows(state)`, which is naturally correct
across an eviction (it nets the added rows against the removed ones), so it needs no change once it
runs.

## Steps

- [x] Failing reducer test first, one per symptom, with the window pre-filled to
      `MAX_MESSAGES_PER_CHAT`: reading position holds, `newMessagesBelow` is raised, cursor follows.
- [x] Change `mergeMessages` to report the merge outcome (e.g. `{ window, addedIds }` or an
      `appended: boolean`), rather than the caller diffing lengths.
- [x] Rewire `message/received` onto that signal; leave the offset arithmetic alone.
- [x] Check the other `mergeMessages` callers (`messages/loaded` paths) still behave — the older/
      newer paging paths must not start raising the affordance.
- [x] Un-skew the perf benchmark: the `scrolled-up arrival` case currently loads
      `MAX_MESSAGES_PER_CHAT - 1` to dodge this bug. Put it back to a genuinely full window.

## Acceptance criteria

- [x] With a full window and the view scrolled up, an arrival holds the reading position and raises
      the new-messages affordance.
- [x] With a full window and the view pinned at the bottom with the cursor on the newest, the cursor
      follows to the new newest.
- [x] Paging older history still does **not** raise the affordance.
- [x] `bun run typecheck`, `bun run lint`, `bun test` green.

## Out of scope

- Changing `MAX_MESSAGES_PER_CHAT` or the eviction policy — bounded memory is an invariant.
- The unrelated question of whether 200 is the right cap.

## Outcome

Done. `mergeMessages` now returns `{ window, addedIds }` and `message/received` branches on
`addedIds.length > 0` instead of a length diff. The offset arithmetic inside the branch needed no
change, as expected — it was already row-based and nets added rows against evicted ones.

Two things the plan did not call out:

- **Two of the three symptom tests passed before the fix, vacuously.** At a full window the evicted
  message and the arrival happened to be the same height, so the reading-position assertion held at
  zero drift. The test only became real once the arrival was made taller than what it evicts. Worth
  remembering: a regression test for "position is preserved" proves nothing unless the position
  would actually have moved.
- **The naive detection cost more than the bug.** Snapshotting the window's ids on every merge
  doubled the live-message benchmark (8 → 17µs/event). Checking incoming ids against the map as
  they arrive, and building the survived-the-cap set only when there is a candidate, brought it to
  11.5µs. The residual increase over the original 8µs is real work that previously was not
  happening, because the branch was being skipped.

The perf benchmark's `scrolled-up arrival` case loaded `MAX_MESSAGES_PER_CHAT - 1` specifically to
dodge this bug; it is back to a genuinely full window.

## Risks / open questions

- `mergeMessages` also handles optimistic-echo reconciliation, where an incoming message _replaces_
  a pending one. That is an arrival for affordance purposes but must not double-count. Cover it with
  a test.
- Changing the return shape touches every caller; keep the change mechanical and let the existing
  paging tests prove it.
