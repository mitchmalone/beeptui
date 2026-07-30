# STATUS

> The cursor: where we are right now. Keep this **terse** — a snapshot, not a history.
> History lives in git, `plans/done/`, and `JOURNAL.md`.
>
> Last updated: 2026-07-30

## Where we are

**Slice 1 core complete on `feat/slice-1-beeper-adapter`** (Slice 0 is merged to `main`, PR #1). The
typed Beeper adapter (`src/beeper/`) wraps the official `@beeper/desktop-api` SDK: config + Keychain
token resolution, domain models, cursor pagination, capability detection, and a normalized
`BeeperError` taxonomy — all fixture-tested via an injected `fetch` (no live Beeper). The
`beeper-tui status` and `doctor` commands work; `doctor` names failures and exits non-zero, verified
end-to-end against a closed port. 52 tests; `typecheck`/`lint`/`format`/`test` green.

## Next up

- **Open the PR for Slice 1** and confirm CI is green, then merge.
- **One deferred acceptance item:** live smoke against a running Beeper Desktop (`status` lists real
  accounts; adapter reads chats + messages for ≥2 networks). Needs Beeper Desktop installed +
  running and a token created in its settings — run before Slice 1 is considered fully validated.
- Then **Slice 2 — State core** (event reducer, normalized entities, optimistic sends; no UI),
  which consumes the adapter's domain models.

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
