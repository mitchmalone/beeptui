import type { AttachmentSummary } from '@/beeper/types.ts'
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
  { id: 'open', label: 'Open attachment' },
]

/** The menu for one specific message. Open attachment appears only when the
 *  message has a downloadable attachment — the same `attachments[0]` +
 *  download-id precondition open/save enforce, so the item never dangles on a
 *  message where picking it could only produce an excuse. */
export function conversationActionsFor(
  message: { attachments?: readonly AttachmentSummary[] | undefined } | null
): readonly ConversationAction[] {
  const openable = message?.attachments?.[0]?.id !== undefined
  return CONVERSATION_ACTIONS.filter((a) => a.id !== 'open' || openable)
}

/** An entry in the Settings flyout (Net rail → Settings). */
export interface SettingsItem {
  id: 'theme'
  label: string
}

/** Settings the menu offers today. Density, network colours and keymap are the
 *  obvious next ones — the menu is built to take them. */
export const SETTINGS_ITEMS: readonly SettingsItem[] = [{ id: 'theme', label: 'Theme…' }]
