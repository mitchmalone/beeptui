/**
 * Pure helpers for the render-loop profiler (`src/tui/profile.ts`). Kept
 * separate from the harness so the maths is unit-tested without a live
 * terminal — the harness itself needs a real TTY and OpenTUI renderer.
 */

export interface FrameSummary {
  /** Number of frame deltas measured. */
  frames: number
  /** Median inter-frame time, ms. */
  p50Ms: number
  /** 95th-percentile inter-frame time, ms — the "worst typical" hitch. */
  p95Ms: number
  /** 99th-percentile inter-frame time, ms. */
  p99Ms: number
  /** Slowest single frame, ms. */
  maxMs: number
  /** Mean frames per second across the sample. */
  meanFps: number
}

/** Nearest-rank percentile over an already-sorted ascending array. `p` in
 *  [0,100]. Returns 0 for an empty array. */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0
  const clamped = Math.min(100, Math.max(0, p))
  const rank = Math.ceil((clamped / 100) * sortedAsc.length)
  const index = Math.min(sortedAsc.length - 1, Math.max(0, rank - 1))
  return sortedAsc[index] ?? 0
}

/** Summarise a series of inter-frame times (ms) into percentiles + mean FPS. */
export function summarizeFrameTimes(deltasMs: number[]): FrameSummary {
  const clean = deltasMs.filter((d) => Number.isFinite(d) && d >= 0)
  if (clean.length === 0) {
    return { frames: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0, meanFps: 0 }
  }
  const sorted = [...clean].sort((a, b) => a - b)
  const total = clean.reduce((sum, d) => sum + d, 0)
  const mean = total / clean.length
  return {
    frames: clean.length,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    maxMs: sorted[sorted.length - 1] ?? 0,
    meanFps: mean > 0 ? 1000 / mean : 0,
  }
}

/** Render a summary as a compact, human-readable block for stderr. */
export function formatFrameSummary(summary: FrameSummary, label: string): string {
  const ms = (n: number) => `${n.toFixed(2)}ms`
  return [
    `[profile] ${label}`,
    `  frames:   ${summary.frames}`,
    `  p50:      ${ms(summary.p50Ms)}`,
    `  p95:      ${ms(summary.p95Ms)}`,
    `  p99:      ${ms(summary.p99Ms)}`,
    `  max:      ${ms(summary.maxMs)}`,
    `  mean fps: ${summary.meanFps.toFixed(1)}`,
  ].join('\n')
}
