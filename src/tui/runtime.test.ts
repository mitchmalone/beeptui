import { describe, expect, test } from 'bun:test'
import {
  applyWatchEvent,
  archiveChat,
  bootstrap,
  loadOlderMessages,
  openAttachment,
  openChat,
  refreshChats,
  resyncAfterReconnect,
  retrySend,
  runMessageSearch,
  saveAttachment,
  submitSend,
  watchStatusToConnection,
  type Gateway,
} from '@/tui/runtime.ts'
import { BeeperError } from '@/beeper/errors.ts'
import type { MessageHistoryPage, MessageSearchPage } from '@/beeper/client.ts'
import { reduce } from '@/state/reducer.ts'
import { initialState, type AppEvent, type AppState } from '@/state/types.ts'
import type { Account, ChatSummary, MessageSummary, ServerInfo } from '@/beeper/types.ts'

const server: ServerInfo = {
  appName: 'Beeper',
  appVersion: '4',
  os: 'darwin',
  arch: 'arm64',
  baseUrl: 'http://127.0.0.1:23373',
  port: 23373,
  remoteAccessEnabled: false,
  wsEventsUrl: 'ws://x/v1/ws',
  oauth: {
    authorizationEndpoint: 'http://x/oauth/authorize',
    tokenEndpoint: 'http://x/oauth/token',
    registrationEndpoint: 'http://x/oauth/register',
    introspectionEndpoint: 'http://x/oauth/introspect',
    revocationEndpoint: 'http://x/oauth/revoke',
    userinfoEndpoint: 'http://x/oauth/userinfo',
  },
}
const accounts: Account[] = [
  { id: 'a', network: 'WhatsApp', bridgeType: 'whatsapp', provider: 'local', displayName: 'Ada' },
]
const chats: ChatSummary[] = [
  {
    id: 'c1',
    accountId: 'a',
    network: 'WhatsApp',
    title: 'Grace',
    type: 'single',
    unreadCount: 0,
    isArchived: false,
    isMuted: false,
  },
]

function capture(): { dispatch: (e: AppEvent) => void; events: AppEvent[] } {
  const events: AppEvent[] = []
  return { events, dispatch: (e) => events.push(e) }
}

const historyMessages: MessageSummary[] = [
  {
    id: 'm1',
    chatId: 'c1',
    accountId: 'a',
    senderId: 'x',
    timestamp: 't',
    sortKey: '1',
    isSender: false,
    isUnread: false,
  },
]
const historyPage: MessageHistoryPage = {
  messages: historyMessages,
  hasMore: true,
  cursor: 'CUR-2',
}

function gateway(over: Partial<Gateway> = {}): Gateway {
  return {
    getInfo: async () => server,
    listAccounts: async () => accounts,
    listChats: async () => chats,
    listMessages: async () => historyPage,
    sendMessage: async () => ({ chatId: 'c1', pendingMessageId: 'srv-1' }),
    getChat: async () => chats[0]!,
    searchMessages: async () => ({ messages: [], scopeHonored: true, capped: false }),
    setArchived: async () => {},
    downloadAttachment: async () => ({ localPath: '/cache/beeper/file.png' }),
    ...over,
  }
}

const sendParams = {
  chatId: 'c1',
  clientId: 'cid-1',
  text: 'hi',
  timestamp: '2026-07-31T00:00:00.000Z',
}

