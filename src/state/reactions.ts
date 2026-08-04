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
  id: 'reply' | 'react'
  label: string
}

/** Actions the menu offers today. Delete / forward / copy come later.
 *  Reply is first: it is the common one, and it was previously reachable only
 *  by knowing about `r`. Both entry points dispatch the same `reply/started`. */
export const CONVERSATION_ACTIONS: readonly ConversationAction[] = [
  { id: 'reply', label: 'Reply' },
  { id: 'react', label: 'React…' },
]

/** An entry in the Settings flyout (Net rail → Settings). */
export interface SettingsItem {
  id: 'theme'
  label: string
}

/** Settings the menu offers today. Density, network colours and keymap are the
 *  obvious next ones — the menu is built to take them. */
export const SETTINGS_ITEMS: readonly SettingsItem[] = [{ id: 'theme', label: 'Theme…' }]
