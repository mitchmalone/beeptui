import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { HelpOverlay } from '@/tui/components/HelpOverlay.tsx'
import { helpGroups } from '@/tui/keymap.ts'

describe('HelpOverlay', () => {
  test('renders every keymap group, including message-selection bindings', async () => {
    const { renderOnce, captureCharFrame } = await testRender(
      <HelpOverlay groups={helpGroups()} />,
      { width: 100, height: 30 }
    )
    await renderOnce()
    const frame = captureCharFrame()
    for (const title of ['Global', 'Inbox', 'Conversation', 'Messages', 'Compose']) {
      expect(frame).toContain(title)
    }
    // The Slice 11 selection keys are documented so they self-teach.
    expect(frame).toContain('Reply to the selected message')
    expect(frame).toContain('Open its attachment')
  })

  test('the two columns stay row-balanced so neither overflows and overlaps', async () => {
    // Column-count splitting put 3 heavy groups left / 2 light right, and the
    // taller column's boxes overlapped on a short terminal. Balancing by rows
    // keeps the columns within one group-height of each other.
    const groups = helpGroups()
    const rows = (g: (typeof groups)[number]) => g.bindings.length + 2
    const columns: [number, number] = [0, 0]
    for (const g of groups) {
      const target = columns[0] <= columns[1] ? 0 : 1
      columns[target] += rows(g)
    }
    const tallest = Math.max(...groups.map(rows))
    expect(Math.abs(columns[0] - columns[1])).toBeLessThanOrEqual(tallest)
  })
})