describe('bootstrap', () => {
  test('happy path dispatches the full connect sequence ending in connected', async () => {
    const { dispatch, events } = capture()
    await bootstrap(gateway(), dispatch)
    expect(events.map((e) => e.type)).toEqual([
      'connection/changed', // connecting
      'server/loaded',
      'accounts/loaded',
      'chats/loaded',
      'error/cleared',
      'connection/changed', // connected
    ])
    expect(events.at(-1)).toEqual({ type: 'connection/changed', state: 'connected' })
  })

  test('unreachable Beeper → connecting then unreachable + error, no throw', async () => {
    const { dispatch, events } = capture()
    await bootstrap(
      gateway({
        getInfo: async () => {
          throw new BeeperError('unreachable', 'down')
        },
      }),
      dispatch
    )
    expect(
      events.find((e) => e.type === 'connection/changed' && e.state === 'unreachable')
    ).toBeDefined()
    expect(events.some((e) => e.type === 'error/raised')).toBe(true)
    // Never got to loading chats.
    expect(events.some((e) => e.type === 'chats/loaded')).toBe(false)
  })

  test('auth failure → unauthorized connection state', async () => {
    const { dispatch, events } = capture()
    await bootstrap(
      gateway({
        listAccounts: async () => {
          throw new BeeperError('unauthorized', 'nope')
        },
      }),
      dispatch
    )
    expect(
      events.find((e) => e.type === 'connection/changed' && e.state === 'unauthorized')
    ).toBeDefined()
  })

  test('normalizes a non-BeeperError throwable without crashing', async () => {
    const { dispatch, events } = capture()
    await bootstrap(
      gateway({
        getInfo: async () => {
          throw new Error('weird')
        },
      }),
      dispatch
    )
    expect(
      events.find((e) => e.type === 'connection/changed' && e.state === 'unreachable')
    ).toBeDefined()
  })
})

describe('refreshChats', () => {
  test('re-dispatches chats/loaded', async () => {
    const { dispatch, events } = capture()
    await refreshChats(gateway(), dispatch)
    expect(events).toEqual([{ type: 'chats/loaded', chats }])
  })
})

describe('openChat', () => {
  test('selects, focuses the conversation, and loads the initial page', async () => {
    const { dispatch, events } = capture()
    await openChat(gateway(), dispatch, 'c1')
    expect(events).toEqual([
      { type: 'chat/selected', chatId: 'c1' },
      { type: 'focus/changed', focus: 'conversation' },
      {
        type: 'messages/loaded',
        chatId: 'c1',
        messages: historyMessages,
        page: 'initial',
        hasMoreOlder: true,
        olderCursor: 'CUR-2',
      },
    ])
  })

  test('still selects + focuses even if the message load fails', async () => {
    const { dispatch, events } = capture()
    await openChat(
      gateway({
        listMessages: async () => {
          throw new BeeperError('unreachable', 'down')
        },
      }),
      dispatch,
      'c1'
    )
    expect(events.map((e) => e.type)).toEqual(['chat/selected', 'focus/changed', 'error/raised'])
  })
})

describe('submitSend', () => {
  test('optimistic pending, draft cleared, then reconciled to sent', async () => {
    const { dispatch, events } = capture()
    await submitSend(gateway(), dispatch, sendParams)
    expect(events.map((e) => e.type)).toEqual([
      'send/requested',
      'draft/changed', // cleared
      'send/succeeded',
    ])
    const requested = events[0]
    expect(requested).toMatchObject({ type: 'send/requested', clientId: 'cid-1', text: 'hi' })
    const succeeded = events[2]
    expect(succeeded).toMatchObject({ type: 'send/succeeded', clientId: 'cid-1' })
  })

  test('a failing send surfaces as send/failed, never a silent success', async () => {
    const { dispatch, events } = capture()
    await submitSend(
      gateway({
        sendMessage: async () => {
          throw new BeeperError('unreachable', 'down')
        },
      }),
      dispatch,
      sendParams
    )
    expect(events.map((e) => e.type)).toEqual(['send/requested', 'draft/changed', 'send/failed'])
  })
})

describe('retrySend', () => {
  test('re-attempts a failed send with send/retried, no new pending', async () => {
    const { dispatch, events } = capture()
    await retrySend(gateway(), dispatch, sendParams)
    expect(events.map((e) => e.type)).toEqual(['send/retried', 'send/succeeded'])
  })
})

describe('invariant 5: no implicit sends', () => {
  test('bootstrap, refreshChats, openChat, and loadOlder never emit send/requested', async () => {
    const { dispatch, events } = capture()
    await bootstrap(gateway(), dispatch)
    await refreshChats(gateway(), dispatch)
    await openChat(gateway(), dispatch, 'c1')
    await loadOlderMessages(gateway(), dispatch, 'c1', 'cur')
    expect(events.some((e) => e.type === 'send/requested')).toBe(false)
    expect(events.some((e) => e.type === 'send/succeeded')).toBe(false)
  })
})

