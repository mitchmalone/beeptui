import type { Account, ChatSummary, MessageSummary } from '@/beeper/types.ts'
import {
  initialMessageSearch,
  MAX_MESSAGES_PER_CHAT,
  PENDING_SORT_PREFIX,
  RAIL_ARCHIVED_ID,
  RAIL_SETTINGS_ID,
  type AppEvent,
  type AppState,
  type ChatMessages,
  type MessageEntity,
  type MessagePage,
} from '@/state/types.ts'
import { conversationActionsFor, QUICK_REACTIONS, SETTINGS_ITEMS } from '@/state/reactions.ts'
import { conversationContentWidth, offsetToShowMessage } from '@/state/conversation-scroll.ts'
import { layOutMessages, totalRows, type MessageLayout } from '@/state/message-layout.ts'
import { matchesFilter, selectSelectedMessage } from '@/state/selectors.ts'

/** Loaded messages of the active chat, or [] when none is selected. */
function activeItems(state: AppState): readonly MessageEntity[] {
  return state.selectedChatId === null
    ? []
    : (state.messagesByChat[state.selectedChatId]?.items ?? [])
}

/** The first chat the current filter actually shows, or null when it shows none. */
function firstVisibleChatId(state: AppState): string | null {
  for (const id of state.chatOrder) {
    const chat = state.chats[id]
    if (chat !== undefined && matchesFilter(chat, state.filter)) return chat.id
  }
  return null
}

/**
 * Keep the inbox cursor on a chat the user can see. The active column having no
 * cursor is a dead-looking UI: nothing responds until the user guesses that
 * `j` will wake it up. Re-seeds when the list first arrives and whenever a
 * filter change hides whatever was selected.
 */
function withSeededChat(state: AppState): AppState {
  const current = state.selectedChatId
  const chat = current === null ? undefined : state.chats[current]
  if (chat !== undefined && matchesFilter(chat, state.filter)) return state
  const next = firstVisibleChatId(state)
  if (next === current) return state
  // Only the highlight moves — opening a chat stays an explicit ⏎, so the
  // conversation pane is not populated behind the user's back.
  return { ...state, selectedChatId: next }
}

/** The newest loaded message of the active chat, for cursor seeding. */
function newestMessageId(state: AppState): string | null {
  const items = activeItems(state)
  return items[items.length - 1]?.id ?? null
}

/** The active chat's messages laid out into rows at the measured width. Scroll
 *  offsets are row counts, so every scroll decision goes through this. */
function activeLayouts(state: AppState): MessageLayout[] {
  return layOutMessages(
    activeItems(state),
    conversationContentWidth(state.viewportCols, state.density),
    {
      separator: state.density !== 'compact',
    }
  )
}

/** True once the view has reported both viewport dimensions. Before that any
 *  row arithmetic would be built on a guessed wrap width. */
function measured(state: AppState): boolean {
  return state.viewportRows > 0 && state.viewportCols > 0
}

/** The scroll offset that keeps `messageId` visible in the current viewport,
 *  falling back to the existing offset when the id or viewport is unknown. */
function offsetForSelection(state: AppState, messageId: string | null): number {
  if (messageId === null || !measured(state)) return state.conversationOffset
  // Landing on the newest message means "show me the latest", so pin to the
  // floor. Left to `offsetToShowMessage`, a newest message taller than the
  // viewport gets anchored by its *top* — right when you navigate up into a long
  // message, wrong here, because the resulting non-zero offset is what the rest
  // of the reducer reads as "the user has scrolled up". That mis-fires the
  // new-messages affordance and holds the reading position on a chat that was
  // only just opened.
  if (messageId === newestMessageId(state)) return 0
  return offsetToShowMessage(
    activeLayouts(state),
    messageId,
    state.viewportRows,
    state.conversationOffset
  )
}

/** Scroll state for a selection move: the viewport-follow offset, plus clearing
 *  the new-messages affordance once the cursor is pinned back to the newest. */
