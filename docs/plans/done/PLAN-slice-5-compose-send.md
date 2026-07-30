---
title: Slice 5 — Compose & send
status: done
created: 2026-07-30
updated: 2026-07-31
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

- [x] Compose editor: multiline input via pure `applyComposeKey` (insert/backspace/cursor/newline),
      caret + wrapped multiline display, bounded-height strip. Cursor movement is left/right/home/end
      (up/down line nav deferred).
- [x] Keybindings via keymap: `⏎` send, `Shift+⏎` newline, `Tab`/`i` focus compose, `Esc`/`Tab`
      blur, `R` retry — declared centrally.
- [x] Wire send → optimistic pending → adapter `sendMessage` → sent/failed reconciliation
      (`submitSend`); draft clears on send.
- [x] Failed-send UI: `⚠ failed` on the message + a compose hint; explicit `R` retry (`retrySend`).
      _(Discard trimmed — retry covers the recovery path; a discard event can come with Slice 7.)_
- [x] Guard tests: `bootstrap`/`refreshChats`/`openChat`/`loadOlder` never emit `send/requested`;
      send only via the explicit `submitSend` path (invariant 5).
- [x] Compose draft survives switching chats — text lives in the reducer `drafts`; the component
      remounts per chat via `key`.
- [x] Editor-logic + lifecycle + render/keyboard tests, test-first (141 total).

## Acceptance criteria

- [~] PRD scenario 2: multiline reply shows pending → sent/failure without leaving the chat. **Flow
  built + fixture/render tested** (type, `Shift+⏎` newline, `⏎` send → optimistic pending →
  reconcile); _live WhatsApp send_ deferred until Beeper Desktop is set up.
- [x] A send during an outage fails visibly, is never silently dropped or duplicated, and can be
      retried explicitly (`submitSend`/`retrySend` tests; failed status renders).
- [~] Newline vs send shortcuts behave as documented — `⏎`/`Shift+⏎` verified in tests; per-terminal
  `Shift+⏎` encoding needs real-terminal confirmation (journalled).
- [x] `bun test` green.

## Outcome (2026-07-31)

Shipped — the core loop (read → reply → move on) is complete. `compose-editor.ts` (pure) drives a
`Compose` strip; `submitSend`/`retrySend` wire the optimistic lifecycle (already modelled in Slice 2) to the adapter. Focus is 3-way (inbox / conversation / compose); the compose pane captures every
key so letters type rather than run commands. **Invariant 5 is enforced and guard-tested**: the only
`send/requested` path is an explicit `⏎` on a non-empty draft.

**Notes / deferred:** live WhatsApp send needs Beeper Desktop set up. Send success reconciles from
the local text + the API's `pendingMessageID` with a sentinel sortKey (real message/sortKey arrive
via live updates — Slice 6). Discard and up/down line-cursor nav were trimmed to keep scope; the
`useRef` input pattern (avoiding stale keyboard closures) is in `LEARNINGS.md`.

## Out of scope

Reply-to-selected-message (Slice 11), draft persistence across restarts (Slice 7), rich
text/attachments (non-goal for v1).

## Risks / open questions

- Terminal key encoding for `Shift+Enter` varies (Kitty keyboard protocol vs legacy) — depends on
  the pending terminal-baseline decision; pick a working default and document per-terminal behavior
  in `LEARNINGS.md`.
