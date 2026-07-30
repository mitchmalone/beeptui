---
title: Slice 9 — Phase 1 validation & smoke harness
status: planned
created: 2026-07-30
updated: 2026-07-30
links:
  - ../../PRD.md § Success criteria, § Acceptance scenarios, § Phased delivery (Phase 1)
  - PLAN-slice-1-beeper-adapter-doctor.md … PLAN-slice-8-chat-search-help.md
---

# Slice 9 — Phase 1 validation & smoke harness

## Goal

Prove the MVP: a terminal smoke-test harness for the key inbox/reply flows, and validated
list/read/send against WhatsApp, Slack, Telegram, and Signal on Mitch's real Beeper setup. Phase 1
is done when this slice closes.

## Context

Slices 0–8 each shipped their own tests; this slice adds the cross-cutting harness the PRD asks
for ("terminal smoke-test harness for the key inbox/reply flows") and executes the per-network
validation matrix. Pending decision (STATUS #4) — which validation accounts — must be resolved
before the live matrix runs.

## Approach

Two layers. (1) An automated smoke harness that drives the real TUI in a pseudo-terminal (pty)
against a **fixture/mock Beeper server**, asserting on rendered frames for the golden paths:
launch → inbox → open chat → page history → compose → send → live inbound → disconnect/reconnect.
Runs in CI. (2) A written validation matrix executed manually against live Beeper per network
(WhatsApp, Slack, Telegram, Signal): list chats, read history, live inbound, send, failure
reporting — results recorded in the plan and gaps journaled.

## Steps

- [ ] Fixture Beeper server: replays Slice 1/6 fixtures over HTTP + watch for deterministic runs.
- [ ] Pty harness: launch the TUI, inject keys, snapshot/assert rendered frames; stable across CI.
- [ ] Golden-path smoke tests covering PRD acceptance scenarios 1–4 and 7 end-to-end.
- [ ] Wire the smoke suite into CI as a separate job from unit tests.
- [ ] Resolve pending decision #4 (validation accounts) with Mitch; record in `DECISIONS.md`.
- [ ] Execute the live validation matrix per network; record per-capability results (works /
      degraded-with-honest-UX / broken) in this plan.
- [ ] Fix what the matrix breaks (scoped to Phase 1 behavior) or journal + ticket what moves to
      Phase 2.
- [ ] Measure PRD success criteria: launch-to-usable ≤ 3s, inbound render ≤ 2s; journal results.

## Acceptance criteria

- [ ] Smoke suite green in CI, covering scenarios 1–4 and 7 against the fixture server.
- [ ] Live matrix complete for WhatsApp, Slack, Telegram, Signal with no silent failures — every
      unsupported operation names itself in the UI.
- [ ] PRD Phase 1 success-criteria measurements recorded in `JOURNAL.md`.
- [ ] `docs/STATUS.md` declares Phase 1 complete; ROADMAP cursor moves to Phase 2.

## Out of scope

Discord/Instagram/X validation (Slice 12), performance tuning beyond meeting the stated targets.

## Risks / open questions

- Pty-driven TUI testing can be flaky in CI — invest in deterministic frame settling (event-driven
  waits, not sleeps); record patterns in `LEARNINGS.md`. If OpenTUI offers a headless test
  renderer, prefer it over pty scraping.
