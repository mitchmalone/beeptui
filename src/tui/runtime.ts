import type {
  MessageHistoryPage,
  MessageSearchOptions,
  MessageSearchPage,
} from '@/beeper/client.ts'
import { BeeperError, normalizeError } from '@/beeper/errors.ts'
import type {
  Account,
  ChatSummary,
  MessageSummary,
  SendResult,
  ServerInfo,
} from '@/beeper/types.ts'
import type { WatchEvent } from '@/beeper/watch-protocol.ts'
import type { WatchStatus } from '@/beeper/watch.ts'
import {
  PENDING_SORT_PREFIX,
  type AppEvent,
  type AppState,
  type ConnectionState,
} from '@/state/types.ts'
import { localSearchMessages, toHit } from '@/tui/message-search.ts'

/**
 * The adapter surface the runtime needs. `BeeperAdapter` satisfies it; tests
 * pass a fake so the boot sequence is exercised without a live Beeper.
 */
export interface Gateway {
  getInfo(): Promise<ServerInfo>
  listAccounts(): Promise<Account[]>
  listChats(options?: { limit?: number }): Promise<ChatSummary[]>
  listMessages(
    chatId: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<MessageHistoryPage>
  sendMessage(chatId: string, text: string): Promise<SendResult>
  getChat(chatId: string): Promise<ChatSummary>
  searchMessages(query: string, options?: MessageSearchOptions): Promise<MessageSearchPage>
  setArchived(chatId: string, archived: boolean): Promise<void>
}

export interface SendParams {
  chatId: string
  /** Stable client id linking the optimistic message to its result. */
  clientId: string
  text: string
  /** ISO timestamp (injected by the caller so this stays deterministic). */
  timestamp: string
}

type Dispatch = (event: AppEvent) => void

/** Map an adapter failure onto a connection state. */
function connectionForError(error: BeeperError): 'unreachable' | 'unauthorized' {
  return error.kind === 'unauthorized' ? 'unauthorized' : 'unreachable'
}

/**
 * Boot: connect, load server info + accounts + chats, and land in a `connected`
 * state — or a visible, named degraded state on failure. Never throws; the UI
 * always has an honest connection state to render (CLAUDE.md invariant 8).
 */
export async function bootstrap(gateway: Gateway, dispatch: Dispatch): Promise<void> {
  dispatch({ type: 'connection/changed', state: 'connecting' })
  try {
    const server = await gateway.getInfo()
    dispatch({ type: 'server/loaded', server })

    const accounts = await gateway.listAccounts()
    dispatch({ type: 'accounts/loaded', accounts })

    const chats = await gateway.listChats()
    dispatch({ type: 'chats/loaded', chats })

    dispatch({ type: 'error/cleared' })
    dispatch({ type: 'connection/changed', state: 'connected' })
  } catch (err) {
    const error = normalizeError(err)
    dispatch({ type: 'connection/changed', state: connectionForError(error) })
    dispatch({ type: 'error/raised', kind: error.kind, message: error.message })
  }
}

/** Re-fetch chats (manual refresh stopgap until live updates land in Slice 6). */
export async function refreshChats(gateway: Gateway, dispatch: Dispatch): Promise<void> {
  try {
    const chats = await gateway.listChats()
    dispatch({ type: 'chats/loaded', chats })
  } catch (err) {
    const error = normalizeError(err)
    dispatch({ type: 'connection/changed', state: connectionForError(error) })
    dispatch({ type: 'error/raised', kind: error.kind, message: error.message })
  }
}

/**
 * Open a chat: select it, focus the conversation, and load the most recent page
 * of messages. Errors surface as a connection/error state, never a crash.
 */
export async function openChat(
  gateway: Gateway,
  dispatch: Dispatch,
  chatId: string
): Promise<void> {
  dispatch({ type: 'chat/selected', chatId })
  dispatch({ type: 'focus/changed', focus: 'conversation' })
  try {
    const page = await gateway.listMessages(chatId)
    dispatch({
      type: 'messages/loaded',
      chatId,
      messages: page.messages,
      page: 'initial',
      hasMoreOlder: page.hasMore,
      olderCursor: page.cursor,
    })
  } catch (err) {
    const error = normalizeError(err)
    dispatch({ type: 'error/raised', kind: error.kind, message: error.message })
  }
}

/** Build the reconciled "sent" message from what we know locally + the server's
 *  pending id. A sentinel sortKey keeps it at the bottom until the real message
 *  arrives via live updates (Slice 6). */
function sentMessage(params: SendParams, serverId: string): MessageSummary {
  return {
    id: serverId,
    chatId: params.chatId,
    accountId: '',
    senderId: 'me',
    timestamp: params.timestamp,
    sortKey: PENDING_SORT_PREFIX + params.timestamp,
    text: params.text,
    isSender: true,
    isUnread: false,
  }
}

/** Attempt delivery, reconciling to sent or failed. Shared by send + retry. */
async function attemptSend(
  gateway: Gateway,
  dispatch: Dispatch,
  params: SendParams
): Promise<void> {
  try {
    const result = await gateway.sendMessage(params.chatId, params.text)
    dispatch({
      type: 'send/succeeded',
      chatId: params.chatId,
      clientId: params.clientId,
      message: sentMessage(params, result.pendingMessageId),
    })
  } catch {
    // A failed send stays visible on the message; never a silent success
    // (invariant 5). The error kind isn't surfaced globally — the message
    // carries the failure and can be retried.
    dispatch({ type: 'send/failed', chatId: params.chatId, clientId: params.clientId })
  }
}

/**
 * Send a message. This is the ONLY path that emits `send/requested`, and it is
 * only ever called from an explicit user send action (invariant 5). The message
 * appears immediately as pending, the draft clears, then it reconciles.
 */
export async function submitSend(
  gateway: Gateway,
  dispatch: Dispatch,
  params: SendParams
): Promise<void> {
  dispatch({
    type: 'send/requested',
    chatId: params.chatId,
    clientId: params.clientId,
    text: params.text,
    timestamp: params.timestamp,
  })
  dispatch({ type: 'draft/changed', chatId: params.chatId, text: '' })
  await attemptSend(gateway, dispatch, params)
}

/** Retry a previously failed send (explicit user action). */
export async function retrySend(
  gateway: Gateway,
  dispatch: Dispatch,
  params: SendParams
): Promise<void> {
  dispatch({ type: 'send/retried', chatId: params.chatId, clientId: params.clientId })
  await attemptSend(gateway, dispatch, params)
}

// ── Message search (Slice 10) ────────────────────────────────────────────

/**
 * Run a message search through the adapter and dispatch the results. Honest
 * about coverage (invariant 8):
 *  - server honored the scope → results as-is, flagged `partial` only if capped;
 *  - server ignored a chat scope → filter to the scope locally and label it;
 *  - server search failed → fall back to searching loaded history, labeled
 *    partial, or a named error state when even that is empty.
 * `getState` is read after the await so hits are enriched with current chats.
 */
export async function runMessageSearch(
  gateway: Gateway,
  dispatch: Dispatch,
  getState: () => AppState,
  query: string,
  scopeChatId: string | null
): Promise<void> {
  dispatch({ type: 'messageSearch/requested' })
  try {
    const page = await gateway.searchMessages(
      query,
      scopeChatId !== null ? { chatId: scopeChatId } : {}
    )
    const state = getState()
    if (scopeChatId !== null && !page.scopeHonored) {
      const scoped = page.messages
        .filter((m) => m.chatId === scopeChatId)
        .map((m) => toHit(state, m))
      dispatch({
        type: 'messageSearch/resultsLoaded',
        results: scoped,
        partial: true,
        note: 'Scoped locally — server search is chat-wide',
      })
      return
    }
    dispatch({
      type: 'messageSearch/resultsLoaded',
      results: page.messages.map((m) => toHit(state, m)),
      partial: page.capped,
      note: page.capped ? 'Showing first results' : null,
    })
  } catch {
    // Server search unavailable: fall back to loaded history, clearly partial.
    const local = localSearchMessages(getState(), query, scopeChatId)
    if (local.length > 0) {
      dispatch({
        type: 'messageSearch/resultsLoaded',
        results: local,
        partial: true,
        note: 'Local results — server search unavailable',
      })
    } else {
      dispatch({ type: 'messageSearch/failed', note: 'Search unavailable' })
    }
  }
}

// ── Archive (Slice 10 follow-up) ─────────────────────────────────────────

/**
 * Archive or unarchive the open chat (toggles based on its current state).
 * Capability-gated: if the platform reports archive isn't supported for this
 * chat, we show a named notice and make no call (degrade visibly, invariant 8).
 * On success we refetch the chat (Beeper is the source of truth) and step back
 * to the list — the chat has left the current view. Never fakes success: a
 * failed call surfaces as a notice, and the chat's state is left untouched.
 */
export async function archiveChat(
  gateway: Gateway,
  dispatch: Dispatch,
  getState: () => AppState,
  chatId: string
): Promise<void> {
  const chat = getState().chats[chatId]
  if (chat === undefined) return
  if (chat.canArchive === false) {
    dispatch({ type: 'notice/shown', message: `Archive isn't supported for ${chat.network}.` })
    return
  }
  const archived = !chat.isArchived
  try {
    await gateway.setArchived(chatId, archived)
    // Reconcile from the server, then close the conversation and step out to the
    // list — the chat has left the current view (gmail-style).
    try {
      dispatch({ type: 'chats/upserted', chat: await gateway.getChat(chatId) })
    } catch {
      // Non-fatal: the next refresh/live event reconciles the row.
    }
    dispatch({ type: 'chat/selected', chatId: null }) // also clears any stale notice
    dispatch({ type: 'focus/changed', focus: 'inbox' })
    dispatch({ type: 'notice/shown', message: archived ? 'Chat archived.' : 'Chat unarchived.' })
  } catch (err) {
    const error = normalizeError(err)
    dispatch({
      type: 'notice/shown',
      message: `Couldn't ${archived ? 'archive' : 'unarchive'} — ${error.message}`,
    })
  }
}

// ── Live updates (Slice 6) ───────────────────────────────────────────────

/** Map a watch socket status to the app connection state (null = leave as-is). */
export function watchStatusToConnection(status: WatchStatus): ConnectionState | null {
  switch (status) {
    case 'connecting':
    case 'reconnecting':
      return 'connecting'
    case 'connected':
      return 'connected'
    case 'closed':
      return null
  }
}

/**
 * Apply one parsed watch event to state. Inbound messages flow through
 * `message/received` (deduped by id in the reducer, so replays are safe and
 * never trigger a send). A `chat.upserted` carries no chat body, so we refetch
 * the one chat to refresh its inbox row.
 */
export async function applyWatchEvent(
  gateway: Gateway,
  dispatch: Dispatch,
  event: WatchEvent
): Promise<void> {
  switch (event.kind) {
    case 'messages':
      for (const message of event.messages) dispatch({ type: 'message/received', message })
      break
    case 'chat-upserted':
      try {
        dispatch({ type: 'chats/upserted', chat: await gateway.getChat(event.chatId) })
      } catch {
        // A failed single-chat refresh is non-fatal; the next resync catches up.
      }
      break
    default:
      // ready / subscribed / error / deletes / unknown — nothing to apply yet.
      break
  }
}

/**
 * Close the gap after a reconnect: refetch chat summaries and the active chat's
 * recent tail. Dedup by id in the reducer means replayed events can't duplicate
 * messages (CLAUDE.md invariant 5 — no send on replay).
 */
export async function resyncAfterReconnect(
  gateway: Gateway,
  dispatch: Dispatch,
  activeChatId: string | null
): Promise<void> {
  await refreshChats(gateway, dispatch)
  if (activeChatId === null) return
  try {
    const page = await gateway.listMessages(activeChatId)
    dispatch({
      type: 'messages/loaded',
      chatId: activeChatId,
      messages: page.messages,
      page: 'newer',
      hasMoreOlder: page.hasMore,
      olderCursor: page.cursor,
    })
  } catch {
    // Non-fatal; live events will fill in.
  }
}

/** Page one step further back in a chat's history using the stored cursor. */
export async function loadOlderMessages(
  gateway: Gateway,
  dispatch: Dispatch,
  chatId: string,
  cursor: string
): Promise<void> {
  try {
    const page = await gateway.listMessages(chatId, { cursor })
    dispatch({
      type: 'messages/loaded',
      chatId,
      messages: page.messages,
      page: 'older',
      hasMoreOlder: page.hasMore,
      olderCursor: page.cursor,
    })
  } catch (err) {
    const error = normalizeError(err)
    dispatch({ type: 'error/raised', kind: error.kind, message: error.message })
  }
}
