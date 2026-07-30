import type { ChatSummary } from '@/beeper/types.ts'
import type { AppState, ConnectionState, MessageEntity } from '@/state/types.ts'

/**
 * Derived views over `AppState`. Pure functions — the UI reads these and never
 * reaches into raw state shape, so rendering stays decoupled from storage.
 */

export interface InboxRow {
  id: string
  title: string
  network: string
  unreadCount: number
  hasUnread: boolean
  isMuted: boolean
  isArchived: boolean
  isSelected: boolean
}

export function selectInboxRows(state: AppState): InboxRow[] {
  const rows: InboxRow[] = []
  for (const id of state.chatOrder) {
    const chat = state.chats[id]
    if (!chat) continue
    rows.push({
      id: chat.id,
      title: chat.title,
      network: chat.network,
      unreadCount: chat.unreadCount,
      hasUnread: chat.unreadCount > 0,
      isMuted: chat.isMuted,
      isArchived: chat.isArchived,
      isSelected: state.selectedChatId === chat.id,
    })
  }
  return rows
}

export interface ActiveConversation {
  chat: ChatSummary | null
  messages: MessageEntity[]
  hasMoreOlder: boolean
  olderCursor: string | null
  scrollOffset: number
}

export function selectActiveConversation(state: AppState): ActiveConversation {
  const id = state.selectedChatId
  if (id === null) {
    return { chat: null, messages: [], hasMoreOlder: false, olderCursor: null, scrollOffset: 0 }
  }
  const window = state.messagesByChat[id]
  return {
    chat: state.chats[id] ?? null,
    messages: window?.items ?? [],
    hasMoreOlder: window?.hasMoreOlder ?? false,
    olderCursor: window?.olderCursor ?? null,
    scrollOffset: state.conversationOffset,
  }
}

export interface ConnectionBanner {
  state: ConnectionState
  message: string
}

const BANNER_MESSAGE: Partial<Record<ConnectionState, string>> = {
  idle: 'Not connected.',
  connecting: 'Connecting to Beeper…',
  unreachable: 'Beeper Desktop is unreachable. Is it running?',
  unauthorized: 'Not authorized. Check your Beeper token (run `beeper-tui doctor`).',
}

/** A banner to show when the connection is anything other than healthy; null
 *  when connected so the UI shows no banner. */
export function selectConnectionBanner(state: AppState): ConnectionBanner | null {
  if (state.connection === 'connected') return null
  return { state: state.connection, message: BANNER_MESSAGE[state.connection] ?? '' }
}

export function selectDraft(state: AppState, chatId: string): string {
  return state.drafts[chatId] ?? ''
}
