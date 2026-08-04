import { describe, expect, test } from 'bun:test'
import { reduce } from '@/state/reducer.ts'
import { initialState, MAX_MESSAGES_PER_CHAT, type AppEvent, type AppState } from '@/state/types.ts'
import { CONVERSATION_ACTIONS, QUICK_REACTIONS } from '@/state/reactions.ts'
import { RAIL_ARCHIVED_ID } from '@/state/types.ts'
import { conversationContentWidth, visibleRows } from '@/state/conversation-scroll.ts'
import { layOutMessages, totalRows } from '@/state/message-layout.ts'

import type { ChatSummary, MessageSummary } from '@/beeper/types.ts'

/** Lay out at the same width the reducer derives from a 120-column terminal —
 *  assert against a different width and the row counts silently disagree. */
const CONTENT_WIDTH = conversationContentWidth(120, 'comfortable')

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

describe('overlays (search / help)', () => {
  test('opening search sets the overlay and clears the query', () => {
    const s = run([
      { type: 'search/queryChanged', query: 'stale' },
      { type: 'overlay/opened', overlay: 'search' },
    ])
    expect(s.overlay).toBe('search')
    expect(s.searchQuery).toBe('')
  })

  test('query changes while searching; closing resets overlay + query', () => {
    let s = run([
      { type: 'overlay/opened', overlay: 'search' },
      { type: 'search/queryChanged', query: 'grace' },
    ])
    expect(s.searchQuery).toBe('grace')
    s = run([{ type: 'overlay/closed' }], s)
    expect(s.overlay).toBe('none')
    expect(s.searchQuery).toBe('')
  })

  test('help overlay opens and closes', () => {
    expect(run([{ type: 'overlay/opened', overlay: 'help' }]).overlay).toBe('help')
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

  test('succeeded confirms the pending as sent, keeping its clientId until the echo', () => {
    const s = run([requested, { type: 'send/succeeded', chatId: 'c1', clientId: 'cid-1' }])
    const items = s.messagesByChat.c1?.items ?? []
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'cid-1',
      status: 'sent',
      clientId: 'cid-1',
      text: 'On it.',
    })
  })

  test('failed marks the pending visible-failed; retry returns it to pending', () => {
    let s = run([requested, { type: 'send/failed', chatId: 'c1', clientId: 'cid-1' }])
    expect(s.messagesByChat.c1?.items[0]?.status).toBe('failed')
    s = run([{ type: 'send/retried', chatId: 'c1', clientId: 'cid-1' }], s)
    expect(s.messagesByChat.c1?.items[0]?.status).toBe('pending')
  })

  test('success after a failure still confirms as sent', () => {
    const s = run([
      requested,
      { type: 'send/failed', chatId: 'c1', clientId: 'cid-1' },
      { type: 'send/succeeded', chatId: 'c1', clientId: 'cid-1' },
    ])
    const items = s.messagesByChat.c1?.items ?? []
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ status: 'sent', clientId: 'cid-1' })
  })

  test('duplicate succeeded does not duplicate the message', () => {
    const succeed: AppEvent = { type: 'send/succeeded', chatId: 'c1', clientId: 'cid-1' }
    const s = run([requested, succeed, succeed])
    expect(s.messagesByChat.c1?.items).toHaveLength(1)
  })

  test('the live echo replaces the optimistic message (own id + real sender) — no double-up', () => {
    // The reported bug: the WS echo has its own server id and real sender name,
    // so it must reconcile against our optimistic "You" message by text, not id.
    const s = run([
      requested, // optimistic "On it." (senderId 'me')
      { type: 'send/succeeded', chatId: 'c1', clientId: 'cid-1' },
      {
        type: 'message/received',
        message: msg('server-9', '9', {
          isSender: true,
          senderName: 'gracehopper',
          text: 'On it.',
        }),
      },
    ])
    const items = s.messagesByChat.c1?.items ?? []
    expect(items).toHaveLength(1) // was 2: optimistic "You" + echo "gracehopper"
    expect(items[0]).toMatchObject({ id: 'server-9', senderName: 'gracehopper', text: 'On it.' })
    expect(items[0]?.clientId).toBeUndefined() // now the real server message
  })

  test('a live echo arriving before send/succeeded still reconciles to one', () => {
    const s = run([
      requested,
      {
        type: 'message/received',
        message: msg('server-9', '9', { isSender: true, text: 'On it.' }),
      },
      { type: 'send/succeeded', chatId: 'c1', clientId: 'cid-1' },
    ])
    const items = s.messagesByChat.c1?.items ?? []
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('server-9')
  })

  test('loading OLDER history with a repeated phrase does not evict a pending send', () => {
    const s = run([
      requested, // pending "On it."
      {
        type: 'messages/loaded',
        chatId: 'c1',
        page: 'older',
        messages: [msg('old-1', '1', { isSender: true, text: 'On it.' })],
      },
    ])
    const items = s.messagesByChat.c1?.items ?? []
    expect(items).toHaveLength(2) // old sent one + our still-pending one
    expect(items.some((m) => m.clientId === 'cid-1' && m.status === 'pending')).toBe(true)
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

describe('bounded live-message buffering', () => {
  const seed: AppEvent[] = [
    { type: 'chats/loaded', chats: [chat('c1'), chat('other')] },
    { type: 'chat/selected', chatId: 'c1' },
  ]

  test('a live message for an unselected chat with no window is not buffered', () => {
    // The chat's list row updates via `chats/upserted`; its history loads on
    // open. Buffering every chat that receives traffic would grow without bound.
    const s = run([
      ...seed,
      { type: 'message/received', message: msg('x', '1', { chatId: 'other' }) },
    ])
    expect(s.messagesByChat['other']).toBeUndefined()
  })

  test('a live message for the selected chat buffers even before history loads', () => {
    const s = run([...seed, { type: 'message/received', message: msg('m1', '1') }])
    expect(s.messagesByChat['c1']?.items).toHaveLength(1)
  })

  test('a live message for a previously-viewed chat (existing window) still buffers', () => {
    const s = run([
      ...seed,
      { type: 'messages/loaded', chatId: 'other', page: 'initial', messages: [] },
      { type: 'message/received', message: msg('x', '1', { chatId: 'other' }) },
    ])
    expect(s.messagesByChat['other']?.items).toHaveLength(1)
  })

  test('live overflow that evicts the oldest re-marks older history as loadable', () => {
    const full = Array.from({ length: MAX_MESSAGES_PER_CHAT }, (_, n) =>
      msg(`m${n}`, String(n).padStart(4, '0'))
    )
    let s = run([
      ...seed,
      {
        type: 'messages/loaded',
        chatId: 'c1',
        page: 'initial',
        messages: full,
        hasMoreOlder: false,
        olderCursor: null,
      },
    ])
    expect(s.messagesByChat['c1']?.hasMoreOlder).toBe(false)
    s = run([{ type: 'message/received', message: msg('newest', '9999') }], s)
    expect(s.messagesByChat['c1']?.items).toHaveLength(MAX_MESSAGES_PER_CHAT)
    // The oldest message was evicted, so older history exists again — claiming
    // "start of conversation" here would be silently wrong.
    expect(s.messagesByChat['c1']?.hasMoreOlder).toBe(true)
  })
})

describe('inbox filter (network rail)', () => {
  const withAccounts = run([
    {
      type: 'accounts/loaded',
      accounts: [
        {
          id: 'wa',
          network: 'WhatsApp',
          bridgeType: 'whatsapp',
          provider: 'local',
          displayName: 'WA',
        },
        {
          id: 'fb',
          network: 'Facebook',
          bridgeType: 'facebook',
          provider: 'local',
          displayName: 'FB',
        },
      ],
    },
  ])

  test('defaults to all / active / all-messages', () => {
    expect(initialState.filter).toEqual({ scope: 'all', archived: false, unreadOnly: false })
  })

  test('scopeCycled walks all → accounts → wrap, forward and back', () => {
    const s1 = reduce(withAccounts, { type: 'filter/scopeCycled', direction: 1 })
    expect(s1.filter.scope).toBe('wa')
    const s2 = reduce(s1, { type: 'filter/scopeCycled', direction: 1 })
    expect(s2.filter.scope).toBe('fb')
    const s3 = reduce(s2, { type: 'filter/scopeCycled', direction: 1 })
    expect(s3.filter.scope).toBe('all') // wraps
    const back = reduce(withAccounts, { type: 'filter/scopeCycled', direction: -1 })
    expect(back.filter.scope).toBe('fb') // wraps backward
  })

  test('scopeSelected sets scope directly', () => {
    const s = reduce(withAccounts, { type: 'filter/scopeSelected', scope: 'fb' })
    expect(s.filter.scope).toBe('fb')
  })

  test('archived and unread toggles flip independently', () => {
    const a = reduce(withAccounts, { type: 'filter/archivedToggled' })
    expect(a.filter).toMatchObject({ archived: true, unreadOnly: false })
    const b = reduce(a, { type: 'filter/unreadToggled' })
    expect(b.filter).toMatchObject({ archived: true, unreadOnly: true })
    const c = reduce(b, { type: 'filter/archivedToggled' })
    expect(c.filter).toMatchObject({ archived: false, unreadOnly: true })
  })

  test('cycling with no accounts stays on all', () => {
    const s = reduce(initialState, { type: 'filter/scopeCycled', direction: 1 })
    expect(s.filter.scope).toBe('all')
  })

  test('scopeSelected/scopeCycled keep the rail cursor in sync', () => {
    expect(reduce(withAccounts, { type: 'filter/scopeSelected', scope: 'fb' }).railCursor).toBe(
      'fb'
    )
    expect(reduce(withAccounts, { type: 'filter/scopeCycled', direction: 1 }).railCursor).toBe('wa')
  })

  test('rail/cursorMoved walks scopes then the Archived toggle, wrapping', () => {
    let s = reduce(withAccounts, { type: 'rail/cursorMoved', direction: 1 })
    expect(s.railCursor).toBe('wa')
    expect(s.filter.scope).toBe('wa') // landing on a scope live-selects it
    s = reduce(s, { type: 'rail/cursorMoved', direction: 1 })
    expect(s.railCursor).toBe('fb')
    s = reduce(s, { type: 'rail/cursorMoved', direction: 1 })
    expect(s.railCursor).toBe('archived') // after the last account
    s = reduce(s, { type: 'rail/cursorMoved', direction: 1 })
    expect(s.railCursor).toBe('all') // wraps
  })

  test('resting the cursor on Archived leaves the active scope untouched', () => {
    // Select fb, then move up onto Archived (fb → archived is one step back).
    const onFb = reduce(withAccounts, { type: 'filter/scopeSelected', scope: 'fb' })
    const onArchived = reduce(onFb, { type: 'rail/cursorMoved', direction: 1 })
    expect(onArchived.railCursor).toBe('archived')
    expect(onArchived.filter.scope).toBe('fb') // scope preserved — Archived is a toggle, not a scope
  })

  test('focusing the rail syncs the cursor to the active scope', () => {
    // Park the cursor on Archived, switch away, then re-focus the rail.
    const parked = run(
      [
        { type: 'filter/scopeSelected', scope: 'wa' },
        { type: 'rail/cursorMoved', direction: -1 }, // wa → all? walk to archived instead
      ],
      withAccounts
    )
    const refocused = reduce(
      { ...parked, railCursor: 'archived' },
      {
        type: 'focus/changed',
        focus: 'rail',
      }
    )
    expect(refocused.railCursor).toBe(refocused.filter.scope)
  })
})

describe('density', () => {
  test('defaults to comfortable and toggles back and forth', () => {
    expect(initialState.density).toBe('comfortable')
    const a = reduce(initialState, { type: 'density/toggled' })
    expect(a.density).toBe('compact')
    const b = reduce(a, { type: 'density/toggled' })
    expect(b.density).toBe('comfortable')
  })
})

describe('theme', () => {
  test('defaults to system and theme/selected records the name', () => {
    expect(initialState.themeName).toBe('system')
    expect(reduce(initialState, { type: 'theme/selected', name: 'dracula' }).themeName).toBe(
      'dracula'
    )
  })
})

describe('message search overlay', () => {
  const hit = (id: string) => ({
    messageId: id,
    chatId: 'c1',
    chatTitle: 'Chat',
    network: 'WhatsApp',
    senderName: 'Grace',
    timestamp: '2026-07-30T00:00:00.000Z',
    snippet: id,
  })

  test('opened sets the overlay and captures the scope', () => {
    const s = reduce(initialState, { type: 'messageSearch/opened', scopeChatId: 'c1' })
    expect(s.overlay).toBe('messageSearch')
    expect(s.messageSearch.scopeChatId).toBe('c1')
    expect(s.messageSearch.status).toBe('idle')
  })

  test('queryChanged invalidates prior results', () => {
    const s = run([
      { type: 'messageSearch/opened', scopeChatId: null },
      { type: 'messageSearch/requested' },
      { type: 'messageSearch/resultsLoaded', results: [hit('a')], partial: false, note: null },
      { type: 'messageSearch/queryChanged', query: 'fri' },
    ])
    expect(s.messageSearch.query).toBe('fri')
    expect(s.messageSearch.status).toBe('idle')
    expect(s.messageSearch.results).toEqual([])
  })

  test('requested → resultsLoaded carries partial + note', () => {
    const s = run([
      { type: 'messageSearch/opened', scopeChatId: null },
      { type: 'messageSearch/requested' },
      {
        type: 'messageSearch/resultsLoaded',
        results: [hit('a'), hit('b')],
        partial: true,
        note: 'Local results',
      },
    ])
    expect(s.messageSearch.status).toBe('done')
    expect(s.messageSearch.results).toHaveLength(2)
    expect(s.messageSearch.partial).toBe(true)
    expect(s.messageSearch.note).toBe('Local results')
  })

  test('failed clears results and records a note', () => {
    const s = run([
      { type: 'messageSearch/opened', scopeChatId: null },
      { type: 'messageSearch/failed', note: 'Search unavailable' },
    ])
    expect(s.messageSearch.status).toBe('error')
    expect(s.messageSearch.results).toEqual([])
    expect(s.messageSearch.note).toBe('Search unavailable')
  })

  test('selectionMoved clamps within results', () => {
    const base = run([
      { type: 'messageSearch/opened', scopeChatId: null },
      {
        type: 'messageSearch/resultsLoaded',
        results: [hit('a'), hit('b')],
        partial: false,
        note: null,
      },
    ])
    const up = reduce(base, { type: 'messageSearch/selectionMoved', delta: -1 })
    expect(up.messageSearch.selectedIndex).toBe(0) // clamped at top
    const down = reduce(base, { type: 'messageSearch/selectionMoved', delta: 1 })
    expect(down.messageSearch.selectedIndex).toBe(1)
    const past = reduce(down, { type: 'messageSearch/selectionMoved', delta: 1 })
    expect(past.messageSearch.selectedIndex).toBe(1) // clamped at bottom
  })

  test('closed resets the overlay and search state', () => {
    const s = run([
      { type: 'messageSearch/opened', scopeChatId: 'c1' },
      { type: 'messageSearch/closed' },
    ])
    expect(s.overlay).toBe('none')
    expect(s.messageSearch.scopeChatId).toBeNull()
    expect(s.messageSearch.results).toEqual([])
  })
})

describe('render stability (compose typing perf)', () => {
  test('draft/changed leaves the slices the panels memoize on referentially identical', () => {
    const base = run([
      { type: 'accounts/loaded', accounts: [] },
      { type: 'chats/loaded', chats: [chat('c1')] },
      { type: 'chat/selected', chatId: 'c1' },
      { type: 'messages/loaded', chatId: 'c1', page: 'initial', messages: [msg('m1', '1')] },
    ])
    const after = reduce(base, { type: 'draft/changed', chatId: 'c1', text: 'hi' })
    // Typing must not invalidate the inbox / rail / conversation memo deps, or
    // the whole tree re-renders per keystroke (the jank we fixed).
    expect(after.chats).toBe(base.chats)
    expect(after.chatOrder).toBe(base.chatOrder)
    expect(after.messagesByChat).toBe(base.messagesByChat)
    expect(after.selectedChatId).toBe(base.selectedChatId)
    expect(after.filter).toBe(base.filter)
    expect(after.accounts).toBe(base.accounts)
    expect(after.drafts).not.toBe(base.drafts) // only drafts changed
  })
})

describe('notice', () => {
  test('shown sets it; cleared and selecting a chat both clear it', () => {
    const shown = reduce(initialState, { type: 'notice/shown', message: 'Chat archived.' })
    expect(shown.notice).toBe('Chat archived.')
    expect(reduce(shown, { type: 'notice/cleared' }).notice).toBeNull()
    // Navigating to another chat clears a stale notice.
    expect(reduce(shown, { type: 'chat/selected', chatId: 'c9' }).notice).toBeNull()
  })
})

describe('message selection + reply', () => {
  /** A chat c1 selected with three loaded messages (oldest → newest: m1,m2,m3). */
  function seeded(): AppState {
    return run([
      { type: 'chats/loaded', chats: [chat('c1')] },
      { type: 'chat/selected', chatId: 'c1' },
      {
        type: 'messages/loaded',
        chatId: 'c1',
        messages: [msg('m1', '1'), msg('m2', '2'), msg('m3', '3')],
        page: 'initial',
      },
    ])
  }

  test('started selects the newest loaded message', () => {
    const s = reduce(seeded(), { type: 'messageSelection/started' })
    expect(s.selectedMessageId).toBe('m3')
  })

  test('started is a no-op when the active chat has no messages', () => {
    const empty = run([
      { type: 'chats/loaded', chats: [chat('c1')] },
      { type: 'chat/selected', chatId: 'c1' },
    ])
    expect(reduce(empty, { type: 'messageSelection/started' }).selectedMessageId).toBeNull()
  })

  test('moved from no selection starts at the newest, then walks older/newer and clamps', () => {
    let s = reduce(seeded(), { type: 'messageSelection/moved', delta: -1 })
    expect(s.selectedMessageId).toBe('m2') // newest is m3; -1 → m2
    s = reduce(s, { type: 'messageSelection/moved', delta: -1 })
    expect(s.selectedMessageId).toBe('m1')
    s = reduce(s, { type: 'messageSelection/moved', delta: -1 })
    expect(s.selectedMessageId).toBe('m1') // clamped at the oldest
    s = reduce(s, { type: 'messageSelection/moved', delta: 1 })
    expect(s.selectedMessageId).toBe('m2')
  })

  test('cleared drops the selection', () => {
    const s = reduce(seeded(), { type: 'messageSelection/started' })
    expect(reduce(s, { type: 'messageSelection/cleared' }).selectedMessageId).toBeNull()
  })

  test('moved jumps to an edge with a large delta (top/bottom)', () => {
    const top = reduce(seeded(), { type: 'messageSelection/moved', delta: -100 })
    expect(top.selectedMessageId).toBe('m1') // oldest
    const bottom = reduce(top, { type: 'messageSelection/moved', delta: 100 })
    expect(bottom.selectedMessageId).toBe('m3') // newest
  })

  test('reply/started records the target and exits selection mode', () => {
    const s = reduce(seeded(), { type: 'messageSelection/started' })
    const replying = reduce(s, { type: 'reply/started', messageId: 'm2' })
    expect(replying.replyTo).toBe('m2')
    expect(replying.selectedMessageId).toBeNull()
  })

  test('reply/cancelled clears the reply target', () => {
    const s = reduce(seeded(), { type: 'reply/started', messageId: 'm2' })
    expect(reduce(s, { type: 'reply/cancelled' }).replyTo).toBeNull()
  })

  test('selecting another chat clears selection + reply', () => {
    const s = run(
      [{ type: 'messageSelection/started' }, { type: 'reply/started', messageId: 'm3' }],
      seeded()
    )
    // reply/started already cleared selection; set one again to prove chat switch clears both.
    const withBoth = reduce(s, { type: 'messageSelection/started' })
    const switched = reduce(withBoth, { type: 'chat/selected', chatId: 'c2' })
    expect(switched.selectedMessageId).toBeNull()
    expect(switched.replyTo).toBeNull()
  })

  test('an edited inbound message updates in place with the edit marker (no duplicate)', () => {
    const base = seeded()
    const edited = reduce(base, {
      type: 'message/received',
      message: msg('m2', '2', { text: 'edited body', isEdited: true }),
    })
    const items = edited.messagesByChat['c1']?.items ?? []
    expect(items).toHaveLength(3) // replaced in place, not appended
    const m2 = items.find((m) => m.id === 'm2')
    expect(m2?.text).toBe('edited body')
    expect(m2?.isEdited).toBe(true)
  })

  test('send/requested with a reply carries the target and consumes the reply context', () => {
    const s = reduce(seeded(), { type: 'reply/started', messageId: 'm2' })
    const sent = reduce(s, {
      type: 'send/requested',
      chatId: 'c1',
      clientId: 'cid-1',
      text: 'sure',
      timestamp: '2026-07-30T02:00:10.000Z',
      replyToId: 'm2',
    })
    expect(sent.replyTo).toBeNull()
    const pending = sent.messagesByChat['c1']?.items.find((m) => m.clientId === 'cid-1')
    expect(pending?.replyToId).toBe('m2')
  })
})

describe('conversation navigation cursor + viewport follow', () => {
  /** A chat with ten loaded messages m0..m9 (oldest → newest). */
  function seededTen(): AppState {
    return run([
      { type: 'chats/loaded', chats: [chat('c1')] },
      { type: 'chat/selected', chatId: 'c1' },
      {
        type: 'messages/loaded',
        chatId: 'c1',
        messages: Array.from({ length: 10 }, (_, i) => msg(`m${i}`, String(i))),
        page: 'initial',
      },
    ])
  }

  test('focusing the conversation auto-selects the newest message', () => {
    const s = reduce(seededTen(), { type: 'focus/changed', focus: 'conversation' })
    expect(s.focus).toBe('conversation')
    expect(s.selectedMessageId).toBe('m9')
  })

  test('focusing the conversation keeps an existing selection', () => {
    const withSel = run(
      [
        { type: 'focus/changed', focus: 'conversation' },
        { type: 'messageSelection/moved', delta: -3 },
      ],
      seededTen()
    )
    const back = run(
      [
        { type: 'focus/changed', focus: 'inbox' },
        { type: 'focus/changed', focus: 'conversation' },
      ],
      withSel
    )
    expect(back.selectedMessageId).toBe(withSel.selectedMessageId)
  })

  test('focusing another pane does not auto-select', () => {
    const s = reduce(seededTen(), { type: 'focus/changed', focus: 'rail' })
    expect(s.selectedMessageId).toBeNull()
  })

  test('viewport/measured records both dimensions', () => {
    const s = reduce(initialState, { type: 'viewport/measured', rows: 12, cols: 120 })
    expect(s.viewportRows).toBe(12)
    expect(s.viewportCols).toBe(120)
  })

  test('a live message pins the cursor to the new newest when following at the bottom', () => {
    const start = reduce(seededTen(), { type: 'focus/changed', focus: 'conversation' })
    expect(start.selectedMessageId).toBe('m9') // newest
    const after = reduce(start, { type: 'message/received', message: msg('m10', 'x') })
    expect(after.selectedMessageId).toBe('m10') // followed to the newest
    expect(after.conversationOffset).toBe(0)
    expect(after.newMessagesBelow).toBe(false)
  })

  test('a live message leaves the cursor when parked on an older on-screen message', () => {
    const parked = run(
      [
        { type: 'viewport/measured', rows: 40, cols: 120 }, // everything fits
        { type: 'focus/changed', focus: 'conversation' },
        { type: 'messageSelection/moved', delta: -3 },
      ],
      seededTen()
    )
    const anchor = parked.selectedMessageId
    const after = reduce(parked, { type: 'message/received', message: msg('m10', 'x') })
    expect(after.selectedMessageId).toBe(anchor) // cursor left where it was
    expect(after.newMessagesBelow).toBe(false) // still on screen, no affordance
  })

  test('moving the cursor scrolls so the selection stays on screen', () => {
    // Six rows of viewport; each message is a header + one body row + a blank
    // separator, so only two fit. Enter at the newest (m9), pinned at the floor.
    const start = run(
      [
        { type: 'viewport/measured', rows: 6, cols: 120 },
        { type: 'focus/changed', focus: 'conversation' },
      ],
      seededTen()
    )
    expect(start.conversationOffset).toBe(0)
    // Walk up to m5 — well above the initial window, so the view must have
    // scrolled to keep it on screen.
    const moved = run(Array(4).fill({ type: 'messageSelection/moved', delta: -1 }), start)
    expect(moved.selectedMessageId).toBe('m5')
    const layouts = layOutMessages(moved.messagesByChat['c1']?.items ?? [], CONTENT_WIDTH)
    const visible = visibleRows(layouts, 6, moved.conversationOffset)
    expect(visible.some((r) => r.messageId === 'm5')).toBe(true)
  })

  test('viewport-follow keeps the cursor visible when messages differ in height', () => {
    // m0 is a wall of text that wraps onto many rows; the rest are one-liners.
    // A message-counting model would think it occupies a single row and scroll
    // too little, leaving the cursor off the top of the window.
    const seeded = run([
      { type: 'chats/loaded', chats: [chat('c1')] },
      { type: 'chat/selected', chatId: 'c1' },
      {
        type: 'messages/loaded',
        chatId: 'c1',
        messages: [
          msg('m0', '0', { text: 'lorem ipsum dolor sit amet '.repeat(12) }),
          msg('m1', '1'),
          msg('m2', '2'),
        ],
        page: 'initial',
      },
      { type: 'viewport/measured', rows: 8, cols: 120 },
      { type: 'focus/changed', focus: 'conversation' },
    ])
    const moved = run(Array(2).fill({ type: 'messageSelection/moved', delta: -1 }), seeded)
    expect(moved.selectedMessageId).toBe('m0')
    const layouts = layOutMessages(moved.messagesByChat['c1']?.items ?? [], CONTENT_WIDTH)
    const visible = visibleRows(layouts, 8, moved.conversationOffset)
    // Bringing all seven of its rows into an eight-row window puts its header
    // at the top — a scroll a message-counting model would never have made.
    expect(visible[0]?.messageId).toBe('m0')
    expect(visible[0]?.first).toBe(true)
    expect(visible.filter((r) => r.messageId === 'm0')).toHaveLength(7)
  })

  test('scrolling up can reach the oldest row, not just the oldest message', () => {
    const seeded = run(
      [{ type: 'viewport/measured', rows: 4, cols: 120 }],
      run([{ type: 'focus/changed', focus: 'conversation' }], seededTen())
    )
    const layouts = layOutMessages(seeded.messagesByChat['c1']?.items ?? [], CONTENT_WIDTH)
    const up = run(Array(60).fill({ type: 'conversation/scrolled', delta: 1 }), seeded)
    expect(up.conversationOffset).toBe(totalRows(layouts) - 4)
  })

  test('a message arriving while scrolled up holds the reading position in rows', () => {
    const parked = run(
      [
        { type: 'viewport/measured', rows: 6, cols: 120 },
        { type: 'conversation/scrolled', delta: 4 },
      ],
      seededTen()
    )
    expect(parked.conversationOffset).toBe(4)
    // A two-row arrival (header + body) plus the separator the previously-last
    // message now needs must move the offset by that many rows, not by one.
    const after = reduce(parked, { type: 'message/received', message: msg('m10', 'x') })
    const grew =
      totalRows(layOutMessages(after.messagesByChat['c1']?.items ?? [], CONTENT_WIDTH)) -
      totalRows(layOutMessages(parked.messagesByChat['c1']?.items ?? [], CONTENT_WIDTH))
    expect(after.conversationOffset).toBe(4 + grew)
    expect(after.newMessagesBelow).toBe(true)
  })
})

describe('action menu + emoji picker overlays', () => {
  test('opening an overlay resets both cursors', () => {
    const dirty: AppState = { ...initialState, actionCursor: 3, emojiCursor: 4 }
    const s = reduce(dirty, { type: 'overlay/opened', overlay: 'conversationActions' })
    expect(s.overlay).toBe('conversationActions')
    expect(s.actionCursor).toBe(0)
    expect(s.emojiCursor).toBe(0)
  })

  test('emojiPicker/moved clamps within the quick-reaction set', () => {
    let s = reduce(initialState, { type: 'emojiPicker/moved', delta: 1 })
    expect(s.emojiCursor).toBe(1)
    s = reduce(s, { type: 'emojiPicker/moved', delta: -5 })
    expect(s.emojiCursor).toBe(0) // clamped at the start
    s = reduce(s, { type: 'emojiPicker/moved', delta: 99 })
    expect(s.emojiCursor).toBe(QUICK_REACTIONS.length - 1) // clamped at the end
  })

  test('actionMenu/moved clamps within the action list', () => {
    const s = reduce(initialState, { type: 'actionMenu/moved', delta: 99 })
    expect(s.actionCursor).toBe(CONVERSATION_ACTIONS.length - 1)
  })
})

describe('live arrivals at a full message window', () => {
  // Once the window is capped, an arrival evicts the oldest, so the list length
  // is unchanged. Everything below used to be skipped because the reducer
  // inferred "did anything arrive" from that length.
  function full(): AppState {
    const seed = run([
      { type: 'chats/loaded', chats: [chat('c1')] },
      { type: 'chat/selected', chatId: 'c1' },
      {
        type: 'messages/loaded',
        chatId: 'c1',
        page: 'initial',
        messages: Array.from({ length: MAX_MESSAGES_PER_CHAT }, (_, i) =>
          msg(`m${i}`, String(i).padStart(5, '0'))
        ),
      },
      { type: 'viewport/measured', rows: 20, cols: 120 },
    ])
    expect(seed.messagesByChat['c1']?.items).toHaveLength(MAX_MESSAGES_PER_CHAT)
    return seed
  }

  const inbound = (id: string) => msg(id, '99999')

  test('holds the reading position when scrolled up', () => {
    const parked = reduce(full(), { type: 'conversation/scrolled', delta: 6 })
    expect(parked.conversationOffset).toBe(6)
    // The arrival must be *taller* than the message it evicts, or the row delta
    // is zero and this asserts nothing.
    const tall = msg('live', '99999', { text: 'lorem ipsum dolor sit amet '.repeat(10) })
    const after = reduce(parked, { type: 'message/received', message: tall })
    const grew =
      totalRows(layOutMessages(after.messagesByChat['c1']?.items ?? [], CONTENT_WIDTH)) -
      totalRows(layOutMessages(parked.messagesByChat['c1']?.items ?? [], CONTENT_WIDTH))
    expect(grew).toBeGreaterThan(0)
    expect(after.conversationOffset).toBe(6 + grew)
  })

  test('raises the new-messages affordance when scrolled up', () => {
    const parked = reduce(full(), { type: 'conversation/scrolled', delta: 6 })
    const after = reduce(parked, { type: 'message/received', message: inbound('live') })
    expect(after.newMessagesBelow).toBe(true)
  })

  test('follows the cursor to the new newest when pinned at the bottom', () => {
    const focused = reduce(full(), { type: 'focus/changed', focus: 'conversation' })
    expect(focused.selectedMessageId).toBe(`m${MAX_MESSAGES_PER_CHAT - 1}`)
    const after = reduce(focused, { type: 'message/received', message: inbound('live') })
    expect(after.selectedMessageId).toBe('live')
  })

  test('our own echo replacing a pending send is not an arrival', () => {
    // The echo carries a new server id but consumes the optimistic placeholder,
    // so nothing new appears to the user — no affordance.
    const parked = run(
      [
        { type: 'send/requested', chatId: 'c1', clientId: 'cid-1', text: 'hi', timestamp: 'x' },
        { type: 'conversation/scrolled', delta: 6 },
      ],
      full()
    )
    const echo = msg('server-1', '99999', { text: 'hi', isSender: true })
    const after = reduce(parked, { type: 'message/received', message: echo })
    expect(after.newMessagesBelow).toBe(false)
    expect(after.conversationOffset).toBe(parked.conversationOffset)
  })

  test('a replayed duplicate is not an arrival', () => {
    const parked = reduce(full(), { type: 'conversation/scrolled', delta: 6 })
    const replay = msg(
      `m${MAX_MESSAGES_PER_CHAT - 1}`,
      String(MAX_MESSAGES_PER_CHAT - 1).padStart(5, '0')
    )
    const after = reduce(parked, { type: 'message/received', message: replay })
    expect(after.newMessagesBelow).toBe(false)
    expect(after.conversationOffset).toBe(parked.conversationOffset)
  })

  test('paging older history never raises the affordance', () => {
    const parked = reduce(full(), { type: 'conversation/scrolled', delta: 6 })
    const after = reduce(parked, {
      type: 'messages/loaded',
      chatId: 'c1',
      page: 'older',
      messages: [msg('older-1', '00000')],
    })
    expect(after.newMessagesBelow).toBe(false)
  })
})

describe('selection follows focus (the active column always has a cursor)', () => {
  const rows = [
    chat('a', { lastActivity: '2026-07-30T03:00:00.000Z' }),
    chat('b', { lastActivity: '2026-07-30T02:00:00.000Z' }),
    chat('arch', { isArchived: true, lastActivity: '2026-07-30T01:00:00.000Z' }),
  ]

  test('chats/loaded highlights the first chat so the column is never cursorless', () => {
    const s = run([{ type: 'chats/loaded', chats: rows }])
    expect(s.selectedChatId).toBe('a')
  })

  test('the seeded chat is the first *visible* one, not the first loaded', () => {
    // Archived view: only `arch` passes the filter, so it takes the cursor.
    const s = run([{ type: 'filter/archivedToggled' }, { type: 'chats/loaded', chats: rows }])
    expect(s.selectedChatId).toBe('arch')
  })

  test('seeding never opens a chat — the conversation stays empty until ⏎', () => {
    const s = run([{ type: 'chats/loaded', chats: rows }])
    expect(s.messagesByChat['a']).toBeUndefined()
    expect(s.focus).toBe('inbox')
  })

  test('an existing selection survives a chat-list refresh', () => {
    const s = run([
      { type: 'chats/loaded', chats: rows },
      { type: 'chat/selected', chatId: 'b' },
      { type: 'chats/loaded', chats: rows },
    ])
    expect(s.selectedChatId).toBe('b')
  })

  test('a selection that falls out of the filter is re-seeded, not left dangling', () => {
    const s = run([
      { type: 'chats/loaded', chats: rows },
      { type: 'chat/selected', chatId: 'b' },
      { type: 'filter/archivedToggled' }, // b is not archived
    ])
    expect(s.selectedChatId).toBe('arch')
  })

  test('an empty filter view leaves nothing selected rather than inventing one', () => {
    const s = run([
      { type: 'chats/loaded', chats: [chat('a')] },
      { type: 'filter/archivedToggled' },
    ])
    expect(s.selectedChatId).toBeNull()
  })

  test('messages arriving after focus put the cursor on the newest', () => {
    // ⏎ focuses the conversation *before* history loads, so focus/changed finds
    // an empty list and selects nothing. The load has to finish the job.
    const opened = run([
      { type: 'chats/loaded', chats: rows },
      { type: 'chat/selected', chatId: 'a' },
      { type: 'focus/changed', focus: 'conversation' },
    ])
    expect(opened.selectedMessageId).toBeNull()
    const loaded = reduce(opened, {
      type: 'messages/loaded',
      chatId: 'a',
      page: 'initial',
      messages: [msg('m1', '1'), msg('m2', '2')],
    })
    expect(loaded.selectedMessageId).toBe('m2')
  })

  test('a later page never yanks the cursor off where the user put it', () => {
    const s = run([
      { type: 'chats/loaded', chats: rows },
      { type: 'chat/selected', chatId: 'a' },
      { type: 'focus/changed', focus: 'conversation' },
      { type: 'messages/loaded', chatId: 'a', page: 'initial', messages: [msg('m1', '1')] },
      { type: 'messageSelection/moved', delta: 0 },
      { type: 'messages/loaded', chatId: 'a', page: 'newer', messages: [msg('m2', '2')] },
    ])
    expect(s.selectedMessageId).toBe('m1')
  })

  test('loading a chat you are not looking at selects nothing', () => {
    const s = run([
      { type: 'chats/loaded', chats: rows },
      { type: 'chat/selected', chatId: 'a' },
      { type: 'messages/loaded', chatId: 'a', page: 'initial', messages: [msg('m1', '1')] },
    ])
    expect(s.focus).toBe('inbox')
    expect(s.selectedMessageId).toBeNull()
  })

  test('composing drops the message highlight but keeps the reply target', () => {
    const conv = run([
      { type: 'chats/loaded', chats: rows },
      { type: 'chat/selected', chatId: 'a' },
      { type: 'messages/loaded', chatId: 'a', page: 'initial', messages: [msg('m1', '1')] },
      { type: 'focus/changed', focus: 'conversation' },
    ])
    expect(conv.selectedMessageId).toBe('m1')
    const composing = reduce(conv, { type: 'focus/changed', focus: 'compose' })
    expect(composing.selectedMessageId).toBeNull()

    const replying = run(
      [
        { type: 'reply/started', messageId: 'm1' },
        { type: 'focus/changed', focus: 'compose' },
      ],
      conv
    )
    expect(replying.replyTo).toBe('m1')
  })

  test('coming back from compose restores the cursor', () => {
    const back = run([
      { type: 'chats/loaded', chats: rows },
      { type: 'chat/selected', chatId: 'a' },
      { type: 'messages/loaded', chatId: 'a', page: 'initial', messages: [msg('m1', '1')] },
      { type: 'focus/changed', focus: 'conversation' },
      { type: 'focus/changed', focus: 'compose' },
      { type: 'focus/changed', focus: 'conversation' },
    ])
    expect(back.selectedMessageId).toBe('m1')
  })
})

describe('going to the newest message pins to the bottom', () => {
  // A message taller than the viewport is anchored by its top when you navigate
  // *up* to it — you want to read it from the start. But seating the cursor on
  // the newest message means "show me the latest", and top-anchoring there
  // leaves a non-zero offset, which the rest of the reducer reads as "the user
  // has scrolled up": it raises the new-messages affordance and holds the
  // reading position instead of following. On a chat you just opened.
  function withTallNewest(): AppState {
    return run([
      { type: 'chats/loaded', chats: [chat('c1')] },
      { type: 'chat/selected', chatId: 'c1' },
      { type: 'viewport/measured', rows: 4, cols: 120 },
      { type: 'focus/changed', focus: 'conversation' },
      {
        type: 'messages/loaded',
        chatId: 'c1',
        page: 'initial',
        messages: [msg('m1', '1'), msg('m2', '2', { text: 'a long one '.repeat(30) })],
      },
    ])
  }

  test('opening a chat whose newest message overflows the viewport stays pinned', () => {
    const s = withTallNewest()
    expect(s.selectedMessageId).toBe('m2')
    expect(s.conversationOffset).toBe(0)
  })

  test('and therefore raises no false new-messages affordance on the next arrival', () => {
    const after = reduce(withTallNewest(), {
      type: 'message/received',
      message: msg('m3', '3'),
    })
    expect(after.newMessagesBelow).toBe(false)
    expect(after.selectedMessageId).toBe('m3')
  })

  test('G jumps to the bottom of a tall newest message, not its top', () => {
    const scrolled = reduce(withTallNewest(), { type: 'conversation/scrolled', delta: 5 })
    expect(scrolled.conversationOffset).toBeGreaterThan(0)
    const bottom = reduce(scrolled, { type: 'messageSelection/moved', delta: 999 })
    expect(bottom.conversationOffset).toBe(0)
  })

  test('navigating up to a tall older message still anchors on its top', () => {
    const tall = run([
      { type: 'chats/loaded', chats: [chat('c1')] },
      { type: 'chat/selected', chatId: 'c1' },
      { type: 'viewport/measured', rows: 4, cols: 120 },
      {
        type: 'messages/loaded',
        chatId: 'c1',
        page: 'initial',
        messages: [msg('m1', '1', { text: 'a long one '.repeat(30) }), msg('m2', '2')],
      },
      { type: 'focus/changed', focus: 'conversation' },
      { type: 'messageSelection/moved', delta: -1 },
    ])
    expect(tall.selectedMessageId).toBe('m1')
    const rows = visibleRows(
      layOutMessages(tall.messagesByChat['c1']?.items ?? [], CONTENT_WIDTH),
      4,
      tall.conversationOffset
    )
    expect(rows[0]?.messageId).toBe('m1')
    expect(rows[0]?.first).toBe(true)
  })
})

describe('moving the rail cursor keeps the Chats column highlighted', () => {
  // Reported live: All → open a chat → Esc to the rail → change network → the
  // Chats column had no highlight, because the previously selected chat belongs
  // to the network you just left and is filtered out.
  function twoNetworks(): AppState {
    return run([
      {
        type: 'accounts/loaded',
        accounts: [
          {
            id: 'a',
            network: 'WhatsApp',
            bridgeType: 'whatsapp',
            provider: 'local',
            displayName: 'A',
          },
          { id: 'b', network: 'Slack', bridgeType: 'slackgo', provider: 'cloud', displayName: 'B' },
        ],
      },
      {
        type: 'chats/loaded',
        chats: [
          chat('a1', { accountId: 'a', lastActivity: '2026-07-30T03:00:00.000Z' }),
          chat('b1', { accountId: 'b', lastActivity: '2026-07-30T02:00:00.000Z' }),
        ],
      },
    ])
  }

  test('walking the rail onto another network re-seeds onto a chat you can see', () => {
    const start = twoNetworks()
    expect(start.selectedChatId).toBe('a1')
    // all → a: a1 is still visible, so the cursor stays put.
    const onA = reduce(start, { type: 'rail/cursorMoved', direction: 1 })
    expect(onA.filter.scope).toBe('a')
    expect(onA.selectedChatId).toBe('a1')
    // a → b: a1 is now hidden; the column must not be left cursorless.
    const onB = reduce(onA, { type: 'rail/cursorMoved', direction: 1 })
    expect(onB.filter.scope).toBe('b')
    expect(onB.selectedChatId).toBe('b1')
  })

  test('landing on the Archived toggle leaves the scope and the selection alone', () => {
    const onB = run(
      [
        { type: 'rail/cursorMoved', direction: 1 },
        { type: 'rail/cursorMoved', direction: 1 },
      ],
      twoNetworks()
    )
    const onArchived = reduce(onB, { type: 'rail/cursorMoved', direction: 1 })
    expect(onArchived.railCursor).toBe(RAIL_ARCHIVED_ID)
    expect(onArchived.filter.scope).toBe('b')
    expect(onArchived.selectedChatId).toBe('b1')
  })

  test('a network with no chats leaves nothing selected rather than a hidden one', () => {
    const empty = run(
      [
        {
          type: 'chats/loaded',
          chats: [chat('a1', { accountId: 'a' })],
        },
        { type: 'rail/cursorMoved', direction: 1 },
        { type: 'rail/cursorMoved', direction: 1 },
      ],
      twoNetworks()
    )
    expect(empty.filter.scope).toBe('b')
    expect(empty.selectedChatId).toBeNull()
  })
})

describe('a chat update that hides the selection re-seeds too', () => {
  test('archiving the selected chat leaves the cursor on a visible one', () => {
    const s = run([
      {
        type: 'chats/loaded',
        chats: [
          chat('a', { lastActivity: '2026-07-30T03:00:00.000Z' }),
          chat('b', { lastActivity: '2026-07-30T02:00:00.000Z' }),
        ],
      },
    ])
    expect(s.selectedChatId).toBe('a')
    // Beeper reports it archived; the active (non-archived) view no longer shows
    // it, so the cursor must move rather than point at something invisible.
    const archived = reduce(s, {
      type: 'chats/upserted',
      chat: chat('a', { isArchived: true, lastActivity: '2026-07-30T03:00:00.000Z' }),
    })
    expect(archived.selectedChatId).toBe('b')
  })
})

describe('history pages itself when the cursor reaches the top', () => {
  function opened(over: { hasMoreOlder?: boolean; olderCursor?: string | null } = {}): AppState {
    return run([
      { type: 'chats/loaded', chats: [chat('c1')] },
      { type: 'chat/selected', chatId: 'c1' },
      { type: 'viewport/measured', rows: 20, cols: 120 },
      { type: 'focus/changed', focus: 'conversation' },
      {
        type: 'messages/loaded',
        chatId: 'c1',
        page: 'initial',
        messages: [msg('m2', '2'), msg('m3', '3')],
        hasMoreOlder: over.hasMoreOlder ?? true,
        olderCursor: over.olderCursor === undefined ? 'CUR-1' : over.olderCursor,
      },
    ])
  }

  const atOldest = (s: AppState) => run([{ type: 'messageSelection/moved', delta: -1 }], s)

  test('moving up off the oldest loaded message asks for the next page', () => {
    const s = atOldest(opened())
    expect(s.selectedMessageId).toBe('m2') // oldest loaded
    const again = reduce(s, { type: 'messageSelection/moved', delta: -1 })
    expect(again.olderPagePending).toBe('c1')
    // The cursor stays put until the page arrives — there is nowhere to go yet.
    expect(again.selectedMessageId).toBe('m2')
  })

  test('the arriving page seats the cursor one message older, by id', () => {
    const requested = reduce(atOldest(opened()), { type: 'messageSelection/moved', delta: -1 })
    const loaded = reduce(requested, {
      type: 'messages/loaded',
      chatId: 'c1',
      page: 'older',
      messages: [msg('m0', '0'), msg('m1', '1')],
      hasMoreOlder: true,
      olderCursor: 'CUR-2',
    })
    // One press, one message: the newest of the batch, not its oldest.
    expect(loaded.selectedMessageId).toBe('m1')
    expect(loaded.olderPagePending).toBeNull()
  })

  test('walking up through a second page keeps moving one message per press', () => {
    let s = reduce(atOldest(opened()), { type: 'messageSelection/moved', delta: -1 })
    s = reduce(s, {
      type: 'messages/loaded',
      chatId: 'c1',
      page: 'older',
      messages: [msg('m0', '0'), msg('m1', '1')],
      hasMoreOlder: true,
      olderCursor: 'CUR-2',
    })
    expect(s.selectedMessageId).toBe('m1')
    s = reduce(s, { type: 'messageSelection/moved', delta: -1 })
    expect(s.selectedMessageId).toBe('m0')
    s = reduce(s, { type: 'messageSelection/moved', delta: -1 })
    expect(s.olderPagePending).toBe('c1')
  })

  test('at the true start of history nothing is requested', () => {
    const s = atOldest(opened({ hasMoreOlder: false }))
    const again = reduce(s, { type: 'messageSelection/moved', delta: -1 })
    expect(again.olderPagePending).toBeNull()
    expect(again.selectedMessageId).toBe('m2')
  })

  test('a missing cursor cannot page, and does not pretend to', () => {
    const s = atOldest(opened({ olderCursor: null }))
    expect(reduce(s, { type: 'messageSelection/moved', delta: -1 }).olderPagePending).toBeNull()
  })

  test('a second press while a page is in flight does not stack requests', () => {
    const requested = reduce(atOldest(opened()), { type: 'messageSelection/moved', delta: -1 })
    const again = reduce(requested, { type: 'messageSelection/moved', delta: -1 })
    expect(again.olderPagePending).toBe('c1')
    expect(again).toEqual(requested)
  })

  test('a failed page clears the request rather than wedging the pane', () => {
    const requested = reduce(atOldest(opened()), { type: 'messageSelection/moved', delta: -1 })
    const failed = reduce(requested, {
      type: 'error/raised',
      kind: 'unreachable',
      message: 'x',
    })
    expect(failed.olderPagePending).toBeNull()
  })

  test('switching chats abandons an in-flight request', () => {
    const requested = reduce(atOldest(opened()), { type: 'messageSelection/moved', delta: -1 })
    expect(
      reduce(requested, { type: 'chat/selected', chatId: 'other' }).olderPagePending
    ).toBeNull()
  })

  test('jumping to the top with g does not page — one keypress, one fetch', () => {
    const s = reduce(opened(), { type: 'messageSelection/moved', delta: -999 })
    expect(s.selectedMessageId).toBe('m2')
    expect(s.olderPagePending).toBeNull()
  })
})
