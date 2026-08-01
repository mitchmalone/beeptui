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

/** Does a chat pass the current inbox filter (scope + archived + unreadOnly)? */
function matchesFilter(chat: ChatSummary, filter: AppState['filter']): boolean {
  if (filter.scope !== 'all' && chat.accountId !== filter.scope) return false
  if (chat.isArchived !== filter.archived) return false
  if (filter.unreadOnly && chat.unreadCount === 0) return false
  return true
}

export function selectInboxRows(state: AppState): InboxRow[] {
  const rows: InboxRow[] = []
  for (const id of state.chatOrder) {
    const chat = state.chats[id]
    if (!chat) continue
    if (!matchesFilter(chat, state.filter)) continue
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

/** One entry in the leftmost network rail. */
export interface NetworkRailEntry {
  /** 'all' or an account id. */
  id: string
  /** Display label: 'All' or the network name. */
  label: string
  /** Network name for the marker, or null for the 'all' entry. */
  network: string | null
  /** Unread total within the current archived view (ignores the unread-only toggle). */
  unreadCount: number
  isSelected: boolean
}

/**
 * The network rail: an 'All' entry followed by one per connected account, in
 * loaded order. Unread counts reflect the current archived view so the rail's
 * dots match the list the user would see — but ignore the unread-only toggle
 * (which is about the list, not the rail). Presentation (markers) is the
 * component's job; this stays free of any TUI import.
 */
export function selectNetworkRail(state: AppState): NetworkRailEntry[] {
  const unreadByAccount: Record<string, number> = {}
  let unreadAll = 0
  for (const id of state.chatOrder) {
    const chat = state.chats[id]
    if (!chat || chat.isArchived !== state.filter.archived) continue
    unreadAll += chat.unreadCount
    unreadByAccount[chat.accountId] = (unreadByAccount[chat.accountId] ?? 0) + chat.unreadCount
  }

  const entries: NetworkRailEntry[] = [
    {
      id: 'all',
      label: 'All',
      network: null,
      unreadCount: unreadAll,
      isSelected: state.filter.scope === 'all',
    },
  ]
  for (const accountId of state.accountOrder) {
    const account = state.accounts[accountId]
    if (!account) continue
    entries.push({
      id: accountId,
      label: account.network,
      network: account.network,
      unreadCount: unreadByAccount[accountId] ?? 0,
      isSelected: state.filter.scope === accountId,
    })
  }
  return entries
}

/** Total unread across all non-archived chats — the number behind the tmux /
 *  terminal status badge. Archived chats don't count toward attention. */
export function selectTotalUnread(state: AppState): number {
  let total = 0
  for (const chat of Object.values(state.chats)) {
    if (!chat.isArchived) total += chat.unreadCount
  }
  return total
}

export interface ActiveConversation {
  chat: ChatSummary | null
  messages: MessageEntity[]
  hasMoreOlder: boolean
  olderCursor: string | null
  scrollOffset: number
  newMessagesBelow: boolean
  /** Id of the message cursor (Slice 11 selection), or null when scrolling. */
  selectedMessageId: string | null
}

export function selectActiveConversation(state: AppState): ActiveConversation {
  const id = state.selectedChatId
  if (id === null) {
    return {
      chat: null,
      messages: [],
      hasMoreOlder: false,
      olderCursor: null,
      scrollOffset: 0,
      newMessagesBelow: false,
      selectedMessageId: null,
    }
  }
  const window = state.messagesByChat[id]
  return {
    chat: state.chats[id] ?? null,
    messages: window?.items ?? [],
    hasMoreOlder: window?.hasMoreOlder ?? false,
    olderCursor: window?.olderCursor ?? null,
    scrollOffset: state.conversationOffset,
    newMessagesBelow: state.newMessagesBelow,
    selectedMessageId: state.selectedMessageId,
  }
}

/** The message the cursor is on in the active conversation, or null. */
export function selectSelectedMessage(state: AppState): MessageEntity | null {
  const id = state.selectedChatId
  if (id === null || state.selectedMessageId === null) return null
  const items = state.messagesByChat[id]?.items ?? []
  return items.find((m) => m.id === state.selectedMessageId) ?? null
}

export interface ReplyContext {
  messageId: string
  sender: string
  snippet: string
}

/** Reply preview shown above the compose box while replying, or null when not
 *  replying (or the target message isn't loaded). Sender + a short text snippet
 *  the user recognizes — their own conversation, rendered in their own terminal. */
export function selectReplyContext(state: AppState): ReplyContext | null {
  const id = state.selectedChatId
  if (id === null || state.replyTo === null) return null
  const target = (state.messagesByChat[id]?.items ?? []).find((m) => m.id === state.replyTo)
  if (target === undefined) return null
  const sender = target.senderName ?? (target.isSender ? 'You' : target.senderId)
  const text = target.text ?? (target.attachments?.length ? `[${target.attachments[0]?.kind}]` : '')
  const snippet = text.length > 60 ? `${text.slice(0, 57)}…` : text
  return { messageId: target.id, sender, snippet }
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

export interface FailedSend {
  clientId: string
  text: string
}

/** The most recent failed optimistic send in the active chat, for explicit
 *  retry. Null when there's nothing to retry. */
export function selectLastFailedSend(state: AppState): FailedSend | null {
  const id = state.selectedChatId
  if (id === null) return null
  const items = state.messagesByChat[id]?.items ?? []
  for (let i = items.length - 1; i >= 0; i--) {
    const message = items[i]
    if (message?.status === 'failed' && message.clientId !== undefined) {
      return { clientId: message.clientId, text: message.text ?? '' }
    }
  }
  return null
}