describe('live updates', () => {
  test('watchStatusToConnection maps socket status to connection state', () => {
    expect(watchStatusToConnection('connecting')).toBe('connecting')
    expect(watchStatusToConnection('reconnecting')).toBe('connecting')
    expect(watchStatusToConnection('connected')).toBe('connected')
    expect(watchStatusToConnection('closed')).toBeNull()
  })

  test('applyWatchEvent dispatches message/received for each inbound message', async () => {
    const { dispatch, events } = capture()
    await applyWatchEvent(gateway(), dispatch, {
      kind: 'messages',
      chatId: 'c1',
      seq: 1,
      messages: [historyMessages[0]!, { ...historyMessages[0]!, id: 'm2' }],
    })
    expect(events.map((e) => e.type)).toEqual(['message/received', 'message/received'])
  })

  test('applyWatchEvent refetches the chat on chat-upserted', async () => {
    const { dispatch, events } = capture()
    await applyWatchEvent(gateway(), dispatch, { kind: 'chat-upserted', chatId: 'c1', seq: 2 })
    expect(events[0]).toMatchObject({ type: 'chats/upserted' })
  })

  test('applyWatchEvent ignores ready/subscribed/error frames', async () => {
    const { dispatch, events } = capture()
    await applyWatchEvent(gateway(), dispatch, { kind: 'ready' })
    await applyWatchEvent(gateway(), dispatch, { kind: 'error', code: 'X', message: 'y' })
    expect(events).toHaveLength(0)
  })

  test('resyncAfterReconnect refetches chats and the active tail', async () => {
    const { dispatch, events } = capture()
    await resyncAfterReconnect(gateway(), dispatch, 'c1')
    const types = events.map((e) => e.type)
    expect(types).toContain('chats/loaded')
    expect(types).toContain('messages/loaded')
  })
})

describe('loadOlderMessages', () => {
  test('fetches with the cursor and dispatches an older page', async () => {
    let usedCursor: string | undefined
    const { dispatch, events } = capture()
    await loadOlderMessages(
      gateway({
        listMessages: async (_id, opts) => {
          usedCursor = opts?.cursor
          return { messages: historyMessages, hasMore: false, cursor: null }
        },
      }),
      dispatch,
      'c1',
      'CUR-2'
    )
    expect(usedCursor).toBe('CUR-2')
    expect(events[0]).toMatchObject({ type: 'messages/loaded', page: 'older', hasMoreOlder: false })
  })
})

