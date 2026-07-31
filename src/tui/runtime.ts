import type {
  MessageHistoryPage,
  MessageSearchOptions,
  MessageSearchPage,
} from '@/beeper/client.ts'
import { BeeperError, normalizeError } from '@/beeper/errors.ts'
import type {
  Account,
  AttachmentSummary,
  ChatSummary,
  SendResult,
  ServerInfo,
} from '@/beeper/types.ts'
import type { WatchEvent } from '@/beeper/watch-protocol.ts'
import type { WatchStatus } from '@/beeper/watch.ts'
import type { AppEvent, AppState, ConnectionState } from '@/state/types.ts'
import { selectInboxRows, selectSelectedMessage } from '@/state/selectors.ts'
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
  sendMessage(chatId: string, text: string, options?: { replyToId?: string }): Promise<SendResult>
  getChat(chatId: string): Promise<ChatSummary>
  searchMessages(query: string, options?: MessageSearchOptions): Promise<MessageSearchPage>
  setArchived(chatId: string, archived: boolean): Promise<void>
  downloadAttachment(id: string): Promise<{ localPath: string }>
}

export interface SendParams {
  chatId: string
  /** Stable client id linking the optimistic message to its result. */
  clientId: string
  text: string
  /** ISO timestamp (injected by the caller so this stays deterministic). */
  timestamp: string
  /** When present, send as a reply to this message id (capability-gated upstream). */
  replyToId?: string
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

/** Attempt delivery, reconciling to sent or failed. Shared by send + retry.
 *  On success we only confirm the optimistic message (flip it to 'sent'); the
 *  real server message arrives via the live echo and reconciles by text in the
 *  reducer — so we never synthesize a duplicate with a guessed id. */
async function attemptSend(
  gateway: Gateway,
  dispatch: Dispatch,
  params: SendParams
): Promise<void> {
  try {
    await gateway.sendMessage(
      params.chatId,
      params.text,
      params.replyToId !== undefined ? { replyToId: params.replyToId } : {}
    )
    dispatch({ type: 'send/succeeded', chatId: params.chatId, clientId: params.clientId })
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
    ...(params.replyToId !== undefined ? { replyToId: params.replyToId } : {}),
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
 * Archive or unarchive a chat (toggles based on its current state). Works from
 * either the chat list or an open conversation — the target is passed in, not
 * assumed to be the open chat. Capability-gated: if the platform reports archive
 * isn't supported, we show a named notice and make no call (degrade visibly,
 * invariant 8).
 *
 * **Optimistic:** the flip is applied to state immediately (so the UI responds
 * instantly) and the network call runs in the background. On failure we revert
 * the flip and surface a named notice — never a silent fake success: a failed
 * archive visibly reappears and says why. The full chat object is reconciled
 * later by the live `chat.upserted` event. The selection moves to the
 * neighbouring chat (below, else above) so the list cursor stays put for quick
 * successive archiving.
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
  // Neighbour to land on, chosen from the list that still contains the target.
  const rows = selectInboxRows(getState())
  const index = rows.findIndex((r) => r.id === chatId)
  const nextId = index === -1 ? null : (rows[index + 1]?.id ?? rows[index - 1]?.id ?? null)

  // Apply the change up front — instant feedback.
  dispatch({ type: 'chats/upserted', chat: { ...chat, isArchived: archived } })
  dispatch({ type: 'chat/selected', chatId: nextId })
  dispatch({ type: 'focus/changed', focus: 'inbox' })
  dispatch({ type: 'notice/shown', message: archived ? 'Chat archived.' : 'Chat unarchived.' })

  try {
    await gateway.setArchived(chatId, archived)
  } catch (err) {
    // Roll back the optimistic flip and say why.
    const current = getState().chats[chatId] ?? chat
    dispatch({ type: 'chats/upserted', chat: { ...current, isArchived: chat.isArchived } })
    const error = normalizeError(err)
    dispatch({
      type: 'notice/shown',
      message: `Couldn't ${archived ? 'archive' : 'unarchive'} — ${error.message}`,
    })
  }
}

// ── Attachments (Slice 11) ───────────────────────────────────────────────

/** Opens a local file with the OS handler. Injected so the runtime stays pure /
 *  testable; the launch layer supplies the real `open`/`xdg-open` implementation.
 *  The path is passed as a process argument, never logged (invariant 6). */
export type FileOpener = (localPath: string) => Promise<void>

/** Copies a downloaded file into the user's Downloads dir, returning the saved
 *  path (for the notice's *filename*, never the full path). Injected like `FileOpener`. */
export type FileSaver = (localPath: string, fileName: string) => Promise<{ savedName: string }>

/** The first attachment of the currently-selected message, or a reason it can't
 *  be acted on. Pure — shared by open + save so their preconditions match. */
function selectableAttachment(
  getState: () => AppState
): { attachment: AttachmentSummary } | { reason: string } {
  const message = selectSelectedMessage(getState())
  const attachment = message?.attachments?.[0]
  if (attachment === undefined) return { reason: 'No attachment on the selected message.' }
  if (attachment.id === undefined) return { reason: "This attachment can't be opened." }
  return { attachment }
}

/**
 * Download the selected message's first attachment and open it in the OS viewer.
 * Progress + failure are surfaced as notices; a failure never fakes success
 * (invariant 8) and no attachment path is ever put in a notice or log
 * (invariant 6 — the notice names the file, not its location).
 */
export async function openAttachment(
  gateway: Gateway,
  dispatch: Dispatch,
  getState: () => AppState,
  opener: FileOpener
): Promise<void> {
  const picked = selectableAttachment(getState)
  if ('reason' in picked) {
    dispatch({ type: 'notice/shown', message: picked.reason })
    return
  }
  const { attachment } = picked
  dispatch({ type: 'notice/shown', message: 'Opening attachment…' })
  try {
    const { localPath } = await gateway.downloadAttachment(attachment.id as string)
    await opener(localPath)
    dispatch({ type: 'notice/shown', message: 'Opened attachment.' })
  } catch (err) {
    const error = normalizeError(err)
    dispatch({ type: 'notice/shown', message: `Couldn't open attachment — ${error.message}` })
  }
}

/**
 * Download the selected message's first attachment and copy it to Downloads.
 * Same honesty guarantees as `openAttachment`; the success notice names the
 * saved file, not the path.
 */
export async function saveAttachment(
  gateway: Gateway,
  dispatch: Dispatch,
  getState: () => AppState,
  saver: FileSaver
): Promise<void> {
  const picked = selectableAttachment(getState)
  if ('reason' in picked) {
    dispatch({ type: 'notice/shown', message: picked.reason })
    return
  }
  const { attachment } = picked
  dispatch({ type: 'notice/shown', message: 'Saving attachment…' })
  try {
    const { localPath } = await gateway.downloadAttachment(attachment.id as string)
    const { savedName } = await saver(localPath, attachment.fileName ?? attachment.kind)
    dispatch({ type: 'notice/shown', message: `Saved ${savedName} to Downloads.` })
  } catch (err) {
    const error = normalizeError(err)
    dispatch({ type: 'notice/shown', message: `Couldn't save attachment — ${error.message}` })
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
