# STATUS

> The cursor: where we are right now. Keep this **terse** — a snapshot, not a history.
> History lives in git, `plans/done/`, and `JOURNAL.md`.
>
> Last updated: 2026-07-30

## Where we are

**Slices 0–5 merged; live-validated end-to-end (2026-07-31), including a real WhatsApp send.**
**Slice 6 — live updates** is done on `feat/slice-6-live-updates` and **live-validated**: WebSocket
`subscriptions.set` → `message.upserted` flows socket → store; reconnect-with-backoff, gap-resync,
and a scrolled-up "new messages" affordance. 161 tests green. **Slice 7 — local store & drafts** is
done in parallel (fork) — **PR #8 open, CI green, not yet merged** (needs review + a small
`launch.ts` reconciliation with Slice 6).

## Next up

- **Merge the two open PRs:** Slice 6 (`feat/slice-6-live-updates`) and Slice 7 (PR #8). Reconcile
  the `launch.ts` overlap (Slice 7 adds `attachPersistence` before `bootstrap` + a `flush()` in
  `onQuit`).
- Then **Slice 8 — chat search & help overlay** (the help overlay generates from the keymap table).
  Phase 1 then closes with **Slice 9 — validation & smoke harness**.

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