describe('runMessageSearch', () => {
  // State with one chat + two loaded messages, for hit enrichment + local fallback.
  const searchState: AppState = [
    { type: 'chats/loaded', chats } as AppEvent,
    {
      type: 'messages/loaded',
      chatId: 'c1',
      page: 'initial',
      messages: [
        { ...historyMessages[0]!, id: 'm1', text: 'Friday works for me' },
        { ...historyMessages[0]!, id: 'm2', text: 'Lunch?' },
      ],
    } as AppEvent,
  ].reduce(reduce, initialState)

  const getState = () => searchState

  const page = (over: Partial<MessageSearchPage> = {}): MessageSearchPage => ({
    messages: [],
    scopeHonored: true,
    capped: false,
    ...over,
  })

  test('server results map to hits with chat context, not partial when uncapped', async () => {
    const { dispatch, events } = capture()
    await runMessageSearch(
      gateway({
        searchMessages: async () =>
          page({ messages: [{ ...historyMessages[0]!, id: 's1', text: 'Friday!' }] }),
      }),
      dispatch,
      getState,
      'friday',
      null
    )
    expect(events.map((e) => e.type)).toEqual([
      'messageSearch/requested',
      'messageSearch/resultsLoaded',
    ])
    const loaded = events[1] as Extract<AppEvent, { type: 'messageSearch/resultsLoaded' }>
    expect(loaded.results[0]).toMatchObject({
      messageId: 's1',
      chatTitle: 'Grace',
      network: 'WhatsApp',
    })
    expect(loaded.partial).toBe(false)
  })

  test('capped server results are flagged partial with a note', async () => {
    const { dispatch, events } = capture()
    await runMessageSearch(
      gateway({ searchMessages: async () => page({ messages: [], capped: true }) }),
      dispatch,
      getState,
      'x',
      null
    )
    const loaded = events[1] as Extract<AppEvent, { type: 'messageSearch/resultsLoaded' }>
    expect(loaded.partial).toBe(true)
    expect(loaded.note).toContain('first')
  })

  test('a scope-ignoring server is scoped locally and labeled partial', async () => {
    const { dispatch, events } = capture()
    await runMessageSearch(
      gateway({
        searchMessages: async () =>
          page({
            scopeHonored: false,
            messages: [
              { ...historyMessages[0]!, id: 'in', chatId: 'c1', text: 'in scope' },
              { ...historyMessages[0]!, id: 'out', chatId: 'other', text: 'out of scope' },
            ],
          }),
      }),
      dispatch,
      getState,
      'scope',
      'c1'
    )
    const loaded = events[1] as Extract<AppEvent, { type: 'messageSearch/resultsLoaded' }>
    expect(loaded.results.map((r) => r.messageId)).toEqual(['in']) // out-of-scope hit dropped
    expect(loaded.partial).toBe(true)
    expect(loaded.note).toContain('locally')
  })

  test('server failure falls back to loaded history, labeled partial', async () => {
    const { dispatch, events } = capture()
    await runMessageSearch(
      gateway({
        searchMessages: async () => {
          throw new BeeperError('unreachable', 'down')
        },
      }),
      dispatch,
      getState,
      'friday',
      null
    )
    const loaded = events[1] as Extract<AppEvent, { type: 'messageSearch/resultsLoaded' }>
    expect(loaded.results.map((r) => r.messageId)).toEqual(['m1']) // local match on 'Friday works'
    expect(loaded.partial).toBe(true)
    expect(loaded.note).toContain('unavailable')
  })

  test('server failure with no local match yields a named error state', async () => {
    const { dispatch, events } = capture()
    await runMessageSearch(
      gateway({
        searchMessages: async () => {
          throw new BeeperError('unreachable', 'down')
        },
      }),
      dispatch,
      getState,
      'zzz-nomatch',
      null
    )
    expect(events[1]).toMatchObject({ type: 'messageSearch/failed' })
  })
})

