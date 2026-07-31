import type { HelpGroup } from '@/tui/keymap.ts'

export interface HelpOverlayProps {
  groups: HelpGroup[]
}

/** The `?` help overlay. Content comes from `helpGroups()` (generated from the
 *  keymap), so it can never drift from the actual bindings. */
export function HelpOverlay({ groups }: HelpOverlayProps) {
  return (
    <box
      title="Keys — ? or Esc to close"
      border
      style={{ flexGrow: 1, flexDirection: 'column', padding: 1 }}
    >
      {groups.map((group) => (
        <box key={group.title} style={{ flexDirection: 'column', marginBottom: 1 }}>
          <text style={{ fg: '#38bdf8' }}>{group.title}</text>
          {group.bindings.map((binding, index) => (
            <text key={index}>{`  ${binding.display.padEnd(10)} ${binding.description}`}</text>
          ))}
        </box>
      ))}
    </box>
  )
}
