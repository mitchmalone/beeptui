/**
 * The limited quick-reaction set and the conversation action-menu items. Pure
 * data, kept out of the TUI so the reducer can clamp cursors against these
 * lengths without importing rendering code. The emoji set is deliberately small
 * (a single-row picker); arbitrary-emoji entry is out of scope for v1.
 */

/** Quick reactions offered by the emoji picker, in display order. */
export const QUICK_REACTIONS: readonly string[] = ['👍', '❤️', '😂', '😮', '😢', '🙏']

/** An action offered by the conversation action menu (the ENTER "dropdown"). */
export interface ConversationAction {
  id: 'reply' | 'react' | 'open'
  label: string
}

/** Actions the menu offers today. Delete / forward / copy come later.
 *  Reply is first: it is the common one, and it was previously reachable only
 *  by knowing about `r`. Both entry points dispatch the same `reply/started`. */
export const CONVERSATION_ACTIONS: readonly ConversationAction[] = [
  { id: 'reply', label: 'Reply' },
  { id: 'react', label: 'React…' },
  // Same handler as `o` — on a message without an attachment it says so in a
  // notice rather than hiding (the menu is a fixed list the reducer's cursor
  // maths depend on, and an honest "no attachment here" beats a shape-shifting
  // menu).
  { id: 'open', label: 'Open attachment' },
]

/** An entry in the Settings flyout (Net rail → Settings). */
export interface SettingsItem {
  id: 'theme'
  label: string
}

/** Settings the menu offers today. Density, network colours and keymap are the
 *  obvious next ones — the menu is built to take them. */
export const SETTINGS_ITEMS: readonly SettingsItem[] = [{ id: 'theme', label: 'Theme…' }]
