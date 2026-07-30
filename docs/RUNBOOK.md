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
bun run beeper-tui status   # endpoint + auth + account summary (Slice 1)
bun run beeper-tui doctor   # named checks, non-zero exit on failure (Slice 1)
```

`doctor` must identify: Beeper not running, endpoint unreachable, authentication failure, no
connected accounts.

## Checks (the merge gate)

```bash
bun run typecheck
bun run lint
bun test
```
