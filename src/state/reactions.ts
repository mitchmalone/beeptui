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
  id: 'react'
  label: string
}

/** Actions the menu offers today. Delete / reply-from-menu / etc. come later. */
export const CONVERSATION_ACTIONS: readonly ConversationAction[] = [
  { id: 'react', label: 'React…' },
]
