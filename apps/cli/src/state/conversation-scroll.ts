/**
 * Pure conversation viewport geometry and scroll math. The message list is a
 * computed window over the loaded messages rather than an OpenTUI `scrollbox` —
 * the scrollbox's `stickyStart` bottom-pin misbehaves in the headless test
 * renderer, and a sliced window is deterministic and unit-testable (see
 * `LEARNINGS.md`).
 *
 * The window is measured in **rows, not messages**. A message occupies a header
 * row, one row per wrapped body line, and a blank separator, so counting
 * messages and counting rows are different numbers (`message-layout.ts`). The
 * reducer and the view both slice with the functions here, which is what keeps
 * the selection cursor and the drawn window agreeing.
 *
 * `offset` is the number of rows scrolled up from the bottom: 0 pins to the
 * newest row; `maxScrollOffset` puts the oldest loaded row at the top.
 */

import type { Density } from '@/state/types.ts'
import { totalRows, type LayoutRow, type MessageLayout } from '@/state/message-layout.ts'

/** Rows the surrounding chrome takes from the terminal height, leaving the rest
 *  for messages: the pane's border and padding, its chat-title and top-hint
 *  rows, the always-present bottom hint, plus the compose pane and status bar
 *  below. Compact density drops the pane's top+bottom padding, freeing two.
 *
 *  This has to be exact, not close. Message rows are fixed-height boxes now, so
 *  an over-count silently clips the newest message off the bottom instead of
 *  merely wasting space. `ConversationView.test.tsx` pins it against a real
 *  render — change one and the other will tell you. */
export const CHROME_ROWS = 11
export const CHROME_ROWS_COMPACT = 9

/** Below this terminal width the app collapses to a single pane and the two
 *  left rails are not drawn. */
export const NARROW_WIDTH = 80

/** Fixed widths of the two left columns in the wide layout. */
export const NET_RAIL_WIDTH = 8
export const CHAT_RAIL_WIDTH = 32

/** Columns reserved for the caret gutter, left of every message's content. The
 *  gutter is a layout column rather than a string prefix, so wrapped lines stay
 *  aligned with the sender name instead of drifting back to the pane edge. */
export const CARET_GUTTER = 2

/** The message-viewport capacity in rows for a given terminal height and
 *  density. Shared by the reducer (to keep the selection in view) and the view
 *  (to slice the window), so both agree on how many rows are visible. */
export function conversationCapacity(height: number, density: Density): number {
  const chrome = density === 'compact' ? CHROME_ROWS_COMPACT : CHROME_ROWS
  return Math.max(1, height - chrome)
}

/**
 * Columns available to a message's text: the terminal minus the left rails (in
 * the wide layout), the pane's border and padding, and the caret gutter. Shared
 * for the same reason as the capacity — layout height depends on this width, so
 * a reducer that guessed it differently would mis-predict every wrap.
 */
export function conversationContentWidth(width: number, density: Density): number {
  const pane = width < NARROW_WIDTH ? width : width - NET_RAIL_WIDTH - CHAT_RAIL_WIDTH
  const padding = density === 'compact' ? 0 : 2
  return Math.max(1, pane - 2 - padding - CARET_GUTTER)
}

export function maxScrollOffset(rowCount: number, capacity: number): number {
  return Math.max(0, rowCount - Math.max(1, capacity))
}

export function clampOffset(offset: number, rowCount: number, capacity: number): number {
  return Math.min(Math.max(0, offset), maxScrollOffset(rowCount, capacity))
}

/** The flat row index a message starts at, or -1 if it isn't laid out. */
export function messageRowStart(layouts: readonly MessageLayout[], messageId: string): number {
  let row = 0
  for (const layout of layouts) {
    if (layout.messageId === messageId) return row
    row += layout.rows.length
  }
  return -1
}

/** A drawn row, tagged with the message it belongs to so the view can tint the
 *  whole block on selection and put the caret on its first row. */
export interface VisibleRow {
  row: LayoutRow
  messageId: string
  /** True on the message's first row — where the caret and highlight begin. */
  first: boolean
}

/** The window of rows currently visible, given a viewport `capacity` in rows. */
export function visibleRows(
  layouts: readonly MessageLayout[],
  capacity: number,
  offset: number
): VisibleRow[] {
  if (capacity <= 0 || layouts.length === 0) return []
  const total = totalRows(layouts)
  const clamped = clampOffset(offset, total, capacity)
  const end = total - clamped
  const start = Math.max(0, end - capacity)

  const out: VisibleRow[] = []
  let index = 0
  for (const layout of layouts) {
    for (let i = 0; i < layout.rows.length; i += 1, index += 1) {
      if (index < start) continue
      if (index >= end) return out
      const row = layout.rows[i]
      if (row !== undefined) out.push({ row, messageId: layout.messageId, first: i === 0 })
    }
  }
  return out
}

/**
 * The scroll offset that keeps `messageId` visible with the least movement. If
 * the message is already fully on screen the current offset is kept; otherwise
 * it scrolls just enough to bring it to the nearest edge. A message taller than
 * the viewport is anchored by its **top**, so the sender and time stay readable
 * rather than scrolling off in favour of its tail. Used by the reducer when the
 * selection cursor moves, so the cursor never lands off-window.
 */
export function offsetToShowMessage(
  layouts: readonly MessageLayout[],
  messageId: string,
  capacity: number,
  currentOffset: number
): number {
  const total = totalRows(layouts)
  if (capacity <= 0 || total === 0) return clampOffset(currentOffset, total, capacity)
  const start = messageRowStart(layouts, messageId)
  if (start === -1) return clampOffset(currentOffset, total, capacity)
  const height = layouts.find((l) => l.messageId === messageId)?.rows.length ?? 1

  // Visible rows at offset o are [total-o-capacity, total-o-1]; solving for the
  // offsets that contain the whole message gives the inclusive range [lo, hi].
  const lo = total - capacity - start
  const hi = total - start - height
  if (lo > hi) return clampOffset(lo, total, capacity) // taller than the viewport
  return clampOffset(Math.min(hi, Math.max(lo, currentOffset)), total, capacity)
}
