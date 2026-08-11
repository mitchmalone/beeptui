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

function conv(
  over: Partial<ActiveConversation> & { replyToId?: string | null } = {}
): ActiveConversation & { replyToId?: string | null } {
  return {
    chat,
    messages: [],
    hasMoreOlder: false,
    olderCursor: null,
    scrollOffset: 0,
    newMessagesBelow: false,
    selectedMessageId: null,
    loaded: true,
    ...over,
  }
}

async function frameOf(
  conversation: ActiveConversation & { replyToId?: string | null },
  capacity = 10,
  width?: number
): Promise<string> {
  const { replyToId = null, ...rest } = conversation
  const { renderOnce, captureCharFrame } = await testRender(
    <ConversationView
      conversation={rest}
      focused
      replyToId={replyToId}
      capacityOverride={capacity}
      {...(width !== undefined ? { widthOverride: width } : {})}
    />,
    { width: 80, height: 20 }
  )
  await renderOnce()
  return captureCharFrame()
}

/** Column of the first drawn character inside the pane border, or -1. */
function textColumn(line: string): number {
  for (let i = 1; i < line.length; i += 1) {
    const ch = line[i]
    if (ch !== undefined && ch !== ' ' && ch !== '│') return i
  }
  return -1
}

function lineWith(frame: string, needle: string): string {
  const line = frame.split('\n').find((l) => l.includes(needle))
  if (line === undefined) throw new Error(`no line containing ${needle} in:\n${frame}`)
  return line
}

