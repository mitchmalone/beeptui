import type { ConversationAction } from '@/state/reactions.ts'
import { useTheme } from '@/tui/theme/context.tsx'

export interface ConversationActionMenuProps {
  /** Index of the highlighted action. */
  cursor: number
  /** The selected message's own menu (from `conversationActionsFor`). */
  actions: readonly ConversationAction[]
}

/**
 * The ENTER "dropdown" on the selected message: a compact floating action menu
 * (positioned by `ConversationView` just under the message cursor). Today it
 * offers React; delete / reply-from-menu / etc. come later. Presentational — the
 * App owns input (↑/↓ move, ⏎ choose, Esc close).
 */
export function ConversationActionMenu({ cursor, actions }: ConversationActionMenuProps) {
  const theme = useTheme()
  // Solid background so the floating menu covers the messages it sits over.
  const bg = theme.menuBg
  return (
    <box
      title="Actions"
      border
      borderColor={theme.borderFocused}
      style={{ flexDirection: 'column', backgroundColor: bg, paddingLeft: 1, paddingRight: 1 }}
    >
      {actions.map((action, index) => (
        <text
          key={action.id}
          style={index === cursor ? { bg: theme.selectionBg, fg: theme.selectionFg } : { bg }}
        >
          {`${index === cursor ? '›' : ' '} ${action.label}`}
        </text>
      ))}
      <text style={{ fg: theme.muted, bg }}>⏎ · Esc</text>
    </box>
  )
}
