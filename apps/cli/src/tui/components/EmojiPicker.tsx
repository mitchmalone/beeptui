import { QUICK_REACTIONS } from '@/state/reactions.ts'
import { useTheme } from '@/tui/theme/context.tsx'

export interface EmojiPickerProps {
  /** Index of the highlighted emoji within `QUICK_REACTIONS`. */
  cursor: number
}

/**
 * The limited reaction picker reached from the action menu's React option: a
 * compact, single-row floating box (positioned by `ConversationView` under the
 * message cursor). Presentational — the App owns input (←/→ move, ⏎ react, Esc).
 */
export function EmojiPicker({ cursor }: EmojiPickerProps) {
  const theme = useTheme()
  // Solid background so the floating picker covers the messages it sits over.
  const bg = theme.menuBg
  return (
    <box
      title="React"
      border
      borderColor={theme.borderFocused}
      style={{ flexDirection: 'column', backgroundColor: bg, paddingLeft: 1, paddingRight: 1 }}
    >
      <box style={{ flexDirection: 'row' }}>
        {QUICK_REACTIONS.map((emoji, index) => (
          <text
            key={emoji}
            style={index === cursor ? { bg: theme.selectionBg, fg: theme.selectionFg } : { bg }}
          >
            {` ${emoji} `}
          </text>
        ))}
      </box>
      <text style={{ fg: theme.muted, bg }}>⏎ react · Esc back</text>
    </box>
  )
}
