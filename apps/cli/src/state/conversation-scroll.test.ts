import { describe, expect, test } from 'bun:test'
import {
  clampOffset,
  conversationCapacity,
  conversationContentWidth,
  maxScrollOffset,
  messageRowStart,
  offsetToShowMessage,
  visibleRows,
} from '@/state/conversation-scroll.ts'
import type { MessageLayout } from '@/state/message-layout.ts'

/** A layout of `height` rows: a header, then filler body rows. */
function layout(messageId: string, height: number): MessageLayout {
  const rows: MessageLayout['rows'] = [{ kind: 'header', sender: messageId, time: '09:00' }]
  for (let i = 1; i < height; i += 1)
    rows.push({ kind: 'body', runs: [{ text: `${messageId}${i}` }] })
  return { messageId, rows }
}

// Three messages of 2 rows each: rows 0-1 = a, 2-3 = b, 4-5 = c.
const even = [layout('a', 2), layout('b', 2), layout('c', 2)]
// Uneven: a=2 (rows 0-1), b=5 (rows 2-6), c=1 (row 7). Eight rows total.
const uneven = [layout('a', 2), layout('b', 5), layout('c', 1)]

/** Compact identity of a visible row: which message it came from. */
function owners(rows: ReturnType<typeof visibleRows>): string[] {
  return rows.map((r) => r.messageId)
}

describe('visibleRows', () => {
  test('offset 0 pins the newest rows to the bottom', () => {
    expect(owners(visibleRows(even, 3, 0))).toEqual(['b', 'c', 'c'])
  })

  test('scrolling up reveals older rows one row at a time, not one message', () => {
    expect(owners(visibleRows(even, 3, 1))).toEqual(['b', 'b', 'c'])
    expect(owners(visibleRows(even, 3, 2))).toEqual(['a', 'b', 'b'])
  })

  test('marks the first row of each message, for the caret gutter', () => {
    const rows = visibleRows(even, 6, 0)
    expect(rows.map((r) => r.first)).toEqual([true, false, true, false, true, false])
  })

  test('carries the row itself through', () => {
    expect(visibleRows(even, 6, 0)[0]?.row).toEqual({ kind: 'header', sender: 'a', time: '09:00' })
  })

  test('offset is clamped so it never scrolls past the oldest row', () => {
    expect(owners(visibleRows(even, 3, 99))).toEqual(['a', 'a', 'b'])
  })

  test('a capacity taller than the content shows everything', () => {
    expect(owners(visibleRows(even, 50, 0))).toEqual(['a', 'a', 'b', 'b', 'c', 'c'])
  })

  test('empty and zero-capacity cases are safe', () => {
    expect(visibleRows([], 5, 0)).toEqual([])
    expect(visibleRows(even, 0, 0)).toEqual([])
  })

  test('windows correctly across messages of unequal height', () => {
    // Eight rows; capacity 3 at offset 0 shows rows 5,6,7 = b, b, c.
    expect(owners(visibleRows(uneven, 3, 0))).toEqual(['b', 'b', 'c'])
  })
})

describe('messageRowStart', () => {
  test('is the flat row index the message begins at', () => {
    expect(messageRowStart(uneven, 'a')).toBe(0)
    expect(messageRowStart(uneven, 'b')).toBe(2)
    expect(messageRowStart(uneven, 'c')).toBe(7)
  })

  test('is -1 for an unknown message', () => {
    expect(messageRowStart(uneven, 'zz')).toBe(-1)
  })
})

describe('maxScrollOffset / clampOffset', () => {
  test('max offset is total rows minus capacity', () => {
    expect(maxScrollOffset(8, 3)).toBe(5)
    expect(maxScrollOffset(2, 3)).toBe(0)
  })

  test('clampOffset keeps the offset in range', () => {
    expect(clampOffset(-4, 8, 3)).toBe(0)
    expect(clampOffset(99, 8, 3)).toBe(5)
    expect(clampOffset(1, 8, 3)).toBe(1)
  })
})

describe('offsetToShowMessage', () => {
  // `uneven`: a rows 0-1, b rows 2-6, c row 7. Total 8.
  test('the newest message keeps the bottom-pinned offset', () => {
    expect(offsetToShowMessage(uneven, 'c', 3, 0)).toBe(0)
  })

  test('scrolls up just enough to bring a whole older message into view', () => {
    // Capacity 5, bottom-pinned, shows rows 3-7 — b starts at row 2, just off
    // the top. One row of scroll brings rows 2-6, exactly b.
    expect(offsetToShowMessage(uneven, 'b', 5, 0)).toBe(1)
  })

  test('the oldest message scrolls all the way up', () => {
    expect(offsetToShowMessage(uneven, 'a', 3, 0)).toBe(5) // max offset
  })

  test('keeps the current offset when the message is already fully visible', () => {
    expect(offsetToShowMessage(uneven, 'b', 5, 1)).toBe(1)
  })

  test('scrolls back down to reveal a message below the window', () => {
    expect(offsetToShowMessage(uneven, 'c', 3, 5)).toBe(0)
  })

  test('a message taller than the viewport shows its top, not its tail', () => {
    // b is 5 rows; at capacity 3 it cannot fit. Anchor on the header row so the
    // sender and time stay readable.
    const rows = visibleRows(uneven, 3, offsetToShowMessage(uneven, 'b', 3, 0))
    expect(rows[0]?.first).toBe(true)
    expect(rows[0]?.messageId).toBe('b')
  })

  test('unknown message and degenerate capacity leave the offset alone', () => {
    expect(offsetToShowMessage(uneven, 'zz', 3, 2)).toBe(2)
    expect(offsetToShowMessage(uneven, 'b', 0, 4)).toBe(4)
    expect(offsetToShowMessage([], 'a', 3, 0)).toBe(0)
  })
})

describe('conversationCapacity', () => {
  test('subtracts the comfortable chrome and floors at 1', () => {
    expect(conversationCapacity(30, 'comfortable')).toBe(30 - 11)
    expect(conversationCapacity(5, 'comfortable')).toBe(1) // floored
  })

  test('compact density frees two rows', () => {
    expect(conversationCapacity(30, 'compact')).toBe(30 - 9)
  })
})

describe('conversationContentWidth', () => {
  test('wide layout subtracts the two left rails, the pane chrome and the caret gutter', () => {
    // 120 - 8 (net rail) - 32 (chat rail) = 80 pane; - 2 border - 2 padding - 2 gutter.
    expect(conversationContentWidth(120, 'comfortable')).toBe(80 - 2 - 2 - 2)
  })

  test('compact density reclaims the pane padding', () => {
    expect(conversationContentWidth(120, 'compact')).toBe(80 - 2 - 2)
  })

  test('a narrow terminal drops the rails and uses the full width', () => {
    expect(conversationContentWidth(60, 'comfortable')).toBe(60 - 2 - 2 - 2)
  })

  test('never returns a width the wrapper cannot use', () => {
    expect(conversationContentWidth(1, 'comfortable')).toBeGreaterThanOrEqual(1)
    expect(conversationContentWidth(0, 'compact')).toBeGreaterThanOrEqual(1)
  })
})
