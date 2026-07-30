---
title: Slice 1 — Beeper adapter, config & doctor
status: planned
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

Build `src/beeper/` as a typed HTTP client with: config resolution (default local Desktop endpoint,
override via config file), token acquisition/storage via macOS Keychain (`security` or a minimal
keychain binding), typed request/response models for accounts/chats/messages/send, pagination
cursors, capability detection, and a normalized `BeeperError` taxonomy (unreachable, unauthorized,
unsupported-capability, rate-limited, unknown). Test against recorded fixtures. Then wire
`src/cli/` `status` and `doctor` on top.

## Steps

- [ ] Read the Beeper Desktop API docs; journal the actual endpoints/auth flow/capability signals.
- [ ] Config module: endpoint resolution + config file location (`~/.config/beeptui/`), validated
      at load with clear errors; token stored in Keychain, config holds only a reference.
- [ ] Typed models for accounts, chats, messages, send results — inferred from one schema layer
      (Zod or TS types + runtime guards at the API boundary).
- [ ] HTTP client with pagination, timeouts, and the normalized error taxonomy. Fixture-based tests
      for happy paths and each error class (test-first).
- [ ] Capability detection: what does this endpoint/account/network support; expose as typed data.
- [ ] `beeptui status`: endpoint, auth state, account list summary — human-readable + `--json`.
- [ ] `beeptui doctor`: named checks with pass/fail and remediation text — Beeper not running,
      endpoint unreachable, auth failure, no connected accounts. Non-zero exit on any failure.
- [ ] Redaction: verify no token or message body can appear in errors/logs (test the formatter).
- [ ] Manual smoke against live local Beeper Desktop; journal discrepancies vs docs.

## Acceptance criteria

- [ ] With Beeper Desktop running: `status` lists connected accounts; adapter fetches chats and
      recent messages for at least two networks (verified by a manual smoke script/test).
- [ ] With Beeper closed: `doctor` names the failure and exits non-zero (PRD acceptance
      scenario 7).
- [ ] All adapter logic covered by fixture-based `bun test` suites; no test requires live Beeper.
- [ ] Grep-proof: no token value or message body in any log/error output path.

## Out of scope

WebSocket/watch (Slice 6), remote Server endpoint + OAuth (Slice 13), any TUI rendering, SQLite
store (Slice 7).

## Risks / open questions

- The real API surface may differ from expectations (auth mechanism, pagination shape, capability
  reporting). The step-1 investigation exists to collapse this risk early; update this plan if the
  API forces a different shape.
- Keychain access from Bun: pick the simplest reliable mechanism (`security` CLI is acceptable);
  record the choice in `DECISIONS.md`.
