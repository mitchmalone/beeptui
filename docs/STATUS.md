# STATUS

> The cursor: where we are right now. Keep this **terse** — a snapshot, not a history.
> History lives in git, `plans/done/`, and `JOURNAL.md`.
>
> Last updated: 2026-07-30

## Where we are

**Slice 0 shipped (on branch `feat/slice-0-foundation`).** The Bun + TypeScript + OpenTUI scaffold
is proven: `bun run dev` renders the hello-world three-pane TUI on macOS arm64 and `q` exits
cleanly. `typecheck` / `lint` / `format:check` / `test` all pass; Husky hooks, gitleaks, and GitHub
Actions CI are wired. `src/` skeleton stubs match the repo map.

## Next up

- **Open the PR for Slice 0** and confirm the GitHub Actions run is green (CI hasn't run remotely
  yet — it's authored, not yet observed).
- Start **Slice 1 — Beeper adapter, config & doctor**
  (`plans/backlog/PLAN-slice-1-beeper-adapter-doctor.md`): move it to `active/`, set `status:
active`, branch, and begin with reading the Beeper Desktop API docs (step 1).

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
