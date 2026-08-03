import { describe, expect, test } from 'bun:test'
import type { MessageEntity } from '@/state/types.ts'
import {
  layOutMessage,
  layOutMessages,
  layoutHeight,
  totalRows,
  type LayoutRow,
} from '@/state/message-layout.ts'

function message(over: Partial<MessageEntity> = {}): MessageEntity {
  return {
    id: 'm',
    chatId: 'c',
    accountId: 'a',
    senderId: 'them@server',
    timestamp: '2026-07-30T09:05:00.000Z',
    sortKey: '1',
    isSender: false,
    isUnread: false,
    status: 'sent',
    ...over,
  }
}

/** The plain text of every body row, for assertions about wrapping. */
function bodyText(rows: readonly LayoutRow[]): string[] {
  return rows
    .filter((r): r is Extract<LayoutRow, { kind: 'body' }> => r.kind === 'body')
    .map((r) => r.runs.map((run) => run.text).join(''))
}

describe('layOutMessage', () => {
  test('puts sender and time in a header row, body beneath', () => {
    const rows = layOutMessage(message({ senderName: 'Ada', text: 'hello' }), 40).rows
    expect(rows[0]).toEqual({ kind: 'header', sender: 'Ada', time: '09:05' })
    expect(bodyText(rows)).toEqual(['hello'])
  })

  test('names our own messages You, and falls back to the sender id', () => {
    expect(layOutMessage(message({ isSender: true, text: 'x' }), 40).rows[0]).toMatchObject({
      sender: 'You',
    })
    expect(layOutMessage(message({ text: 'x' }), 40).rows[0]).toMatchObject({
      sender: 'them@server',
    })
  })

  test('an unparseable timestamp renders an empty time, never NaN', () => {
    expect(layOutMessage(message({ timestamp: 'nope', text: 'x' }), 40).rows[0]).toMatchObject({
      time: '',
    })
  })

  test('wraps the body at the content width, on word boundaries', () => {
    const m = message({ senderName: 'Ada', text: 'the quick brown fox jumps' })
    expect(bodyText(layOutMessage(m, 10).rows)).toEqual(['the quick', 'brown fox', 'jumps'])
  })

  test('hard-breaks a single word longer than the width', () => {
    const m = message({ senderName: 'Ada', text: 'supercalifragilistic' })
    expect(bodyText(layOutMessage(m, 8).rows)).toEqual(['supercal', 'ifragili', 'stic'])
  })

  test('wraps on display width, so wide glyphs break earlier than their length', () => {
    // Six CJK characters are twelve cells: at width 8 only four fit per row.
    const m = message({ senderName: 'Ada', text: '日本語日本語' })
    expect(bodyText(layOutMessage(m, 8).rows)).toEqual(['日本語日', '本語'])
  })

  test('never cuts inside an emoji sequence', () => {
    const m = message({ senderName: 'Ada', text: 'ab\u{1F469}\u{200D}\u{1F4BB}cd' })
    const lines = bodyText(layOutMessage(m, 3).rows)
    expect(lines.join('')).toBe('ab\u{1F469}\u{200D}\u{1F4BB}cd')
    for (const line of lines) expect(line.includes('\u{200D}')).toBe(line.includes('\u{1F469}'))
  })

  test('keeps HTML styling across a wrap boundary', () => {
    const m = message({ senderName: 'Ada', text: '<b>alpha bravo charlie</b>' })
    const rows = layOutMessage(m, 12).rows
    const body = rows.filter((r): r is Extract<LayoutRow, { kind: 'body' }> => r.kind === 'body')
    expect(body.length).toBeGreaterThan(1)
    for (const row of body) for (const run of row.runs) expect(run.bold).toBe(true)
  })

  test('honours explicit line breaks from HTML', () => {
    const m = message({ senderName: 'Ada', text: 'one<br>two' })
    expect(bodyText(layOutMessage(m, 40).rows)).toEqual(['one', 'two'])
  })

  test('marks a reply, and appends attachments, edits, reactions and status', () => {
    const m = message({
      senderName: 'Ada',
      text: 'see this',
      replyToId: 'm0',
      isEdited: true,
      attachments: [{ kind: 'image', fileName: 'cat.png' }],
      reactions: [{ key: '👍', count: 2, isEmoji: true }],
    })
    const text = bodyText(layOutMessage(m, 80).rows).join(' ')
    expect(text).toContain('↩')
    expect(text).toContain('[image: cat.png]')
    expect(text).toContain('(edited)')
    expect(text).toContain('👍×2')
  })

  test('a failed send shows the marker; an empty message says so', () => {
    expect(
      bodyText(layOutMessage(message({ status: 'failed', text: 'x' }), 40).rows).join('')
    ).toContain('⚠ failed')
    expect(bodyText(layOutMessage(message(), 40).rows)).toEqual(['(no content)'])
  })

  test('height is the row count and is at least a header plus one body row', () => {
    const layout = layOutMessage(message({ senderName: 'Ada', text: 'hi' }), 40)
    expect(layoutHeight(layout)).toBe(layout.rows.length)
    expect(layoutHeight(layout)).toBe(2)
  })

  test('a degenerate width still terminates and yields one row per source line', () => {
    const rows = layOutMessage(message({ senderName: 'Ada', text: 'abc' }), 0).rows
    expect(bodyText(rows)).toEqual(['abc'])
  })
})

describe('layOutMessages', () => {
  const a = message({ id: 'a', senderName: 'Ada', text: 'one' })
  const b = message({ id: 'b', senderName: 'Bo', text: 'two' })

  test('separates messages with a blank row, with none trailing the last', () => {
    const layouts = layOutMessages([a, b], 40)
    expect(layouts.map((l) => l.messageId)).toEqual(['a', 'b'])
    expect(layouts[0]?.rows.at(-1)).toEqual({ kind: 'blank' })
    expect(layouts[1]?.rows.at(-1)).not.toEqual({ kind: 'blank' })
  })

  test('omits the separator when asked, for compact density', () => {
    const layouts = layOutMessages([a, b], 40, { separator: false })
    for (const l of layouts) expect(l.rows.some((r) => r.kind === 'blank')).toBe(false)
  })

  test('totalRows sums the laid-out heights', () => {
    const layouts = layOutMessages([a, b], 40)
    expect(totalRows(layouts)).toBe(layouts.reduce((n, l) => n + l.rows.length, 0))
    expect(totalRows(layouts)).toBe(5) // header+body+blank, header+body
  })

  test('no messages lays out to nothing', () => {
    expect(layOutMessages([], 40)).toEqual([])
    expect(totalRows([])).toBe(0)
  })
})
