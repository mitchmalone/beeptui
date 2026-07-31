import { describe, expect, test } from 'bun:test'
import {
  applyWatchEvent,
  archiveChat,
  bootstrap,
  loadOlderMessages,
  openChat,
  refreshChats,
  resyncAfterReconnect,
  retrySend,
  runMessageSearch,
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
  const stateWith = (over: Partial<ChatSummary>): AppState =>
    reduce(initialState, { type: 'chats/loaded', chats: [{ ...chats[0]!, ...over }] })

  test('archives an active chat: calls the adapter, reconciles, steps back to the list', async () => {
    const { dispatch, events } = capture()
    const archivedArgs: boolean[] = []
    await archiveChat(
      gateway({
        setArchived: async (_id, archived) => {
          archivedArgs.push(archived)
        },
        getChat: async () => ({ ...chats[0]!, isArchived: true }),
      }),
      dispatch,
      () => stateWith({ isArchived: false, canArchive: true }),
      'c1'
    )
    expect(archivedArgs).toEqual([true]) // toggled from active → archived
    expect(events.map((e) => e.type)).toEqual([
      'chats/upserted',
      'chat/selected', // close the conversation
      'focus/changed',
      'notice/shown',
    ])
    expect(events.at(-1)).toMatchObject({ type: 'notice/shown', message: 'Chat archived.' })
    expect(events).toContainEqual({ type: 'chat/selected', chatId: null })
    expect(events[2]).toMatchObject({ type: 'focus/changed', focus: 'inbox' })
  })

  test('unarchives an archived chat (toggles the other way)', async () => {
    const { dispatch, events } = capture()
    const archivedArgs: boolean[] = []
    await archiveChat(
      gateway({ setArchived: async (_id, a) => void archivedArgs.push(a) }),
      dispatch,
      () => stateWith({ isArchived: true, canArchive: true }),
      'c1'
    )
    expect(archivedArgs).toEqual([false])
    expect(events.at(-1)).toMatchObject({ type: 'notice/shown', message: 'Chat unarchived.' })
  })

  test('unsupported capability → named notice, no adapter call (degrade visibly)', async () => {
    const { dispatch, events } = capture()
    let called = false
    await archiveChat(
      gateway({ setArchived: async () => void (called = true) }),
      dispatch,
      () => stateWith({ canArchive: false }),
      'c1'
    )
    expect(called).toBe(false)
    expect(events).toEqual([
      { type: 'notice/shown', message: "Archive isn't supported for WhatsApp." },
    ])
  })

  test('a failed archive surfaces a notice and never fakes success', async () => {
    const { dispatch, events } = capture()
    await archiveChat(
      gateway({
        setArchived: async () => {
          throw new BeeperError('unreachable', 'down')
        },
      }),
      dispatch,
      () => stateWith({ isArchived: false, canArchive: true }),
      'c1'
    )
    expect(events.map((e) => e.type)).toEqual(['notice/shown'])
    expect(events[0]).toMatchObject({ type: 'notice/shown' })
    expect((events[0] as { message: string }).message).toContain("Couldn't archive")
  })
})
