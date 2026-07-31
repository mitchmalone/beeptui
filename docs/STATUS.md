# STATUS

> The cursor: where we are right now. Keep this **terse** — a snapshot, not a history.
> History lives in git, `plans/done/`, and `JOURNAL.md`.
>
> Last updated: 2026-07-30

## Where we are

**Slices 0–7 merged to `main`; live-validated end-to-end (2026-07-31), incl. a real WhatsApp send.**
**Slice 6 — live updates** (WebSocket `subscriptions.set` → `message.upserted` → store; reconnect +
backoff, gap-resync, scrolled-up "new messages" affordance) and **Slice 7 — local SQLite store &
drafts** were built **in parallel** (Slice 7 in a forked worktree) and both merged (PRs #9, #8). The
`launch.ts` overlap reconciled cleanly. Integrated gate: **177 tests** green.

**Slice 8 — chat search & help overlay** is done on `feat/slice-8-chat-search-help`: `/` fuzzy chat
search (type → filter → `⏎` jumps), and `?` help overlay generated from the keymap (drift-proof).
194 tests green.

## Next up

- **Slice 9 — Phase 1 validation & smoke harness** closes Phase 1: terminal smoke tests for the key
  flows, and validate WhatsApp/Slack/Telegram/Signal end-to-end. Fold in the deferred live checks:
  warm-launch draft/inbox restore (Slice 7), mid-draft disconnect dance + cross-network send-echo id
  (Slice 6), and `doctor` token-scope reporting.

## Deferred / follow-ups

- `doctor` should report token scope (read-only token looks send-capable). Candidate for Slice 14.
- Slice 6 deferrals: polling fallback (this build has the WS), delete-event application, the
  quit-Beeper-mid-draft manual dance, and cross-network send-echo id confirmation — all for Slice 9.
- Slice 7 deferral: scroll-anchor _restore_ into the loaded page (Slice 6/9 territory).

## Pending decisions (from PRD "Open questions")

Record outcomes in `DECISIONS.md` when made.

1. ~~Final name~~ — **resolved 2026-07-30:** package/CLI/config is `beeper-tui`, repo stays
   `beeptui` (`DECISIONS.md`).
2. Phase 1 = local Beeper Desktop only? (Assumed **yes** by the slice plans.)
3. Terminal support baseline: rich terminals only vs conservative baseline. (Slice plans assume
   rich terminals — Ghostty/Kitty/iTerm2/WezTerm — first.)
4. First four validation accounts on Mitch's real Beeper setup.
5. Cache policy: metadata/drafts only vs opt-in message-body cache. (Slice 7 assumes
   metadata/drafts only for v1.)
6. Private tool vs open-source from first public commit. **Partially resolved 2026-07-30:** the
   repo is treated as publishable from day one regardless (`DECISIONS.md`); only the
   when/whether-to-flip-public call remains open.
