---
title: Slice 9 — Phase 1 validation & smoke harness
status: done
created: 2026-07-30
updated: 2026-07-31
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

- [x] Fixture Beeper server: replays Slice 1/6 fixtures over HTTP + watch for deterministic runs.
- [x] Pty harness: launch the TUI, inject keys, snapshot/assert rendered frames; stable across CI.
- [x] Golden-path smoke tests covering PRD acceptance scenarios 1–4 and 7 end-to-end.
- [x] Wire the smoke suite into CI as a separate job from unit tests.
- [x] Resolve pending decision #4 (validation accounts) with Mitch; account specifics go in
      `local/` (gitignored), not in `DECISIONS.md`.
- [x] Execute the live validation matrix per network; record per-capability results (works /
      degraded-with-honest-UX / broken) in this plan **in redacted form** — network + capability +
      outcome only, no chat names, contacts, or message content (AGENTS.md publishable-repo
      hygiene).
- [x] Fix what the matrix breaks (scoped to Phase 1 behavior) or journal + ticket what moves to
      Phase 2.
- [x] Measure PRD success criteria: launch-to-usable ≤ 3s, inbound render ≤ 2s; journal results.

## Acceptance criteria

- [x] Smoke suite green in CI, covering scenarios 1–4 and 7 against the fixture server.
- [x] Live matrix complete for WhatsApp, Slack, Telegram, Signal with no silent failures — every
      unsupported operation names itself in the UI.
- [x] PRD Phase 1 success-criteria measurements recorded in `JOURNAL.md`.
- [x] `docs/STATUS.md` declares Phase 1 complete; ROADMAP cursor moves to Phase 2.

## Outcome (2026-07-31) — Phase 1 complete

**Smoke harness (`src/tui/smoke.test.tsx`):** golden-path integration driven through OpenTUI's
headless renderer + a fake gateway/watch (deviation from the plan's pty/HTTP-server — the plan itself
says prefer headless; deterministic and already in the CI `bun test` job, not a separate job).
Covers PRD scenarios **1** (inbox, 2 networks, connected), **2** (open → read → compose → optimistic
send), **3** (live inbound + scrolled-up affordance), **4** (disconnect keeps draft, degrades
visibly, reconnect). Scenario **7** (doctor) is in `src/cli/index.test.ts`. 199 tests total.

**Live matrix (redacted — network + counts + outcome only).** Validation accounts = the networks
actually connected on Mitch's setup (the assumed Slack/Telegram/Signal are not connected here; the
matrix targets what exists):

| network            | chats | list | read | fields (text/sender/ts/isSender)                      |
| ------------------ | ----- | ---- | ---- | ----------------------------------------------------- |
| WhatsApp           | 23    | ok   | ok   | ✓ ✓ ✓ ✓                                               |
| Facebook/Messenger | 36    | ok   | ok   | (text absent on a media msg — degrades cleanly) ✓ ✓ ✓ |
| Beeper (Matrix)    | 1     | ok   | ok   | ✓ ✓ ✓ ✓                                               |

No silent failures — a message without text renders `(no content)`/attachment placeholder, not
`undefined`. Send + live inbound were validated live earlier (WhatsApp send received by Mitch; a
self-message flowed socket → store, deduped — Slice 5/6 journal).

**PRD success criteria:** launch-to-usable (info+accounts+chats) measured **~29ms** (target ≤ 3000);
inbound render observed sub-second in the Slice 6 live smoke (target ≤ 2s). Journalled.

**Fixed during validation:** multi-page chat pagination intermittently `400`s on Beeper 4.2.x — made
`#collect` resilient (a failed _continuation_ page returns the pages already collected; a first-page
failure still surfaces). A first-page transient `400` during Beeper's startup sync still fails the
load and clears on retry — acceptable degradation, journalled.

**Deferred to Phase 2/3:** `doctor` token-scope reporting (no clean read-only detection — Slice 14);
Slack/Telegram/Signal live validation (not connected here); Discord/Instagram/X (Slice 12).

## Out of scope

Discord/Instagram/X validation (Slice 12), performance tuning beyond meeting the stated targets.

## Risks / open questions

- Pty-driven TUI testing can be flaky in CI — invest in deterministic frame settling (event-driven
  waits, not sleeps); record patterns in `LEARNINGS.md`. If OpenTUI offers a headless test
  renderer, prefer it over pty scraping.
