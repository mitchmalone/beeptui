import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import type { CapturedFrame } from '@opentui/core'
import { MessageView } from '@/tui/components/MessageView.tsx'
import type { MessageEntity } from '@/state/types.ts'

function msg(text: string, over: Partial<MessageEntity> = {}): MessageEntity {
  return {
    id: 'm1',
    chatId: 'c1',
    accountId: 'a',
    senderId: 'them',
    senderName: 'Bee',
    timestamp: '2026-07-31T09:41:00.000Z',
    sortKey: '1',
    text,
    isSender: false,
    isUnread: false,
    status: 'sent',
    ...over,
  }
}

async function render(message: MessageEntity) {
  const r = await testRender(<MessageView message={message} selected={false} caret=" " />, {
    width: 60,
    height: 12,
  })
  await r.renderOnce()
  return r
}

/** The `attributes` bitfield of the first span containing `needle`. */
function attrsOf(frame: CapturedFrame, needle: string): number | null {
  for (const line of frame.lines) {
    for (const span of line.spans) {
      if (span.text.includes(needle)) return span.attributes
    }
  }
  return null
}

const BOLD = 1
const ITALIC = 4

describe('MessageView', () => {
  test('renders bold/italic as real terminal attributes, no tags visible', async () => {
    const { captureCharFrame, captureSpans } = await render(msg('a <b>bold</b> <i>it</i>'))
    const frame = captureCharFrame()
    expect(frame).toContain('Bee:')
    expect(frame).toContain('bold')
    expect(frame).not.toContain('<b>') // markup stripped
    const spans = captureSpans()
    expect((attrsOf(spans, 'bold')! & BOLD) !== 0).toBe(true)
    expect((attrsOf(spans, 'it')! & ITALIC) !== 0).toBe(true)
  })

  test('<br> and lists render as multiple lines with dash/number markers', async () => {
    const { captureCharFrame } = await render(
      msg('intro<br><ul><li>one</li></ul><ol><li>first</li></ol>')
    )
    const frame = captureCharFrame()
    expect(frame).toContain('intro')
    expect(frame).toContain('- one')
    expect(frame).toContain('1. first')
    expect(frame).not.toContain('<ul>')
    expect(frame).not.toContain('<li>')
  })

  test('decodes entities and keeps the sender header', async () => {
    const { captureCharFrame } = await render(msg('Tom &amp; Jerry &lt;3'))
    const frame = captureCharFrame()
    expect(frame).toContain('Bee: Tom & Jerry <3')
  })
})
