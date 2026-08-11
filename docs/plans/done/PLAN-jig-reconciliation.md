---
title: jig reconciliation — monorepo merge + toolchain unification
status: done
created: 2026-08-11
updated: 2026-08-11
links:
  - ~/Desktop/jig-defects/beeptui.md (defect list, source of scope)
  - jig standard: mitchmalone/jig AGENTS.md (vendored here as docs/STANDARDS.md)
---

# jig reconciliation — monorepo merge + toolchain unification

## Goal

Bring beeptui onto the jig standard: one monorepo (`apps/cli` + `apps/www`), one toolchain (Bun),
Lefthook hooks, the jig docs conventions (AGENTS.md canonical, DEVIATIONS.md, vendored
STANDARDS.md, release-notes-first gate), and a release pipeline with no cross-repo website fan-out.

## Context

- `beeptui-web` (private repo) becomes `apps/www` here. Snapshot import, not subtree: the web
  repo's history was never vetted for publishable hygiene (this repo's was filter-repo'd before the
  public flip), and `main` here requires linear history — the full history stays in the archived
  `beeptui-web` repo.
- The web repo is already on Bun (`bun.lock`, `bunx` hooks) — only Husky→Lefthook and the missing
  test/verify wiring remain from the toolchain defect.
- The website release fan-out (`WEB_REPO`/`WEB_REPO_TOKEN`) never worked; the last `release.json`
  was stamped by hand. Post-merge the stamp is an in-repo file updated in the release-prep commit
  (a bot push to protected `main` would be blocked, so the workflow gates rather than writes).
- jig session rulings (2026-08-11): full restructure now (`apps/cli`, keep `src/` layout intact
  inside it, no `packages/*` until a second consumer exists); STANDARDS.md stamp =
  `<!-- vendored from the jig on YYYY-MM-DD (jig commit <sha>) -->`; CLAUDE.md → `@AGENTS.md`
  pointer, rich content folds into AGENTS.md as deltas only.

## Approach

One branch, one commit per defect cluster. Restructure first (pure `git mv`, no behavior change),
then hooks, then the www import, then release wiring, then docs. Verify green at each commit.

## Steps

- [x] Restructure: app → `apps/cli`, root becomes Bun workspace root (tui-bun flavor shape);
      update tsconfig/eslint/CI/release paths, compile outfile, formula renderer invocation.
- [x] Husky → Lefthook (+ gitleaks pre-commit); root `verify` script = typecheck + lint +
      format:check + test.
- [x] Import web as `apps/www` (`@beeptui/www`): strip its hooks/agent files (deltas fold into
      root AGENTS.md), `output: 'export'` static-first, typecheck/lint wired into `verify`,
      `next build` in CI.
- [x] Release workflow: release-notes-written-first gate from `docs/releases/_TEMPLATE.md`
      (+ `--notes-file`), gate that `apps/www/src/data/release.json` matches the tag, delete the
      website fan-out job, path updates.
- [x] Docs: CLAUDE.md → pointer; AGENTS.md rewritten (deltas only); TODO.md → `docs/ROADMAP.md`;
      vendor `docs/STANDARDS.md` (+ `.prettierignore`); create `DEVIATIONS.md`.
- [x] Close out: STATUS/JOURNAL/DECISIONS updated, plan → done, push branch, CI green.

## Acceptance criteria

- [x] `bun run verify` green at repo root; `bun run --filter '@beeptui/www' build` produces a
      static export.
- [x] No Husky remnants; Lefthook hooks fire (pre-commit format/lint/gitleaks, commit-msg,
      pre-push verify).
- [x] Release workflow refuses a tag without `docs/releases/v<X.Y.Z>.md` or with a stale
      `release.json`.
- [x] `CLAUDE.md` is one line; no rule stated in two places (AGENTS.md vs STANDARDS.md).

## Out of scope

- Archiving `beeptui-web`, repointing the Vercel project root to `apps/www`, deleting the
  `WEB_REPO*` config — Mitch-level GitHub/Vercel actions, listed as follow-ups.
- Extracting `packages/*` (second-use rule: nothing shared yet).
- The deferred live-validation items themselves (they move to ROADMAP, not done).

## Risks / open questions

- `eslint-config-next` vs the root flat config: `apps/www` keeps its own lint script; root lint
  ignores `apps/www`.
- Vercel must switch root directory to `apps/www` at merge time or the site build breaks — noted
  in follow-ups; the old repo keeps serving until the switch.
