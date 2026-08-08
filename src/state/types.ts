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

/** The rail cursor id for the Archived toggle entry (not a real scope). */
export const RAIL_ARCHIVED_ID = 'archived'

/** Rail id for the Settings entry, pinned below the Archived toggle. Not a
 *  scope and not a toggle — landing on it and pressing ⏎ opens a flyout. */
export const RAIL_SETTINGS_ID = 'settings'

/** Which pane has keyboard focus. Ordered outer→inner: the network rail (filter),
 *  the chat list (inbox), the conversation, and the compose box within it. `Esc`
 *  walks this back out toward the rail. */
export type FocusTarget = 'rail' | 'inbox' | 'conversation' | 'compose'

/** Modal overlay on top of the panes, if any. */
export type Overlay =
  | 'none'
  | 'search'
  | 'help'
  | 'messageSearch'
  /** The ENTER action menu on the selected message ("dropdown"). */
  | 'conversationActions'
  /** The limited emoji picker reached from the action menu's React option. */
  | 'emojiPicker'
  /** The Settings flyout, opened from the Net rail's Settings entry. */
  | 'settingsMenu'
  /** The theme list, reached from Settings → Theme. */
  | 'themePicker'

/** One message-search hit, enriched with the chat context the palette renders. */
export interface MessageSearchHit {
  messageId: string
  chatId: string
  chatTitle: string
  network: string
  senderName: string
  timestamp: string
  snippet: string
}

export type MessageSearchStatus = 'idle' | 'searching' | 'done' | 'error'

/**
 * Message-search overlay state. Unlike chat search (a pure local fuzzy filter),
 * message search runs through the Beeper adapter, so it carries an async status
 * and an honest `partial`/`note` for capped or fallback (local) results.
 */
export interface MessageSearchState {
  query: string
  status: MessageSearchStatus
  results: MessageSearchHit[]
  selectedIndex: number
  /** Coverage is partial: a local fallback, or the server ignored our scope. */
  partial: boolean
  /** Short reason for partial/failed results, or null. */
  note: string | null
  /** Chat the search is scoped to (the active chat when opened), or null. */
  scopeChatId: string | null
}

export const initialMessageSearch: MessageSearchState = {
  query: '',
  status: 'idle',
  results: [],
  selectedIndex: 0,
  partial: false,
  note: null,
  scopeChatId: null,
}

/** Network-rail scope: 'all' networks, or a specific account id. */
export type FilterScope = 'all' | (string & {})

/**
 * Inbox filter state, driven by the `slk`-style network rail. `scope` selects a
 * network (account) or all; `archived` switches active↔archived views (composes
 * with scope); `unreadOnly` restricts to chats with unread messages.
 */
export interface InboxFilter {
  scope: FilterScope
  archived: boolean
  unreadOnly: boolean
}

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

/** Layout density: `comfortable` keeps padding between rows/messages;
 *  `compact` strips it to fit more on screen. Toggled at runtime (`D`) and
 *  seeded from `config.theme.density`. */
export type Density = 'comfortable' | 'compact'

export interface AppState {
  connection: ConnectionState
  accounts: Record<string, Account>
  accountOrder: string[]
  chats: Record<string, ChatSummary>
  /** Chat ids ordered for the inbox (most recent activity first). */
  chatOrder: string[]
  messagesByChat: Record<string, ChatMessages>
  selectedChatId: string | null
  /** Id of the message the selection cursor is on within the active
   *  conversation, or null when scrolling normally. Cleared on chat change. */
  selectedMessageId: string | null
  /** Id of the message being replied to in the active conversation, or null.
   *  When set, the compose box shows the quoted reply context. Cleared on chat
   *  change, on send, and on cancel. */
  replyTo: string | null
  /** Which pane the keyboard drives. */
  focus: FocusTarget
  /** Rows the active conversation is scrolled up from the newest message. */
  conversationOffset: number
  /** Last measured message-viewport height (rows), so the reducer can keep the
   *  selection cursor on screen. 0 until the view first measures it. */
  viewportRows: number
  /** Last measured terminal width (columns). Message height depends on where
   *  text wraps, so the reducer needs the same width the view renders at.
   *  0 until the view first measures it. */
  viewportCols: number
  /** Cursor into the conversation action menu (while that overlay is open). */
  actionCursor: number
  /** Cursor into the emoji picker (while that overlay is open). */
  emojiCursor: number
  /** Cursor into the Settings flyout (while that overlay is open). */
  settingsCursor: number
  /** Cursor into the theme list (while that overlay is open). */
  themeCursor: number
  /** True when messages arrived in the active chat while scrolled up. */
  newMessagesBelow: boolean
  /** Chat id whose older page has been requested and not yet arrived, else null.
   *  Set when the message cursor tries to move past the oldest loaded message;
   *  the App watches it, fetches, and `messages/loaded` clears it. Doubles as
   *  the guard that stops a held-down arrow key stacking requests. */
  olderPagePending: string | null
  /** The open modal overlay (search palette / help), or 'none'. */
  overlay: Overlay
  /** Current chat-search query (only meaningful while the search overlay is open). */
  searchQuery: string
  /** Inbox filter driven by the network rail (scope / archived / unread). */
  filter: InboxFilter
  /** Which rail entry the cursor is on: `'all'`, an accountId, or `'archived'`
   *  (the toggle entry). Tracks `filter.scope` for scope entries; decouples only
   *  while resting on `'archived'`. */
  railCursor: string
  /** Message-search overlay state (adapter-backed; see `initialMessageSearch`). */
  messageSearch: MessageSearchState
  /** Per-chat draft text (persisted across restarts by `src/store`). */
  drafts: Record<string, string>
  server: ServerInfo | null
  error: { kind: BeeperErrorKind; message: string } | null
  /** Ephemeral one-line notice (e.g. archive result / unsupported action). Shown
   *  in the status bar until the next navigation clears it. */
  notice: string | null
  /** Layout density (seeded from config; toggled with `D`). */
  density: Density
  /** Selected theme name (seeded from config; cycled with `t`). Resolved to a
   *  `Theme` by the App via the launch-built registry. */
  themeName: string
}

