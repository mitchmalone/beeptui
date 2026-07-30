import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { App } from '@/tui/app.tsx'
import { createStore } from '@/tui/store.ts'
import type { ChatSummary } from '@/beeper/types.ts'

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

/** A store seeded as if a healthy boot just completed. */
function seededStore() {
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

describe('App shell', () => {
  test('renders inbox, conversation, and a connected status bar', async () => {
    const store = seededStore()
    const { renderOnce, captureCharFrame } = await testRender(
      <App store={store} onQuit={noop} onRefresh={noop} />,
      { width: 100, height: 24 }
    )
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain('Chats')
    expect(frame).toContain('Grace Hopper')
    expect(frame).toContain('engineering')
    expect(frame).toContain('WA')
    expect(frame).toContain('SL')
    expect(frame).toContain('Conversation')
    expect(frame).toContain('Connected')
    expect(frame).toContain('2 accounts')
  })

  test('degraded connection is shown in the status bar, never a silent empty state', async () => {
    const store = createStore()
    store.dispatch({ type: 'connection/changed', state: 'unreachable' })
    const { renderOnce, captureCharFrame } = await testRender(
      <App store={store} onQuit={noop} onRefresh={noop} />,
      { width: 100, height: 24 }
    )
    await renderOnce()
    expect(captureCharFrame()).toContain('unreachable')
  })

  test('narrow terminal collapses to a single inbox pane', async () => {
    const store = seededStore()
    const { renderOnce, captureCharFrame } = await testRender(
      <App store={store} onQuit={noop} onRefresh={noop} />,
      { width: 60, height: 24 }
    )
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain('Grace Hopper') // inbox still there
    expect(frame).not.toContain('Conversation') // center pane hidden
  })

  test('j/k navigate the inbox via the keymap, updating selection', async () => {
    const store = seededStore()
    const { renderOnce, mockInput } = await testRender(
      <App store={store} onQuit={noop} onRefresh={noop} />,
      { width: 100, height: 24 }
    )
    await renderOnce()
    expect(store.getState().selectedChatId).toBeNull()

    await mockInput.pressKey('j')
    expect(store.getState().selectedChatId).toBe('c1')
    await mockInput.pressKey('j')
    expect(store.getState().selectedChatId).toBe('c2')
    await mockInput.pressKey('k')
    expect(store.getState().selectedChatId).toBe('c1')
    await mockInput.pressKey('G', { shift: true })
    expect(store.getState().selectedChatId).toBe('c2')
  })

  test('q triggers the quit callback', async () => {
    let quit = 0
    const { renderOnce, mockInput } = await testRender(
      <App store={seededStore()} onQuit={() => quit++} onRefresh={noop} />,
      { width: 100, height: 24 }
    )
    await renderOnce()
    await mockInput.pressKey('q')
    expect(quit).toBe(1)
  })
})
