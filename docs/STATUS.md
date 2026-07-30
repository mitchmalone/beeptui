# STATUS

> The cursor: where we are right now. Keep this **terse** — a snapshot, not a history.
> History lives in git, `plans/done/`, and `JOURNAL.md`.
>
> Last updated: 2026-07-30

## Where we are

**Slices 0 and 1 merged to `main`** (PRs #1, #2, CI green). The scaffold is proven and the typed
Beeper adapter (`src/beeper/`) wraps the official `@beeper/desktop-api` SDK: config + Keychain token
resolution, domain models, cursor pagination, capability detection, a normalized `BeeperError`
taxonomy, and the `status` / `doctor` CLI — all fixture-tested via an injected `fetch`. 52 tests
green.

## Next up

- Start **Slice 2 — State core** (event reducer, normalized entities, optimistic sends; pure, no
  UI), which consumes the adapter's domain models.

## Deferred / blocked on external setup

- **Live testing is booked until Beeper Desktop is set up** (Mitch's call, 2026-07-30). Needs Beeper
  Desktop installed + running, WhatsApp bridged, and a token created in its settings. Once ready:
  run Slice 1's deferred live smoke (`status` lists real accounts; adapter reads chats + messages
  for ≥2 networks), and a real send can be exercised (either an added `send` command or, properly,
  the Slice 5 compose flow).

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
