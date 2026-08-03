---
title: release hygiene — version stamping + CI action bump
status: done
created: 2026-08-03
updated: 2026-08-03
links:
  - ../../STATUS.md (v0.1.0 released 2026-08-02)
  - .github/workflows/release.yml
  - src/cli/index.ts (--version)
  - package.json
---

# release hygiene — version stamping + CI action bump

## Goal

Make a released binary report its real version, and stop it drifting again. `v0.1.0` shipped with
`beeptui --version` printing **`0.0.0`** because `src/cli/index.ts` reads `version` from
`package.json`, which was never bumped. Fix the value, tie it to the tag so it can't drift, and clear
the release run's Node-20 action-deprecation warning while we're in the workflow.

## Context

- `src/cli/index.ts:15` → `import { version } from '../../package.json'`; `package.json` version is
  `"0.0.0"`.
- The `v0.1.0` GitHub Release, `sha256sums.txt`, and the Homebrew formula all say `0.1.0` — only the
  embedded binary version is wrong.
- `release.yml` builds with `bun build --compile` on a `v*` tag; `github.ref_name` is the tag.
- The release run warns: `actions/checkout@v4` + `actions/upload/download-artifact@v4` target Node
  20 (force-run on Node 24). Warning only, not failing.

## Approach

Stamp the version from the tag at build time so `package.json` need not be hand-bumped per release
(single source of truth = the tag). Simplest: a workflow step that writes `github.ref_name` (minus
the `v`) into `package.json` before `bun build --compile`. Keep `package.json` at a sane baseline
(bump to `0.1.1`) so local `bun run dev`/`build` reports something truthful too. Then cut `v0.1.1`.

## Steps

- [x] ~~Bump `package.json` `0.0.0` → `0.1.1`~~ — **stale premise:** `package.json` was already
      bumped to `0.2.0` (STATUS 2026-08-03), so local `--version` is truthful. Left at `0.2.0`; the
      release now stamps the tag over it so it can't drift regardless.
- [x] In `release.yml`, before compile: stamp the version from `${{ github.ref_name }}` (strip `v`)
      into `package.json` via a small `bun` step so the binary embeds the tag's version.
- [x] Bump the GitHub Actions to the Node-24 majors (`actions/checkout@v5`,
      `actions/upload-artifact@v5`, `actions/download-artifact@v5`) to clear the deprecation warning.
- [x] Cut the next release (`v0.2.0`, folded in with the `beeptui` rename); confirm `beeptui
    --version` prints the tag version from the released binary and the tap updates. _(release run
      verified at close — see JOURNAL 2026-08-03)_

## Acceptance criteria

- [ ] A binary from a `vX.Y.Z` release prints `X.Y.Z` for `--version`.
- [ ] The release workflow runs without the Node-20 deprecation annotation.
- [ ] `brew upgrade beeptui` yields a binary reporting the new version.

## Out of scope

- Changelog / release-notes automation (GitHub auto-notes already run).

## Risks / open questions

- Editing `release.yml` needs a `workflow`-scoped push (the session's HTTPS token lacks it — see
  `JOURNAL.md` 2026-08-01). Land the `package.json` bump + CI step together on a branch that can be
  pushed with the right scope.
