/**
 * Pure conversation scroll math. The message list is a computed window over the
 * loaded messages rather than an OpenTUI `scrollbox` — the scrollbox's
 * `stickyStart` bottom-pin misbehaves in the headless test renderer, and a
 * sliced window is deterministic and unit-testable (see `LEARNINGS.md`).
 *
 * `offset` is the number of rows scrolled up from the bottom: 0 pins to the
 * newest message; `maxScrollOffset` shows the oldest loaded message at the top.
 */

export function maxScrollOffset(count: number, capacity: number): number {
  return Math.max(0, count - Math.max(1, capacity))
}

export function clampOffset(offset: number, count: number, capacity: number): number {
  return Math.min(Math.max(0, offset), maxScrollOffset(count, capacity))
}

/** The window of messages currently visible, given a viewport `capacity`. */
export function visibleMessages<T>(messages: T[], capacity: number, offset: number): T[] {
  if (capacity <= 0 || messages.length === 0) return []
  const clamped = clampOffset(offset, messages.length, capacity)
  const end = messages.length - clamped
  const start = Math.max(0, end - capacity)
  return messages.slice(start, end)
}
