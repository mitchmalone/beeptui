import { describe, expect, test } from 'bun:test'
import { createDemoGateway, DEMO_FIRST_CHAT_ID } from '@/tui/demo.ts'
import { bootstrap, openChat } from '@/tui/runtime.ts'
import { createStore } from '@/state/store.ts'
import { selectActiveConversation, selectInboxRows } from '@/state/selectors.ts'

describe('createDemoGateway', () => {
  test('serves multiple networks and fictitious chats', async () => {
    const g = createDemoGateway()
    const accounts = await g.listAccounts()
    expect(accounts.map((a) => a.network)).toEqual(['WhatsApp', 'Slack', 'Telegram', 'Signal'])
    const chats = await g.listChats()
    expect(chats.length).toBeGreaterThanOrEqual(6)
    expect(chats.some((c) => c.isArchived)).toBe(true)
    expect(chats.some((c) => c.isMuted)).toBe(true)
    expect(chats.some((c) => c.unreadCount > 0)).toBe(true)
  })

  test('one conversation shows off HTML formatting; another has reactions', async () => {
    const g = createDemoGateway()
    const standup = (await g.listMessages('c-standup')).messages
    expect(standup.some((m) => (m.text ?? '').includes('<strong>'))).toBe(true)
    const ada = (await g.listMessages('c-ada')).messages
    expect(ada.some((m) => (m.reactions?.length ?? 0) > 0)).toBe(true)
  })

  test('search matches on message text; send returns a pending id; writes are no-ops', async () => {
    const g = createDemoGateway()
    const hits = await g.searchMessages('hike')
    expect(hits.messages.length).toBeGreaterThan(0)
    expect(hits.scopeHonored).toBe(true)
    const sent = await g.sendMessage('c-ada', 'hi')
    expect(sent.pendingMessageId).toContain('demo-pending')
    await g.addReaction('c-ada', 'c-ada-m1', '👍') // resolves without throwing
    await g.setArchived('c-ada', true)
  })
})

describe('demo gateway drives the real runtime', () => {
  test('bootstrap loads the fictitious inbox (archived hidden by default)', async () => {
    const store = createStore()
    await bootstrap(createDemoGateway(), store.dispatch)
    expect(store.getState().connection).toBe('connected')
    expect(store.getState().accountOrder).toHaveLength(4)
    const titles = selectInboxRows(store.getState()).map((r) => r.title)
    expect(titles).toContain('Ada Lovelace')
    expect(titles).toContain('design-team')
    expect(titles).not.toContain('family group') // archived, hidden until you toggle it
  })

  test('opening the demo entry chat loads its messages', async () => {
    const store = createStore()
    const g = createDemoGateway()
    await bootstrap(g, store.dispatch)
    await openChat(g, store.dispatch, DEMO_FIRST_CHAT_ID)
    const conv = selectActiveConversation(store.getState())
    expect(conv.chat?.title).toBe('Ada Lovelace')
    expect(conv.messages.length).toBeGreaterThan(0)
  })
})
