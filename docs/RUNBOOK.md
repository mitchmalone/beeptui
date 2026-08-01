# RUNBOOK

> Operational procedures that are run by hand. Keep each entry copy-pasteable.

## Prerequisites

- Bun `>=1.3.14` (`engines` in `package.json`, `.bun-version`). Install: `brew install bun`.
- `gitleaks` for the pre-commit secret scan: `brew install gitleaks`. The pre-commit hook fails if
  it's missing (invariant 9).
- Beeper Desktop running locally (Phase 1 requires the local Desktop API).

## Run

```bash
bun install
bun run dev        # launch the TUI (Slice 0+)
```

## Diagnose

```bash
bun run src/cli/index.ts status          # endpoint + auth + account summary
bun run src/cli/index.ts status --json   # machine-readable
bun run src/cli/index.ts doctor          # named checks, non-zero exit on failure
```

`doctor` identifies: Beeper not running / endpoint unreachable, no access token, authentication
failure, and no connected accounts. The token is read from the macOS Keychain (service `beeper-tui`,
account `access-token`) or the `BEEPER_ACCESS_TOKEN` env var; override the endpoint with
`BEEPER_TUI_ENDPOINT`.

## Checks (the merge gate)

```bash
bun run typecheck
bun run lint
bun test
```

## Manual validation gates (finish Slices 11–14)

The buildable + auto-verifiable work for Slices 11–14 is done, tested, and merged. Each slice has one
final acceptance step that is a real-world act or decision — not automatable (a live send is barred by
invariant 5; the others need accounts / a remote host / a terminal / a product call). Run these by
hand to close each slice; update `docs/STATUS.md` + the slice plan when each passes.

### Slice 11 — live reply send (a supporting network, e.g. WhatsApp)

```bash
bun run dev
```

`j`/`k` to a chat → `⏎` open → `v` enter message-selection → `j`/`k` to a message → `r` reply
(the compose box shows a quoted header) → type → `⏎` send. **Pass:** it lands threaded/quoted in the
other client. Also confirm a non-supporting network shows "Replies not available for … via Beeper"
instead of a dead control. Note per-network reply rendering in `LEARNINGS.md`.

### Slice 12 — live matrix on the remaining networks

Connect **Discord / Instagram DMs / X DMs** in Beeper Desktop, then per network: list chats, read
history, receive a live inbound, send, reply, search, open an attachment. Record results in the
Slice 12 plan **redacted** (network + capability + outcome only — invariant 9). When all seven
day-one networks pass, declare **Phase 2 complete** in `docs/STATUS.md`.

### Slice 13 — remote endpoint login

On a host with Beeper **remote access enabled** (`server.remote_access: true` in `/v1/info`):

```bash
# point at the remote endpoint (a URL, or a name from config.endpoints)
export BEEPER_TUI_ENDPOINT="https://your-remote-host:PORT"
bun run src/cli/index.ts login      # opens the browser for OAuth 2.0 + PKCE; stores tokens in the OS keychain
bun run src/cli/index.ts doctor     # expect: remote endpoint reachable, authenticated, token scope
bun run dev                         # inbox + read + send over the remote endpoint
bun run src/cli/index.ts logout     # revokes + clears the stored session
```

**Pass:** the full flow works and no token is ever written to a file/log/argv.

### Slice 14 — release + open-source decision + media preview

```bash
# Cut a release (exercises .github/workflows/release.yml → builds + attaches the binary):
git tag v0.1.0 && git push --tags
```

Then make **decision #6** (open-source/licensing) before any public distribution (brew tap / npm),
and — if you want inline image previews — build + verify media rendering in a real **Kitty / iTerm2**
session (the escape-sequence rendering can't be verified headlessly).
