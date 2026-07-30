import type { Account, ChatSummary, MessageSummary, ServerInfo } from '@/beeper/types.ts'
import type { BeeperErrorKind } from '@/beeper/errors.ts'

/**
 * Application state model. Pure data — this module and the reducer/selectors
 * import no I/O (no adapter runtime, no OpenTUI); entity types are the adapter's
 * domain models (type-only, erased at build) so nothing is duplicated
 * (CLAUDE.md invariant 4).
 */

export type ConnectionState =
  | 'idle' // nothing attempted yet
  | 'connecting'
  | 'connected'
  | 'unreachable' // Beeper Desktop not reachable
  | 'unauthorized' // token missing/rejected

export type MessageDeliveryStatus = 'sent' | 'pending' | 'failed'

/** Which pane has keyboard focus. */
export type FocusTarget = 'inbox' | 'conversation' | 'compose'

/**
 * A message in state. Extends the adapter's summary with local delivery status
 * and, for optimistic sends, the `clientId` used to reconcile the server echo.
 * `id` is the server id once known, or the `clientId` while pending.
 */
export interface MessageEntity extends MessageSummary {
  status: MessageDeliveryStatus
  clientId?: string
}

/** Ordered, bounded message window for one chat. `items` is ascending by sortKey. */
export interface ChatMessages {
  items: MessageEntity[]
  hasMoreOlder: boolean
  /** Opaque adapter cursor for fetching the next older page. */
  olderCursor: string | null
}

export interface AppState {
  connection: ConnectionState
  accounts: Record<string, Account>
  accountOrder: string[]
  chats: Record<string, ChatSummary>
  /** Chat ids ordered for the inbox (most recent activity first). */
  chatOrder: string[]
  messagesByChat: Record<string, ChatMessages>
  selectedChatId: string | null
  /** Which pane the keyboard drives. */
  focus: FocusTarget
  /** Rows the active conversation is scrolled up from the newest message. */
  conversationOffset: number
  /** True when messages arrived in the active chat while scrolled up. */
  newMessagesBelow: boolean
  /** Per-chat draft text (state only; persistence is Slice 7). */
  drafts: Record<string, string>
  server: ServerInfo | null
  error: { kind: BeeperErrorKind; message: string } | null
}

export const initialState: AppState = {
  connection: 'idle',
  accounts: {},
  accountOrder: [],
  chats: {},
  chatOrder: [],
  messagesByChat: {},
  selectedChatId: null,
  focus: 'inbox',
  conversationOffset: 0,
  newMessagesBelow: false,
  drafts: {},
  server: null,
  error: null,
}

/**
 * All state transitions. Discriminated by `type`. Covers adapter results, user
 * intents, and live events (shape defined now, fed by the WebSocket in Slice 6).
 */
export type AppEvent =
  | { type: 'connection/changed'; state: ConnectionState }
  | { type: 'server/loaded'; server: ServerInfo }
  | { type: 'accounts/loaded'; accounts: Account[] }
  | { type: 'chats/loaded'; chats: ChatSummary[] }
  | { type: 'chats/upserted'; chat: ChatSummary }
  | {
      type: 'messages/loaded'
      chatId: string
      messages: MessageSummary[]
      page: MessagePage
      hasMoreOlder?: boolean
      olderCursor?: string | null
    }
  | { type: 'message/received'; message: MessageSummary }
  | { type: 'chat/selected'; chatId: string | null }
  | { type: 'focus/changed'; focus: FocusTarget }
  | { type: 'conversation/scrolled'; delta: number }
  | { type: 'draft/changed'; chatId: string; text: string }
  | { type: 'send/requested'; chatId: string; clientId: string; text: string; timestamp: string }
  | { type: 'send/succeeded'; chatId: string; clientId: string; message: MessageSummary }
  | { type: 'send/failed'; chatId: string; clientId: string }
  | { type: 'send/retried'; chatId: string; clientId: string }
  | { type: 'error/raised'; kind: BeeperErrorKind; message: string }
  | { type: 'error/cleared' }

export type MessagePage = 'initial' | 'older' | 'newer'

/** Cap on retained messages per chat (bounded memory; CLAUDE.md). */
export const MAX_MESSAGES_PER_CHAT = 200

/** Sentinel sort prefix that keeps optimistic (pending) messages after all
 *  server messages until the real sortKey arrives. Server keys never use it. */
export const PENDING_SORT_PREFIX = '￿'