describe('archiveChat', () => {
  const c = (over: Partial<ChatSummary>): ChatSummary => ({ ...chats[0]!, ...over })

  // Store-backed harness: dispatch threads through the real reducer so getState
  // reflects the reconcile (the "select next" logic reads state post-upsert).
  function harness(initialChats: ChatSummary[], selectedId: string | null = null) {
    let state = reduce(initialState, { type: 'chats/loaded', chats: initialChats })
    if (selectedId !== null) state = reduce(state, { type: 'chat/selected', chatId: selectedId })
    const events: AppEvent[] = []
    const dispatch = (e: AppEvent): void => {
      events.push(e)
      state = reduce(state, e)
    }
    return { events, dispatch, getState: () => state }
  }

  test('archives an active chat: calls the adapter, reconciles, returns to the list', async () => {
    const h = harness([c({ id: 'c1', isArchived: false, canArchive: true })], 'c1')
    const archivedArgs: boolean[] = []
    await archiveChat(
      gateway({
        setArchived: async (_id, a) => void archivedArgs.push(a),
        getChat: async () => c({ id: 'c1', isArchived: true, canArchive: true }),
      }),
      h.dispatch,
      h.getState,
      'c1'
    )
    expect(archivedArgs).toEqual([true]) // toggled active → archived
    expect(h.getState().chats.c1?.isArchived).toBe(true)
    expect(h.getState().selectedChatId).toBeNull() // only chat → nothing to land on
    expect(h.getState().focus).toBe('inbox')
    expect(h.events.at(-1)).toMatchObject({ type: 'notice/shown', message: 'Chat archived.' })
  })

  test('keeps the list cursor: lands on the chat that takes the archived one’s place', async () => {
    const h = harness(
      [
        c({ id: 'a', lastActivity: '2026-07-31T02:00:00.000Z', canArchive: true }),
        c({ id: 'b', lastActivity: '2026-07-31T01:00:00.000Z', canArchive: true }),
      ],
      'a'
    )
    await archiveChat(
      gateway({ getChat: async () => c({ id: 'a', isArchived: true, canArchive: true }) }),
      h.dispatch,
      h.getState,
      'a'
    )
    expect(h.getState().selectedChatId).toBe('b') // successor selected, not a jump to top
  })

  test('archiving the bottom chat lands on the one above it', async () => {
    const h = harness(
      [
        c({ id: 'a', lastActivity: '2026-07-31T02:00:00.000Z', canArchive: true }),
        c({ id: 'b', lastActivity: '2026-07-31T01:00:00.000Z', canArchive: true }),
      ],
      'b' // bottom of the list
    )
    await archiveChat(
      gateway({ getChat: async () => c({ id: 'b', isArchived: true, canArchive: true }) }),
      h.dispatch,
      h.getState,
      'b'
    )
    expect(h.getState().selectedChatId).toBe('a') // no chat below → the one above
  })

  test('unarchives an archived chat (toggles the other way)', async () => {
    const h = harness([c({ id: 'c1', isArchived: true, canArchive: true })], 'c1')
    const archivedArgs: boolean[] = []
    await archiveChat(
      gateway({
        setArchived: async (_id, a) => void archivedArgs.push(a),
        getChat: async () => c({ id: 'c1', isArchived: false, canArchive: true }),
      }),
      h.dispatch,
      h.getState,
      'c1'
    )
    expect(archivedArgs).toEqual([false])
    expect(h.events.at(-1)).toMatchObject({ type: 'notice/shown', message: 'Chat unarchived.' })
  })

  test('unsupported capability → named notice, no adapter call (degrade visibly)', async () => {
    const h = harness([c({ id: 'c1', canArchive: false })], 'c1')
    let called = false
    await archiveChat(
      gateway({ setArchived: async () => void (called = true) }),
      h.dispatch,
      h.getState,
      'c1'
    )
    expect(called).toBe(false)
    expect(h.events).toEqual([
      { type: 'notice/shown', message: 'Archiving not available for WhatsApp via Beeper.' },
    ])
  })

  test('optimistic flip is applied before the call resolves', async () => {
    const h = harness([c({ id: 'c1', isArchived: false, canArchive: true })], 'c1')
    let resolveCall = (): void => {}
    const pending = archiveChat(
      gateway({ setArchived: () => new Promise<void>((r) => (resolveCall = r)) }),
      h.dispatch,
      h.getState,
      'c1'
    )
    // The call hasn't resolved yet, but the UI already reflects the archive.
    expect(h.getState().chats.c1?.isArchived).toBe(true)
    resolveCall()
    await pending
    expect(h.getState().chats.c1?.isArchived).toBe(true) // stays archived on success
  })

  test('a failed archive rolls back the optimistic flip and says why', async () => {
    const h = harness([c({ id: 'c1', isArchived: false, canArchive: true })], 'c1')
    await archiveChat(
      gateway({
        setArchived: async () => {
          throw new BeeperError('unreachable', 'down')
        },
      }),
      h.dispatch,
      h.getState,
      'c1'
    )
    expect(h.getState().chats.c1?.isArchived).toBe(false) // reverted to original
    expect(h.getState().notice).toContain("Couldn't archive")
    const upserts = h.events.filter((e) => e.type === 'chats/upserted')
    expect(upserts).toHaveLength(2) // optimistic flip + rollback
  })
})

describe('reply send', () => {
  test('carries replyToId to the adapter and into the send/requested event', async () => {
    let sentOptions: { replyToId?: string } | undefined
    const { dispatch, events } = capture()
    await submitSend(
      gateway({
        sendMessage: async (_chatId, _text, options) => {
          sentOptions = options
          return { chatId: 'c1', pendingMessageId: 'srv-1' }
        },
      }),
      dispatch,
      { ...sendParams, replyToId: 'msg-orig' }
    )
    expect(sentOptions).toMatchObject({ replyToId: 'msg-orig' })
    expect(events[0]).toMatchObject({ type: 'send/requested', replyToId: 'msg-orig' })
  })
})

