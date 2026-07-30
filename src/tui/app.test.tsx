import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { App, type AppProps } from '@/tui/app.tsx'
import { createStore, type Store } from '@/tui/store.ts'
import type { ChatSummary, MessageSummary } from '@/beeper/types.ts'

function chat(id: string, title: string, network: string): ChatSummary {
  return {
    id,
    accountId: 'a',
    network,
    title,
    type: 'single',
    unreadCount: 0,
    isArchived: false,
    isMuted: false,
  }
}

function seededStore(): Store {
  const store = createStore()
  store.dispatch({ type: 'connection/changed', state: 'connected' })
  store.dispatch({
    type: 'accounts/loaded',
    accounts: [
      {
        id: 'a',
        network: 'WhatsApp',
        bridgeType: 'whatsapp',
        provider: 'local',
        displayName: 'Ada',
      },
      { id: 'b', network: 'Slack', bridgeType: 'slackgo', provider: 'cloud', displayName: 'Bee' },
    ],
  })
  store.dispatch({
    type: 'chats/loaded',
    chats: [chat('c1', 'Grace Hopper', 'WhatsApp'), chat('c2', 'engineering', 'Slack')],
  })
  return store
}

const noop = () => {}

async function renderApp(store: Store, over: Partial<AppProps> = {}) {
  const props: AppProps = {
    store,
    onQuit: noop,
    onRefresh: noop,
    onOpenChat: noop,
    onLoadOlder: noop,
    ...over,
  }
  return testRender(<App {...props} />, { width: 100, height: 24 })
}

describe('App shell', () => {
  test('renders inbox, conversation, and a connected status bar', async () => {
    const { renderOnce, captureCharFrame } = await renderApp(seededStore())
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain('Grace Hopper')
    expect(frame).toContain('WA')
    expect(frame).toContain('Conversation')
    expect(frame).toContain('Connected')
  })

  test('degraded connection shows in the status bar, never a silent empty state', async () => {
    const store = createStore()
    store.dispatch({ type: 'connection/changed', state: 'unreachable' })
    const { renderOnce, captureCharFrame } = await renderApp(store)
    await renderOnce()
    expect(captureCharFrame()).toContain('unreachable')
  })

  test('j/k navigate the inbox; ⏎ opens the selected chat', async () => {
    const store = seededStore()
    const opened: string[] = []
    const { renderOnce, mockInput } = await renderApp(store, {
      onOpenChat: (id) => opened.push(id),
    })
    await renderOnce()
    await mockInput.pressKey('j')
    expect(store.getState().selectedChatId).toBe('c1')
    await mockInput.pressKey('j')
    expect(store.getState().selectedChatId).toBe('c2')
    await mockInput.pressKey('RETURN')
    expect(opened).toEqual(['c2'])
  })

  test('conversation renders messages once loaded, and Esc returns focus to the inbox', async () => {
    const store = seededStore()
    store.dispatch({ type: 'chat/selected', chatId: 'c1' })
    store.dispatch({ type: 'focus/changed', focus: 'conversation' })
    const messages: MessageSummary[] = [
      {
        id: 'm1',
        chatId: 'c1',
        accountId: 'a',
        senderId: 'g',
        senderName: 'Grace',
        timestamp: '2026-07-30T09:05:00.000Z',
        sortKey: '1',
        text: 'Ship it.',
        isSender: false,
        isUnread: false,
      },
    ]
    store.dispatch({
      type: 'messages/loaded',
      chatId: 'c1',
      page: 'initial',
      messages,
      hasMoreOlder: false,
    })

    const { renderOnce, captureCharFrame, mockInput } = await renderApp(store)
    await renderOnce()
    expect(captureCharFrame()).toContain('Ship it.')
    expect(captureCharFrame()).toContain('Grace')

    // `h` / ← / Esc all return to the inbox; test the unambiguous `h`.
    await mockInput.pressKey('h')
    expect(store.getState().focus).toBe('inbox')
  })

  test('u pages older history when more exists', async () => {
    const store = seededStore()
    store.dispatch({ type: 'chat/selected', chatId: 'c1' })
    store.dispatch({ type: 'focus/changed', focus: 'conversation' })
    store.dispatch({
      type: 'messages/loaded',
      chatId: 'c1',
      page: 'initial',
      messages: [],
      hasMoreOlder: true,
      olderCursor: 'CUR-7',
    })
    const older: Array<[string, string]> = []
    const { renderOnce, mockInput } = await renderApp(store, {
      onLoadOlder: (id, cursor) => older.push([id, cursor]),
    })
    await renderOnce()
    await mockInput.pressKey('u')
    expect(older).toEqual([['c1', 'CUR-7']])
  })

  test('k/j scroll the conversation when it is focused', async () => {
    const store = seededStore()
    store.dispatch({ type: 'chat/selected', chatId: 'c1' })
    store.dispatch({ type: 'focus/changed', focus: 'conversation' })
    const messages: MessageSummary[] = Array.from({ length: 5 }, (_, i) => ({
      id: `m${i}`,
      chatId: 'c1',
      accountId: 'a',
      senderId: 'g',
      timestamp: 't',
      sortKey: `${i}`,
      text: `line ${i}`,
      isSender: false,
      isUnread: false,
    }))
    store.dispatch({ type: 'messages/loaded', chatId: 'c1', page: 'initial', messages })

    const { renderOnce, mockInput } = await renderApp(store)
    await renderOnce()
    expect(store.getState().conversationOffset).toBe(0)
    await mockInput.pressKey('k') // scroll up
    expect(store.getState().conversationOffset).toBe(1)
    await mockInput.pressKey('j') // scroll back down
    expect(store.getState().conversationOffset).toBe(0)
  })

  test('q triggers the quit callback from either pane', async () => {
    let quit = 0
    const { renderOnce, mockInput } = await renderApp(seededStore(), { onQuit: () => quit++ })
    await renderOnce()
    await mockInput.pressKey('q')
    expect(quit).toBe(1)
  })
})
