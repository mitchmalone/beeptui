import { describe, expect, test } from 'bun:test'
import { formatFrameSummary, percentile, summarizeFrameTimes } from '@/tui/frame-profiler.ts'

describe('percentile', () => {
  const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  test('nearest-rank at the common points', () => {
    expect(percentile(sorted, 50)).toBe(5)
    expect(percentile(sorted, 95)).toBe(10)
    expect(percentile(sorted, 100)).toBe(10)
    expect(percentile(sorted, 0)).toBe(1)
  })
  test('empty array is 0; clamps out-of-range p', () => {
    expect(percentile([], 50)).toBe(0)
    expect(percentile(sorted, 150)).toBe(10)
    expect(percentile(sorted, -10)).toBe(1)
  })
})

describe('summarizeFrameTimes', () => {
  test('computes percentiles, max, and mean fps for a steady 60fps-ish stream', () => {
    const deltas = Array.from({ length: 100 }, () => 16.67)
    const s = summarizeFrameTimes(deltas)
    expect(s.frames).toBe(100)
    expect(s.p50Ms).toBeCloseTo(16.67, 1)
    expect(s.meanFps).toBeCloseTo(60, 0)
  })

  test('surfaces a hitch in p95/p99/max without moving the median much', () => {
    const deltas = [
      ...Array.from({ length: 95 }, () => 16),
      ...Array.from({ length: 5 }, () => 120),
    ]
    const s = summarizeFrameTimes(deltas)
    expect(s.p50Ms).toBe(16)
    expect(s.maxMs).toBe(120)
    expect(s.p95Ms).toBeGreaterThanOrEqual(16)
    expect(s.p99Ms).toBe(120)
  })

  test('drops non-finite / negative samples; empty → zeros', () => {
    expect(summarizeFrameTimes([NaN, -5, Infinity]).frames).toBe(0)
    expect(summarizeFrameTimes([]).meanFps).toBe(0)
  })
})

describe('formatFrameSummary', () => {
  test('renders a labeled block with all metrics', () => {
    const out = formatFrameSummary(summarizeFrameTimes([16, 16, 16]), 'burst')
    expect(out).toContain('[profile] burst')
    expect(out).toContain('p95:')
    expect(out).toContain('mean fps:')
  })
})
