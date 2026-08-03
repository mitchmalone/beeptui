---
title: Demo mode (beeptui --demo)
status: done
created: 2026-08-03
updated: 2026-08-03
links:
  - src/tui/launch.ts
  - src/tui/runtime.ts (Gateway)
---

# Demo mode — `beeptui --demo`

## Goal

`beeptui --demo` launches the **real** TUI against synthetic data — no Beeper, no auth, no network —
so it's a safe, self-contained surface for screenshots and screen recordings. Multiple networks,
fictitious chats/messages that show off the features (unread, reactions, muted, archived, an
HTML-formatted message, themes).

## Approach

- **`src/tui/demo.ts`:** `createDemoGateway(): Gateway` — implements the same `Gateway` interface the
  runtime already uses, returning hardcoded fictitious accounts/chats/messages. Everything is
  synthetic (invariant 9): made-up names, no real content. Writes (send/react/archive) resolve as
  no-ops so the optimistic UI behaves.
- **`launch({ demo })`:** when demo, use the demo gateway and **skip** token resolution, the watch
  socket, persistence (must not overwrite the user's real cached inbox/drafts), and the tmux status
  writer. Theme resolution + everything else is identical. Auto-open the first chat so the
  conversation pane has content on first paint.
- **CLI:** `beeper-tui --demo` (and `run --demo`) → `launch({ demo: true })`.

## Steps

- [x] `src/tui/demo.ts` — fixtures + `createDemoGateway` + a unit test (data shape / search / send)
- [x] `launch({ demo })` — demo branch (gateway, skip auth/watch/persistence/status), auto-open
- [x] CLI `--demo` flag + USAGE line
- [x] Boot test: App + demo gateway renders the fictitious inbox
- [x] Docs + commit on its own

## Acceptance criteria

- [x] `beeper-tui --demo` boots with fictitious multi-network chats, no token/network required
- [x] Demo never touches the user's persisted store or tmux title
- [x] `bun run typecheck`, `bun run lint`, `bun test` green

## Out of scope (possible follow-ups)

- Self-driving choreography (scripted keypresses / auto-tour) — complex, and can't be validated live
  here; the user drives manually for now.
- A live activity simulator (new messages trickling in during a recording).
