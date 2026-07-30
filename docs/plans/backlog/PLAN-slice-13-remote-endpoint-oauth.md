---
title: Slice 13 — Remote Server Client endpoint & OAuth
status: planned
created: 2026-07-30
updated: 2026-07-30
links:
  - ../../PRD.md § Configuration, privacy, and diagnostics, § Constraints and risks (OAuth review)
  - PLAN-slice-1-beeper-adapter-doctor.md
---

# Slice 13 — Remote Server Client endpoint & OAuth

> Phase 3 — coarse outline. **Re-plan in detail before starting**; the Beeper Server Client API and
> its auth mechanism must be re-investigated at that time.

## Goal

`beeptui` works against a user-configured remote Beeper Server Client endpoint with the API's
supported OAuth/auth mechanism and secure token storage — making the TUI usable where Beeper
Desktop isn't running (e.g. a remote/SSH box).

## Context

Phase 1 deliberately constrained to local Desktop (pending decision #2 assumed yes). The adapter
was built with endpoint/config abstraction from Slice 1, so this is config + auth flow + hardening,
not a rewrite. The PRD explicitly requires a security review of OAuth/token handling before
shipping this.

## Approach (sketch)

Add an auth module to the adapter implementing the Server Client OAuth flow (device-code or
localhost-redirect, whatever the API supports), refresh handling, and Keychain-backed token
storage (with an encrypted-file fallback for headless Linux). Extend config for named endpoints;
extend `status`/`doctor` with endpoint-specific checks (TLS, auth validity, token expiry). Then a
focused security review pass against the CLAUDE.md invariants (no tokens in logs/args/config
files; redaction verified).

## Acceptance criteria (draft)

- [ ] Full flow works against a real Server Client endpoint: configure → authenticate → inbox →
      send, with tokens only in the credential store.
- [ ] `doctor` distinguishes local-desktop vs remote-endpoint failure modes.
- [ ] Security review completed and its findings recorded in `DECISIONS.md` / fixed.

## Out of scope

Multi-endpoint simultaneous connections; any Beeper account management.

## Risks / open questions

- The Server Client API's availability, auth mechanism, and account requirements are unverified —
  the re-plan starts with that investigation.
