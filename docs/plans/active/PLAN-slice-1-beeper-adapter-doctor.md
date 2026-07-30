---
title: Slice 1 — Beeper adapter, config & doctor
status: active
created: 2026-07-30
updated: 2026-07-30
links:
  - ../../PRD.md § Technical approach (adapter), § Configuration, privacy, and diagnostics
  - ../../ROADMAP.md Phase 1
  - PLAN-slice-0-foundation.md
---

# Slice 1 — Beeper adapter, config & doctor

## Goal

A typed adapter over the local Beeper Desktop API — auth, accounts, chats, message history,
send — plus `status` and `doctor` CLI commands. This is the seam every later slice consumes, and
`doctor` is the first user-visible value.

## Context

The PRD mandates: the TUI calls the documented Desktop/Server Client API directly (never the
`beeper` CLI); the adapter owns authentication, pagination, capability detection, and error
normalization. Tokens live in the platform credential store; nothing secret is logged. Study the
official Beeper Desktop API docs/SDK before designing the client — record surface-area findings in
`docs/JOURNAL.md`.

## Approach

**Revised after API research (see `docs/JOURNAL.md` 2026-07-30, `DECISIONS.md`).** Beeper ships an
official typed SDK, `@beeper/desktop-api` (Bun-compatible, zero transitive deps). `src/beeper/`
**wraps** it rather than hand-rolling HTTP + a full schema layer. The adapter owns: config resolution
(default `http://127.0.0.1:23373`, override via config file), token storage via macOS Keychain
(config holds only a reference), our domain models over the SDK types, capability detection from
`info.retrieve()`, and a normalized `BeeperError` taxonomy (unreachable, unauthorized,
unsupported-capability, rate-limited, unknown) mapped from the SDK's error classes. The SDK
constructor takes a custom `fetch`, so tests inject synthetic fixtures — no live Beeper. Then wire
`src/cli/` `status` and `doctor` on top.

## Steps

- [x] ~~Read the Beeper Desktop API docs~~; journalled endpoints/auth/capabilities. **Done** —
      official SDK `@beeper/desktop-api@5.0.0` chosen; Bun compatibility + synthetic-`fetch` fixture
      seam smoke-verified.
- [ ] Config module: endpoint resolution + config file location (`~/.config/beeper-tui/`), validated
      at load with clear errors; token stored in Keychain (`security` CLI), config holds only a
      reference.
- [ ] Domain models + adapter surface: wrap the SDK's accounts/chats/messages/send/info types into
      our own typed methods so nothing outside `src/beeper/` imports the SDK.
- [ ] Error normalization: map SDK error classes (`APIConnectionError`, `AuthenticationError`,
      `PermissionDeniedError`, `RateLimitError`, `InternalServerError`, …) → `BeeperError`, plus
      timeouts. Fixture-based tests (injected `fetch`) for happy paths and each error class
      (test-first). **Fixtures are synthetic** — no real chat/contact/account data (AGENTS.md
      publishable-repo hygiene).
- [ ] Capability detection from `info.retrieve()`; expose as typed data with an explicit fallback.
- [ ] `beeper-tui status`: endpoint, auth state, account list summary — human-readable + `--json`.
- [ ] `beeper-tui doctor`: named checks with pass/fail and remediation text — Beeper not running,
      endpoint unreachable, auth failure, no connected accounts. Non-zero exit on any failure.
- [ ] Redaction: verify no token or message body can appear in errors/logs (test the formatter).
- [ ] ~~Manual smoke against live local Beeper Desktop~~ — **deferred**: Beeper Desktop not set up
      locally yet. Tracked in `STATUS.md`; run before Slice 1 is considered fully validated.

## Acceptance criteria

- [ ] All adapter logic covered by fixture-based `bun test` suites; no test requires live Beeper.
- [ ] With Beeper closed (or endpoint unreachable): `doctor` names the failure and exits non-zero
      (PRD acceptance scenario 7) — provable without a live Beeper via the injected transport.
- [ ] Grep-proof: no token value or message body in any log/error output path.
- [ ] _(Deferred, needs live Beeper)_ `status` lists real connected accounts and the adapter fetches
      chats + recent messages for ≥2 networks — manual smoke once Desktop is set up.

## Out of scope

WebSocket/watch (Slice 6), remote Server endpoint + OAuth (Slice 13), any TUI rendering, SQLite
store (Slice 7).

## Risks / open questions

- The real API surface may differ from expectations (auth mechanism, pagination shape, capability
  reporting). The step-1 investigation exists to collapse this risk early; update this plan if the
  API forces a different shape.
- Keychain access from Bun: pick the simplest reliable mechanism (`security` CLI is acceptable);
  record the choice in `DECISIONS.md`.
