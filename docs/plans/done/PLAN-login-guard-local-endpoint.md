---
title: login — guard against local / remote-access-off endpoints
status: done
created: 2026-08-03
updated: 2026-08-04
links:
  - PLAN-v03-release.md # step 1 of the 0.3 ladder
  - ../../PRD.md § Auth
  - ../../JOURNAL.md 2026-08-03 (login opens a dead page on a local endpoint)
  - src/cli/index.ts (login handler)
  - src/beeper/oauth.ts
---

# login — guard against local / remote-access-off endpoints

## Goal

Stop `beeptui login` from opening a doomed browser tab against an endpoint that can't do
OAuth. Today it always runs the remote flow; against a **local Beeper Desktop** (or any endpoint
with `remote_access: false`) it opens the advertised `authorization_endpoint` — a static/dead
localhost page — then waits forever on a loopback callback that never comes. Turn that into an
honest, actionable refusal (invariant 8: degrade visibly, no dead controls).

## Context

- `login` (src/cli/index.ts) calls `adapter.getInfo()` then `login(info.oauth, …)` with **no check**
  on whether the endpoint supports the flow.
- `/v1/info` exposes `remoteAccessEnabled` (already surfaced by `doctor`: "remote access: off") and
  the endpoint kind is classifiable (`classifyEndpoint` in `src/cli/doctor.ts` → local | remote).
- For a local Desktop, auth is a **token** (env `BEEPER_ACCESS_TOKEN` or the credential store), not
  a browser login — that path already works end-to-end (doctor green, real sends).
- Discovered live 2026-08-03: doctor all-green on local, but `login` still opened a dead page.

## Approach

Guard at the top of the `login` handler: resolve `info` (already fetched), and if the endpoint is
local **or** `info.remoteAccessEnabled === false`, refuse before opening a browser, with a message
that points at the token path and how to enable remote. Keep the decision pure/testable — factor a
`canBrowserLogin(info, endpointKind)` (or similar) helper so it has a unit test without a live
endpoint.

## Steps

- [x] Add a pure helper (e.g. `src/beeper/oauth.ts` or a small auth-policy module):
      `loginPreflight({ endpointKind, remoteAccessEnabled }) → { ok: true } | { ok: false, reason }`.
- [x] Wire it into the `login` handler in `src/cli/index.ts`: on `!ok`, print the reason + guidance
      and `process.exit(1)` **before** `getInfo`→`login` opens a browser.
- [x] Message content: name the situation ("local Beeper Desktop, remote access off — already
      authenticated via a token; run `beeptui`"), and how to use remote (enable remote access /
      point `BEEPTUI_ENDPOINT` at a remote Server Client).
- [x] Unit-test the helper (local → refuse; remote+access-on → allow; remote+access-off → refuse).

## Acceptance criteria

- [x] `beeptui login` against the local default endpoint prints the guidance and exits non-zero
      **without** opening a browser or starting the loopback.
- [x] `login` still proceeds normally when the endpoint is remote with remote access enabled.
- [x] Helper has unit tests; `bun run typecheck` + `bun test` green.

## Out of scope

- The actual remote-login live validation (needs a real remote endpoint — tracked in `TODO.md`).
- Any change to the token/local auth path (it already works).

## Outcome

Done. `beeptui login` against the local default endpoint now prints the guidance and exits 1
without opening a browser — verified by running it, not just by test.

**The open question below is resolved, and not the way the plan assumed.** The plan proposed
refusing when the endpoint is local **or** remote access is off. Shipped: refuse **iff
`remote_access` is off**, with the endpoint kind only choosing which way out to point at.

`remote_access` is the flag that says the advertised OAuth endpoints are real. A _local_ endpoint
with remote access switched on serves a genuine authorization page — that is how you would pair a
remote client — so refusing on locality alone would block a working flow we have no evidence is
broken. Over-refusing costs a user a capability; under-refusing in that rarer case only restores
today's behaviour. The reported bug (local + remote access off) is caught either way.

## Risks / open questions

- Confirm the exact `remoteAccessEnabled` semantics vs. endpoint kind — is a remote endpoint with
  remote access _off_ possible/meaningful? Guard on both signals to be safe.
