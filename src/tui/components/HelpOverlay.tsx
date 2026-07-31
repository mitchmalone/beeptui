import type { HelpGroup } from '@/tui/keymap.ts'

export interface HelpOverlayProps {
  groups: HelpGroup[]
}

function GroupBlock({ group }: { group: HelpGroup }) {
  return (
    <box style={{ flexDirection: 'column', marginBottom: 1 }}>
      <text style={{ fg: '#38bdf8' }}>{group.title}</text>
      {group.bindings.map((binding, index) => (
        <text key={index}>{`  ${binding.display.padEnd(10)} ${binding.description}`}</text>
      ))}
    </box>
  )
}

/** The `?` help overlay. Content comes from `helpGroups()` (generated from the
 *  keymap), so it can never drift from the actual bindings. Laid out in two
 *  columns so the full binding set fits a short terminal without overflowing. */
export function HelpOverlay({ groups }: HelpOverlayProps) {
  const mid = Math.ceil(groups.length / 2)
  const columns = [groups.slice(0, mid), groups.slice(mid)]
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
