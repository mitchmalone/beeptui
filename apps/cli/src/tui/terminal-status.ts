/**
 * Surfaces the unread count in the terminal chrome:
 *  - inside tmux, as the window name `Beeper [n]` (so tmux renders `1: Beeper [n]`
 *    in its status line — the `1:` is tmux's own window index);
 *  - everywhere, as the terminal tab title via an OSC 2 sequence.
 *
 * It only ever emits the app name and a count — never a chat name, sender, or any
 * message content (CLAUDE.md invariant 6), and never a network request (invariant
 * 7). tmux is driven with `rename-window` (works with default tmux settings, no
 * user config needed) and handed back on exit by unsetting the window-local
 * `automatic-rename`. All I/O is injectable so it unit-tests without a real tty.
 */

export interface StatusWriterOptions {
  /** Environment; reads TMUX + TMUX_PANE. Defaults to `process.env`. */
  env?: Record<string, string | undefined>
  /** Write a raw string to the terminal. Defaults to stdout. */
  write?: (text: string) => void
  /** Run a tmux command. Defaults to a synchronous, best-effort `tmux` spawn. */
  runTmux?: (args: string[]) => void
}

export interface StatusWriter {
  /** Reflect the current unread count. No-op when unchanged. */
  update(unread: number): void
  /** Restore default terminal/window naming. Call once on exit. */
  restore(): void
}

const APP_NAME = 'Beeper'

export function createStatusWriter(options: StatusWriterOptions = {}): StatusWriter {
  const env = options.env ?? process.env
  const write = options.write ?? ((text: string) => void process.stdout.write(text))
  const runTmux = options.runTmux ?? defaultRunTmux
  const inTmux = typeof env.TMUX === 'string' && env.TMUX.length > 0
  const pane = env.TMUX_PANE
  const target = pane ? ['-t', pane] : []
  let last: number | null = null

  return {
    update(unread) {
      if (unread === last) return
      last = unread
      const label = `${APP_NAME} [${unread}]`
      write(`\u001b]2;${label}\u0007`) // OSC 2 — terminal tab / tmux pane title
      if (inTmux) runTmux(['rename-window', ...target, label])
    },
    restore() {
      // Clear our OSC 2 tab title (outside tmux it would otherwise outlive the
      // app), and hand the tmux window name back to automatic-rename.
      write(`\u001b]2;\u0007`)
      if (inTmux) runTmux(['set-window-option', ...target, '-u', 'automatic-rename'])
    },
  }
}

/** Best-effort synchronous tmux call — a status badge must never be fatal, and
 *  sync keeps `restore()` reliable right before `process.exit`. */
function defaultRunTmux(args: string[]): void {
  try {
    Bun.spawnSync(['tmux', ...args], { stdout: 'ignore', stderr: 'ignore' })
  } catch {
    // tmux missing or errored — ignore; the badge is a nicety, not a requirement.
  }
}
