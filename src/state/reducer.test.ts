import { describe, expect, test } from 'bun:test'
import { reduce } from '@/state/reducer.ts'
import { initialState, MAX_MESSAGES_PER_CHAT, type AppEvent, type AppState } from '@/state/types.ts'
import type { ChatSummary, MessageSummary } from '@/beeper/types.ts'

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

function msg(id: string, sortKey: string, over: Partial<MessageSummary> = {}): MessageSummary {
  return {
    id,
    chatId: 'c1',
    accountId: 'acc',
    senderId: 'them',
    timestamp: `2026-07-30T00:00:${sortKey.padStart(2, '0')}.000Z`,
    sortKey,
    text: id,
    isSender: false,
    isUnread: false,
    ...over,
  }
}

/** Apply a sequence of events from initial state. */
function run(events: AppEvent[], from: AppState = initialState): AppState {
  return events.reduce(reduce, from)
}

describe('connection + server + accounts + error', () => {
  test('connection/changed sets state', () => {
    expect(run([{ type: 'connection/changed', state: 'connected' }]).connection).toBe('connected')
  })

  test('accounts/loaded normalizes into map + order', () => {
    const s = run([
      {
        type: 'accounts/loaded',
        accounts: [
          {
            id: 'a',
            network: 'WhatsApp',
            bridgeType: 'whatsapp',
            provider: 'local',
            displayName: 'Ada',
          },
          { id: 'b', network: 'Slack', bridgeType: 'slackgo', provider: 'cloud', displayName: 'B' },
        ],
      },
    ])
    expect(s.accountOrder).toEqual(['a', 'b'])
    expect(s.accounts.a?.network).toBe('WhatsApp')
  })

  test('error raised then cleared', () => {
    const raised = run([{ type: 'error/raised', kind: 'unreachable', message: 'x' }])
    expect(raised.error?.kind).toBe('unreachable')
    expect(run([{ type: 'error/cleared' }], raised).error).toBeNull()
  })
})

describe('chats', () => {
  test('chats/loaded orders by lastActivity desc, missing activity last', () => {
    const s = run([
      {
        type: 'chats/loaded',
        chats: [
          chat('old', { lastActivity: '2026-07-30T01:00:00.000Z' }),
          chat('new', { lastActivity: '2026-07-30T03:00:00.000Z' }),
          chat('none'),
          chat('mid', { lastActivity: '2026-07-30T02:00:00.000Z' }),
        ],
      },
    ])
    expect(s.chatOrder).toEqual(['new', 'mid', 'old', 'none'])
  })

  test('chats/upserted inserts new and re-sorts, updates existing', () => {
    const base = run([
      { type: 'chats/loaded', chats: [chat('a', { lastActivity: '2026-07-30T01:00:00.000Z' })] },
    ])
    const s = run(
      [{ type: 'chats/upserted', chat: chat('b', { lastActivity: '2026-07-30T05:00:00.000Z' }) }],
      base
    )
    expect(s.chatOrder).toEqual(['b', 'a'])
    const updated = run(
      [
        {
          type: 'chats/upserted',
          chat: chat('a', { unreadCount: 9, lastActivity: '2026-07-30T09:00:00.000Z' }),
        },
      ],
      s
    )
    expect(updated.chats.a?.unreadCount).toBe(9)
    expect(updated.chatOrder).toEqual(['a', 'b'])
  })
})

