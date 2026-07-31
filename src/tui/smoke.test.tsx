import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { App, type AppProps } from '@/tui/app.tsx'
import { createStore } from '@/tui/store.ts'
import {
  applyWatchEvent,
  bootstrap,
  openChat,
  runMessageSearch,
  submitSend,
  type Gateway,
} from '@/tui/runtime.ts'
import type { MessageHistoryPage, MessageSearchPage } from '@/beeper/client.ts'
import type {
  Account,
  ChatSummary,
  MessageSummary,
  SendResult,
  ServerInfo,
} from '@/beeper/types.ts'

/**
 * Golden-path smoke harness — drives the real App via keyboard against a fake
 * gateway + injected watch events, asserting rendered frames end-to-end. This
 * is the "fixture Beeper server" the plan calls for, done through OpenTUI's
 * headless renderer instead of a pty (deterministic, CI-safe).
 *
 * Covers PRD acceptance scenarios: 1 (inbox), 2 (read + send), 3 (live inbound
 * + affordance), 4 (disconnect keeps draft). Scenario 7 (doctor) lives in
 * `src/cli/index.test.ts`.
 */

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
  { id: 'wa', network: 'WhatsApp', bridgeType: 'whatsapp', provider: 'local', displayName: 'Ada' },
  { id: 'sl', network: 'Slack', bridgeType: 'slackgo', provider: 'cloud', displayName: 'Ada' },
]
const chats: ChatSummary[] = [
  {
    id: 'c-wa',
    accountId: 'wa',
    network: 'WhatsApp',
    title: 'Grace Hopper',
    type: 'single',
    unreadCount: 2,
    isArchived: false,
    isMuted: false,
    lastActivity: '2026-07-31T02:00:00.000Z',
  },
  {
    id: 'c-sl',
    accountId: 'sl',
    network: 'Slack',
    title: 'engineering',
    type: 'group',
    unreadCount: 0,
    isArchived: false,
    isMuted: false,
    lastActivity: '2026-07-31T01:00:00.000Z',
  },
]
function msg(id: string, text: string, over: Partial<MessageSummary> = {}): MessageSummary {
  return {
    id,
    chatId: 'c-wa',
    accountId: 'wa',
    senderId: 'g',
    senderName: 'Grace',
    timestamp: '2026-07-31T02:00:00.000Z',
    sortKey: id,
    text,
    isSender: false,
    isUnread: false,
    ...over,
  }
}
const history: MessageSummary[] = [msg('m1', 'Ship it.'), msg('m2', 'Right behind you.')]

function fakeGateway(): Gateway {
  return {
    getInfo: async () => server,
    listAccounts: async () => accounts,
    listChats: async () => chats,
    listMessages: async (): Promise<MessageHistoryPage> => ({
      messages: history,
      hasMore: false,
      cursor: null,
    }),
    sendMessage: async (): Promise<SendResult> => ({ chatId: 'c-wa', pendingMessageId: 'srv-1' }),
    getChat: async () => chats[0]!,
    searchMessages: async (query): Promise<MessageSearchPage> => ({
      messages: history.filter((m) => (m.text ?? '').toLowerCase().includes(query.toLowerCase())),
      scopeHonored: true,
      capped: false,
    }),
  }
}

/** Wire the App to the fake gateway exactly as `launch.ts` wires the real one. */
async function harness() {
  const store = createStore()
  const gateway = fakeGateway()
  const props: AppProps = {
    store,
    onQuit: () => {},
    onRefresh: () => {},
    onOpenChat: (id) => void openChat(gateway, store.dispatch, id),
    onLoadOlder: () => {},
    onSend: (chatId, text) =>
      void submitSend(gateway, store.dispatch, {
        chatId,
        clientId: 'cid-1',
        text,
        timestamp: '2026-07-31T02:05:00.000Z',
      }),
    onRetry: () => {},
    onSearchMessages: (query, scopeChatId) =>
      void runMessageSearch(gateway, store.dispatch, store.getState, query, scopeChatId),
  }
  const r = await testRender(<App {...props} />, { width: 100, height: 24 })
  const settle = async () => {
    await Promise.resolve()
    await Promise.resolve()
    await r.renderOnce()
  }
  await bootstrap(gateway, store.dispatch)
  await settle()
  return { store, gateway, settle, ...r }
}

