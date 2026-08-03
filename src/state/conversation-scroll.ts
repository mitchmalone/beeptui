/**
 * Pure conversation scroll math. The message list is a computed window over the
 * loaded messages rather than an OpenTUI `scrollbox` — the scrollbox's
 * `stickyStart` bottom-pin misbehaves in the headless test renderer, and a
 * sliced window is deterministic and unit-testable (see `LEARNINGS.md`).
 *
 * `offset` is the number of rows scrolled up from the bottom: 0 pins to the
 * newest message; `maxScrollOffset` shows the oldest loaded message at the top.
 */

import type { Density } from '@/state/types.ts'

/** Rows the surrounding chrome (border, padding, header, hints, status bar)
 *  takes from the terminal height, leaving the rest for messages. Compact
 *  density drops the pane's top+bottom padding, freeing two rows. */
export const CHROME_ROWS = 9
export const CHROME_ROWS_COMPACT = 7

/** The message-viewport capacity for a given terminal height and density. Shared
 *  by the reducer (to keep the selection in view) and the view (to slice the
 *  window), so both agree on how many message rows are visible. */
export function conversationCapacity(height: number, density: Density): number {
  const chrome = density === 'compact' ? CHROME_ROWS_COMPACT : CHROME_ROWS
  return Math.max(1, height - chrome)
}

export function maxScrollOffset(count: number, capacity: number): number {
  return Math.max(0, count - Math.max(1, capacity))
}

export function clampOffset(offset: number, count: number, capacity: number): number {
  return Math.min(Math.max(0, offset), maxScrollOffset(count, capacity))
}

/**
 * The scroll offset that keeps message `index` visible with the least movement.
 * `index` is 0-based from the oldest loaded message. If the index is already on
 * screen at `currentOffset`, that offset is kept; otherwise it scrolls just
 * enough to bring the index to the nearest edge. Result is always a valid,
 * clamped offset. Used by the reducer when the selection cursor moves so the
 * indicator never lands off-window.
 */
export function offsetToShowIndex(
  index: number,
  count: number,
  capacity: number,
  currentOffset: number
): number {
  if (count <= 0 || capacity <= 0) return clampOffset(currentOffset, count, capacity)
  // Visible indices at offset o are [count-o-capacity, count-o-1]; solving for o
  // that contains `index` gives the inclusive range [lo, hi].
  const lo = count - capacity - index
  const hi = count - 1 - index
  const target = Math.min(hi, Math.max(lo, currentOffset))
  return clampOffset(target, count, capacity)
}

/** The window of messages currently visible, given a viewport `capacity`. */
export function visibleMessages<T>(messages: T[], capacity: number, offset: number): T[] {
  if (capacity <= 0 || messages.length === 0) return []
  const clamped = clampOffset(offset, messages.length, capacity)
  const end = messages.length - clamped
  const start = Math.max(0, end - capacity)
  return messages.slice(start, end)
}
