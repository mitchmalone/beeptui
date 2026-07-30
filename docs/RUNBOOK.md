# RUNBOOK

> Operational procedures that are run by hand. Keep each entry copy-pasteable.
> Mostly placeholders until Slice 0/1 land — fill in real commands as they ship.

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
