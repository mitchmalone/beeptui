import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { App, type AppProps } from '@/tui/app.tsx'
import { createStore, type Store } from '@/tui/store.ts'
import type { ChatSummary, MessageSummary } from '@/beeper/types.ts'

function chat(id: string, title: string, network: string): ChatSummary {
  return {
    id,
    // Accounts seeded below: 'a' = WhatsApp, 'b' = Slack. Keep chat.accountId
    // consistent with its network so scope filtering behaves realistically.
    accountId: network === 'Slack' ? 'b' : 'a',
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
    onSend: noop,
    onRetry: noop,
    ...over,
  }
  return testRender(<App {...props} />, { width: 100, height: 24 })
}

/** Store with a chat open and the conversation focused. */
function openChatStore(): Store {
  const store = seededStore()
  store.dispatch({ type: 'chat/selected', chatId: 'c1' })
  store.dispatch({ type: 'focus/changed', focus: 'conversation' })
  store.dispatch({
    type: 'messages/loaded',
    chatId: 'c1',
    page: 'initial',
    messages: [],
    hasMoreOlder: false,
  })
  return store
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

  describe('compose', () => {
    test('Tab focuses compose; typing edits the draft; letters do not run commands', async () => {
      const store = openChatStore()
      const { renderOnce, mockInput } = await renderApp(store)
      await renderOnce()
      await mockInput.pressKey('TAB')
      expect(store.getState().focus).toBe('compose')
      await mockInput.pressKeys(['h', 'i'])
      expect(store.getState().drafts.c1).toBe('hi')
      // 'q' in compose types, it does not quit.
      await mockInput.pressKey('q')
      expect(store.getState().drafts.c1).toBe('hiq')
    })

    test('Enter sends the draft via the explicit onSend callback', async () => {
      const store = openChatStore()
      store.dispatch({ type: 'draft/changed', chatId: 'c1', text: 'ship it' })
      const sent: Array<[string, string]> = []
      const { renderOnce, mockInput } = await renderApp(store, {
        onSend: (id, text) => sent.push([id, text]),
      })
      await renderOnce()
      await mockInput.pressKey('TAB')
      await mockInput.pressKey('RETURN')
      expect(sent).toEqual([['c1', 'ship it']])
    })

    test('Enter with an empty draft does not send', async () => {
      const store = openChatStore()
      const sent: string[] = []
      const { renderOnce, mockInput } = await renderApp(store, { onSend: (_id, t) => sent.push(t) })
      await renderOnce()
      await mockInput.pressKey('TAB')
      await mockInput.pressKey('RETURN')
      expect(sent).toEqual([])
    })

    test('R retries the last failed send from the conversation', async () => {
      const store = openChatStore()
      store.dispatch({
        type: 'send/requested',
        chatId: 'c1',
        clientId: 'cid-9',
        text: 'oops',
        timestamp: '2026-07-31T00:00:00.000Z',
      })
      store.dispatch({ type: 'send/failed', chatId: 'c1', clientId: 'cid-9' })
      const retried: Array<[string, string, string]> = []
      const { renderOnce, mockInput } = await renderApp(store, {
        onRetry: (id, clientId, text) => retried.push([id, clientId, text]),
      })
      await renderOnce()
      await mockInput.pressKey('R', { shift: true })
      expect(retried).toEqual([['c1', 'cid-9', 'oops']])
    })
  })

  describe('overlays', () => {
    test('/ opens search; typing filters; ⏎ jumps to the top match', async () => {
      const store = seededStore()
      const opened: string[] = []
      const { renderOnce, captureCharFrame, mockInput } = await renderApp(store, {
        onOpenChat: (id) => opened.push(id),
      })
      await renderOnce()
      await mockInput.pressKey('/')
      expect(store.getState().overlay).toBe('search')
      await mockInput.pressKeys(['e', 'n', 'g'])
      expect(store.getState().searchQuery).toBe('eng')
      expect(captureCharFrame()).toContain('engineering')
      await mockInput.pressKey('RETURN')
      expect(opened).toEqual(['c2']) // 'engineering'
      expect(store.getState().overlay).toBe('none')
    })

    test('Enter with no match closes search without jumping', async () => {
      const store = seededStore()
      const opened: string[] = []
      const { renderOnce, mockInput } = await renderApp(store, {
        onOpenChat: (id) => opened.push(id),
      })
      await renderOnce()
      await mockInput.pressKey('/')
      await mockInput.pressKeys(['z', 'z', 'z'])
      expect(store.getState().searchQuery).toBe('zzz')
      await mockInput.pressKey('RETURN')
      expect(opened).toEqual([]) // no match → nothing opened
      expect(store.getState().overlay).toBe('none') // but the overlay closes
    })

    test('? opens the help overlay listing bindings generated from the keymap', async () => {
      const store = seededStore()
      const { renderOnce, captureCharFrame, mockInput } = await renderApp(store)
      await renderOnce()
      await mockInput.pressKey('?')
      expect(store.getState().overlay).toBe('help')
      await renderOnce() // reflect the overlay in the captured frame
      const frame = captureCharFrame()
      expect(frame).toContain('Quit')
      expect(frame).toContain('Search chats')
      expect(frame).toContain('Compose')
      await mockInput.pressKey('x') // any key dismisses help
      expect(store.getState().overlay).toBe('none')
    })
  })

  describe('network rail filters', () => {
    test('] cycles scope to the first network and filters the inbox', async () => {
      const store = seededStore()
      const { renderOnce, captureCharFrame, mockInput } = await renderApp(store)
      await renderOnce()
      expect(captureCharFrame()).toContain('engineering') // Slack chat visible under All
      await mockInput.pressKey(']')
      expect(store.getState().filter.scope).toBe('a') // WhatsApp account
      await renderOnce()
      const frame = captureCharFrame()
      expect(frame).toContain('Grace Hopper') // WhatsApp chat stays
      expect(frame).not.toContain('engineering') // Slack chat filtered out
      await mockInput.pressKey('[')
      expect(store.getState().filter.scope).toBe('all') // wraps back
    })

    test('a toggles the archived view', async () => {
      const store = seededStore()
      const { renderOnce, mockInput } = await renderApp(store)
      await renderOnce()
      expect(store.getState().filter.archived).toBe(false)
      await mockInput.pressKey('a')
      expect(store.getState().filter.archived).toBe(true)
    })

    test('U toggles unread-only', async () => {
      const store = seededStore()
      const { renderOnce, mockInput } = await renderApp(store)
      await renderOnce()
      await mockInput.pressKey('U', { shift: true })
      expect(store.getState().filter.unreadOnly).toBe(true)
    })
  })

  test('q triggers the quit callback from either pane', async () => {
    let quit = 0
    const { renderOnce, mockInput } = await renderApp(seededStore(), { onQuit: () => quit++ })
    await renderOnce()
    await mockInput.pressKey('q')
    expect(quit).toBe(1)
  })
})
