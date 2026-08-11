import { SETTINGS_ITEMS } from '@/state/reactions.ts'
import { useTheme } from '@/tui/theme/context.tsx'

export interface SettingsMenuProps {
  /** Index of the highlighted setting. */
  cursor: number
}

/**
 * The Settings flyout, opened from the Net rail's Settings entry. Modelled on
 * `ConversationActionMenu`: a content-sized box the rail positions absolutely
 * over the panes, which stay mounted. Presentational — the App owns input
 * (↑/↓ move, ⏎ choose, Esc back one level).
 */
export function SettingsMenu({ cursor }: SettingsMenuProps) {
  const theme = useTheme()
  // Solid background so the flyout covers the columns it sits over.
  const bg = theme.menuBg
  return (
    <box
      title="Settings"
      border
      borderColor={theme.borderFocused}
      style={{ flexDirection: 'column', backgroundColor: bg, paddingLeft: 1, paddingRight: 1 }}
    >
      {SETTINGS_ITEMS.map((item, index) => (
        <text
          key={item.id}
          style={index === cursor ? { bg: theme.selectionBg, fg: theme.selectionFg } : { bg }}
        >
          {`${index === cursor ? '›' : ' '} ${item.label}`}
        </text>
      ))}
      <text style={{ fg: theme.muted, bg }}>⏎ · Esc</text>
    </box>
  )
}
