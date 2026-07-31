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
  | 'search'
  | 'help'
  | 'refresh'
  | 'quit'

/** Grouping used by the help overlay. */
export type KeyContext = 'global' | 'inbox' | 'conversation' | 'compose'

export interface Binding {
  /** Normalized key tokens that trigger the command (see `keyToken`). */
  keys: string[]
  /** Keys as shown in help. */
  display: string
  command: Command
  description: string
  context: KeyContext
}

export const KEYMAP: readonly Binding[] = [
  {
    keys: ['j', 'down'],
    display: 'j / ↓',
    command: 'move-down',
    description: 'Move down / scroll',
    context: 'inbox',
  },
  {
    keys: ['k', 'up'],
    display: 'k / ↑',
    command: 'move-up',
    description: 'Move up / scroll',
    context: 'inbox',
  },
  {
    keys: ['return', 'enter'],
    display: '⏎',
    command: 'open',
    description: 'Open chat',
    context: 'inbox',
  },
  { keys: ['g'], display: 'g', command: 'top', description: 'Jump to top', context: 'inbox' },
  {
    keys: ['shift+g'],
    display: 'G',
    command: 'bottom',
    description: 'Jump to bottom / latest',
    context: 'inbox',
  },
  {
    keys: ['escape', 'h', 'left'],
    display: 'Esc / h',
    command: 'back',
    description: 'Back to inbox',
    context: 'conversation',
  },
  {
    keys: ['u'],
    display: 'u',
    command: 'load-older',
    description: 'Load older messages',
    context: 'conversation',
  },
  {
    keys: ['tab', 'i'],
    display: 'Tab / i',
    command: 'compose',
    description: 'Compose a message',
    context: 'conversation',
  },
  {
    keys: ['shift+r'],
    display: 'R',
    command: 'retry',
    description: 'Retry failed send',
    context: 'conversation',
  },
  { keys: ['/'], display: '/', command: 'search', description: 'Search chats', context: 'global' },
  {
    keys: ['?'],
    display: '?',
    command: 'help',
    description: 'Toggle this help',
    context: 'global',
  },
  { keys: ['r'], display: 'r', command: 'refresh', description: 'Refresh', context: 'global' },
  { keys: ['q'], display: 'q', command: 'quit', description: 'Quit', context: 'global' },
]

/** Compose-mode keys are handled by the editor (not `resolveCommand`); listed
 *  here so the help overlay documents them too. */
export const COMPOSE_HELP: ReadonlyArray<{ display: string; description: string }> = [
  { display: '⏎', description: 'Send' },
  { display: 'Shift+⏎', description: 'Newline' },
  { display: 'Esc / Tab', description: 'Back to conversation' },
]

const CONTEXT_TITLES: Record<KeyContext, string> = {
  global: 'Global',
  inbox: 'Inbox',
  conversation: 'Conversation',
  compose: 'Compose',
}

export interface HelpGroup {
  title: string
  bindings: ReadonlyArray<{ display: string; description: string }>
}

/** The help overlay content, generated from the keymap so it can never drift. */
export function helpGroups(): HelpGroup[] {
  const order: KeyContext[] = ['global', 'inbox', 'conversation']
  const groups: HelpGroup[] = order.map((context) => ({
    title: CONTEXT_TITLES[context],
    bindings: KEYMAP.filter((b) => b.context === context).map((b) => ({
      display: b.display,
      description: b.description,
    })),
  }))
  groups.push({ title: CONTEXT_TITLES.compose, bindings: COMPOSE_HELP })
  return groups
}

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
