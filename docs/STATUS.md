# STATUS

> The cursor: where we are right now. Keep this **terse** — a snapshot, not a history.
> History lives in git, `plans/done/`, and `JOURNAL.md`.
>
> Last updated: 2026-07-31

## Where we are

**Phase 2 in progress — Slice 10 built** on `feat/slice-10-filters-message-search` (10a + 10b + live
feedback; PR #12 open). A `slk`-style **leftmost network rail** scopes the inbox (All + per-network,
unread dots) with archived (`a`) and unread-only (`U`) toggles. Per Mitch's live-use feedback the
rail is now a **real focus target**: `Esc`/`h`/`←` walks out (conversation → list → rail), `j`/`k`
switch networks in the rail, `l`/`→`/`Enter` drill back in — quick-keys still work. **`Shift+A`
archives/unarchives the open chat** via Beeper's endpoint, capability-gated (named notice when the
platform can't), then returns to the list. **Message search** (`S`) runs through the adapter with
verified scope + labeled local fallback. **261 tests** green; typecheck + lint clean; 7 smoke
scenarios. Live validation of the real search endpoint still pending.

**🎉 Phase 1 complete — Slices 0–9 done (all merged to `main`).**
The MVP is real and live-validated against Beeper Desktop 4.2.1004: browse the inbox, read history
(paged), send real messages (a WhatsApp send received by Mitch), live updates over WebSocket, drafts
that persist restart, `/` fuzzy search, `?` help. **Slice 9** added a golden-path smoke harness
(scenarios 1–4 via the headless renderer, +7 in the CLI test) and ran the redacted live matrix —
launch-to-usable ~29ms (≤3s target), all connected networks (WhatsApp/Facebook/Beeper) list+read with
no silent failures. Fixed pagination resilience along the way. **199 tests** green.

## Next up

- **Live-validate Slice 10's message search** against the real Beeper search endpoint (scope honor,
  caps, deep-link support per network) — the one acceptance item that needs a running Beeper.
- Then Slice 11 (replies, edits & attachments), Slice 12 (remaining networks — depends on 10 + 11).
  Re-plan Phase 3 (13–14) before starting; 14 is blocked on pending decisions #1 (name) and #6
  (open-source).

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