export const initialState: AppState = {
  connection: 'idle',
  accounts: {},
  accountOrder: [],
  chats: {},
  chatOrder: [],
  messagesByChat: {},
  selectedChatId: null,
  selectedMessageId: null,
  replyTo: null,
  focus: 'inbox',
  conversationOffset: 0,
  viewportRows: 0,
  viewportCols: 0,
  actionCursor: 0,
  emojiCursor: 0,
  settingsCursor: 0,
  themeCursor: 0,
  newMessagesBelow: false,
  olderPagePending: null,
  overlay: 'none',
  searchQuery: '',
  filter: { scope: 'all', archived: false, unreadOnly: false },
  railCursor: 'all',
  messageSearch: initialMessageSearch,
  drafts: {},
  server: null,
  error: null,
  notice: null,
  density: 'comfortable',
  themeName: 'system',
}

/**
 * All state transitions. Discriminated by `type`. Covers adapter results, user
 * intents, and live events (fed by the adapter's WebSocket watch).
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
  /** Replace a chat's loaded window wholesale (messages/loaded merges). The
   *  demo scenario loop uses this to reset a chat at the top of each cycle. */
  | { type: 'messages/replaced'; chatId: string; messages: MessageSummary[] }
  | { type: 'chat/selected'; chatId: string | null }
  | { type: 'messageSelection/started' }
  | { type: 'messageSelection/moved'; delta: number }
  | { type: 'messageSelection/cleared' }
  | { type: 'reply/started'; messageId: string }
  | { type: 'reply/cancelled' }
  | { type: 'focus/changed'; focus: FocusTarget }
  | { type: 'overlay/opened'; overlay: Exclude<Overlay, 'none'> }
  | { type: 'overlay/closed' }
  /** The conversation viewport measured `rows` tall and the terminal `cols`
   *  wide (from the view). Both are needed: height in rows bounds the window,
   *  width decides where messages wrap and therefore how tall they are. */
  | { type: 'viewport/measured'; rows: number; cols: number }
  /** Move the action-menu cursor (the ENTER dropdown). */
  | { type: 'actionMenu/moved'; delta: number }
  /** Move the Settings-flyout cursor. */
  | { type: 'settingsMenu/moved'; delta: number }
  /** Move the theme-list cursor. `count` is the registry size — the App owns the
   *  registry, so the reducer is told how far it may travel rather than guessing. */
  | { type: 'themePicker/moved'; delta: number; count: number }
  /** Move the emoji-picker cursor. */
  | { type: 'emojiPicker/moved'; delta: number }
  | { type: 'search/queryChanged'; query: string }
  | { type: 'filter/scopeCycled'; direction: 1 | -1 }
  | { type: 'filter/scopeSelected'; scope: FilterScope }
  /** Move the rail cursor over ['all', ...accounts, 'archived']. */
  | { type: 'rail/cursorMoved'; direction: 1 | -1 }
  | { type: 'filter/archivedToggled' }
  | { type: 'filter/unreadToggled' }
  | { type: 'density/toggled' }
  | { type: 'theme/selected'; name: string }
  | { type: 'messageSearch/opened'; scopeChatId: string | null }
  | { type: 'messageSearch/queryChanged'; query: string }
  | { type: 'messageSearch/requested' }
  | {
      type: 'messageSearch/resultsLoaded'
      results: MessageSearchHit[]
      partial: boolean
      note: string | null
    }
  | { type: 'messageSearch/failed'; note: string }
  | { type: 'messageSearch/selectionMoved'; delta: 1 | -1 }
  | { type: 'messageSearch/closed' }
  | { type: 'notice/shown'; message: string }
  | { type: 'notice/cleared' }
  | { type: 'draft/changed'; chatId: string; text: string }
  | {
      type: 'send/requested'
      chatId: string
      clientId: string
      text: string
      timestamp: string
      /** When present, this send is a reply to the given message id. */
      replyToId?: string
    }
  | { type: 'send/succeeded'; chatId: string; clientId: string }
  | { type: 'send/failed'; chatId: string; clientId: string }
  | { type: 'send/retried'; chatId: string; clientId: string }
  | { type: 'error/raised'; kind: BeeperErrorKind; message: string }
  | { type: 'error/cleared' }

export type MessagePage = 'initial' | 'older' | 'newer'

/** Cap on retained messages per chat (bounded memory; CLAUDE.md). */
export const MAX_MESSAGES_PER_CHAT = 200

/** Sentinel sort prefix that keeps optimistic (pending) messages after all
 *  server messages until the real sortKey arrives. U+FFFF is a Unicode
 *  noncharacter: it sorts after every valid code point and can never appear in
 *  a legitimate server sort key. */
export const PENDING_SORT_PREFIX = '\uFFFF'
