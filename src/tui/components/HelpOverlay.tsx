import type { HelpGroup } from '@/tui/keymap.ts'
import { useTheme } from '@/tui/theme/context.tsx'

export interface HelpOverlayProps {
  groups: HelpGroup[]
}

function GroupBlock({ group }: { group: HelpGroup }) {
  // No trailing blank line: the accent title is separation enough, and on a short
  // (24-row) terminal an extra row per group can tip a column past the box
  // height, where sibling group-boxes overlap instead of clipping (JOURNAL).
  const theme = useTheme()
  return (
    <box style={{ flexDirection: 'column' }}>
      <text style={{ fg: theme.accent }}>{group.title}</text>
      {group.bindings.map((binding, index) => (
        <text key={index}>{`  ${binding.display.padEnd(10)} ${binding.description}`}</text>
      ))}
    </box>
  )
}

/** Rows a group occupies: title + one per binding. */
function groupHeight(group: HelpGroup): number {
  return group.bindings.length + 1
}

/**
 * Split groups across two columns balancing total *rows*, not group count — an
 * even count split leaves one column much taller and its group-boxes overlap
 * (they don't clip) on a short terminal, garbling rows (see docs/JOURNAL.md).
 * Greedy: each group joins the currently-shorter column, preserving order.
 */
function balanceColumns(groups: HelpGroup[]): [HelpGroup[], HelpGroup[]] {
  const left: HelpGroup[] = []
  const right: HelpGroup[] = []
  let leftHeight = 0
  let rightHeight = 0
  for (const group of groups) {
    if (leftHeight <= rightHeight) {
      left.push(group)
      leftHeight += groupHeight(group)
    } else {
      right.push(group)
      rightHeight += groupHeight(group)
    }
  }
  return [left, right]
}

/** The `?` help overlay. Content comes from `helpGroups()` (generated from the
 *  keymap), so it can never drift from the actual bindings. Laid out in two
 *  row-balanced columns so the full binding set fits a short terminal without
 *  overflowing. */
export function HelpOverlay({ groups }: HelpOverlayProps) {
  const columns = balanceColumns(groups)
  return (
    <box
      title="Keys — ? or Esc to close"
      border
      style={{ flexGrow: 1, flexDirection: 'row', padding: 1 }}
    >
      {columns.map((column, columnIndex) => (
        <box key={columnIndex} style={{ flexGrow: 1, flexDirection: 'column' }}>
          {column.map((group) => (
            <GroupBlock key={group.title} group={group} />
          ))}
        </box>
      ))}
    </box>
  )
}
