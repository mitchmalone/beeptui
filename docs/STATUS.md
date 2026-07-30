# STATUS

> The cursor: where we are right now. Keep this **terse** — a snapshot, not a history.
> History lives in git, `plans/done/`, and `JOURNAL.md`.
>
> Last updated: 2026-07-30

## Where we are

**Slices 0–5 merged; first live validation pass done (2026-07-31).** The core loop — read → reply →
move on — is built and, for reads, validated against real Beeper Desktop (4.2.1004): `doctor`/`status`,
3 accounts, multi-network chats, message history, and older-paging all work live. One real bug found
and fixed (paging `direction` is `'before'`, not `'older'` — PR #7). 141 tests green.

## Next up

- **Send is blocked on token scope:** the current token is read-only, so `messages.send` 403s
  (`missing: write`). Re-create the token _with write scope_ to run the live send test to
  `+61493009690` (Mitch's chosen self/test target).
- Then **Slice 6 — Live updates**: WebSocket subscription (`ws://…/v1/ws`), reconnect with backoff,
  new-message affordance, and finalize send-echo reconciliation.

## Deferred / blocked on external setup

- **Live send** needs a **write-scoped token** (see above). Read paths are validated.
- Follow-up: `doctor` should report token scope, so a read-only token doesn't look send-capable
  (`LEARNINGS.md`). Candidate for Slice 14 polish or a capability-detection tweak.

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
