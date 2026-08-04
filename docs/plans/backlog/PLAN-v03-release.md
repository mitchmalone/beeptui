---
title: v0.3 — the ladder, and the release itself
status: planned
created: 2026-08-04
updated: 2026-08-04
links:
  - PLAN-login-guard-local-endpoint.md # step 1
  - PLAN-v03-2-full-window-eviction.md # step 2
  - PLAN-v03-3-selection-and-focus.md # step 3
  - PLAN-v03-4-history-paging-on-scroll.md # step 4
  - PLAN-v03-5-reply-from-action-menu.md # step 5
  - PLAN-v03-6-settings-menu.md # step 6
  - PLAN-inline-image-rendering.md # step 7
  - ../done/PLAN-conversation-message-layout.md # shipped in 0.2.1
---

# v0.3 — the ladder, and the release itself

## Goal

Ship v0.3: the conversation is readable (images render), navigable (one scrolling model, always a
visible cursor), and configurable (a settings home), with two known defects closed. Each step below
is its own plan and its own PR; this file is the index and the release checklist.

## The ladder

Worked in order. Steps 1, 2, 6 and 7 are independent; 4 and 5 both depend on 3 and must not start
before it lands.

| #   | Plan                                  | What                                                                                      | Size | Depends on |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------- | ---- | ---------- |
| 1   | `PLAN-login-guard-local-endpoint`     | `login` refuses honestly against a local endpoint instead of opening a dead browser tab   | S    | —          |
| 2   | `PLAN-v03-2-full-window-eviction`     | Live arrivals stop being ignored once the 200-message window is full                      | S    | —          |
| 3   | `PLAN-v03-3-selection-and-focus`      | Always a visible cursor: first chat on load, newest message on open, none while composing | M    | —          |
| 4   | `PLAN-v03-4-history-paging-on-scroll` | Drop `u`; `↑` at the oldest loaded message pages history and keeps walking                | M    | 3          |
| 5   | `PLAN-v03-5-reply-from-action-menu`   | Reply in the `⏎` dropdown; `Replying in thread ●`; mark the target message                | M    | 3          |
| 6   | `PLAN-v03-6-settings-menu`            | Settings pinned to the Net rail → flyout → Theme → theme flyout                           | M    | —          |
| 7   | `PLAN-inline-image-rendering`         | Images render inline instead of `[image: … · 205 KB]`                                     | L    | —          |

**Why this order.** The two small independent fixes go first — they are quick, they touch code the
later steps will disturb, and they get the ladder moving. Step 3 is the foundation the two
navigation slices build on, so it precedes both. Step 7 is last because it is the only one with an
unresolved feasibility question (framebuffer cooperation); sequencing it last means an unhappy spike
result costs the release nothing but images.

**Scope discipline.** One plan, one PR, one merge. Anything discovered mid-slice that is not in that
slice's plan gets written down, not absorbed — the way the full-window eviction bug was found during
the layout slice and deferred rather than folded in.

## Release steps (after 1–7 land)

- [ ] `main` green: `bun run typecheck`, `bun run lint`, `bun test`, and the GitHub Actions run on
      `main` — checked, not assumed.
- [ ] Full manual pass in `--demo` **and** against a real account: launch state, chat open, cursor
      behaviour, paging by `↑`, reply from the dropdown, settings → theme, images.
- [ ] Bump `package.json` to `0.3.0`. (The release workflow stamps the binary from the git tag; the
      package version is for local dev builds.)
- [ ] `docs/STATUS.md` rewritten to describe 0.3 as shipped, not in flight. `docs/JOURNAL.md` and
      `LEARNINGS.md` current. Every step's plan moved to `plans/done/`.
- [ ] Confirm `README.md` and the website claim nothing 0.3 does not do (cross-repo rule 2 —
      `beeptui-web` copy must match `STATUS.md` and `README.md`).
- [ ] Tag `v0.3.0` and push. Watch the release workflow: both binaries build, `sha256sums.txt`
      publishes, the tap job pushes `Formula/beeptui.rb`, and the SHA-256s match.
- [ ] **Website version stamping** — the `website` job needs repo variable
      `WEB_REPO=mitchmalone/beeptui-web` and secret `WEB_REPO_TOKEN` (fine-grained PAT,
      contents:write on `beeptui-web`) or it silently skips. Set them before tagging, or accept that
      beeptui.com keeps showing the old version.
- [ ] `brew install mitchmalone/tap/beeptui` resolves to 0.3.0 from a clean shell.

## Out of scope for 0.3

- The deferred live validation in `TODO.md` (Slice 12 network matrix, Slice 13 remote login) — these
  need accounts and endpoints that do not exist yet, and 0.3 does not change that.
- The any-terminal image path (needs a decode dependency).
- Threaded reply _display_, settings persistence, and further action-menu entries — all noted as
  out-of-scope in their own plans.

## Risks / open questions

- **Step 7 may not land.** If the emit-point spike fails, 0.3 ships without inline images and the
  plan is rewritten against the `drawSuperSampleBuffer` path. Decide at the spike, not after
  building on top of it.
- **Steps 3–5 all move selection state.** Landing them in order and merging each before starting the
  next avoids three-way conflicts in the reducer; do not run them in parallel.
- Version stamping and the tap are both gated jobs that pass silently when unconfigured — verify the
  release output rather than trusting a green workflow.
