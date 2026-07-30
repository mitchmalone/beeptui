# STATUS

> The cursor: where we are right now. Keep this **terse** — a snapshot, not a history.
> History lives in git, `plans/done/`, and `JOURNAL.md`.
>
> Last updated: 2026-07-30

## Where we are

**Slices 0–5 merged/complete.** 0–4 are on `main`. **Slice 5 — compose & send** is done on
`feat/slice-5-compose-send`: a compose strip (pure editor, draft-backed, `Tab`/`i` to focus), explicit
`⏎` send → optimistic pending → sent/failed reconciliation, `Shift+⏎` newline, and `R` to retry a
failed send. Invariant 5 is enforced and guard-tested (no implicit send path). The core loop — read →
reply → move on — is complete. 141 tests green.

## Next up

- Land Slice 5 (PR), then **Slice 6 — Live updates**: WebSocket/watch subscription
  (`ws://…/v1/ws`), reconnect with backoff, new-message affordance. **This is where a running Beeper
  Desktop becomes genuinely necessary** — a natural point to pause the build-ahead and do the live
  validation pass (Slices 1/3/4/5 smokes) in one go once Beeper is set up.

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
