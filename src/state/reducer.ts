import type { Account, ChatSummary, MessageSummary } from '@/beeper/types.ts'
import {
  initialMessageSearch,
  MAX_MESSAGES_PER_CHAT,
  PENDING_SORT_PREFIX,
  type AppEvent,
  type AppState,
  type ChatMessages,
  type MessageEntity,
  type MessagePage,
} from '@/state/types.ts'

function assertNever(value: never): never {
  throw new Error(`Unhandled AppEvent: ${JSON.stringify(value)}`)
}

// ── Chat ordering ──────────────────────────────────────────────────────────

/** Inbox order: most recent activity first; chats without activity sort last,
 *  ties broken by id for determinism. */
function orderChats(chats: Record<string, ChatSummary>): string[] {
  return Object.keys(chats).sort((a, b) => {
    const ta = chats[a]?.lastActivity
    const tb = chats[b]?.lastActivity
    if (ta === undefined && tb === undefined) return a.localeCompare(b)
    if (ta === undefined) return 1
    if (tb === undefined) return -1
    const byTime = tb.localeCompare(ta)
    return byTime !== 0 ? byTime : a.localeCompare(b)
  })
}

// ── Message windows ────────────────────────────────────────────────────────

function toEntity(message: MessageSummary): MessageEntity {
  return { ...message, status: 'sent' }
}

/** Sort key that keeps our own unconfirmed messages (still carrying a clientId,
 *  whether pending, failed, or optimistically-sent) after all server messages,
 *  until the real echo — which has no clientId and a real sortKey — replaces it. */
function effectiveKey(message: MessageEntity): string {
  if (
    message.clientId !== undefined ||
    message.status === 'pending' ||
    message.status === 'failed'
  ) {
    return PENDING_SORT_PREFIX + (message.clientId ?? message.timestamp)
  }
  return message.sortKey
}

function capWindow(items: MessageEntity[], page: MessagePage): MessageEntity[] {
  if (items.length <= MAX_MESSAGES_PER_CHAT) return items
  // Keep the messages nearest the direction the user just loaded from.
  return page === 'older'
    ? items.slice(0, MAX_MESSAGES_PER_CHAT)
    : items.slice(items.length - MAX_MESSAGES_PER_CHAT)
}

/** Merge messages into a window, deduping by id (incoming updates existing),
 *  re-sorting by effective key, and re-bounding. Pure. */
function mergeMessages(
  window: ChatMessages | undefined,
  incoming: MessageEntity[],
  page: MessagePage
): ChatMessages {
  const byId = new Map<string, MessageEntity>()
  for (const m of window?.items ?? []) byId.set(m.id, m)

  // Reconcile optimistic sends against their real echo. A live echo of one of
  // our own messages arrives as a self-message with NO clientId and its own
  // server id; drop the optimistic placeholder we created (which keeps its
  // clientId) so the two don't double up despite the differing ids. Matched by
  // chat-local text, and only on the live/newer path so loading old history
  // with a repeated phrase can't evict a genuine pending message.
  if (page === 'newer') {
    for (const inc of incoming) {
      if (!inc.isSender || inc.clientId !== undefined) continue
      for (const [id, existing] of byId) {
        if (existing.clientId !== undefined && existing.isSender && existing.text === inc.text) {
          byId.delete(id)
          break
        }
      }
    }
  }

  for (const m of incoming) {
    const existing = byId.get(m.id)
    byId.set(m.id, existing ? { ...existing, ...m } : m)
  }
  const merged = [...byId.values()].sort((a, b) => effectiveKey(a).localeCompare(effectiveKey(b)))
  return {
    items: capWindow(merged, page),
    hasMoreOlder: window?.hasMoreOlder ?? false,
    olderCursor: window?.olderCursor ?? null,
  }
}

/** Return new state with the given chat's message window transformed. */
function withChatMessages(
  state: AppState,
  chatId: string,
  transform: (window: ChatMessages | undefined) => ChatMessages
): AppState {
  return {
    ...state,
    messagesByChat: { ...state.messagesByChat, [chatId]: transform(state.messagesByChat[chatId]) },
  }
}