describe('messages paging', () => {
  test('initial load sorts ascending by sortKey', () => {
    const s = run([
      {
        type: 'messages/loaded',
        chatId: 'c1',
        page: 'initial',
        messages: [msg('m2', '2'), msg('m1', '1'), msg('m3', '3')],
      },
    ])
    expect(s.messagesByChat.c1?.items.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
    expect(s.messagesByChat.c1?.items.every((m) => m.status === 'sent')).toBe(true)
  })

  test('older page prepends, newer page appends, dedup by id', () => {
    let s = run([
      {
        type: 'messages/loaded',
        chatId: 'c1',
        page: 'initial',
        messages: [msg('m5', '5'), msg('m6', '6')],
      },
    ])
    s = run(
      [
        {
          type: 'messages/loaded',
          chatId: 'c1',
          page: 'older',
          messages: [msg('m3', '3'), msg('m5', '5')],
        },
      ],
      s
    )
    s = run(
      [{ type: 'messages/loaded', chatId: 'c1', page: 'newer', messages: [msg('m7', '7')] }],
      s
    )
    expect(s.messagesByChat.c1?.items.map((m) => m.id)).toEqual(['m3', 'm5', 'm6', 'm7'])
  })

  test('bounded to MAX, evicting oldest on newer growth', () => {
    const many = Array.from({ length: MAX_MESSAGES_PER_CHAT + 10 }, (_, i) =>
      msg(`m${i}`, String(i).padStart(5, '0'))
    )
    const s = run([{ type: 'messages/loaded', chatId: 'c1', page: 'initial', messages: many }])
    const items = s.messagesByChat.c1?.items ?? []
    expect(items).toHaveLength(MAX_MESSAGES_PER_CHAT)
    expect(items[items.length - 1]?.id).toBe(`m${MAX_MESSAGES_PER_CHAT + 9}`)
  })

  test('message/received appends and dedups (reconnect replay is a no-op)', () => {
    let s = run([
      { type: 'messages/loaded', chatId: 'c1', page: 'initial', messages: [msg('m1', '1')] },
    ])
    s = run([{ type: 'message/received', message: msg('m2', '2') }], s)
    s = run([{ type: 'message/received', message: msg('m2', '2') }], s) // replay
    expect(s.messagesByChat.c1?.items.map((m) => m.id)).toEqual(['m1', 'm2'])
  })
})

describe('focus + pagination metadata', () => {
  test('focus/changed switches the focused pane', () => {
    expect(run([{ type: 'focus/changed', focus: 'conversation' }]).focus).toBe('conversation')
    expect(initialState.focus).toBe('inbox')
  })

  test('conversation/scrolled clamps within loaded messages; chat/selected resets it', () => {
    const base = run([
      { type: 'chats/loaded', chats: [chat('c1')] },
      { type: 'chat/selected', chatId: 'c1' },
      {
        type: 'messages/loaded',
        chatId: 'c1',
        page: 'initial',
        messages: [msg('m1', '1'), msg('m2', '2'), msg('m3', '3')],
      },
    ])
    const up = run([{ type: 'conversation/scrolled', delta: 99 }], base)
    expect(up.conversationOffset).toBe(2) // clamped to count - 1
    const down = run([{ type: 'conversation/scrolled', delta: -99 }], up)
    expect(down.conversationOffset).toBe(0)
    // Switching chats snaps back to the newest.
    expect(run([{ type: 'chat/selected', chatId: 'other' }], up).conversationOffset).toBe(0)
  })

  test('messages/loaded records hasMoreOlder and the older cursor', () => {
    const s = run([
      {
        type: 'messages/loaded',
        chatId: 'c1',
        page: 'initial',
        messages: [msg('m1', '1')],
        hasMoreOlder: true,
        olderCursor: 'CUR-9',
      },
    ])
    expect(s.messagesByChat.c1?.hasMoreOlder).toBe(true)
    expect(s.messagesByChat.c1?.olderCursor).toBe('CUR-9')
  })
})

describe('new-messages affordance (scrolled up)', () => {
  const seed: AppEvent[] = [
    { type: 'chats/loaded', chats: [chat('c1')] },
    { type: 'chat/selected', chatId: 'c1' },
    {
      type: 'messages/loaded',
      chatId: 'c1',
      page: 'initial',
      messages: [msg('m1', '1'), msg('m2', '2'), msg('m3', '3')],
    },
  ]

  test('a message arriving while scrolled up preserves position and flags new-below', () => {
    const scrolled = run([...seed, { type: 'conversation/scrolled', delta: 2 }])
    expect(scrolled.conversationOffset).toBe(2)
    const after = run([{ type: 'message/received', message: msg('m4', '4') }], scrolled)
    // Offset bumped by 1 so the visible window is unchanged; flag set.
    expect(after.conversationOffset).toBe(3)
    expect(after.newMessagesBelow).toBe(true)
  })

  test('a message arriving at the bottom (offset 0) does not raise the flag', () => {
    const after = run([...seed, { type: 'message/received', message: msg('m4', '4') }])
    expect(after.newMessagesBelow).toBe(false)
    expect(after.conversationOffset).toBe(0)
  })

  test('scrolling back to the bottom dismisses the affordance', () => {
    let s = run([...seed, { type: 'conversation/scrolled', delta: 2 }])
    s = run([{ type: 'message/received', message: msg('m4', '4') }], s)
    expect(s.newMessagesBelow).toBe(true)
    s = run([{ type: 'conversation/scrolled', delta: -99 }], s)
    expect(s.conversationOffset).toBe(0)
    expect(s.newMessagesBelow).toBe(false)
  })

  test('a message for a different chat never raises the flag', () => {
    const s = run([
      ...seed,
      { type: 'conversation/scrolled', delta: 2 },
      { type: 'message/received', message: msg('x', '9', { chatId: 'other' }) },
    ])
    expect(s.newMessagesBelow).toBe(false)
  })
})

describe('selection + drafts', () => {
  test('chat/selected sets and clears', () => {
    expect(run([{ type: 'chat/selected', chatId: 'c1' }]).selectedChatId).toBe('c1')
    expect(run([{ type: 'chat/selected', chatId: null }]).selectedChatId).toBeNull()
  })

  test('draft/changed stores per chat; empty string clears', () => {
    let s = run([{ type: 'draft/changed', chatId: 'c1', text: 'hi' }])
    expect(s.drafts.c1).toBe('hi')
    s = run([{ type: 'draft/changed', chatId: 'c1', text: '' }], s)
    expect(s.drafts.c1).toBeUndefined()
  })
})

describe('optimistic send lifecycle', () => {
  const requested: AppEvent = {
    type: 'send/requested',
    chatId: 'c1',
    clientId: 'cid-1',
    text: 'On it.',
    timestamp: '2026-07-30T00:00:09.000Z',
  }

  test('requested creates a pending message that sorts last', () => {
    const s = run([
      { type: 'messages/loaded', chatId: 'c1', page: 'initial', messages: [msg('m1', '1')] },
      requested,
    ])
    const items = s.messagesByChat.c1?.items ?? []
    expect(items.map((m) => m.id)).toEqual(['m1', 'cid-1'])
    expect(items[1]).toMatchObject({
      status: 'pending',
      isSender: true,
      text: 'On it.',
      clientId: 'cid-1',
    })
  })

  test('succeeded reconciles the pending into a sent server message', () => {
    const s = run([
      requested,
      {
        type: 'send/succeeded',
        chatId: 'c1',
        clientId: 'cid-1',
        message: msg('server-9', '9', { isSender: true }),
      },
    ])
    const items = s.messagesByChat.c1?.items ?? []
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 'server-9', status: 'sent' })
    expect(items[0]?.clientId).toBeUndefined()
  })

  test('failed marks the pending visible-failed; retry returns it to pending', () => {
    let s = run([requested, { type: 'send/failed', chatId: 'c1', clientId: 'cid-1' }])
    expect(s.messagesByChat.c1?.items[0]?.status).toBe('failed')
    s = run([{ type: 'send/retried', chatId: 'c1', clientId: 'cid-1' }], s)
    expect(s.messagesByChat.c1?.items[0]?.status).toBe('pending')
  })

  test('success after a failure still reconciles (race)', () => {
    const s = run([
      requested,
      { type: 'send/failed', chatId: 'c1', clientId: 'cid-1' },
      {
        type: 'send/succeeded',
        chatId: 'c1',
        clientId: 'cid-1',
        message: msg('server-9', '9', { isSender: true }),
      },
    ])
    const items = s.messagesByChat.c1?.items ?? []
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 'server-9', status: 'sent' })
  })

  test('duplicate succeeded does not duplicate the message', () => {
    const succeed: AppEvent = {
      type: 'send/succeeded',
      chatId: 'c1',
      clientId: 'cid-1',
      message: msg('server-9', '9', { isSender: true }),
    }
    const s = run([requested, succeed, succeed])
    expect(s.messagesByChat.c1?.items).toHaveLength(1)
  })

  test('a live echo of the same server id after success does not duplicate', () => {
    const s = run([
      requested,
      {
        type: 'send/succeeded',
        chatId: 'c1',
        clientId: 'cid-1',
        message: msg('server-9', '9', { isSender: true }),
      },
      { type: 'message/received', message: msg('server-9', '9', { isSender: true }) },
    ])
    expect(s.messagesByChat.c1?.items).toHaveLength(1)
  })
})

describe('immutability', () => {
  test('reducer never mutates the prior state', () => {
    const before = run([{ type: 'chats/loaded', chats: [chat('a')] }])
    const snapshot = JSON.stringify(before)
    reduce(before, { type: 'chats/upserted', chat: chat('b') })
    reduce(before, { type: 'chat/selected', chatId: 'a' })
    reduce(before, {
      type: 'messages/loaded',
      chatId: 'a',
      page: 'initial',
      messages: [msg('m1', '1')],
    })
    expect(JSON.stringify(before)).toBe(snapshot)
  })

  test('unknown chat id for messages is handled without throwing', () => {
    expect(() =>
      run([{ type: 'message/received', message: msg('m1', '1', { chatId: 'ghost' }) }])
    ).not.toThrow()
  })
})
