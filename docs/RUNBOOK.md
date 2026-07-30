# RUNBOOK

> Operational procedures that are run by hand. Keep each entry copy-pasteable.
> Mostly placeholders until Slice 0/1 land — fill in real commands as they ship.

## Prerequisites

- Bun (version pinned in `package.json` `engines` / `.bun-version` once Slice 0 lands).
- Beeper Desktop running locally (Phase 1 requires the local Desktop API).

## Run

```bash
bun install
bun run dev        # launch the TUI (Slice 0+)
```

## Diagnose

```bash
bun run beeptui status   # endpoint + auth + account summary (Slice 1)
bun run beeptui doctor   # named checks, non-zero exit on failure (Slice 1)
```

`doctor` must identify: Beeper not running, endpoint unreachable, authentication failure, no
connected accounts.

## Checks (the merge gate)

```bash
bun run typecheck
bun run lint
bun test
```