function mapWindowItems(
  window: ChatMessages | undefined,
  fn: (m: MessageEntity) => MessageEntity
): ChatMessages {
  return {
    items: (window?.items ?? []).map(fn),
    hasMoreOlder: window?.hasMoreOlder ?? false,
    olderCursor: window?.olderCursor ?? null,
  }
}

// ── Reducer ──────────────────────────────────────────────────────────────

/**
 * The single pure transition function. `(state, event) => state`, no I/O, never
 * mutates the input. Every UI state change flows through here (invariant 4).
 */
export function reduce(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case 'connection/changed':
      return { ...state, connection: event.state }

    case 'server/loaded':
      return { ...state, server: event.server }

    case 'accounts/loaded': {
      const accounts: Record<string, Account> = {}
      for (const a of event.accounts) accounts[a.id] = a
      return { ...state, accounts, accountOrder: event.accounts.map((a) => a.id) }
    }

    case 'chats/loaded': {
      const chats: Record<string, ChatSummary> = {}
      for (const c of event.chats) chats[c.id] = c
      return { ...state, chats, chatOrder: orderChats(chats) }
    }

    case 'chats/upserted': {
      const chats = { ...state.chats, [event.chat.id]: event.chat }
      return { ...state, chats, chatOrder: orderChats(chats) }
    }

    case 'messages/loaded':
      return withChatMessages(state, event.chatId, (window) => {
        const merged = mergeMessages(window, event.messages.map(toEntity), event.page)
        return {
          ...merged,
          ...(event.hasMoreOlder !== undefined ? { hasMoreOlder: event.hasMoreOlder } : {}),
          ...(event.olderCursor !== undefined ? { olderCursor: event.olderCursor } : {}),
        }
      })

    case 'message/received': {
      const chatId = event.message.chatId
      const before = state.messagesByChat[chatId]?.items.length ?? 0
      const next = withChatMessages(state, chatId, (window) =>
        mergeMessages(window, [toEntity(event.message)], 'newer')
      )
      const added = (next.messagesByChat[chatId]?.items.length ?? 0) - before
      // If the user is scrolled up in this chat, keep their reading position
      // (bump the offset by the number appended) and flag new-below.
      if (chatId === state.selectedChatId && state.conversationOffset > 0 && added > 0) {
        return {
          ...next,
          conversationOffset: state.conversationOffset + added,
          newMessagesBelow: true,
        }
      }
      return next
    }

    case 'chat/selected':
      // Reset scroll to the newest message when the selection changes, and clear
      // any transient notice (it belonged to the previous view).
      return {
        ...state,
        selectedChatId: event.chatId,
        conversationOffset: 0,
        newMessagesBelow: false,
        notice: null,
      }

    case 'focus/changed':
      return { ...state, focus: event.focus }

    case 'conversation/scrolled': {
      const count =
        state.selectedChatId === null
          ? 0
          : (state.messagesByChat[state.selectedChatId]?.items.length ?? 0)
      const max = Math.max(0, count - 1)
      const offset = Math.min(max, Math.max(0, state.conversationOffset + event.delta))
      // Reaching the bottom (offset 0) dismisses the new-messages affordance.
      return {
        ...state,
        conversationOffset: offset,
        newMessagesBelow: offset === 0 ? false : state.newMessagesBelow,
      }
    }

    case 'draft/changed': {
      const drafts = { ...state.drafts }
      if (event.text.length === 0) delete drafts[event.chatId]
      else drafts[event.chatId] = event.text
      return { ...state, drafts }
    }

    case 'send/requested': {
      const pending: MessageEntity = {
        id: event.clientId,
        clientId: event.clientId,
        chatId: event.chatId,
        accountId: state.chats[event.chatId]?.accountId ?? '',
        senderId: 'me',
        timestamp: event.timestamp,
        sortKey: '',
        text: event.text,
        isSender: true,
        isUnread: false,
        status: 'pending',
      }
      return withChatMessages(state, event.chatId, (window) =>
        mergeMessages(window, [pending], 'newer')
      )
    }

    case 'send/succeeded':
      // Just confirm the optimistic message (keep its clientId + position). We do
      // NOT synthesize a server message here — the real one arrives via the live
      // `message/received` echo and reconciles against this placeholder by text
      // (see mergeMessages). If the echo already arrived, this is a no-op.
      return withChatMessages(state, event.chatId, (window) =>
        mapWindowItems(window, (m) =>
          m.clientId === event.clientId ? { ...m, status: 'sent' } : m
        )
      )

    case 'send/failed':
      return withChatMessages(state, event.chatId, (window) =>
        mapWindowItems(window, (m) =>
          m.clientId === event.clientId ? { ...m, status: 'failed' } : m
        )
      )

    case 'send/retried':
      return withChatMessages(state, event.chatId, (window) =>
        mapWindowItems(window, (m) =>
          m.clientId === event.clientId ? { ...m, status: 'pending' } : m
        )
      )

    case 'overlay/opened':
      // Opening search starts from an empty query.
      return { ...state, overlay: event.overlay, searchQuery: '' }

    case 'overlay/closed':
      return { ...state, overlay: 'none', searchQuery: '' }

    case 'search/queryChanged':
      return { ...state, searchQuery: event.query }

    case 'filter/scopeCycled': {
      // Rail order is 'all' followed by accounts in their loaded order.
      const order = ['all', ...state.accountOrder]
      const current = order.indexOf(state.filter.scope)
      const from = current === -1 ? 0 : current
      const next = (from + event.direction + order.length) % order.length
      return { ...state, filter: { ...state.filter, scope: order[next] ?? 'all' } }
    }

    case 'filter/scopeSelected':
      return { ...state, filter: { ...state.filter, scope: event.scope } }

    case 'filter/archivedToggled':
      return { ...state, filter: { ...state.filter, archived: !state.filter.archived } }

    case 'filter/unreadToggled':
      return { ...state, filter: { ...state.filter, unreadOnly: !state.filter.unreadOnly } }

    case 'messageSearch/opened':
      return {
        ...state,
        overlay: 'messageSearch',
        messageSearch: { ...initialMessageSearch, scopeChatId: event.scopeChatId },
      }

    case 'messageSearch/queryChanged':
      // Editing the query invalidates prior results (they must be re-fetched).
      return {
        ...state,
        messageSearch: {
          ...state.messageSearch,
          query: event.query,
          status: 'idle',
          results: [],
          selectedIndex: 0,
          partial: false,
          note: null,
        },
      }

    case 'messageSearch/requested':
      return { ...state, messageSearch: { ...state.messageSearch, status: 'searching' } }

    case 'messageSearch/resultsLoaded':
      return {
        ...state,
        messageSearch: {
          ...state.messageSearch,
          status: 'done',
          results: event.results,
          selectedIndex: 0,
          partial: event.partial,
          note: event.note,
        },
      }

    case 'messageSearch/failed':
      return {
        ...state,
        messageSearch: {
          ...state.messageSearch,
          status: 'error',
          results: [],
          selectedIndex: 0,
          partial: false,
          note: event.note,
        },
      }

    case 'messageSearch/selectionMoved': {
      const count = state.messageSearch.results.length
      if (count === 0) return state
      const max = count - 1
      const selectedIndex = Math.min(
        max,
        Math.max(0, state.messageSearch.selectedIndex + event.delta)
      )
      return { ...state, messageSearch: { ...state.messageSearch, selectedIndex } }
    }

    case 'messageSearch/closed':
      return { ...state, overlay: 'none', messageSearch: initialMessageSearch }

    case 'notice/shown':
      return { ...state, notice: event.message }

    case 'notice/cleared':
      return { ...state, notice: null }

    case 'error/raised':
      return { ...state, error: { kind: event.kind, message: event.message } }

    case 'error/cleared':
      return { ...state, error: null }

    default: {
      // Exhaustiveness guard: adding an AppEvent variant without a case above
      // makes `event` non-never here and fails the build.
      return assertNever(event)
    }
  }
}
