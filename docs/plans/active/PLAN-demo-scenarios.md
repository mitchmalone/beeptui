---
title: demo scenarios — looping, feature-specific --demo states
status: active
created: 2026-08-08
updated: 2026-08-08
links:
  - ../done/PLAN-inline-image-rendering.md # the images the demos now show off
  - ../../../beeptui-web/demo/README.md # the consumer: VHS tapes
---

# demo scenarios — looping, feature-specific `--demo` states

## Goal

`--demo` grows named, **looping** scenarios so the website's clips (and any live showcase) can
record real behaviour instead of a static screen: `--demo` (everything, the primary demo),
`--demo live`, `--demo replies`, `--demo images`. Each scenario is a timed cycle of synthetic
events that repeats until quit. Demo mode today is static — the site's "message arriving live"
row has sat on a placeholder because there was nothing honest to record.

## Approach

- **Scenarios are pure data + a tiny driver.** `src/tui/demo-scenarios.ts` defines each scenario
  as a cycle: `[{ at, event }...]` with a period; events are ordinary `AppEvent`s
  (`message/received`, and a `messages/loaded` reset at cycle start so the loop is clean).
  Everything flows through the reducer like a real watch event (invariant 4); the driver is a
  scheduler with an injectable clock, unit-tested with a fake one.
- **Fixtures get richer**: a photo-heavy synthetic chat (several image attachments, varied
  generated PNGs — per-id gradients so thumbnails differ), and reply/reaction beats for the
  scripted cycles. All invented content (invariant 9).
- **CLI**: `beeptui --demo [scenario]`; unknown names exit listing the valid ones (invariant 8).

## Steps

- [ ] Scenario module: types, four scenarios, cycle validation + scheduler with injectable
      clock — unit tests (ordering, looping, reset, stop).
- [ ] Fixtures: photo-heavy chat; varied demo PNG per attachment id; reply/reaction beats.
- [ ] CLI + launch wiring: parse scenario, validate, start/stop the driver with the app.
- [ ] Verify each scenario live in tmux (headless capture) — arrivals render, images fill in,
      replies mark targets, loops reset cleanly.

## Acceptance criteria

- [ ] `--demo` alone behaves as today plus a gentle everything-cycle; each named scenario loops
      its feature indefinitely; `q` still exits cleanly.
- [ ] All events go through the reducer; no adapter or store bypass; no wall-clock timestamps in
      scripted events (deterministic re-records).
- [ ] Unknown scenario name → helpful error, exit non-zero.
- [ ] `bun run typecheck` + `bun test` green; scheduler and scenario data unit-tested.

## Out of scope

- Self-driving navigation (auto-opening chats, kiosk mode) — tapes press the keys.
- Website tapes themselves (they live in beeptui-web).
