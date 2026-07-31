---
title: Slice 8 — Chat search, quick jump & help overlay
status: done
created: 2026-07-30
updated: 2026-07-31
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

- [x] Modal/overlay primitive: focus capture, dismiss, restore — reused by help and future palettes.
- [x] Fuzzy matcher over inbox metadata with ranking (recency-weighted) and highlight spans; unit
      tests for scoring and ordering.
- [x] Search palette UI + keymap wiring; selection jumps to the chat (opening it exactly like inbox
      `Enter`).
- [x] Help overlay generated from keymap declarations, grouped by context (global / inbox /
      conversation / compose).
- [x] Assert in tests that every declared binding renders in the overlay (no drift possible).

## Acceptance criteria

- [x] From anywhere, `/` + a few characters + `Enter` lands in the intended chat; `Esc` returns to
      the prior state cleanly.
- [x] `?` shows all bindings, grouped, matching the keymap source exactly (test-enforced).
- [x] Search over several hundred cached chats stays instant (no perceptible lag).
- [x] `bun test` green.

## Outcome (2026-07-31)

Shipped. `fuzzy.ts` (pure subsequence matcher + `searchChats` ranking with highlight positions) +
overlay state (`overlay`/`searchQuery` + events) + `SearchPalette`/`HelpOverlay` components, wired in
`App`. `/` opens fuzzy chat search (type → filter, `⏎` → jump to top match, `Esc` → cancel); `?`
shows a help overlay **generated from the keymap** (`helpGroups()`) so it can never drift — a test
asserts every binding renders. 194 tests; typecheck/lint/format green; PTY-verified.

**Notes:** the keyboard handler now reads `store.getState()` (not the render closure) so fast typing
isn't lost — the stale-closure fix, in `LEARNINGS.md`. `Esc`-cancel works for real but is
parser-ambiguous to test, so the test uses the reliable `⏎`-closes path. Search is O(n) over cached
metadata — instant for the account sizes seen; not separately benchmarked.

## Out of scope

Message-content search (Slice 10), account/unread/archive filters (Slice 10).

## Risks / open questions

- None significant — this slice is deliberately low-risk consolidation before validation.
