import { describe, expect, test } from 'bun:test'
import { clampOffset, maxScrollOffset, visibleMessages } from '@/tui/conversation-scroll.ts'

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
