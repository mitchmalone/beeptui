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

## Deferred live validation (accepted risk, 2026-08-01)

Built, tested, and merged — but the live/manual runs need accounts/endpoints that don't currently
exist. Until ticked, these capabilities are **unverified in production**, not "known good"; don't
upgrade `STATUS.md` wording to "validated" without actually running them.

- **Slice 12 — remaining-networks live matrix.** Trigger: Discord / Instagram DMs / X DMs
  connected in Beeper Desktop. Run the full per-network matrix (list · read · live inbound ·
  send · reply · search · attachments); record a redacted results table in `STATUS.md` (note
  Beeper-side flakiness honestly — IG/X bridges historically flakiest). Once green, `STATUS.md`
  may declare Phase 2 complete.
- **Slice 13 — remote endpoint OAuth login.** Trigger: a real remote Server Client endpoint with
  `remote_access` enabled. Run `beeptui login` end-to-end (browser OAuth + PKCE → loopback →
  token in the OS credential store); confirm `launch`/`status`/`doctor` resolve it and `logout`
  revokes. Note the result in `STATUS.md`.
- **Slice 11 — per-network reply rendering.** Accrues as networks are exercised: note threaded vs
  quoted vs unsupported in `LEARNINGS.md` (WhatsApp done 2026-08-01).

> Product truth lives in `PRD.md`. Out-of-slice items are architected-for, not built.
