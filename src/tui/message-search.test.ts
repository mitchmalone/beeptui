import { describe, expect, test } from 'bun:test'
import { reduce } from '@/state/reducer.ts'
import { initialState, type AppEvent, type AppState } from '@/state/types.ts'
import { localSearchMessages, toHit } from '@/tui/message-search.ts'
import type { ChatSummary, MessageSummary } from '@/beeper/types.ts'

function chat(id: string, over: Partial<ChatSummary> = {}): ChatSummary {
  return {
    id,
    accountId: 'acc',
    network: 'WhatsApp',
    title: `Title ${id}`,
    type: 'single',
    unreadCount: 0,
    isArchived: false,
    isMuted: false,
    ...over,
  }
}

function msg(id: string, chatId: string, text: string, ts: string): MessageSummary {
  return {
    id,
    chatId,
    accountId: 'acc',
    senderId: 'them',
    senderName: 'Grace',
    timestamp: ts,
    sortKey: id,
    text,
    isSender: false,
    isUnread: false,
  }
}

function run(events: AppEvent[]): AppState {
  return events.reduce(reduce, initialState)
}

const seeded = run([
  { type: 'chats/loaded', chats: [chat('c1'), chat('c2', { network: 'Slack' })] },
  {
    type: 'messages/loaded',
    chatId: 'c1',
    page: 'initial',
    messages: [
      msg('m1', 'c1', 'Are we still on for Friday?', '2026-07-30T01:00:00.000Z'),
      msg('m2', 'c1', 'Lunch tomorrow?', '2026-07-30T02:00:00.000Z'),
    ],
  },
  {
    type: 'messages/loaded',
    chatId: 'c2',
    page: 'initial',
    messages: [msg('m3', 'c2', 'Friday deploy is green', '2026-07-30T03:00:00.000Z')],
  },
])

describe('toHit', () => {
  test('enriches a message with chat title + network and a trimmed snippet', () => {
    const hit = toHit(seeded, msg('m1', 'c1', '  hello   world  ', '2026-07-30T01:00:00.000Z'))
    expect(hit).toMatchObject({
      messageId: 'm1',
      chatId: 'c1',
      chatTitle: 'Title c1',
      network: 'WhatsApp',
      senderName: 'Grace',
      snippet: 'hello world',
    })
  })
})

describe('localSearchMessages', () => {
  test('finds matches across all loaded chats, newest first', () => {
    const hits = localSearchMessages(seeded, 'friday', null)
    expect(hits.map((h) => h.messageId)).toEqual(['m3', 'm1']) // m3 newer
  })

  test('scopes to a single chat when asked', () => {
    const hits = localSearchMessages(seeded, 'friday', 'c1')
    expect(hits.map((h) => h.messageId)).toEqual(['m1'])
  })

  test('empty query yields nothing', () => {
    expect(localSearchMessages(seeded, '  ', null)).toEqual([])
  })
})