describe('ConversationView', () => {
  test('placeholder when no chat is selected', async () => {
    const frame = await frameOf({ ...conv(), chat: null })
    expect(frame).toContain('Select a chat')
  })

  test('focus indicator shows in the placeholder title too (frameOf renders focused)', async () => {
    const frame = await frameOf({ ...conv(), chat: null })
    expect(frame).toContain('Conversation ●')
  })

  test('header + empty-history hint + empty state', async () => {
    const frame = await frameOf(conv())
    expect(frame).toContain('Grace Hopper')
    expect(frame).toContain('WhatsApp')
    expect(frame).toContain('start of history')
    expect(frame).toContain('No messages yet')
  })

  test('a highlighted but unopened chat says so, rather than claiming it is empty', async () => {
    const frame = await frameOf(conv({ loaded: false }))
    expect(frame).toContain('Press ⏎ to open')
    expect(frame).not.toContain('No messages yet')
  })

  test('more-history hint points at the arrow key, not a separate one', async () => {
    expect(await frameOf(conv({ hasMoreOlder: true, olderCursor: 'x' }))).toContain('↑ for older')
  })

  test('a page in flight says so rather than looking like it ignored the key', async () => {
    const { renderOnce, captureCharFrame } = await testRender(
      <ConversationView
        conversation={conv({ hasMoreOlder: true, olderCursor: 'x' })}
        focused
        capacityOverride={10}
        widthOverride={40}
        loadingOlder
      />,
      { width: 80, height: 20 }
    )
    await renderOnce()
    expect(captureCharFrame()).toContain('loading older')
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

  test('puts the sender on its own line with the time to the right, body beneath', async () => {
    const frame = await frameOf(conv({ messages: [msg('m1', 'hi there')] }))
    const header = lineWith(frame, 'Grace  ') // the message header, not the chat title
    expect(header).toContain('09:05')
    // Time is right-aligned: it ends against the pane's right edge, and nothing
    // but padding sits between it and the sender.
    expect(header.indexOf('09:05')).toBeGreaterThan(header.indexOf('Grace') + 'Grace'.length)
    expect(lineWith(frame, 'hi there')).not.toContain('09:05')
  })

  test('body lines align with the sender name, not the pane edge', async () => {
    // Narrow content so the body must wrap; every continuation has to start in
    // the same column as the name above it.
    const frame = await frameOf(
      conv({ messages: [msg('m1', 'alpha bravo charlie delta')] }),
      10,
      12
    )
    const nameColumn = textColumn(lineWith(frame, 'Grace  '))
    for (const token of ['alpha', 'charlie']) {
      expect(textColumn(lineWith(frame, token))).toBe(nameColumn)
    }
  })

  test('separates messages with a blank line', async () => {
    const frame = await frameOf(conv({ messages: [msg('m1', 'first'), msg('m2', 'second')] }))
    const lines = frame.split('\n')
    const firstBody = lines.findIndex((l) => l.includes('first'))
    const secondHeader = lines.findIndex((l, i) => i > firstBody && l.includes('09:05'))
    expect(secondHeader).toBe(firstBody + 2) // exactly one blank row between
    expect(textColumn(lines[firstBody + 1] ?? '')).toBe(-1) // and it is blank
  })

  test('compact density drops the separator', async () => {
    const { renderOnce, captureCharFrame } = await testRender(
      <ConversationView
        conversation={conv({ messages: [msg('m1', 'first'), msg('m2', 'second')] })}
        focused
        density="compact"
        capacityOverride={10}
        widthOverride={40}
      />,
      { width: 80, height: 20 }
    )
    await renderOnce()
    const lines = captureCharFrame().split('\n')
    const firstBody = lines.findIndex((l) => l.includes('first'))
    expect(lines[firstBody + 1]).toContain('Grace') // next header, no blank between
  })

  test('bottom-pins: with a small capacity only the newest rows show', async () => {
    const many = Array.from({ length: 8 }, (_, i) => msg(`m${i}`, `line-${i}`))
    const frame = await frameOf(conv({ messages: many }), 3)
    expect(frame).toContain('line-7') // newest visible
    expect(frame).toContain('↑ older') // older exists above
    expect(frame).not.toContain('line-0') // oldest scrolled off
  })

  test('scrolling is by rows, so a message can be half in view', async () => {
    const many = Array.from({ length: 8 }, (_, i) => msg(`m${i}`, `line-${i}`))
    // Each message is header + body + separator = 3 rows; one row of scroll
    // hides the newest body while keeping its header.
    const frame = await frameOf(conv({ messages: many, scrollOffset: 1 }), 3)
    expect(frame).toContain('line-6')
    expect(frame).not.toContain('line-7')
  })

  test('scrolled to the top reveals the oldest and offers a way back to newest', async () => {
    const many = Array.from({ length: 8 }, (_, i) => msg(`m${i}`, `line-${i}`))
    // 8 messages: seven at 3 rows plus a final 2 = 23 rows; capacity 3 puts the
    // maximum offset at 20.
    const frame = await frameOf(conv({ messages: many, scrollOffset: 20 }), 3)
    expect(frame).toContain('line-0')
    expect(frame).toContain('j for newer')
  })

  test('the caret marks only the first row of the selected message', async () => {
    const frame = await frameOf(
      conv({ messages: [msg('m1', 'alpha bravo charlie')], selectedMessageId: 'm1' }),
      10,
      12
    )
    expect(lineWith(frame, 'Grace  ')).toContain('›')
    expect(lineWith(frame, 'alpha')).not.toContain('›')
  })
})

describe('reply target', () => {
  test('is marked with a quote bar, distinct from the selection caret', async () => {
    const frame = await frameOf(
      conv({
        messages: [msg('m1', 'answer this'), msg('m2', 'not this')],
        replyToId: 'm1',
        selectedMessageId: 'm2',
      })
    )
    expect(lineWith(frame, 'answer this')).toContain('┃')
    expect(lineWith(frame, 'answer this')).not.toContain('›')
    // The cursor is elsewhere and keeps its own glyph.
    expect(lineWith(frame, 'not this')).not.toContain('┃')
  })

  test('no marker when nothing is being replied to', async () => {
    const frame = await frameOf(conv({ messages: [msg('m1', 'plain')] }))
    expect(lineWith(frame, 'plain')).not.toContain('┃')
  })
})
