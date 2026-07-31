import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { App, type AppProps } from '@/tui/app.tsx'
import { createStore } from '@/tui/store.ts'
import {
  applyWatchEvent,
  archiveChat,
  bootstrap,
  openAttachment,
  openChat,
  runMessageSearch,
  saveAttachment,
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
    canReply: true,
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
    canReply: false,
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
const history: MessageSummary[] = [
  msg('m1', 'Ship it.'),
  msg('m2', 'Right behind you.', {
    attachments: [
      { kind: 'image', fileName: 'diagram.png', id: 'mxc://x/diagram', fileSize: 20480 },
    ],
  }),
]

function fakeGateway(): Gateway {
  // Per-harness archive state so the archive golden path reflects a real
  // move-out-of-view (getChat/listChats report the updated isArchived).
  const archivedIds = new Set<string>()
  return {
    getInfo: async () => server,
    listAccounts: async () => accounts,
    listChats: async () => chats.map((c) => ({ ...c, isArchived: archivedIds.has(c.id) })),
    listMessages: async (): Promise<MessageHistoryPage> => ({
      messages: history,
      hasMore: false,
      cursor: null,
    }),
    sendMessage: async (): Promise<SendResult> => ({ chatId: 'c-wa', pendingMessageId: 'srv-1' }),
    getChat: async (id) => ({
      ...chats.find((c) => c.id === id)!,
      isArchived: archivedIds.has(id),
    }),
    searchMessages: async (query): Promise<MessageSearchPage> => ({
      messages: history.filter((m) => (m.text ?? '').toLowerCase().includes(query.toLowerCase())),
      scopeHonored: true,
      capped: false,
    }),
    setArchived: async (id, archived) => {
      if (archived) archivedIds.add(id)
      else archivedIds.delete(id)
    },
    downloadAttachment: async () => ({ localPath: '/cache/beeper/att.png' }),
  }
}

/** Wire the App to the fake gateway exactly as `launch.ts` wires the real one. */
async function harness() {
  const store = createStore()
  const gateway = fakeGateway()
  const opened: string[] = []
  const saved: string[] = []
  const props: AppProps = {
    store,
    onQuit: () => {},
    onRefresh: () => {},
    onOpenChat: (id) => void openChat(gateway, store.dispatch, id),
    onLoadOlder: () => {},
    onSend: (chatId, text, replyToId) =>
      void submitSend(gateway, store.dispatch, {
        chatId,
        clientId: 'cid-1',
        text,
        timestamp: '2026-07-31T02:05:00.000Z',
        ...(replyToId !== undefined ? { replyToId } : {}),
      }),
    onRetry: () => {},
    onSearchMessages: (query, scopeChatId) =>
      void runMessageSearch(gateway, store.dispatch, store.getState, query, scopeChatId),
    onArchiveChat: (chatId) => void archiveChat(gateway, store.dispatch, store.getState, chatId),
    onOpenAttachment: () =>
      void openAttachment(gateway, store.dispatch, store.getState, async (p) => {
        opened.push(p)
      }),
    onSaveAttachment: () =>
      void saveAttachment(gateway, store.dispatch, store.getState, async (_p, name) => {
        saved.push(name)
        return { savedName: name }
      }),
  }
  const r = await testRender(<App {...props} />, { width: 100, height: 24 })
  const settle = async () => {
    await Promise.resolve()
    await Promise.resolve()
    await r.renderOnce()
  }
  await bootstrap(gateway, store.dispatch)
  await settle()
  return { store, gateway, settle, opened, saved, ...r }
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

  test('scenario 3b: a burst of live inbound messages while scrolled up keeps reading position', async () => {
    const h = await harness()
    await h.mockInput.pressKey('j')
    await h.mockInput.pressKey('RETURN')
    await h.settle()

    // Scroll up off the bottom, then take a burst on a busy channel.
    await h.mockInput.pressKey('k')
    await h.settle()
    const offsetBefore = h.store.getState().conversationOffset
    expect(offsetBefore).toBeGreaterThan(0)
    const anchorId = h.store.getState().selectedChatId // unchanged marker

    for (let i = 0; i < 12; i++) {
      await applyWatchEvent(h.gateway, h.store.dispatch, {
        kind: 'messages',
        chatId: 'c-wa',
        seq: 10 + i,
        messages: [msg(`burst-${i}`, `burst ${i}`)],
      })
    }
    await h.settle()

    // Reading position holds: still scrolled up (offset grew with the burst, not
    // reset to the bottom), the affordance is showing, and no snap to latest.
    expect(h.store.getState().conversationOffset).toBeGreaterThanOrEqual(offsetBefore)
    expect(h.store.getState().newMessagesBelow).toBe(true)
    expect(h.store.getState().selectedChatId).toBe(anchorId)
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

  test('scenario 7: archiving the open chat moves it out of the active view, visibly', async () => {
    const h = await harness()
    await h.mockInput.pressKey('j') // select Grace Hopper (WhatsApp)
    await h.mockInput.pressKey('RETURN') // open it
    await h.settle()
    expect(h.captureCharFrame()).toContain('Grace Hopper')

    await h.mockInput.pressKey('A', { shift: true }) // archive it
    await h.settle()

    // Beeper is the source of truth: the chat is now archived, focus stepped back
    // to the list, and the status bar names what happened — no silent success.
    expect(h.store.getState().chats['c-wa']?.isArchived).toBe(true)
    expect(h.store.getState().focus).toBe('inbox')
    const frame = h.captureCharFrame()
    expect(frame).toContain('archived') // notice in the status bar
    expect(frame).not.toContain('Grace Hopper') // gone from the active inbox

    // It reappears in the archived view.
    await h.mockInput.pressKey('a')
    await h.settle()
    expect(h.captureCharFrame()).toContain('Grace Hopper')
  })

  test('scenario 8: reply on a supporting network quotes the message and threads the send', async () => {
    const h = await harness()
    await h.mockInput.pressKey('j') // Grace Hopper (WhatsApp, canReply)
    await h.mockInput.pressKey('RETURN')
    await h.settle()

    await h.mockInput.pressKey('v') // enter selection (newest message)
    await h.settle()
    await h.mockInput.pressKey('r') // reply → focus compose
    await h.settle()

    expect(h.store.getState().focus).toBe('compose')
    expect(h.store.getState().replyTo).toBe('m2')
    expect(h.captureCharFrame()).toContain('Replying to')

    await h.mockInput.pressKeys(['s', 'u', 'r', 'e'])
    await h.settle()
    await h.mockInput.pressKey('RETURN') // send the reply
    await h.settle()

    const items = h.store.getState().messagesByChat['c-wa']?.items ?? []
    const reply = items.find((m) => m.text === 'sure')
    expect(reply?.replyToId).toBe('m2') // threaded to the selected message
    expect(h.store.getState().replyTo).toBeNull() // reply context consumed
  })

  test('scenario 8b: a non-supporting network names the missing reply capability', async () => {
    const h = await harness()
    await h.mockInput.pressKey('j')
    await h.mockInput.pressKey('j') // engineering (Slack, canReply: false)
    await h.mockInput.pressKey('RETURN')
    await h.settle()
    expect(h.captureCharFrame()).toContain('engineering')

    await h.mockInput.pressKey('v') // select
    await h.settle()
    await h.mockInput.pressKey('r') // reply attempt
    await h.settle()

    expect(h.captureCharFrame()).toContain('Replies not available for Slack via Beeper')
    expect(h.store.getState().replyTo).toBeNull() // no reply started
    expect(h.store.getState().focus).toBe('conversation') // no dead jump to compose
  })

  test('scenario 9: open + save an attachment; the notice names the file, never the path', async () => {
    const h = await harness()
    await h.mockInput.pressKey('j') // Grace Hopper
    await h.mockInput.pressKey('RETURN')
    await h.settle()

    await h.mockInput.pressKey('v') // select newest (m2 has an attachment)
    await h.settle()
    await h.mockInput.pressKey('o') // open it
    await h.settle()

    expect(h.opened).toEqual(['/cache/beeper/att.png'])
    let frame = h.captureCharFrame()
    expect(frame).toContain('Opened attachment')
    expect(frame).not.toContain('/cache/beeper') // path must never surface (invariant 6)

    await h.mockInput.pressKey('s') // save to Downloads
    await h.settle()
    expect(h.saved).toEqual(['diagram.png'])
    frame = h.captureCharFrame()
    expect(frame).toContain('Saved diagram.png to Downloads')
    expect(frame).not.toContain('/cache/beeper')
  })
})