describe('golden-path smoke', () => {
  test('scenario 1: launch shows the inbox with chats from two networks, connected', async () => {
    const { captureCharFrame } = await harness()
    const frame = captureCharFrame()
    expect(frame).toContain('Grace Hopper')
    expect(frame).toContain('engineering')
    expect(frame).toContain('WA')
    expect(frame).toContain('SL')
    expect(frame).toContain('Connected')
    expect(frame).toContain('2 accounts')
  })

  test('scenario 2: open a chat, read history, then compose + send (optimistic pending)', async () => {
    const h = await harness()
    await h.mockInput.pressKey('j') // select first chat
    await h.mockInput.pressKey('RETURN') // open it
    await h.settle()
    expect(h.captureCharFrame()).toContain('Ship it.')

    await h.mockInput.pressKey('TAB') // focus compose
    await h.mockInput.pressKeys(['o', 'n', ' ', 'i', 't'])
    await h.settle()
    await h.mockInput.pressKey('RETURN') // send
    await h.settle()

    // Optimistic message shows immediately, then reconciles to sent.
    const items = h.store.getState().messagesByChat['c-wa']?.items ?? []
    expect(items.some((m) => m.text === 'on it')).toBe(true)
    expect(h.captureCharFrame()).toContain('on it')
  })

  test('scenario 3: a live inbound message renders; scrolled-up shows the affordance', async () => {
    const h = await harness()
    await h.mockInput.pressKey('j')
    await h.mockInput.pressKey('RETURN')
    await h.settle()

    // Inbound while at the bottom → appears.
    await applyWatchEvent(h.gateway, h.store.dispatch, {
      kind: 'messages',
      chatId: 'c-wa',
      seq: 1,
      messages: [msg('m3', 'Live hello')],
    })
    await h.settle()
    expect(h.captureCharFrame()).toContain('Live hello')

    // Scroll up, then another inbound → new-messages affordance, not a snap.
    await h.mockInput.pressKey('k')
    await h.settle()
    await applyWatchEvent(h.gateway, h.store.dispatch, {
      kind: 'messages',
      chatId: 'c-wa',
      seq: 2,
      messages: [msg('m4', 'Another one')],
    })
    await h.settle()
    expect(h.store.getState().newMessagesBelow).toBe(true)
    expect(h.captureCharFrame()).toContain('new messages')
  })

  test('scenario 4: disconnect keeps the draft and degrades visibly; reconnect recovers', async () => {
    const h = await harness()
    await h.mockInput.pressKey('j')
    await h.mockInput.pressKey('RETURN')
    await h.settle()
    await h.mockInput.pressKey('TAB')
    await h.mockInput.pressKeys(['h', 'i'])
    await h.settle()
    expect(h.store.getState().drafts['c-wa']).toBe('hi')

    // Simulate a disconnect (what the watch client dispatches).
    h.store.dispatch({ type: 'connection/changed', state: 'unreachable' })
    await h.settle()
    expect(h.captureCharFrame()).toContain('unreachable')
    // Draft survives the disconnect; nothing was sent.
    expect(h.store.getState().drafts['c-wa']).toBe('hi')

    h.store.dispatch({ type: 'connection/changed', state: 'connected' })
    await h.settle()
    expect(h.store.getState().drafts['c-wa']).toBe('hi')
  })

  test('scenario 5: the network rail scopes the inbox, and archived view is honored', async () => {
    const h = await harness()
    // Both networks visible under "All".
    expect(h.captureCharFrame()).toContain('Grace Hopper')
    expect(h.captureCharFrame()).toContain('engineering')

    // ] scopes to the first network (WhatsApp): the Slack chat drops out.
    await h.mockInput.pressKey(']')
    await h.settle()
    expect(h.store.getState().filter.scope).toBe('wa')
    let frame = h.captureCharFrame()
    expect(frame).toContain('Grace Hopper')
    expect(frame).not.toContain('engineering')

    // ] again → Slack scope: the WhatsApp chat drops out.
    await h.mockInput.pressKey(']')
    await h.settle()
    frame = h.captureCharFrame()
    expect(frame).toContain('engineering')
    expect(frame).not.toContain('Grace Hopper')

    // [ back to All, then archived view: neither fixture chat is archived, so
    // the list is empty and the rail names the archived mode — honest, not blank.
    await h.mockInput.pressKey('[')
    await h.mockInput.pressKey('a')
    await h.settle()
    expect(h.store.getState().filter.archived).toBe(true)
    frame = h.captureCharFrame()
    expect(frame).toContain('No chats to show')
    expect(frame).toContain('archived') // status bar filter indicator
  })

  test('scenario 6: message search finds a message and lands in its conversation', async () => {
    const h = await harness()
    await h.mockInput.pressKey('S', { shift: true }) // open message search
    await h.settle()
    expect(h.store.getState().overlay).toBe('messageSearch')

    await h.mockInput.pressKeys(['s', 'h', 'i', 'p'])
    await h.mockInput.pressKey('RETURN') // run the search
    await h.settle()
    const frame = h.captureCharFrame()
    expect(frame).toContain('Ship it.') // the matching snippet
    expect(frame).toContain('Grace Hopper') // with chat context

    await h.mockInput.pressKey('RETURN') // open the selected hit
    await h.settle()
    expect(h.store.getState().overlay).toBe('none')
    expect(h.store.getState().selectedChatId).toBe('c-wa')
    expect(h.captureCharFrame()).toContain('Ship it.') // landed in the conversation
  })
})
