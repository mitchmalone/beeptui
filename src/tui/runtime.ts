import type { MessageHistoryPage } from '@/beeper/client.ts'
import { BeeperError, normalizeError } from '@/beeper/errors.ts'
import type {
  Account,
  ChatSummary,
  MessageSummary,
  SendResult,
  ServerInfo,
} from '@/beeper/types.ts'
import { PENDING_SORT_PREFIX, type AppEvent } from '@/state/types.ts'

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
