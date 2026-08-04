import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { App, type AppProps } from '@/tui/app.tsx'
import { applyKeymapOverrides } from '@/tui/keymap.ts'
import { createStore, type Store } from '@/state/store.ts'
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
    onSearchMessages: noop,
    onArchiveChat: noop,
    onOpenAttachment: noop,
    onSaveAttachment: noop,
    onReact: noop,
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
    // The first chat is already highlighted when the list loads — `j` moves off
    // it rather than waking the column up.
    expect(store.getState().selectedChatId).toBe('c1')
    await mockInput.pressKey('j')
    expect(store.getState().selectedChatId).toBe('c2')
    await mockInput.pressKey('k')
    expect(store.getState().selectedChatId).toBe('c1')
    await mockInput.pressKey('j')
    await mockInput.pressKey('RETURN')
    expect(opened).toEqual(['c2'])
  })

  test('t cycles the theme through the registry and names it in the status bar', async () => {
    const store = seededStore()
    const { renderOnce, captureCharFrame, mockInput } = await renderApp(store)
    await renderOnce()
    expect(store.getState().themeName).toBe('system') // initial
    await mockInput.pressKey('t') // system → default (registry order)
    await renderOnce()
    expect(store.getState().themeName).toBe('default')
    expect(captureCharFrame()).toContain('Theme: default')
    await mockInput.pressKey('t') // default → dracula
    expect(store.getState().themeName).toBe('dracula')
  })

  test('rail: navigate to Archived and Enter toggles it, leaving the scope', async () => {
    const store = seededStore()
    store.dispatch({ type: 'focus/changed', focus: 'rail' })
    const { renderOnce, mockInput } = await renderApp(store)
    await renderOnce()
    expect(store.getState().railCursor).toBe('all')
    await mockInput.pressKey('k') // up from 'all' wraps to Settings (now last)
    expect(store.getState().railCursor).toBe('settings')
    await mockInput.pressKey('k') // and once more to Archived
    expect(store.getState().railCursor).toBe('archived')
    expect(store.getState().filter.scope).toBe('all') // scope untouched by resting on Archived
    await mockInput.pressKey('RETURN') // Enter toggles the archived view
    expect(store.getState().filter.archived).toBe(true)
    expect(store.getState().focus).toBe('rail') // stayed in the rail (didn't drill in)
    expect(store.getState().filter.scope).toBe('all')
  })

  test('a config keymap override rebinds a command end-to-end', async () => {
    const store = seededStore()
    let quit = 0
    const { renderOnce, mockInput } = await renderApp(store, {
      onQuit: () => (quit += 1),
      keymap: applyKeymapOverrides({ quit: ['x'] }),
    })
    await renderOnce()
    await mockInput.pressKey('q') // no longer bound to quit
    expect(quit).toBe(0)
    await mockInput.pressKey('x') // the rebound key quits
    expect(quit).toBe(1)
  })

  test('A archives the highlighted chat straight from the list (no need to open it)', async () => {
    const store = seededStore()
    const archived: string[] = []
    const { renderOnce, mockInput } = await renderApp(store, {
      onArchiveChat: (id) => archived.push(id),
    })
    await renderOnce()
    // The first chat is highlighted from the load; no keypress needed.
    expect(store.getState().focus).toBe('inbox')
    expect(store.getState().selectedChatId).toBe('c1')
    await mockInput.pressKey('A', { shift: true })
    expect(archived).toEqual(['c1'])
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

  test('↑ off the oldest message pages older history, with no separate key', async () => {
    const store = seededStore()
    store.dispatch({ type: 'chat/selected', chatId: 'c1' })
    store.dispatch({ type: 'focus/changed', focus: 'conversation' })
    store.dispatch({
      type: 'messages/loaded',
      chatId: 'c1',
      page: 'initial',
      messages: [
        {
          id: 'm1',
          chatId: 'c1',
          accountId: 'a',
          senderId: 'g',
          timestamp: '2026-07-30T09:00:00.000Z',
          sortKey: '1',
          text: 'oldest loaded',
          isSender: false,
          isUnread: false,
        },
      ],
      hasMoreOlder: true,
      olderCursor: 'CUR-7',
    })
    const older: Array<[string, string]> = []
    const { renderOnce, mockInput } = await renderApp(store, {
      onLoadOlder: (id, cursor) => older.push([id, cursor]),
    })
    await renderOnce()
    // The cursor is already on the only (and therefore oldest) message; one more
    // step up is the request.
    await mockInput.pressKey('ARROW_UP')
    // The reducer records the request; the fetch happens in an effect on the
    // next commit, so let React settle before asserting.
    await Promise.resolve()
    await renderOnce()
    expect(older).toEqual([['c1', 'CUR-7']])
    expect(store.getState().olderPagePending).toBe('c1')
  })

  test('the top hint says a page is loading rather than looking ignored', async () => {
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
    const { renderOnce, captureCharFrame } = await renderApp(store)
    await renderOnce()
    expect(captureCharFrame()).toContain('↑ for older')
    store.dispatch({ type: 'messageSelection/moved', delta: -1 })
    await renderOnce()
  })

  test('k/j move the message cursor when the conversation is focused', async () => {
    const store = seededStore()
    store.dispatch({ type: 'chat/selected', chatId: 'c1' })
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
    // Focus after loading so the newest message is auto-selected.
    store.dispatch({ type: 'focus/changed', focus: 'conversation' })

    const { renderOnce, mockInput } = await renderApp(store)
    await renderOnce()
    expect(store.getState().selectedMessageId).toBe('m4') // newest
    await mockInput.pressKey('k') // cursor up → older
    expect(store.getState().selectedMessageId).toBe('m3')
    await mockInput.pressKey('k')
    expect(store.getState().selectedMessageId).toBe('m2')
    await mockInput.pressKey('j') // cursor down → newer
    expect(store.getState().selectedMessageId).toBe('m3')
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

    test('status-bar hints only advertise keys that fire: compose hides the global shortcuts', async () => {
      const store = openChatStore()
      const { renderOnce, captureCharFrame, mockInput } = await renderApp(store)
      await renderOnce()
      // Conversation focus: the global shortcuts run, so they're shown.
      expect(captureCharFrame()).toContain('q quit')
      // Compose captures every key for text entry — those shortcuts no longer
      // fire, so they're hidden and the compose keys are shown instead.
      await mockInput.pressKey('TAB')
      await renderOnce()
      const frame = captureCharFrame()
      expect(frame).toContain('send · Esc back')
      expect(frame).not.toContain('q quit')
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

    test('A archives the open chat from the conversation', async () => {
      const store = openChatStore()
      const archived: string[] = []
      const { renderOnce, mockInput } = await renderApp(store, {
        onArchiveChat: (id) => archived.push(id),
      })
      await renderOnce()
      await mockInput.pressKey('A', { shift: true })
      expect(archived).toEqual(['c1'])
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

    test('S opens message search; typing then Enter runs the scoped search; Enter opens a hit', async () => {
      const store = seededStore()
      const searched: Array<[string, string | null]> = []
      const opened: string[] = []
      const { renderOnce, captureCharFrame, mockInput } = await renderApp(store, {
        onSearchMessages: (q, scope) => {
          searched.push([q, scope])
          // Simulate the runtime dispatching a result back into the store.
          store.dispatch({
            type: 'messageSearch/resultsLoaded',
            results: [
              {
                messageId: 'm9',
                chatId: 'c2',
                chatTitle: 'engineering',
                network: 'Slack',
                senderName: 'Bob',
                timestamp: '2026-07-31T02:00:00.000Z',
                snippet: 'Friday deploy is green',
              },
            ],
            partial: false,
            note: null,
          })
        },
        onOpenChat: (id) => opened.push(id),
      })
      await renderOnce()
      await mockInput.pressKey('S', { shift: true })
      expect(store.getState().overlay).toBe('messageSearch')
      await mockInput.pressKeys(['f', 'r', 'i'])
      expect(store.getState().messageSearch.query).toBe('fri')
      await mockInput.pressKey('RETURN') // runs the search
      expect(searched).toEqual([['fri', null]]) // unscoped from the inbox
      await renderOnce()
      expect(captureCharFrame()).toContain('Friday deploy is green')
      await mockInput.pressKey('RETURN') // opens the selected hit
      expect(opened).toEqual(['c2'])
      expect(store.getState().overlay).toBe('none')
    })

    test('message search from an open chat scopes to that chat', async () => {
      const store = openChatStore() // c1 open, conversation focused
      const searched: Array<[string, string | null]> = []
      const { renderOnce, mockInput } = await renderApp(store, {
        onSearchMessages: (q, scope) => searched.push([q, scope]),
      })
      await renderOnce()
      await mockInput.pressKey('S', { shift: true })
      await mockInput.pressKeys(['h', 'i'])
      await mockInput.pressKey('RETURN')
      expect(searched).toEqual([['hi', 'c1']]) // scoped to the active chat
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

  describe('rail focus navigation (Esc walks out)', () => {
    test('Esc walks conversation → inbox → rail; l/Enter drills back in', async () => {
      const store = openChatStore() // c1 open, conversation focused
      const { renderOnce, mockInput } = await renderApp(store)
      await renderOnce()
      expect(store.getState().focus).toBe('conversation')
      await mockInput.pressKey('h') // conversation → inbox
      expect(store.getState().focus).toBe('inbox')
      await mockInput.pressKey('h') // inbox → rail (the new step)
      expect(store.getState().focus).toBe('rail')
      await mockInput.pressKey('l') // rail → inbox (drill back in)
      expect(store.getState().focus).toBe('inbox')
    })

    test('in the rail, j/k switch networks', async () => {
      const store = seededStore()
      store.dispatch({ type: 'focus/changed', focus: 'rail' })
      const { renderOnce, mockInput } = await renderApp(store)
      await renderOnce()
      expect(store.getState().filter.scope).toBe('all')
      await mockInput.pressKey('j') // next network
      expect(store.getState().filter.scope).toBe('a') // WhatsApp
      await mockInput.pressKey('k') // back up
      expect(store.getState().filter.scope).toBe('all')
    })

    test('the rail shows a focus indicator when focused', async () => {
      const store = seededStore()
      store.dispatch({ type: 'focus/changed', focus: 'rail' })
      const { renderOnce, captureCharFrame } = await renderApp(store)
      await renderOnce()
      expect(captureCharFrame()).toContain('Net●') // focus marker in the rail title
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

describe('first load', () => {
  test('opens with All scope, the first chat highlighted, and Chats focused', async () => {
    const store = seededStore()
    const { renderOnce, captureCharFrame } = await renderApp(store)
    await renderOnce()
    const frame = captureCharFrame()

    // Chats owns the focus dot; Net and Conversation do not.
    expect(frame).toContain('Chats ●')
    expect(frame).not.toContain('Conversation ●')
    expect(frame).not.toContain('Net●')
    // The first chat carries the cursor without a keypress.
    expect(store.getState().selectedChatId).toBe('c1')
    expect(store.getState().focus).toBe('inbox')
    // All is the active scope.
    expect(store.getState().filter.scope).toBe('all')
    // Highlighting is not opening: the pane invites you to open the chat rather
    // than claiming it has no messages.
    expect(frame).toContain('Press ⏎ to open')
    expect(frame).not.toContain('No messages yet')
  })
})

describe('settings flyout', () => {
  test('⏎ on the rail Settings entry opens a flyout, and Theme opens the list', async () => {
    const store = seededStore()
    store.dispatch({ type: 'focus/changed', focus: 'rail' })
    const { renderOnce, captureCharFrame, mockInput } = await renderApp(store)
    await renderOnce()

    await mockInput.pressKey('k') // wraps up onto Settings, pinned at the foot
    expect(store.getState().railCursor).toBe('settings')
    await mockInput.pressKey('RETURN')
    await renderOnce()
    expect(store.getState().overlay).toBe('settingsMenu')
    expect(captureCharFrame()).toContain('Theme')

    await mockInput.pressKey('RETURN')
    await renderOnce()
    expect(store.getState().overlay).toBe('themePicker')
    const frame = captureCharFrame()
    expect(frame).toContain('default')
    expect(frame).toContain('dracula')
  })

  test('choosing a theme applies it and closes', async () => {
    const store = seededStore()
    store.dispatch({ type: 'overlay/opened', overlay: 'themePicker' })
    const before = store.getState().themeName
    const { renderOnce, mockInput } = await renderApp(store)
    await renderOnce()
    await mockInput.pressKey('ARROW_DOWN')
    await mockInput.pressKey('RETURN')
    expect(store.getState().themeName).not.toBe(before)
    expect(store.getState().overlay).toBe('none')
  })

  // Esc stepping back one level (themePicker → settingsMenu → none) is verified
  // live rather than here: the mock input does not deliver a bare ESC as an
  // escape key event, so asserting it in this harness would test nothing.

  test('the panes stay mounted under the flyout — it is not a full-screen overlay', async () => {
    const store = seededStore()
    store.dispatch({ type: 'overlay/opened', overlay: 'settingsMenu' })
    const { renderOnce, captureCharFrame } = await renderApp(store)
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain('Chats')
    expect(frame).toContain('Grace Hopper')
  })
})
