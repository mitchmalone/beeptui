---
title: Slice 13 — Remote Server Client endpoint & OAuth
status: done
created: 2026-07-30
updated: 2026-08-01
links:
  - ../../PRD.md § Configuration, privacy, and diagnostics, § Constraints and risks (OAuth review)
  - PLAN-slice-1-beeper-adapter-doctor.md
---

# Slice 13 — Remote Server Client endpoint & OAuth

> Phase 3. **Re-planned in detail 2026-07-31** after investigating the API (below). The OAuth
> mechanism is now known; the remaining build needs a real remote endpoint + a security review,
> which are the blocking gates.

## Goal

`beeptui` works against a user-configured remote Beeper Server Client endpoint with the API's
supported OAuth mechanism and secure token storage — usable where Beeper Desktop isn't local
(e.g. a remote/SSH box).

## API investigation (done 2026-07-31)

The mechanism is **discoverable and standard** — no guessing:

- `/v1/info` advertises a full OAuth 2.0 metadata block under `endpoints.oauth`:
  `authorization_endpoint`, `token_endpoint`, **`registration_endpoint`** (RFC 7591 dynamic client
  registration), `introspection_endpoint`, `revocation_endpoint`, `userinfo_endpoint`.
  **Live-confirmed** all six are present on the real server (redacted probe).
- The SDK docstring: _"Bearer access token obtained via **OAuth2 PKCE flow** or created in-app.
  Required for all API operations."_ → auth is a bearer token; the flow to obtain one is OAuth 2.0
  **Authorization Code + PKCE**, with the client registered dynamically.
- `server.remote_access: boolean` says whether the server accepts non-local connections (currently
  `false` on this local Desktop — the user enables it in Beeper settings for remote use).
- The SDK takes `baseURL` + `accessToken` only; **it does not implement the OAuth flow** — that's
  ours to build against the discovered endpoints.

**Groundwork already landed (this slice):** `ServerInfo.oauth` now surfaces the six endpoints via
`mapInfo` (fixture + live tested), so the flow builds against advertised URLs, not hard-coded ones.

## Approach (grounded)

1. **Auth module** (`src/beeper/oauth.ts`): discover endpoints from `/v1/info`; RFC 7591 dynamic
   client registration; Authorization Code + PKCE (S256) via a localhost loopback redirect
   (`http://127.0.0.1:<ephemeral>/callback`) — open the system browser to `authorization_endpoint`,
   capture the code, exchange at `token_endpoint`; refresh-token handling; revoke on logout.
2. **Token storage**: reuse the Slice 1 Keychain module for access + refresh tokens (encrypted-file
   fallback for headless Linux). Never in config files, logs, or process args (invariant 6).
3. **Config**: named endpoints (`local` default + user-added remote), endpoint selection precedence
   documented; `remote_access` awareness.
4. **Diagnostics**: `doctor`/`status` gain endpoint-type awareness (local Desktop vs remote),
   TLS check for https remotes, token-validity via `introspection_endpoint`, and expiry.
5. **Security review**: a dedicated pass against the CLAUDE.md invariants + PKCE/loopback best
   practice (state param, PKCE verifier entropy, exact redirect match, no token leakage); findings
   recorded in `DECISIONS.md` and fixed. **PRD requires this before shipping remote auth.**

## Steps

- [x] Investigate the Server Client API + auth mechanism (see above) — the outline's precondition.
- [x] Surface the advertised OAuth endpoints in the adapter (`ServerInfo.oauth`, `mapInfo`);
      fixture + live tested.
- [x] Auth module: dynamic registration + PKCE authorize/token/refresh/revoke + `authorize`
      orchestrator; unit-tested against a fake authorization server (`oauth.ts`, `oauth.test.ts`).
