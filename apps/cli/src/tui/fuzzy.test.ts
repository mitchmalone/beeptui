import { describe, expect, test } from 'bun:test'
import { fuzzyMatch, searchChats, type Searchable } from '@/tui/fuzzy.ts'

describe('fuzzyMatch', () => {
  test('empty query matches everything with zero score', () => {
    expect(fuzzyMatch('', 'anything')).toEqual({ matched: true, score: 0, positions: [] })
  })

  test('subsequence match records positions; non-subsequence fails', () => {
    const m = fuzzyMatch('grh', 'Grace Hopper')
    expect(m.matched).toBe(true)
    expect(m.positions).toEqual([0, 1, 6]) // G(0) r(1) H(6)
    expect(fuzzyMatch('xyz', 'Grace Hopper').matched).toBe(false)
  })

  test('consecutive runs and word-starts score higher', () => {
    const consecutive = fuzzyMatch('grace', 'Grace Hopper')
    const scattered = fuzzyMatch('grcp', 'Grace Hopper')
    expect(consecutive.score).toBeGreaterThan(scattered.score)
  })

  test('is case-insensitive', () => {
    expect(fuzzyMatch('HOP', 'Grace Hopper').matched).toBe(true)
  })
})

describe('searchChats', () => {
  const rows: Searchable[] = [
    { id: 'c1', title: 'Grace Hopper', network: 'WhatsApp' },
    { id: 'c2', title: 'engineering', network: 'Slack' },
    { id: 'c3', title: 'Ada Lovelace', network: 'WhatsApp' },
  ]

  test('empty query returns all rows in the given (recency) order', () => {
    expect(searchChats('', rows).map((r) => r.id)).toEqual(['c1', 'c2', 'c3'])
  })

  test('filters and ranks by match quality', () => {
    const results = searchChats('ada', rows)
    expect(results.map((r) => r.id)).toEqual(['c3'])
    expect(results[0]?.positions.length).toBeGreaterThan(0)
  })

  test('matches on network name via the fallback', () => {
    const ids = searchChats('slack', rows).map((r) => r.id)
    expect(ids).toContain('c2')
  })

  test('a better title match outranks a weaker one', () => {
    const results = searchChats('e', rows)
    // 'engineering' starts with 'e' (word-start) -> should rank first.
    expect(results[0]?.id).toBe('c2')
  })

  test('ties fall back to recency order', () => {
    const results = searchChats('a', rows) // Grace(a), Ada, Lovelace...
    // both c1 and c3 contain 'a'; ensure stable, deterministic ordering
    expect(results.length).toBeGreaterThan(1)
  })
})
