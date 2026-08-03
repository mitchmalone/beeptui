---
title: Conversation message navigation + action menu + reactions
status: done
created: 2026-08-03
updated: 2026-08-03
links:
  - docs/PRD.md (messaging client scope)
  - src/state/reducer.ts (messageSelection/*)
  - node_modules/@beeper/desktop-api reactions.add
---

# Conversation message navigation + action menu + reactions

## Goal

Make the Conversation column navigable message-by-message with a visible indicator (like the
Net/Chats columns), and let the user press ENTER on the highlighted message to open an action menu.
The first (and for now only) action is **React**, which opens a limited emoji picker and writes the
reaction back through the Beeper adapter. Delete/reply/etc. come later; this lays the menu + write
path.

## Context

- Message selection already exists in state: `selectedMessageId` + `messageSelection/started`,
  `messageSelection/moved`, `messageSelection/cleared` (`src/state/reducer.ts`). Today it is a
  distinct mode entered with `v`; arrows scroll instead. The UX decision (2026-08-03) is to make
  arrow navigation select messages directly on focus.
- Reactions are currently **read-only** display (`ReactionSummary`, `mapReactions` in
  `src/beeper/types.ts`). The SDK supports writing: `client.chats.messages.reactions.add(messageID,
{ chatID, reactionKey })`.
- Overlays follow the `overlay/opened|closed` + `Overlay` union pattern (`SearchPalette`,
  `MessageSearchPalette`). The action menu and emoji picker are new overlays.
- Sends flow UI → runtime helper → adapter → dispatch (`src/tui/runtime.ts`). Reactions follow the
  same shape and honour invariant 5 (only on explicit user action) and 8 (degrade visibly).

## Decisions (confirmed with Mitch 2026-08-03)

- **Nav model:** focusing Conversation auto-selects the newest message; ↑/↓ move the indicator
  message-by-message and auto-scroll to keep it visible; ENTER opens the action menu; Esc clears.
- **Emoji set (limited picker):** 👍 ❤️ 😂 😮 😢 🙏.

## Approach

1. **Reducer/selectors first (pure).** Auto-select newest message when focus enters conversation;
   make `messageSelection/moved` keep the selection inside the viewport (adjust `conversationOffset`
   so the selected row stays visible). Add overlay variants `conversationActions` and `emojiPicker`
   with a small piece of state for the emoji picker cursor. Add a `reaction/*` event path if needed
   for optimistic display (optional — reactions may just re-fetch; keep minimal).
2. **Adapter.** Add `addReaction(chatId, messageId, reactionKey)` to the client + `Gateway`,
   guarded and error-normalized. Test against a fake SDK.
3. **Runtime.** Add `sendReaction(...)` helper: capability check → `addReaction` → visible
   success/failure notice. No optimistic fake success (invariant 5/8).
4. **TUI.** Add a `›` caret indicator to the selected message row (keep the highlight). Wire
   Conversation focus so ↑/↓ = `messageSelection/moved`, ENTER = open action menu. Build
   `ConversationActionMenu` (list: React) and `EmojiPicker` (single row, ←/→ + Enter) overlays via
   the keymap layer. Update the hint bar.
5. **Keymap.** Declare any new bindings through `src/tui/keymap.ts` so help stays generated.

## Steps

- [x] Reducer: auto-select newest on `focus/changed → conversation` (when none selected)
- [x] Reducer: `messageSelection/moved` keeps selection within the viewport (offset follow via
      `offsetToShowIndex` + a `viewport/measured` event carrying the measured capacity)
- [x] Reducer: cursor **follows** the newest on a live message when pinned at the bottom; **holds**
      when scrolled up (offset > 0) with the new-below affordance
- [x] State: `Overlay` gains `conversationActions` + `emojiPicker`; `viewportRows`, `actionCursor`,
      `emojiCursor` state
- [x] Reducer: `actionMenu/moved` + `emojiPicker/moved` (clamped); `overlay/opened` resets cursors
- [x] Adapter: `Client.addReaction` + `Gateway.addReaction`, guarded, with fake-fetch tests;
      `ChatSummary.canReact` mapped from Beeper's `reaction` capability
- [x] Runtime: `sendReaction` helper (capability-gated, visible notice, no fake success)
- [x] TUI: `›` caret on selected row; ConversationView hint bar (affordance takes priority)
- [x] TUI: Conversation focus keys — ↑/↓ select, g/G jump, ENTER opens action menu, Esc leaves
- [x] TUI: `ConversationActionMenu` overlay (React option)
- [x] TUI: `EmojiPicker` overlay (👍 ❤️ 😂 😮 😢 🙏; ←/→ + Enter; Esc back to menu)
- [x] Keymap `MESSAGE_SELECT_HELP` reflects the new flow; `v` re-anchors the cursor
- [x] Docs: STATUS, JOURNAL, LEARNINGS, move plan to done

## Acceptance criteria

- [x] Focusing the Conversation highlights the newest message; ↑/↓ move the indicator and it stays
      on screen; Esc clears selection and steps out to the inbox
- [x] ENTER on a selected message opens an action menu; choosing React opens the emoji picker
- [x] Picking an emoji calls the adapter's reaction-add exactly once with the right key, and shows
      a visible success/failure notice; unsupported networks show a named notice, never a dead menu
- [x] No Beeper I/O outside `src/beeper/`; no state mutation outside the reducer; new reducer +
      adapter behaviour is test-first
- [x] `bun run typecheck`, `bun run lint`, `bun test` all green (485 tests)
- [ ] **Manual smoke (Mitch):** react to a real message end-to-end against live Beeper

## Out of scope

- Delete, reply-from-menu (reply already exists via `r`), edit, forward, copy.
- Full emoji search / arbitrary emoji entry — the picker is a fixed limited set.
- Rendering reaction counts differently than today; removing reactions (delete path) — add later.

## Risks / open questions

- Does the live network accept `reactions.add` for the selected chat? Gate on a capability if one is
  reported; otherwise attempt-then-degrade with a visible notice. Live validation is a manual smoke
  step, not a unit test.
- Viewport-follow math interacts with `visibleMessages`/`conversation-scroll.ts`; add focused tests
  so selection never renders off-window.
