import { describe, expect, test } from 'bun:test'
import { bootstrap, refreshChats, type Gateway } from '@/tui/runtime.ts'
import { BeeperError } from '@/beeper/errors.ts'
import type { AppEvent } from '@/state/types.ts'
import type { Account, ChatSummary, ServerInfo } from '@/beeper/types.ts'

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

function gateway(over: Partial<Gateway> = {}): Gateway {
  return {
    getInfo: async () => server,
    listAccounts: async () => accounts,
    listChats: async () => chats,
    ...over,
  }
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
