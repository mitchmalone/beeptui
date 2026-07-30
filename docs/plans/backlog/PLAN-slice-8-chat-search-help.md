---
title: Slice 8 — Chat search, quick jump & help overlay
status: planned
created: 2026-07-30
updated: 2026-07-30
links:
  - ../../PRD.md § Search (chat search), § Inbox and navigation (quick jump, help overlay)
  - PLAN-slice-3-tui-shell-inbox.md
---

# Slice 8 — Chat search, quick jump & help overlay

## Goal

`/`-style fuzzy chat search and quick jump make moving between conversations instant, and a
generated help overlay makes every binding discoverable.

## Context

Chat search is local over loaded metadata (PRD) — no API dependency, so this slice is pure
state + UI on top of Slices 2/3/7. The keymap layer has been the single source of bindings since
Slice 0 precisely so the help overlay can be generated, not hand-maintained.

## Approach

A modal palette component (also the pattern for Slice 10's message search): open with `/` or
`Ctrl+K`, type to fuzzy-filter chats (name, network, account) with match highlighting, `Enter`
jumps to the chat, `Esc` dismisses and restores prior focus. Fuzzy scoring is a small local
implementation or one tiny well-maintained dependency — decide against AGENTS.md dependency rules.
Help overlay (`?`) renders grouped bindings straight from the keymap declarations.

## Steps

- [ ] Modal/overlay primitive: focus capture, dismiss, restore — reused by help and future palettes.
- [ ] Fuzzy matcher over inbox metadata with ranking (recency-weighted) and highlight spans; unit
      tests for scoring and ordering.
- [ ] Search palette UI + keymap wiring; selection jumps to the chat (opening it exactly like inbox
      `Enter`).
- [ ] Help overlay generated from keymap declarations, grouped by context (global / inbox /
      conversation / compose).
- [ ] Assert in tests that every declared binding renders in the overlay (no drift possible).

## Acceptance criteria

- [ ] From anywhere, `/` + a few characters + `Enter` lands in the intended chat; `Esc` returns to
      the prior state cleanly.
- [ ] `?` shows all bindings, grouped, matching the keymap source exactly (test-enforced).
- [ ] Search over several hundred cached chats stays instant (no perceptible lag).
- [ ] `bun test` green.

## Out of scope

Message-content search (Slice 10), account/unread/archive filters (Slice 10).

## Risks / open questions

- None significant — this slice is deliberately low-risk consolidation before validation.
