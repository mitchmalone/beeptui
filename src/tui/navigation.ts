import type { InboxRow } from '@/state/selectors.ts'

/**
 * Pure inbox cursor math. Kept out of components so it's unit-testable without
 * rendering a terminal (Slice 3 risk note: push logic out of OpenTUI components).
 */

/** Move selection by `delta` rows, clamped to the ends. Returns the new chat id
 *  (or null when the list is empty). A null current selects the first row. */
export function moveSelection(
  rows: InboxRow[],
  currentId: string | null,
  delta: 1 | -1
): string | null {
  if (rows.length === 0) return null
  const index = rows.findIndex((r) => r.id === currentId)
  if (index === -1) return rows[0]?.id ?? null
  const next = Math.min(rows.length - 1, Math.max(0, index + delta))
  return rows[next]?.id ?? null
}

/** Jump to the first or last row. */
export function edgeSelection(rows: InboxRow[], edge: 'top' | 'bottom'): string | null {
  if (rows.length === 0) return null
  return (edge === 'top' ? rows[0] : rows[rows.length - 1])?.id ?? null
}
