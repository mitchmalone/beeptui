/**
 * The single source of truth for keybindings. The help overlay is
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
  | 'select-message'
  | 'retry'
  | 'archive-chat'
  | 'search'
  | 'search-messages'
  | 'help'
  | 'refresh'
  | 'network-cycle'
  | 'toggle-archived'
  | 'toggle-unread'
  | 'toggle-density'
  | 'cycle-theme'
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
    keys: ['shift+a'],
    display: 'A',
    command: 'archive-chat',
    description: 'Archive / unarchive the selected chat',
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
    keys: ['v'],
    display: 'v',
    command: 'select-message',
    description: 'Re-anchor the cursor at the newest message',
    context: 'conversation',
  },
  {
    keys: ['shift+r'],
    display: 'R',
    command: 'retry',
    description: 'Retry failed send',
    context: 'conversation',
  },
  {
    keys: ['shift+a'],
    display: 'A',
    command: 'archive-chat',
    description: 'Archive / unarchive this chat',
    context: 'conversation',
  },
  {
    keys: [']', '['],
    display: '[ / ]',
    command: 'network-cycle',
    description: 'Cycle network scope',
    context: 'global',
  },
  {
    keys: ['a'],
    display: 'a',
    command: 'toggle-archived',
    description: 'Toggle archived view',
    context: 'global',
  },
  {
    keys: ['shift+u'],
    display: 'U',
    command: 'toggle-unread',
    description: 'Toggle unread-only',
    context: 'global',
  },
  { keys: ['/'], display: '/', command: 'search', description: 'Search chats', context: 'global' },
  {
    keys: ['shift+s'],
    display: 'S',
    command: 'search-messages',
    description: 'Search messages',
    context: 'global',
  },
  {
    keys: ['?'],
    display: '?',
    command: 'help',
    description: 'Toggle this help',
    context: 'global',
  },
  {
    keys: ['shift+d'],
    display: 'D',
    command: 'toggle-density',
    description: 'Toggle compact/comfortable layout',
    context: 'global',
  },
  {
    keys: ['t'],
    display: 't',
    command: 'cycle-theme',
    description: 'Cycle theme',
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

/** Network-rail keys (while the rail has focus); j/k reuse the move bindings and
 *  drill-in mirrors `open`, so these are listed for the help overlay only. */
export const RAIL_HELP: ReadonlyArray<{ display: string; description: string }> = [
  { display: 'j / k', description: 'Move cursor (incl. Archived)' },
  { display: '⏎ / l / →', description: 'Drill in, or toggle Archived' },
]

/** Message-cursor keys (the conversation always has a cursor; ↑/↓ move it).
 *  r/o/s are raw-matched in the app so they don't shadow the global `r`/`s`;
 *  listed here for the help overlay. */
export const MESSAGE_SELECT_HELP: ReadonlyArray<{ display: string; description: string }> = [
  { display: 'j / k · ↓ / ↑', description: 'Move the message cursor newer / older' },
  { display: '⏎', description: 'Open the action menu (React…) on the cursor' },
  { display: 'r', description: 'Reply to the selected message' },
  { display: 'o', description: 'Open its attachment' },
  { display: 's', description: 'Save its attachment to Downloads' },
  { display: '← / → · ⏎', description: 'In the emoji picker: move · react' },
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

/** The help overlay content, generated from the keymap so it can never drift.
 *  Pass the effective keymap so rebinds show their configured keys. */
export function helpGroups(keymap: readonly Binding[] = KEYMAP): HelpGroup[] {
  const order: KeyContext[] = ['global', 'inbox', 'conversation']
  const groups: HelpGroup[] = order.map((context) => ({
    title: CONTEXT_TITLES[context],
    bindings: keymap
      .filter((b) => b.context === context)
      .map((b) => ({ display: b.display, description: b.description })),
  }))
  groups.push({ title: 'Network rail', bindings: RAIL_HELP })
  groups.push({ title: 'Messages', bindings: MESSAGE_SELECT_HELP })
  groups.push({ title: CONTEXT_TITLES.compose, bindings: COMPOSE_HELP })
  return groups
}

/** Normalize a key event into a match token (e.g. `g`, `shift+g`, `down`). */
export function keyToken(key: { name: string; shift?: boolean }): string {
  const name = key.name.toLowerCase()
  // Shift only disambiguates letters (G vs g); ignore it for named keys.
  return key.shift && name.length === 1 ? `shift+${name}` : name
}

export interface KeyEvent {
  name: string
  shift?: boolean
  /** The raw typed character, when the terminal reports one. */
  sequence?: string
}

export interface KeyMatch {
  command: Command
  /** Index of the matched key within the binding's `keys` — for commands where
   *  the key picks a direction (`network-cycle`: first key cycles forward,
   *  any later key cycles backward). */
  keyIndex: number
}

/**
 * Resolve a key event against the keymap: first by normalized token, then by
 * the raw typed character. The raw fallback is what makes punctuation bindings
 * (`/`, `?`, `[`, `]`) work everywhere — terminals name those keys
 * inconsistently, and shifted punctuation tokenizes as `shift+/` rather
 * than `?`.
 */
export function resolveKey(key: KeyEvent, keymap: readonly Binding[] = KEYMAP): KeyMatch | null {
  const token = keyToken(key)
  for (const b of keymap) {
    const keyIndex = b.keys.indexOf(token)
    if (keyIndex !== -1) return { command: b.command, keyIndex }
  }
  if (key.sequence !== undefined && key.sequence.length === 1 && key.sequence !== token) {
    for (const b of keymap) {
      const keyIndex = b.keys.indexOf(key.sequence)
      if (keyIndex !== -1) return { command: b.command, keyIndex }
    }
  }
  return null
}

/** Resolve a key event to a command, or null if unbound. Pass an effective
 *  keymap (base + user overrides) to honour config-file rebinds. */
export function resolveCommand(key: KeyEvent, keymap: readonly Binding[] = KEYMAP): Command | null {
  return resolveKey(key, keymap)?.command ?? null
}

/** The set of valid command names, for validating config overrides. */
export const COMMANDS: ReadonlySet<Command> = new Set(KEYMAP.map((b) => b.command))

/** User keymap overrides from config: command name → replacement key tokens. */
export type KeymapOverrides = Record<string, string[]>

/** Pretty display string for a set of key tokens (used when an override replaces
 *  a binding's hand-written display). */
function keysToDisplay(keys: string[]): string {
  const pretty: Record<string, string> = {
    return: '⏎',
    enter: '⏎',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
    escape: 'Esc',
    tab: 'Tab',
    space: '␣',
  }
  return keys
    .map((k) => pretty[k] ?? (k.startsWith('shift+') ? k.slice(6).toUpperCase() : k))
    .join(' / ')
}

/**
 * Build the effective keymap from the base bindings plus user overrides. Each
 * override replaces a command's keys (and regenerates its help display). An
 * override for an unknown command throws with a clear message so a config typo
 * surfaces instead of silently doing nothing.
 */
export function applyKeymapOverrides(
  overrides: KeymapOverrides,
  base: readonly Binding[] = KEYMAP
): Binding[] {
  for (const command of Object.keys(overrides)) {
    if (!COMMANDS.has(command as Command)) {
      throw new Error(`Unknown keymap command in config: "${command}"`)
    }
    const keys = overrides[command]
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new Error(`Keymap override for "${command}" must be a non-empty array of key tokens`)
    }
  }
  return base.map((binding) => {
    const keys = overrides[binding.command]
    return keys === undefined ? binding : { ...binding, keys, display: keysToDisplay(keys) }
  })
}
