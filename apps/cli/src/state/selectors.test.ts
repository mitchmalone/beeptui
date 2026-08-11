import { describe, expect, test } from 'bun:test'
import { reduce } from '@/state/reducer.ts'
import { initialState, type AppEvent, type AppState } from '@/state/types.ts'
import {
  selectActiveConversation,
  selectConnectionBanner,
  selectDraft,
  selectInboxRows,
  selectNetworkRail,
  selectReplyContext,
  selectSelectedMessage,
  selectTotalUnread,
} from '@/state/selectors.ts'
import type { Account, ChatSummary, MessageSummary } from '@/beeper/types.ts'

function chat(id: string, over: Partial<ChatSummary> = {}): ChatSummary {
  return {
    id,
    accountId: 'acc',
    network: 'WhatsApp',
    title: id,
    type: 'single',
    unreadCount: 0,
    isArchived: false,
    isMuted: false,
    ...over,
  }
}

function acct(id: string, network: string): Account {
  return { id, network, bridgeType: network.toLowerCase(), provider: 'local', displayName: network }
}

function run(events: AppEvent[]): AppState {
  return events.reduce(reduce, initialState)
}

describe('selectInboxRows', () => {
  test('returns chats in inbox order with unread + selection flags', () => {
    const s = run([
      {
        type: 'chats/loaded',
        chats: [
          chat('a', { lastActivity: '2026-07-30T01:00:00.000Z', unreadCount: 3 }),
          chat('b', { lastActivity: '2026-07-30T02:00:00.000Z' }),
        ],
      },
      { type: 'chat/selected', chatId: 'a' },
    ])
    const rows = selectInboxRows(s)
    expect(rows.map((r) => r.id)).toEqual(['b', 'a'])
    const a = rows.find((r) => r.id === 'a')
    expect(a).toMatchObject({
      hasUnread: true,
      unreadCount: 3,
      isSelected: true,
      network: 'WhatsApp',
    })
    expect(rows.find((r) => r.id === 'b')?.hasUnread).toBe(false)
  })
})

describe('selectInboxRows filtering', () => {
  const base = run([
    { type: 'accounts/loaded', accounts: [acct('wa', 'WhatsApp'), acct('fb', 'Facebook')] },
    {
      type: 'chats/loaded',
      chats: [
        chat('w1', { accountId: 'wa', network: 'WhatsApp', unreadCount: 2 }),
        chat('w2', { accountId: 'wa', network: 'WhatsApp', isArchived: true, unreadCount: 5 }),
        chat('f1', { accountId: 'fb', network: 'Facebook' }),
      ],
    },
  ])

  test('default view shows all active (non-archived) chats', () => {
    expect(
      selectInboxRows(base)
        .map((r) => r.id)
        .sort()
    ).toEqual(['f1', 'w1'])
  })

  test('scope narrows to a single account', () => {
    const s = reduce(base, { type: 'filter/scopeSelected', scope: 'wa' })
    expect(selectInboxRows(s).map((r) => r.id)).toEqual(['w1'])
  })

  test('archived toggle shows archived chats for the scope', () => {
    const s = reduce(base, { type: 'filter/archivedToggled' })
    expect(selectInboxRows(s).map((r) => r.id)).toEqual(['w2'])
  })

  test('unreadOnly restricts to chats with unread', () => {
    const s = reduce(base, { type: 'filter/unreadToggled' })
    expect(selectInboxRows(s).map((r) => r.id)).toEqual(['w1'])
  })
})

describe('selectNetworkRail', () => {
  const base = run([
    { type: 'accounts/loaded', accounts: [acct('wa', 'WhatsApp'), acct('fb', 'Facebook')] },
    {
      type: 'chats/loaded',
      chats: [
        chat('w1', { accountId: 'wa', network: 'WhatsApp', unreadCount: 2 }),
        chat('w2', { accountId: 'wa', network: 'WhatsApp', isArchived: true, unreadCount: 5 }),
        chat('f1', { accountId: 'fb', network: 'Facebook', unreadCount: 1 }),
      ],
    },
  ])

  test('All first, then accounts in order, then Archived, then Settings', () => {
    const rail = selectNetworkRail(base)
    expect(rail.map((e) => e.id)).toEqual(['all', 'wa', 'fb', 'archived', 'settings'])
    expect(rail.map((e) => e.label)).toEqual([
      'All',
      'WhatsApp',
      'Facebook',
      'Archived',
      'Settings',
    ])
    const archived = rail.find((e) => e.id === 'archived')
    expect(archived?.kind).toBe('archived')
    expect(archived?.isSelected).toBe(false) // a toggle, never the active scope
    const settings = rail.find((e) => e.id === 'settings')
    expect(settings?.kind).toBe('settings')
    expect(settings?.isSelected).toBe(false) // opens a flyout; not a scope
  })

  test('per-scope unread counts honor the active view', () => {
    const rail = selectNetworkRail(base)
    expect(rail.find((e) => e.id === 'all')?.unreadCount).toBe(3) // w1(2)+f1(1); w2 archived excluded
    expect(rail.find((e) => e.id === 'wa')?.unreadCount).toBe(2)
    expect(rail.find((e) => e.id === 'fb')?.unreadCount).toBe(1)
  })

  test('unread counts follow the archived view', () => {
    const s = reduce(base, { type: 'filter/archivedToggled' })
    const rail = selectNetworkRail(s)
    expect(rail.find((e) => e.id === 'all')?.unreadCount).toBe(5) // only w2 (archived)
    expect(rail.find((e) => e.id === 'wa')?.unreadCount).toBe(5)
    expect(rail.find((e) => e.id === 'fb')?.unreadCount).toBe(0)
  })

  test('selected reflects the current scope', () => {
    const s = reduce(base, { type: 'filter/scopeSelected', scope: 'fb' })
    const rail = selectNetworkRail(s)
    expect(rail.find((e) => e.isSelected)?.id).toBe('fb')
    expect(rail.filter((e) => e.isSelected)).toHaveLength(1)
  })
})

