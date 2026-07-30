---
title: Slice 5 — Compose & send
status: planned
created: 2026-07-30
updated: 2026-07-30
links:
  - ../../PRD.md § Compose and sending
  - PLAN-slice-4-conversation-view.md
---

# Slice 5 — Compose & send

## Goal

Type a multiline message in the compose box and send it to the active chat, with unambiguous
pending → sent/failed feedback. Completes the core loop: read → reply → move on.

## Context

Slice 2 already models the optimistic-send lifecycle; Slice 1's adapter has the send call. This
slice builds the compose editor UI and wires the loop. Hard PRD rules: explicit send and newline
shortcuts; never send automatically on launch, reconnect, or focus change; never silently pretend
a send succeeded.

## Approach

A multiline compose component owning its editing state (text, cursor) with `Enter` = send and
`Shift+Enter` (or `Alt+Enter` where terminals can't distinguish) = newline; focus toggling between
list and compose. Send dispatches the Slice 2 `send-requested` event: the message appears
immediately as pending in the conversation, then reconciles to sent or failed. Failed sends render
inline with a retry binding that requires an explicit keypress.

## Steps

- [ ] Compose editor: multiline input, cursor movement, wrapped display, grows within a bounded
      height.
- [ ] Keybindings via keymap: send, newline, focus switch (e.g. `Tab`/`Esc`), declared centrally.
- [ ] Wire send → optimistic pending message → adapter call → success/failure reconciliation.
- [ ] Failed-send UI: visible error on the message, explicit retry and discard actions.
- [ ] Guard tests: no send path reachable from launch/reconnect/focus events (assert reducer +
      runtime never emit `send-requested` without the user send action).
- [ ] Compose state survives switching chats (in-memory here; persistence is Slice 7).
- [ ] Editor-logic and lifecycle tests, test-first.

## Acceptance criteria

- [ ] PRD acceptance scenario 2 end-to-end: multiline reply to a WhatsApp chat shows pending then
      sent/failure without leaving the chat.
- [ ] A send during an API outage fails visibly, is never silently dropped or duplicated, and can
      be retried explicitly.
- [ ] Newline vs send shortcuts behave as documented in the tested terminals.
- [ ] `bun test` green.

## Out of scope

Reply-to-selected-message (Slice 11), draft persistence across restarts (Slice 7), rich
text/attachments (non-goal for v1).

## Risks / open questions

- Terminal key encoding for `Shift+Enter` varies (Kitty keyboard protocol vs legacy) — depends on
  the pending terminal-baseline decision; pick a working default and document per-terminal behavior
  in `LEARNINGS.md`.
