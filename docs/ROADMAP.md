# ROADMAP

> Phases & milestones. Stable-ish; mirrors `PRD.md`'s phased delivery, broken into agent-sized
> slices. The moving cursor lives in `STATUS.md`. Each slice has a plan in `plans/backlog/` that
> moves to `plans/active/` when picked up and `plans/done/` when shipped.

## Phase 0 — Foundations ✅ done

No product features. Scaffold the project so every later slice lands on rails.

- **Slice 0 — Project scaffold & toolchain**: Bun + TypeScript + OpenTUI pinned and proven on
  macOS arm64, lint/format/test/hooks/CI, repo layout.

## Phase 1 — Vertical-slice MVP ✅ done (2026-07-31)

Local Beeper Desktop only. Outcome: read, watch, and reply across WhatsApp, Slack, Telegram, and
Signal without leaving the terminal.

- **Slice 1 — Beeper adapter, config & doctor**: typed HTTP client, auth/token handling, capability
  detection, error normalization, `status`/`doctor` CLI.
- **Slice 2 — State core**: event reducer, normalized entities, optimistic sends — fully unit
  tested, no UI.
- **Slice 3 — TUI shell & inbox**: three-pane layout, chat list, keyboard navigation, status bar.
- **Slice 4 — Conversation view**: message history, upward paging, author/timestamp/delivery
  rendering, scroll behavior.
- **Slice 5 — Compose & send**: multiline editor, explicit send, pending/sent/failed states.
- **Slice 6 — Live updates**: WebSocket/watch subscription, reconnect with backoff, new-messages
  affordance.
- **Slice 7 — Local store & drafts**: SQLite UI-state store, per-chat draft persistence, last-view
  restore.
- **Slice 8 — Chat search & help overlay**: fuzzy chat search, quick jump, command/help overlay.
- **Slice 9 — Phase 1 validation & smoke harness**: terminal smoke tests for the key flows;
  validate WhatsApp, Slack, Telegram, Signal end-to-end.

## Phase 2 — Multi-network hardening (current)

- **Slice 10 — Filters & message search**: all/unread/account/archive filters; Beeper-backed
  message search with local fallback.
- **Slice 11 — Replies, edits & attachments**: reply-to-selected composition, edit rendering,
  attachment placeholders + open/download.
- **Slice 12 — Remaining networks & capability messaging**: validate Discord, Instagram DMs, X DMs;
  explicit "capability unavailable" UX.

## Phase 3 — Quality & power-user features

Coarser outlines — re-plan before starting.

- **Slice 13 — Remote Server Client endpoint**: OAuth/token flow, platform credential store,
  security review.
- **Slice 14 — Polish & packaging**: read-only reactions/receipts, theming/config, notification
  hooks, performance tuning, install docs and distribution.

> Product truth lives in `PRD.md`. Out-of-slice items are architected-for, not built.