describe('attachments', () => {
  /** State with c1 open, a message selected that carries an image attachment. */
  function withSelectedAttachment(attachmentOver: Record<string, unknown> = {}): AppState {
    const message: MessageSummary = {
      id: 'm1',
      chatId: 'c1',
      accountId: 'a',
      senderId: 'x',
      timestamp: 't',
      sortKey: '1',
      isSender: false,
      isUnread: false,
      attachments: [{ kind: 'image', fileName: 'pic.png', id: 'mxc://x/1', ...attachmentOver }],
    }
    const events: AppEvent[] = [
      { type: 'chats/loaded', chats },
      { type: 'chat/selected', chatId: 'c1' },
      { type: 'messages/loaded', chatId: 'c1', page: 'initial', messages: [message] },
      { type: 'messageSelection/started' },
    ]
    return events.reduce(reduce, initialState)
  }

  test('openAttachment downloads then opens the local path; path never appears in a notice', async () => {
    const opened: string[] = []
    const { dispatch, events } = capture()
    await openAttachment(
      gateway({ downloadAttachment: async () => ({ localPath: '/secret/cache/pic.png' }) }),
      dispatch,
      () => withSelectedAttachment(),
      async (p) => {
        opened.push(p)
      }
    )
    expect(opened).toEqual(['/secret/cache/pic.png'])
    const notices = events
      .filter((e) => e.type === 'notice/shown')
      .map((e) => (e as { message: string }).message)
    expect(notices).toContain('Opened attachment.')
    // invariant 6: the local path must never leak into a user-facing notice.
    expect(notices.some((m) => m.includes('/secret/cache'))).toBe(false)
  })

  test('openAttachment reports a failure honestly and does not open anything', async () => {
    let openerCalled = false
    const { dispatch, events } = capture()
    await openAttachment(
      gateway({
        downloadAttachment: async () => {
          throw new BeeperError('unreachable', 'download failed')
        },
      }),
      dispatch,
      () => withSelectedAttachment(),
      async () => {
        openerCalled = true
      }
    )
    expect(openerCalled).toBe(false)
    const notices = events.map((e) => (e as { message?: string }).message)
    expect(notices.some((m) => m?.startsWith("Couldn't open attachment"))).toBe(true)
  })

  test('openAttachment on a message with no attachment shows a named notice, no download', async () => {
    let downloaded = false
    const { dispatch, events } = capture()
    const plain: AppState = [
      { type: 'chats/loaded', chats } as AppEvent,
      { type: 'chat/selected', chatId: 'c1' } as AppEvent,
      {
        type: 'messages/loaded',
        chatId: 'c1',
        page: 'initial',
        messages: [
          {
            id: 'm1',
            chatId: 'c1',
            accountId: 'a',
            senderId: 'x',
            timestamp: 't',
            sortKey: '1',
            isSender: false,
            isUnread: false,
          },
        ],
      } as AppEvent,
      { type: 'messageSelection/started' } as AppEvent,
    ].reduce(reduce, initialState)
    await openAttachment(
      gateway({
        downloadAttachment: async () => {
          downloaded = true
          return { localPath: '/x' }
        },
      }),
      dispatch,
      () => plain,
      async () => {}
    )
    expect(downloaded).toBe(false)
    expect((events[0] as { message: string }).message).toBe(
      'No attachment on the selected message.'
    )
  })

  test('saveAttachment copies to Downloads and names the saved file, not its path', async () => {
    const saved: Array<{ path: string; name: string }> = []
    const { dispatch, events } = capture()
    await saveAttachment(
      gateway({ downloadAttachment: async () => ({ localPath: '/secret/cache/pic.png' }) }),
      dispatch,
      () => withSelectedAttachment(),
      async (path, name) => {
        saved.push({ path, name })
        return { savedName: name }
      }
    )
    expect(saved).toEqual([{ path: '/secret/cache/pic.png', name: 'pic.png' }])
    const notices = events
      .filter((e) => e.type === 'notice/shown')
      .map((e) => (e as { message: string }).message)
    expect(notices).toContain('Saved pic.png to Downloads.')
    expect(notices.some((m) => m.includes('/secret/cache'))).toBe(false)
  })
})
