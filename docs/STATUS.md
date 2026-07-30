# STATUS

> The cursor: where we are right now. Keep this **terse** — a snapshot, not a history.
> History lives in git, `plans/done/`, and `JOURNAL.md`.
>
> Last updated: 2026-07-30

## Where we are

**Pre-code.** Docs are scaffolded; no application code exists yet. The PRD is mirrored at
`docs/PRD.md`, the slice breakdown is in `docs/ROADMAP.md`, and every slice has a plan in
`docs/plans/backlog/` ready to hand to an agent.

## Next up

- Resolve the pending PRD decisions below (they gate Slice 0/1 details but not their start).
- Start **Slice 0 — Project scaffold & toolchain** (`plans/backlog/PLAN-slice-0-foundation.md`):
  move it to `plans/active/`, set `status: active`, and go.

## Pending decisions (from PRD "Open questions")

Record outcomes in `DECISIONS.md` when made.

1. Final name (`beeper-tui` vs something else; repo is `beeptui`).
2. Phase 1 = local Beeper Desktop only? (Assumed **yes** by the slice plans.)
3. Terminal support baseline: rich terminals only vs conservative baseline. (Slice plans assume
   rich terminals — Ghostty/Kitty/iTerm2/WezTerm — first.)
4. First four validation accounts on Mitch's real Beeper setup.
5. Cache policy: metadata/drafts only vs opt-in message-body cache. (Slice 7 assumes
   metadata/drafts only for v1.)
6. Private tool vs open-source from first public commit.
