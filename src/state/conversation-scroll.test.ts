import { describe, expect, test } from 'bun:test'
import {
  clampOffset,
  conversationCapacity,
  maxScrollOffset,
  offsetToShowIndex,
  visibleMessages,
} from '@/state/conversation-scroll.ts'

const items = ['a', 'b', 'c', 'd', 'e']

describe('visibleMessages', () => {
  test('offset 0 pins to the newest that fit', () => {
    expect(visibleMessages(items, 3, 0)).toEqual(['c', 'd', 'e'])
  })

  test('scrolling up reveals older messages', () => {
    expect(visibleMessages(items, 3, 1)).toEqual(['b', 'c', 'd'])
    expect(visibleMessages(items, 3, 2)).toEqual(['a', 'b', 'c'])
  })

  test('offset is clamped so it never scrolls past the top', () => {
    expect(visibleMessages(items, 3, 99)).toEqual(['a', 'b', 'c'])
  })

  test('capacity ≥ count shows everything; empty/zero cases are safe', () => {
    expect(visibleMessages(items, 10, 0)).toEqual(items)
    expect(visibleMessages([], 5, 0)).toEqual([])
    expect(visibleMessages(items, 0, 0)).toEqual([])
  })
})

describe('maxScrollOffset / clampOffset', () => {
  test('max offset is count minus capacity', () => {
    expect(maxScrollOffset(5, 3)).toBe(2)
    expect(maxScrollOffset(2, 3)).toBe(0)
  })

  test('clampOffset keeps offset in range', () => {
    expect(clampOffset(-4, 5, 3)).toBe(0)
    expect(clampOffset(99, 5, 3)).toBe(2)
    expect(clampOffset(1, 5, 3)).toBe(1)
  })
})

describe('offsetToShowIndex', () => {
  // 5 messages (indices 0..4), capacity 3.
  test('newest index keeps the bottom-pinned offset', () => {
    expect(offsetToShowIndex(4, 5, 3, 0)).toBe(0)
  })

  test('oldest index scrolls all the way up', () => {
    expect(offsetToShowIndex(0, 5, 3, 0)).toBe(2) // max offset
  })

  test('moving up one from the newest brings the target to the top with minimal scroll', () => {
    // index 1 (second-oldest) from a bottom-pinned view → smallest offset that shows it
    expect(offsetToShowIndex(1, 5, 3, 0)).toBe(1)
  })

  test('keeps the current offset when the index is already visible', () => {
    // offset 1 shows indices [1,2,3]; index 2 is already on screen → no change
    expect(offsetToShowIndex(2, 5, 3, 1)).toBe(1)
  })

  test('scrolls down to reveal an index below the current window', () => {
    // offset 2 shows [0,1,2]; selecting index 4 pins it to the bottom (offset 0)
    expect(offsetToShowIndex(4, 5, 3, 2)).toBe(0)
  })

  test('degenerate counts/capacities are safe', () => {
    expect(offsetToShowIndex(0, 0, 3, 0)).toBe(0)
    // capacity 0 is degenerate; the offset stays clamped in range rather than throwing.
    expect(offsetToShowIndex(0, 5, 0, 4)).toBe(4)
  })
})

describe('conversationCapacity', () => {
  test('subtracts the comfortable chrome and floors at 1', () => {
    expect(conversationCapacity(30, 'comfortable')).toBe(30 - 9)
    expect(conversationCapacity(5, 'comfortable')).toBe(1) // floored
  })

  test('compact density frees two rows', () => {
    expect(conversationCapacity(30, 'compact')).toBe(30 - 7)
  })
})