describe('selectTotalUnread', () => {
  test('sums unread across chats, excluding archived', () => {
    const s = run([
      {
        type: 'chats/loaded',
        chats: [
          chat('a', { unreadCount: 3 }),
          chat('b', { unreadCount: 0 }),
          chat('c', { unreadCount: 5 }),
          chat('d', { unreadCount: 9, isArchived: true }), // archived → excluded
        ],
      },
    ])
    expect(selectTotalUnread(s)).toBe(8)
  })

  test('is zero with no chats', () => {
    expect(selectTotalUnread(initialState)).toBe(0)
  })
})

describe('selectActiveConversation', () => {
  test('returns the selected chat and its messages', () => {
    const s = run([
      { type: 'chats/loaded', chats: [chat('c1')] },
      { type: 'chat/selected', chatId: 'c1' },
      {
        type: 'messages/loaded',
        chatId: 'c1',
        page: 'initial',
        messages: [
          {
            id: 'm1',
            chatId: 'c1',
            accountId: 'acc',
            senderId: 'x',
            timestamp: 't',
            sortKey: '1',
            isSender: false,
            isUnread: false,
          },
        ],
      },
    ])
    const conv = selectActiveConversation(s)
    expect(conv.chat?.id).toBe('c1')
    expect(conv.messages.map((m) => m.id)).toEqual(['m1'])
  })

  test('returns null chat and empty messages when nothing selected', () => {
    const conv = selectActiveConversation(initialState)
    expect(conv.chat).toBeNull()
    expect(conv.messages).toEqual([])
  })
})

describe('message selection + reply context', () => {
  function msg(id: string, over: Partial<MessageSummary> = {}): MessageSummary {
    return {
      id,
      chatId: 'c1',
      accountId: 'acc',
      senderId: 'grace',
      senderName: 'Grace',
      timestamp: `2026-07-30T00:00:0${id.slice(-1)}.000Z`,
      sortKey: id.slice(-1),
      text: `body ${id}`,
      isSender: false,
      isUnread: false,
      ...over,
    }
  }

  function seeded(): AppState {
    return run([
      { type: 'chats/loaded', chats: [chat('c1')] },
      { type: 'chat/selected', chatId: 'c1' },
      { type: 'messages/loaded', chatId: 'c1', page: 'initial', messages: [msg('m1'), msg('m2')] },
    ])
  }

  test('selectActiveConversation surfaces the selected message id', () => {
    const s = reduce(seeded(), { type: 'messageSelection/started' })
    expect(selectActiveConversation(s).selectedMessageId).toBe('m2')
  })

  test('selectSelectedMessage returns the message entity, or null when none', () => {
    expect(selectSelectedMessage(seeded())).toBeNull()
    const s = reduce(seeded(), { type: 'reply/started', messageId: 'placeholder' }) // no selection
    expect(selectSelectedMessage(s)).toBeNull()
    const sel = reduce(seeded(), { type: 'messageSelection/moved', delta: -1 })
    expect(selectSelectedMessage(sel)?.id).toBe('m1')
  })

  test('selectReplyContext derives sender + snippet when replying, null otherwise', () => {
    expect(selectReplyContext(seeded())).toBeNull()
    const s = reduce(seeded(), { type: 'reply/started', messageId: 'm1' })
    expect(selectReplyContext(s)).toEqual({ messageId: 'm1', sender: 'Grace', snippet: 'body m1' })
  })

  test('selectReplyContext is null when the target message is not loaded', () => {
    const s = reduce(seeded(), { type: 'reply/started', messageId: 'not-loaded' })
    expect(selectReplyContext(s)).toBeNull()
  })

  test('selectReplyContext truncates a long snippet', () => {
    const long = 'x'.repeat(100)
    const s = run([
      { type: 'chats/loaded', chats: [chat('c1')] },
      { type: 'chat/selected', chatId: 'c1' },
      {
        type: 'messages/loaded',
        chatId: 'c1',
        page: 'initial',
        messages: [msg('m1', { text: long })],
      },
      { type: 'reply/started', messageId: 'm1' },
    ])
    const ctx = selectReplyContext(s)
    expect(ctx?.snippet.endsWith('…')).toBe(true)
    expect(ctx?.snippet.length).toBe(58)
  })
})

describe('selectConnectionBanner', () => {
  test('null when connected, present with a message otherwise', () => {
    expect(
      selectConnectionBanner(run([{ type: 'connection/changed', state: 'connected' }]))
    ).toBeNull()
    const banner = selectConnectionBanner(
      run([{ type: 'connection/changed', state: 'unreachable' }])
    )
    expect(banner?.state).toBe('unreachable')
    expect(banner?.message.length).toBeGreaterThan(0)
  })
})

describe('selectDraft', () => {
  test('returns the draft text or empty string', () => {
    const s = run([{ type: 'draft/changed', chatId: 'c1', text: 'hello' }])
    expect(selectDraft(s, 'c1')).toBe('hello')
    expect(selectDraft(s, 'other')).toBe('')
  })
})
