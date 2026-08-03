---
title: system theme — terminal light/dark detection
status: done
created: 2026-08-03
updated: 2026-08-03
links:
  - docs/plans/done/PLAN-theme-foundation.md
  - node_modules/@opentui/core renderer.waitForThemeMode
---

# system theme — terminal light/dark detection

## Goal

Make the `system` theme actually adapt to the user's terminal instead of mirroring the dark default.
Detect whether the terminal is **light or dark** and select a curated `system` palette to match, so
beeptui is readable on a light terminal and cohesive on a dark one — degrading to the dark default
when detection isn't available.

## Approach & decision

- **Use OpenTUI's `renderer.waitForThemeMode(timeoutMs)`** (returns `"dark" | "light" | null`) rather
  than hand-rolling raw OSC 10/11/4 stdin parsing. OpenTUI already does the OSC dance and owns the
  terminal I/O; hand-rolled raw-mode stdin reads are fragile, can't be validated live here, and risk
  corrupting input for the renderer. This is the responsible, testable choice.
- `system` becomes **light/dark-aware**, not an exact palette clone. Pulling the terminal's _exact_
  fg/bg/accent colours (raw OSC RGB) is a **possible follow-up** — it needs live cross-terminal
  testing and carries the stdin risks above; explicitly out of scope here.
- Curated `SYSTEM_DARK` (≈ current default) and a new `SYSTEM_LIGHT` token set; a pure
  `systemThemeForMode(mode)` picks one. Both keep `name: 'system'`.
- **Wiring:** launch already builds the theme registry with a `system` placeholder. After
  `createCliRenderer`, `await renderer.waitForThemeMode(short)` and `registry.set('system',
systemThemeForMode(mode))` **before** the first render, so the initial paint is already correct and
  runtime cycling to `system` uses the detected variant. A timeout/failure → dark (safe).

## Steps

- [x] `theme.ts`: `SYSTEM_LIGHT` + `SYSTEM_DARK` token sets + `systemThemeForMode(mode)` (pure)
- [x] Tests: light → light, dark/null → dark, both named `system`
- [x] `launch.ts`: await theme mode after renderer, override the registry's `system` entry pre-render
- [x] Docs: STATUS, JOURNAL; move plan to done. Commit as its own commit.

## Acceptance criteria

- [x] On a light terminal, `system` renders a readable light palette; on a dark terminal, the dark one
- [x] Detection failure/timeout falls back to the dark `system` (no crash, no hang beyond the timeout)
- [x] `theme.name: "system"` (or cycling to it) reflects the detected variant
- [x] `bun run typecheck`, `bun run lint`, `bun test` green

## Out of scope

- Exact terminal fg/bg/accent extraction via raw OSC RGB (a later, live-tested experiment).
- Re-detecting on terminal theme change mid-session.
