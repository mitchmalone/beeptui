import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { ConversationView } from '@/tui/components/ConversationView.tsx'
import type { ActiveConversation } from '@/state/selectors.ts'
import type { ChatSummary } from '@/beeper/types.ts'
import type { MessageEntity } from '@/state/types.ts'

const chat: ChatSummary = {
  id: 'c1',
  accountId: 'a',
  network: 'WhatsApp',
  title: 'Grace Hopper',
  type: 'single',
  unreadCount: 0,
  isArchived: false,
  isMuted: false,
}

function msg(id: string, text: string, over: Partial<MessageEntity> = {}): MessageEntity {
  return {
    id,
    chatId: 'c1',
    accountId: 'a',
    senderId: 'g',
    senderName: 'Grace',
    timestamp: '2026-07-30T09:05:00.000Z',
    sortKey: id,
    text,
    isSender: false,
    isUnread: false,
    status: 'sent',
    ...over,
  }
}

function conv(over: Partial<ActiveConversation> = {}): ActiveConversation {
  return {
    chat,
    messages: [],
    hasMoreOlder: false,
    olderCursor: null,
    scrollOffset: 0,
    newMessagesBelow: false,
    selectedMessageId: null,
    ...over,
  }
}

async function frameOf(conversation: ActiveConversation, capacity = 10): Promise<string> {
  const { renderOnce, captureCharFrame } = await testRender(
    <ConversationView conversation={conversation} focused capacityOverride={capacity} />,
    { width: 80, height: 20 }
  )
  await renderOnce()
  return captureCharFrame()
}

describe('ConversationView', () => {
  test('placeholder when no chat is selected', async () => {
    const frame = await frameOf({ ...conv(), chat: null })
    expect(frame).toContain('Select a chat')
  })

  test('header + empty-history hint + empty state', async () => {
    const frame = await frameOf(conv())
    expect(frame).toContain('Grace Hopper')
    expect(frame).toContain('WhatsApp')
    expect(frame).toContain('start of history')
    expect(frame).toContain('No messages yet')
  })

  test('load-older hint when more history exists', async () => {
    expect(await frameOf(conv({ hasMoreOlder: true, olderCursor: 'x' }))).toContain('load older')
  })

  test('renders message lines and a failed-send marker', async () => {
    const frame = await frameOf(
      conv({
        messages: [
          msg('m1', 'hi there'),
          msg('m2', 'oops', { isSender: true, senderName: 'You', status: 'failed' }),
        ],
      })
    )
    expect(frame).toContain('hi there')
    expect(frame).toContain('failed')
  })

  test('bottom-pins: with a small capacity only the newest messages show', async () => {
    const many = Array.from({ length: 8 }, (_, i) => msg(`m${i}`, `line-${i}`))
    const frame = await frameOf(conv({ messages: many }), 3)
    expect(frame).toContain('line-7') // newest visible
    expect(frame).toContain('↑ older') // older exists above
    expect(frame).not.toContain('line-0') // oldest scrolled off
  })

  test('scrolled up reveals older and offers a way back to newest', async () => {
    const many = Array.from({ length: 8 }, (_, i) => msg(`m${i}`, `line-${i}`))
    const frame = await frameOf(conv({ messages: many, scrollOffset: 5 }), 3)
    expect(frame).toContain('line-0') // scrolled to the top
    expect(frame).toContain('j for newer')
  })
})
