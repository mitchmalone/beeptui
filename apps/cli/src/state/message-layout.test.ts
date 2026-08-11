import { describe, expect, test } from 'bun:test'
import type { AttachmentSummary } from '@/beeper/types.ts'
import type { MessageEntity } from '@/state/types.ts'
import {
  IMAGE_BLOCK_ROWS,
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

  test('composes the body exactly: reply marker, text, attachment, edited', () => {
    const m = message({
      senderName: 'Ada',
      text: 'see this',
      replyToId: 'm0',
      isEdited: true,
      attachments: [{ kind: 'image', fileName: 'a.png' }],
    })
    expect(bodyText(layOutMessage(m, 80).rows)).toEqual(['↩ see this [image: a.png] (edited)'])
  })

  test('an attachment-only message shows a placeholder, never blank or undefined', () => {
    const rows = layOutMessage(message({ attachments: [{ kind: 'file' }] }), 80).rows
    expect(bodyText(rows)).toEqual(['[file]'])
  })

  test('an attachment label carries its size when known', () => {
    const m = message({ attachments: [{ kind: 'image', fileName: 'a.png', fileSize: 20480 }] })
    expect(bodyText(layOutMessage(m, 80).rows)).toEqual(['[image: a.png · 20 KB]'])
  })

  test('renders read-only reactions as a trailing summary with counts', () => {
    const m = message({
      text: 'ship it',
      reactions: [
        { key: '👍', count: 2, isEmoji: true },
        { key: '🎉', count: 1, isEmoji: true },
      ],
    })
    expect(bodyText(layOutMessage(m, 80).rows)).toEqual(['ship it  👍×2 🎉'])
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

  test('a reaction-only message still says (no content) before its reactions', () => {
    const m = message({ reactions: [{ key: '👍', count: 1, isEmoji: true }] })
    expect(bodyText(layOutMessage(m, 80).rows)).toEqual(['(no content)  👍'])
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

describe('media messages that arrive with no attachment metadata', () => {
  // Beeper's message list returns IMAGE/VIDEO messages that carry neither text
  // nor an attachments array — 21 of 22 image messages across ten real chats.
  // Rendered from text and attachments alone they came out as an empty line
  // (just the reply marker and read receipt), which tells the user nothing.
  test('an image with no text and no attachments still says it is an image', () => {
    const m = message({ senderName: 'Ada', kind: 'IMAGE' })
    expect(bodyText(layOutMessage(m, 80).rows)).toEqual(['[image]'])
  })

  test('the same for the other media kinds', () => {
    const kinds = [
      ['VIDEO', '[video]'],
      ['VOICE', '[voice message]'],
      ['AUDIO', '[audio]'],
      ['FILE', '[file]'],
      ['STICKER', '[sticker]'],
      ['LOCATION', '[location]'],
    ] as const
    for (const [kind, expected] of kinds) {
      expect(bodyText(layOutMessage(message({ kind }), 80).rows)).toEqual([expected])
    }
  })

  test('real attachment metadata still wins — the placeholder is only a fallback', () => {
    const m = message({ kind: 'IMAGE', attachments: [{ kind: 'image', fileName: 'a.png' }] })
    expect(bodyText(layOutMessage(m, 80).rows)).toEqual(['[image: a.png]'])
  })

  test('text wins too — a captioned image is not replaced by a placeholder', () => {
    const m = message({ kind: 'IMAGE', text: 'look at this' })
    expect(bodyText(layOutMessage(m, 80).rows)).toEqual(['look at this'])
  })

  test('a reply carrying only an image keeps its marker and gains a body', () => {
    const m = message({ kind: 'IMAGE', replyToId: 'm0', isSender: true, isSeen: true })
    expect(bodyText(layOutMessage(m, 80).rows)).toEqual(['↩ [image] ✓✓'])
  })

  test('a text message with no text still says (no content), not a media label', () => {
    expect(bodyText(layOutMessage(message({ kind: 'TEXT' }), 80).rows)).toEqual(['(no content)'])
  })
})

describe('inline image blocks', () => {
  // An image attachment with a downloadable id becomes a fixed-height block of
  // image rows — the cells the pane paints pixels into. Fixed height because
  // attachment metadata carries no dimensions: an aspect-derived height would
  // need the bytes first and re-layout on arrival, moving content under the
  // cursor (plan: PLAN-inline-image-rendering, DECISIONS 2026-08-07).
  const img = (over: Partial<AttachmentSummary> = {}): AttachmentSummary => ({
    kind: 'image',
    id: 'mxc://beeper/abc',
    fileName: 'cat.jpg',
    fileSize: 2048,
    ...over,
  })

  function imageRows(rows: readonly LayoutRow[]): Extract<LayoutRow, { kind: 'image' }>[] {
    return rows.filter((r): r is Extract<LayoutRow, { kind: 'image' }> => r.kind === 'image')
  }

  test('a downloadable image attachment lays out as a fixed-height image block', () => {
    const rows = layOutMessage(message({ attachments: [img()] }), 80).rows
    const block = imageRows(rows)
    expect(block).toHaveLength(IMAGE_BLOCK_ROWS)
    expect(block[0]).toEqual({
      kind: 'image',
      attachmentId: 'mxc://beeper/abc',
      placeholder: '[image: cat.jpg · 2 KB]',
      slice: 0,
      of: IMAGE_BLOCK_ROWS,
    })
    expect(block.map((r) => r.slice)).toEqual([...Array(IMAGE_BLOCK_ROWS).keys()])
  })

  test('the block replaces the body placeholder — no [image: …] text row, no (no content)', () => {
    const rows = layOutMessage(message({ attachments: [img()] }), 80).rows
    expect(bodyText(rows)).toEqual([])
  })

  test('a captioned image keeps its text body, block after it', () => {
    const rows = layOutMessage(message({ text: 'look!', attachments: [img()] }), 80).rows
    expect(bodyText(rows)).toEqual(['look!'])
    const kinds = rows.map((r) => r.kind)
    expect(kinds.indexOf('image')).toBeGreaterThan(kinds.indexOf('body'))
  })

  test('an image without a download id keeps the text placeholder and gets no block', () => {
    const noId = { ...img() }
    delete noId.id
    const rows = layOutMessage(message({ attachments: [noId] }), 80).rows
    expect(imageRows(rows)).toHaveLength(0)
    expect(bodyText(rows)).toEqual(['[image: cat.jpg · 2 KB]'])
  })

  test('non-image attachments keep the text placeholder', () => {
    const rows = layOutMessage(
      message({ attachments: [{ kind: 'file', fileName: 'notes.pdf', id: 'mxc://beeper/f' }] }),
      80
    ).rows
    expect(imageRows(rows)).toHaveLength(0)
    expect(bodyText(rows)).toEqual(['[file: notes.pdf]'])
  })

  test('two images make two blocks; a mixed message keeps the file as text', () => {
    const m = message({
      attachments: [
        img(),
        img({ id: 'mxc://beeper/two', fileName: 'dog.png' }),
        { kind: 'file', fileName: 'notes.pdf' },
      ],
    })
    const rows = layOutMessage(m, 80).rows
    const block = imageRows(rows)
    expect(block).toHaveLength(2 * IMAGE_BLOCK_ROWS)
    expect(new Set(block.map((r) => r.attachmentId))).toEqual(
      new Set(['mxc://beeper/abc', 'mxc://beeper/two'])
    )
    expect(bodyText(rows)).toEqual(['[file: notes.pdf]'])
  })

  test('reactions and status still get a body row on an image-only message', () => {
    const m = message({
      isSender: true,
      isSeen: true,
      attachments: [img()],
      reactions: [{ key: '👍', count: 2, isEmoji: true }],
    })
    expect(bodyText(layOutMessage(m, 80).rows)).toEqual(['👍×2 ✓✓'])
  })

  test('the separator still trails the block, and heights count image rows', () => {
    const layout = layOutMessage(message({ attachments: [img()] }), 80, { separator: true })
    expect(layout.rows[layout.rows.length - 1]).toEqual({ kind: 'blank' })
    expect(layoutHeight(layout)).toBe(1 + IMAGE_BLOCK_ROWS + 1) // header + block + blank
  })

  test('the media-kind fallback stays off when a block is present', () => {
    const m = message({ kind: 'IMAGE', attachments: [img()] })
    expect(bodyText(layOutMessage(m, 80).rows)).toEqual([])
  })
})