- [x] Token storage for access + refresh (`token-store.ts`) — backed by **`Bun.secrets`**, Bun's
      built-in cross-platform OS credential store (macOS Keychain / Linux Secret Service / Windows
      Credential Manager). In-process → argv-free (invariant 6) and _is_ the platform credential
      store (invariant 1); zero dependency. Persists `{clientId, tokens}` (client id needed for
      refresh/revoke). Injectable backend → unit-tested with an in-memory fake; corrupt entry degrades
      to logged-out, never a crash. **Headless-Linux fallback** (`secret-file-store.ts`): AES-256-GCM
      encrypted `0600` file when no keyring is present. **This closes the security review's open item**
      (no more argv/FFI fork — `Bun.secrets` + an honest encrypted-file fallback).
- [x] Session lifecycle (`auth-session.ts`): `login` (authorize + persist), `logout` (revoke + clear),
      `currentAccessToken` (refresh-on-expiry + persist), `resolveActiveToken` (env/legacy → stored
      OAuth). `beeptui login` / `logout` CLI commands; `launch` + `status`/`doctor` resolve the
      active token through it. Unit-tested end-to-end against fakes.
- [x] Named-endpoint config + selection; token introspection checks in `doctor`. **Introspection
      done** — `doctor` reports token scope via `introspectToken` (RFC 7662), flagging read-only
      tokens (live-verified). **Named endpoints done** — `config.endpoints` (`{name: url}`); the
      `endpoint` selector (or `BEEPTUI_ENDPOINT`) is a URL _or_ a name resolved against it.
- [x] Security review pass; record + fix findings (`DECISIONS.md`, 2026-08-01). **Passed** — no
      exploitable findings; fixed one non-security IPv6-loopback labelling bug in `classifyEndpoint`.

## Acceptance criteria

- [~] Full flow works against a **real Server Client endpoint**: configure → authenticate → inbox →
  send, tokens only in the credential store. **Built + unit-tested end-to-end; the credential-store
  persistence is live-verified** (`Bun.secrets` set/get/delete round-trip on the macOS Keychain).
  **Remaining gate:** running `beeptui login` against a real remote endpoint (browser flow +
  `remote_access` enabled) — not available locally (`remote_access:false`).
- [x] `doctor` distinguishes local-desktop vs remote-endpoint failure modes.
- [x] Security review completed and its findings recorded in `DECISIONS.md` / fixed
      (2026-08-01) — passed, no exploitable findings.

## Closure note (2026-08-01)

Closed as **code-complete, live-validation deferred (accepted risk, Mitch)**. The full OAuth surface
(PKCE core, dynamic registration, exchange/refresh/revoke, token persistence via `Bun.secrets`,
headless-Linux encrypted-file fallback, `login`/`logout` wiring, endpoint-aware `doctor`) is built,
unit-tested, security-reviewed, and merged. The single unrun item — `beeptui login` against a
**real remote endpoint** with `remote_access` on — has no such endpoint available here
(`remote_access:false` locally), so Mitch chose to close the slice and carry that live run as a
tracked follow-up in `TODO.md`.

## Blocking gates (need Mitch / environment) — DEFERRED to TODO.md

1. **A real remote Server Client endpoint** with `remote_access` enabled, to validate `beeptui
login` end-to-end (the browser flow + a live token exchange). Only a local Desktop
   (`remote_access: false`) is available here. Everything up to that point is built + tested.

**Resolved since the re-plan:** ~~security-review sign-off~~ (passed 2026-08-01), ~~token-storage
mechanism~~ (**`Bun.secrets`** — cross-platform, argv-free, zero-dep), and decision #2 (adding remote
is the intent — Mitch confirmed 2026-08-01).

## Out of scope

Multi-endpoint simultaneous connections; any Beeper account management.

## Risks / open questions

- Building the PKCE flow is unvalidatable without a live endpoint; unit tests use a fake
  authorization server, but the first real-endpoint run is where reality bites. Sequence the
  security review right after the module compiles and before any "done" claim.