function scrollForSelection(
  state: AppState,
  messageId: string | null
): { conversationOffset: number; newMessagesBelow: boolean } {
  const conversationOffset = offsetForSelection(state, messageId)
  return {
    conversationOffset,
    newMessagesBelow: conversationOffset === 0 ? false : state.newMessagesBelow,
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled AppEvent: ${JSON.stringify(value)}`)
}

// ── Chat ordering ───────────────────────────────────────────────────────

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

// ── Message windows ─────────────────────────────────────────────────────

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

interface MergeResult {
  window: ChatMessages
  /** Ids that are genuinely new to the window — excluding a self-echo that
   *  consumed an optimistic placeholder, which replaces a message the user can
   *  already see rather than adding one.
   *
   *  Callers must use this rather than diffing list lengths: once the window is
   *  at `MAX_MESSAGES_PER_CHAT` an arrival evicts the oldest, so the length is
   *  identical either side of a real arrival. */
  addedIds: string[]
}

/** Merge messages into a window, deduping by id (incoming updates existing),
 *  re-sorting by effective key, and re-bounding. Pure. */
function mergeMessages(
  window: ChatMessages | undefined,
  incoming: MessageEntity[],
  page: MessagePage
): MergeResult {
  const byId = new Map<string, MessageEntity>()
  for (const m of window?.items ?? []) byId.set(m.id, m)
  // Which incoming ids the window doesn't already hold. Recorded per incoming
  // message rather than by snapshotting the window's ids, so this stays O(the
  // arrival) instead of O(the whole window) on every live message.
  const isNew = new Map<string, boolean>()
  for (const m of incoming) isNew.set(m.id, !byId.has(m.id))
  // Incoming ids that stood in for a placeholder we dropped — not arrivals.
  const reconciled = new Set<string>()

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
          reconciled.add(inc.id)
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
  const items = capWindow(merged, page)
  // Live growth that evicts from the front makes older history real again, even
  // for a window that had been paged back to its start — claiming "start of
  // conversation" after eviction would be silently wrong. (If the cursor is
  // stale or null, scrollback refetches what it can; reopening the chat reloads
  // the newest page cleanly.)
  const evictedOldest = page === 'newer' && items.length < merged.length
  // Only count what survived the cap — a message trimmed off the far end never
  // reached the user. The membership set is built only when there is something
  // to check, so a replay or a self-echo costs nothing.
  let addedIds = incoming
    .map((m) => m.id)
    .filter((id) => isNew.get(id) === true && !reconciled.has(id))
  if (addedIds.length > 0) {
    const kept = new Set(items.map((m) => m.id))
    addedIds = addedIds.filter((id) => kept.has(id))
  }
  return {
    window: {
      items,
      hasMoreOlder: evictedOldest || (window?.hasMoreOlder ?? false),
      olderCursor: window?.olderCursor ?? null,
    },
    addedIds,
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

// ── Reducer ─────────────────────────────────────────────────────────────

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
      return withSeededChat({ ...state, chats, chatOrder: orderChats(chats) })
    }

    case 'chats/upserted': {
      // An update can hide the selected chat — archiving it is the obvious case
      // — so the cursor is re-seeded here for the same reason as on a filter
      // change: a highlighted chat that isn't in the list is no highlight.
      const chats = { ...state.chats, [event.chat.id]: event.chat }
      return withSeededChat({ ...state, chats, chatOrder: orderChats(chats) })
    }

    case 'messages/loaded': {
      const oldestBefore = (state.messagesByChat[event.chatId]?.items ?? [])[0]?.id ?? null
      const wasPending = state.olderPagePending === event.chatId
      const loaded = withChatMessages(state, event.chatId, (window) => {
        const merged = mergeMessages(window, event.messages.map(toEntity), event.page).window
        return {
          ...merged,
          ...(event.hasMoreOlder !== undefined ? { hasMoreOlder: event.hasMoreOlder } : {}),
          ...(event.olderCursor !== undefined ? { olderCursor: event.olderCursor } : {}),
        }
      })
      // The page this chat was waiting on: seat the cursor on the newest message
      // of the batch, so the keypress that asked for it moves by exactly one
      // message the way it does anywhere else in the list. By id, not index —
      // prepending shifts every index and the view would lurch.
      if (wasPending) {
        const settled = { ...loaded, olderPagePending: null }
        const items = activeItems(settled)
        const boundary = oldestBefore === null ? -1 : items.findIndex((m) => m.id === oldestBefore)
        const nextId = boundary > 0 ? items[boundary - 1]?.id : undefined
        if (nextId === undefined) return settled
        return { ...settled, selectedMessageId: nextId, ...scrollForSelection(settled, nextId) }
      }
      // Opening a chat focuses the conversation *before* its history arrives, so
      // `focus/changed` looks at an empty list and selects nothing. Whichever of
      // the two finishes last has to seat the cursor — otherwise the pane renders
      // populated with no cursor in it, and the arrow keys look broken.
      if (loaded.focus !== 'conversation' || loaded.selectedMessageId !== null) return loaded
      const newest = newestMessageId(loaded)
      if (newest === null) return loaded
      return { ...loaded, selectedMessageId: newest, ...scrollForSelection(loaded, newest) }
    }

    case 'message/received': {
      const chatId = event.message.chatId
      // Bounded memory: live messages are only buffered into windows that
      // already exist (open now or viewed earlier) or the selected chat. Any
      // other chat's list row still updates via `chats/upserted`, and its
      // history loads on open — buffering every chat that receives traffic
      // would grow with the whole account.
      if (state.messagesByChat[chatId] === undefined && chatId !== state.selectedChatId) {
        return state
      }
      const existing = state.messagesByChat[chatId]?.items ?? []
      const newestBeforeId = existing[existing.length - 1]?.id ?? null
      // Ask the merge what actually arrived. Diffing list lengths silently
      // reported nothing once the window hit MAX_MESSAGES_PER_CHAT, because the
      // arrival evicts the oldest and the length never moves — which killed the
      // reading-position hold, the new-messages affordance and cursor-follow on
      // every busy chat with a full window.
      const merged = mergeMessages(state.messagesByChat[chatId], [toEntity(event.message)], 'newer')
      const next = withChatMessages(state, chatId, () => merged.window)
      if (chatId === state.selectedChatId && merged.addedIds.length > 0) {
        if (state.conversationOffset > 0) {
          // Scrolled up (the newest is below the fold): keep the reading position
          // — bump the offset by the *rows* the arrivals added, not the message
          // count, or the view slides by however many rows they wrapped onto —
          // and flag new-below.
          const grew = measured(state)
            ? totalRows(activeLayouts(next)) - totalRows(activeLayouts(state))
            : merged.addedIds.length
          return {
            ...next,
            conversationOffset: state.conversationOffset + Math.max(0, grew),
            newMessagesBelow: true,
          }
        }
        // Pinned at the bottom with the cursor on the newest: follow to the new
        // newest so the indicator stays put as live messages arrive. A cursor
        // parked on an older (but still on-screen) message is left alone.
        if (state.selectedMessageId !== null && state.selectedMessageId === newestBeforeId) {
          const items = next.messagesByChat[chatId]?.items ?? []
          const newest = items[items.length - 1]
          if (newest !== undefined) return { ...next, selectedMessageId: newest.id }
        }
      }
      return next
    }

    case 'chat/selected':
      // Reset scroll to the newest message when the selection changes, and clear
      // any transient notice (it belonged to the previous view). Message
      // selection and any pending reply belong to the old chat — clear them too.
      return {
        ...state,
        selectedChatId: event.chatId,
        selectedMessageId: null,
        replyTo: null,
        conversationOffset: 0,
        newMessagesBelow: false,
        olderPagePending: null,
        notice: null,
      }

    case 'messageSelection/started': {
      // Enter selection at the newest loaded message of the active chat.
      const items = activeItems(state)
      const newest = items[items.length - 1]
      if (newest === undefined) return state
      return { ...state, selectedMessageId: newest.id, ...scrollForSelection(state, newest.id) }
    }

    case 'messageSelection/moved': {
      const items = activeItems(state)
      if (items.length === 0) return state
      const current = items.findIndex((m) => m.id === state.selectedMessageId)
      // From no selection, a move starts at the newest message. A large delta
      // (top/bottom) clamps to an edge.
      const from = current === -1 ? items.length - 1 : current
      const next = Math.min(items.length - 1, Math.max(0, from + event.delta))
      // A single step up off the oldest loaded message is a request for more
      // history rather than a no-op. Deliberately only a single step: `g` jumps
      // to the top, and letting a jump page would turn one keypress into an
      // unbounded run of fetches. The cursor stays where it is until the page
      // lands — there is nowhere older to put it yet — and the pending marker
      // keeps a held-down key from stacking requests.
      if (event.delta === -1 && from === 0 && next === 0) {
        const window =
          state.selectedChatId === null ? undefined : state.messagesByChat[state.selectedChatId]
        const canPage =
          state.selectedChatId !== null &&
          state.olderPagePending === null &&
          window?.hasMoreOlder === true &&
          window.olderCursor !== null &&
          window.olderCursor !== undefined
        return canPage ? { ...state, olderPagePending: state.selectedChatId } : state
      }
      const nextId = items[next]?.id ?? state.selectedMessageId
      return { ...state, selectedMessageId: nextId, ...scrollForSelection(state, nextId) }
    }

    case 'messageSelection/cleared':
      return { ...state, selectedMessageId: null }

    case 'reply/started':
      // Begin replying: record the target, leave selection mode (focus moves to
      // compose, handled by the caller).
      return { ...state, replyTo: event.messageId, selectedMessageId: null }

    case 'reply/cancelled':
      return { ...state, replyTo: null }

    case 'focus/changed': {
      // Entering the conversation auto-selects the newest message so arrow keys
      // drive a visible cursor immediately (like the Net/Chats rails). An
      // existing selection is preserved.
      if (event.focus === 'conversation' && state.selectedMessageId === null) {
        const items = activeItems(state)
        const newest = items[items.length - 1]
        if (newest !== undefined) {
          return {
            ...state,
            focus: event.focus,
            selectedMessageId: newest.id,
            ...scrollForSelection(state, newest.id),
          }
        }
      }
      // Composing is elsewhere: drop the message cursor so two columns don't
      // both look active. `replyTo` is a different thing — what the draft
      // answers — and must survive, or starting a reply would cancel itself.
      if (event.focus === 'compose') {
        return { ...state, focus: event.focus, selectedMessageId: null }
      }
      // Entering the rail puts the cursor on the active scope (never left stale
      // on the Archived toggle).
      if (event.focus === 'rail') {
        return { ...state, focus: event.focus, railCursor: state.filter.scope }
      }
      return { ...state, focus: event.focus }
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
        // A reply carries its target so the optimistic bubble shows the ↩ marker
        // immediately (invariant 5: only ever on an explicit send).
        ...(event.replyToId !== undefined ? { replyToId: event.replyToId } : {}),
      }
      // The reply is consumed by this send — clear the pending reply context.
      const next = event.replyToId !== undefined ? { ...state, replyTo: null } : state
      return withChatMessages(
        next,
        event.chatId,
        (window) => mergeMessages(window, [pending], 'newer').window
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
      // Opening search starts from an empty query; the action menu and emoji
      // picker start from their first item.
      return {
        ...state,
        overlay: event.overlay,
        searchQuery: '',
        actionCursor: 0,
        emojiCursor: 0,
        settingsCursor: 0,
        themeCursor: 0,
      }

    case 'overlay/closed':
      return { ...state, overlay: 'none', searchQuery: '' }

    case 'viewport/measured':
      if (event.rows === state.viewportRows && event.cols === state.viewportCols) return state
      return { ...state, viewportRows: event.rows, viewportCols: event.cols }

    case 'actionMenu/moved': {
      const max = conversationActionsFor(selectSelectedMessage(state)).length - 1
      const next = Math.min(max, Math.max(0, state.actionCursor + event.delta))
      return { ...state, actionCursor: next }
    }

    case 'settingsMenu/moved': {
      const max = Math.max(0, SETTINGS_ITEMS.length - 1)
      return {
        ...state,
        settingsCursor: Math.min(max, Math.max(0, state.settingsCursor + event.delta)),
      }
    }

    case 'themePicker/moved': {
      // The App owns the theme registry, so it tells the reducer how long the
      // list is rather than the reducer importing the view's data.
      const max = Math.max(0, event.count - 1)
      return { ...state, themeCursor: Math.min(max, Math.max(0, state.themeCursor + event.delta)) }
    }

    case 'emojiPicker/moved': {
      const max = QUICK_REACTIONS.length - 1
      const next = Math.min(max, Math.max(0, state.emojiCursor + event.delta))
      return { ...state, emojiCursor: next }
    }

    case 'search/queryChanged':
      return { ...state, searchQuery: event.query }

    case 'filter/scopeCycled': {
      // Rail order is 'all' followed by accounts in their loaded order.
      const order = ['all', ...state.accountOrder]
      const current = order.indexOf(state.filter.scope)
      const from = current === -1 ? 0 : current
      const scope = order[(from + event.direction + order.length) % order.length] ?? 'all'
      return withSeededChat({ ...state, filter: { ...state.filter, scope }, railCursor: scope })
    }

    case 'filter/scopeSelected':
      return withSeededChat({
        ...state,
        filter: { ...state.filter, scope: event.scope },
        railCursor: event.scope,
      })

    case 'rail/cursorMoved': {
      // The rail cursor walks scopes plus the Archived toggle. Landing on a scope
      // live-selects it (current behaviour); landing on Archived leaves the scope.
      const order = ['all', ...state.accountOrder, RAIL_ARCHIVED_ID, RAIL_SETTINGS_ID]
      const current = order.indexOf(state.railCursor)
      const from = current === -1 ? 0 : current
      const next = order[(from + event.direction + order.length) % order.length] ?? 'all'
      // Landing on a scope changes what the Chats column shows, so the chat
      // cursor has to be re-seeded like any other filter change — otherwise it
      // stays on a chat belonging to the network you just left, which is
      // filtered out, and the column renders with no highlight at all.
      return withSeededChat({
        ...state,
        railCursor: next,
        filter:
          next === RAIL_ARCHIVED_ID || next === RAIL_SETTINGS_ID
            ? state.filter
            : { ...state.filter, scope: next },
      })
    }

    case 'filter/archivedToggled':
      return withSeededChat({
        ...state,
        filter: { ...state.filter, archived: !state.filter.archived },
      })

    case 'filter/unreadToggled':
      return withSeededChat({
        ...state,
        filter: { ...state.filter, unreadOnly: !state.filter.unreadOnly },
      })

    case 'density/toggled':
      return { ...state, density: state.density === 'comfortable' ? 'compact' : 'comfortable' }

    case 'theme/selected':
      // The App owns the theme registry and picks the name; the reducer just
      // records the selection (resolution to a Theme happens in the view).
      return { ...state, themeName: event.name }

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
      // Any error while a history page is in flight means it is not coming.
      // Clear the request so the pane can be scrolled again rather than sitting
      // in a permanent "loading" that nothing will ever resolve (invariant 8).
      return {
        ...state,
        error: { kind: event.kind, message: event.message },
        olderPagePending: null,
      }

    case 'error/cleared':
      return { ...state, error: null }

    default: {
      // Exhaustiveness guard: adding an AppEvent variant without a case above
      // makes `event` non-never here and fails the build.
      return assertNever(event)
    }
  }
}
