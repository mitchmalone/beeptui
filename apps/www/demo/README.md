# Demo assets

The clips in `/public/demo` are recorded from the real app's `beeptui --demo` mode
(synthetic data, no Beeper or auth needed) by the [VHS](https://github.com/charmbracelet/vhs)
tapes in this directory. `xdg/` holds the demo config (Dracula theme) the tapes point
`XDG_CONFIG_HOME` at — the user's real config is never read.

Regenerate (from the repo root):

```bash
brew install mitchmalone/tap/beeptui vhs   # once
for t in demo/*.tape; do vhs "$t"; done
```

The tapes lean on the app's looping demo scenarios (`--demo`, `--demo live`,
`--demo images` — beeptui ≥ 0.4.1): scripted cycles with fixed timestamps, so
every re-record is identical. To record an unreleased build, put it first in
PATH: `PATH="../cli/dist:$PATH" vhs demo/hero.tape` (from `apps/www`).

Notes:

- Demo data is fixed (invented names, frozen timestamps), so re-recordings are stable —
  except a message sent during a tape, which is stamped with the wall-clock time.
- Re-record after any release that changes the UI, so the site matches the shipped app.
