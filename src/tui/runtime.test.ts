import { describe, expect, test } from 'bun:test'
import {
  bootstrap,
  loadOlderMessages,
  openChat,
  refreshChats,
  retrySend,
  submitSend,
  type Gateway,
} from '@/tui/runtime.ts'
import { BeeperError } from '@/beeper/errors.ts'
import type { MessageHistoryPage } from '@/beeper/client.ts'
import type { AppEvent } from '@/state/types.ts'
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
