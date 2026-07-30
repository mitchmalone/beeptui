/**
 * The single source of truth for keybindings. The Slice 8 help overlay is
 * generated from this table (CLAUDE.md keymap intent; see docs/DECISIONS.md for
 * why this is in-repo rather than `@opentui/keymap`).
 */

export type Command =
  | 'move-down'
  | 'move-up'
  | 'open'
  | 'back'
  | 'top'
  | 'bottom'
  | 'load-older'
  | 'compose'
  | 'retry'
  | 'refresh'
  | 'quit'

export interface Binding {
  /** Normalized key tokens that trigger the command (see `keyToken`). */
  keys: string[]
  /** Keys as shown in help. */
  display: string
  command: Command
  description: string
}

export const KEYMAP: readonly Binding[] = [
  { keys: ['j', 'down'], display: 'j / ↓', command: 'move-down', description: 'Move down' },
  { keys: ['k', 'up'], display: 'k / ↑', command: 'move-up', description: 'Move up' },
  { keys: ['return', 'enter'], display: '⏎', command: 'open', description: 'Open chat' },
  {
    keys: ['escape', 'h', 'left'],
    display: 'Esc / h',
    command: 'back',
    description: 'Back to inbox',
  },
  { keys: ['g'], display: 'g', command: 'top', description: 'Jump to top' },
  { keys: ['shift+g'], display: 'G', command: 'bottom', description: 'Jump to bottom' },
  { keys: ['u'], display: 'u', command: 'load-older', description: 'Load older messages' },
  { keys: ['tab', 'i'], display: 'Tab / i', command: 'compose', description: 'Compose a message' },
  { keys: ['shift+r'], display: 'R', command: 'retry', description: 'Retry failed send' },
  { keys: ['r'], display: 'r', command: 'refresh', description: 'Refresh' },
  { keys: ['q'], display: 'q', command: 'quit', description: 'Quit' },
]

/** Normalize a key event into a match token (e.g. `g`, `shift+g`, `down`). */
export function keyToken(key: { name: string; shift?: boolean }): string {
  const name = key.name.toLowerCase()
  // Shift only disambiguates letters (G vs g); ignore it for named keys.
  return key.shift && name.length === 1 ? `shift+${name}` : name
}

/** Resolve a key event to a command, or null if unbound. */
export function resolveCommand(key: { name: string; shift?: boolean }): Command | null {
  const token = keyToken(key)
  return KEYMAP.find((b) => b.keys.includes(token))?.command ?? null
}
