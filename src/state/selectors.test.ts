import { describe, expect, test } from 'bun:test'
import { reduce } from '@/state/reducer.ts'
import { initialState, type AppEvent, type AppState } from '@/state/types.ts'
import {
  selectActiveConversation,
  selectConnectionBanner,
  selectDraft,
  selectInboxRows,
} from '@/state/selectors.ts'
import type { ChatSummary } from '@/beeper/types.ts'

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
