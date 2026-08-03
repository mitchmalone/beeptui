import { memo } from 'react'
import { useTerminalDimensions } from '@opentui/react'
import type { ActiveConversation } from '@/state/selectors.ts'
import type { Density, MessageEntity } from '@/state/types.ts'
import { messageLine } from '@/tui/message-format.ts'
import { networkColor, type NetworkColors } from '@/tui/components/InboxPane.tsx'
import { CHROME_ROWS, CHROME_ROWS_COMPACT, visibleMessages } from '@/state/conversation-scroll.ts'
import { ConversationActionMenu } from '@/tui/components/ConversationActionMenu.tsx'
import { EmojiPicker } from '@/tui/components/EmojiPicker.tsx'
import { CONVERSATION_ACTIONS } from '@/state/reactions.ts'
import { useTheme } from '@/tui/theme/context.tsx'
import type { Theme } from '@/tui/theme/theme.ts'

/** The floating menu open over the message cursor, if any. Positioned by this
 *  component just under (or above) the selected message row. */
export type ConversationMenu =
  { kind: 'actions'; actionCursor: number } | { kind: 'emoji'; emojiCursor: number } | null

export interface ConversationViewProps {
  conversation: ActiveConversation
  focused: boolean
  /** Floating action-menu / emoji-picker anchored on the selected message. */
  menu?: ConversationMenu
  /** Test override for the viewport height in rows. */
  capacityOverride?: number
  /** Per-network colour overrides from config. */
  networkColors?: NetworkColors | undefined
  /** Layout density; `compact` strips pane padding (freeing two message rows). */
  density?: Density | undefined
}

/** Rows a floating menu occupies (border + rows + hint), for open-up/down choice. */
function menuHeight(menu: NonNullable<ConversationMenu>): number {
  // border (2) + hint (1) + content rows.
  return menu.kind === 'emoji' ? 2 + 1 + 1 : 2 + 1 + CONVERSATION_ACTIONS.length
}

function rowStyle(
  message: MessageEntity,
  selected: boolean,
  theme: Theme
): { fg?: string; bg?: string } {
  // Selection highlight wins visually — it's the active cursor.
  if (selected) return { fg: theme.selectionFg, bg: theme.selectionBg }
  if (message.status === 'failed') return { fg: theme.danger }
  if (message.status === 'pending') return { fg: theme.muted }
  return {}
}

/**
 * Center pane: the selected chat's message history as a computed, bottom-pinned
 * window over the loaded messages (`scrollOffset` from state). Scrolling and
 * paging are driven by the reducer; this component only renders.
 */
export const ConversationView = memo(function ConversationView({
  conversation,
  focused,
  menu = null,
  capacityOverride,
  networkColors,
  density = 'comfortable',
}: ConversationViewProps) {
  const theme = useTheme()
  const { height } = useTerminalDimensions()
  const { chat, messages, hasMoreOlder, scrollOffset, newMessagesBelow, selectedMessageId } =
    conversation
  const pad = density === 'compact' ? 0 : 1
  const borderColor = focused ? theme.borderFocused : theme.border

  if (chat === null) {
    return (
      <box
        title={focused ? 'Conversation ●' : 'Conversation'}
        border
        borderColor={borderColor}
        style={{ flexGrow: 1, padding: pad }}
      >
        <text>Select a chat with j/k, then ⏎.</text>
      </box>
    )
  }

  const chromeRows = density === 'compact' ? CHROME_ROWS_COMPACT : CHROME_ROWS
  const capacity = capacityOverride ?? Math.max(1, height - chromeRows)
  const visible = visibleMessages(messages, capacity, scrollOffset)
  const atOldestLoaded = visible.length === 0 || visible[0]?.id === messages[0]?.id
  const topHint = atOldestLoaded
    ? hasMoreOlder
      ? '— press u to load older —'
      : '— start of history —'
    : '— ↑ older —'

  // Anchor the floating menu on the selected message's row within the visible
  // window: open downward just under it, or upward when it would overflow the
  // bottom. `top`/`left` are relative to the (position:relative) messages box,
  // whose row 0 is the first visible message.
  const menuRow = menu !== null ? visible.findIndex((m) => m.id === selectedMessageId) : -1
  const showMenu = menu !== null && menuRow >= 0
  const menuTop =
    showMenu && menu !== null
      ? menuRow + 1 + menuHeight(menu) <= capacity
        ? menuRow + 1
        : Math.max(0, menuRow - menuHeight(menu))
      : 0

  return (
    <box
      title={focused ? 'Conversation ●' : 'Conversation'}
      border
      borderColor={borderColor}
      style={{ flexGrow: 1, flexDirection: 'column', padding: pad }}
    >
      <box style={{ flexShrink: 0, flexDirection: 'row' }}>
        <text>{`${chat.title} · `}</text>
        <text style={{ fg: networkColor(chat.network, networkColors) }}>{chat.network}</text>
      </box>
      <text style={{ flexShrink: 0, fg: theme.muted }}>{topHint}</text>
      <box style={{ flexGrow: 1, flexDirection: 'column', position: 'relative' }}>
        {visible.length === 0 ? (
          <text>No messages yet.</text>
        ) : (
          visible.map((message) => {
            const selected = message.id === selectedMessageId
            // A `›` caret marks the message cursor, mirroring the Net/Chats rails.
            return (
              <text key={message.id} style={rowStyle(message, selected, theme)}>
                {`${selected ? '›' : ' '} ${messageLine(message)}`}
              </text>
            )
          })
        )}
        {showMenu && menu !== null ? (
          <box style={{ position: 'absolute', top: menuTop, left: 2, zIndex: 20 }}>
            {menu.kind === 'actions' ? (
              <ConversationActionMenu cursor={menu.actionCursor} />
            ) : (
              <EmojiPicker cursor={menu.emojiCursor} />
            )}
          </box>
        ) : null}
      </box>
      {/* The new-messages affordance takes priority — it's transient and time
          sensitive — then the selection hint, then the plain scrolled-up hint. */}
      {newMessagesBelow ? (
        <text style={{ flexShrink: 0, fg: theme.accent }}>
          — ↓ new messages — press G for latest —
        </text>
      ) : selectedMessageId !== null ? (
        <text style={{ flexShrink: 0, fg: theme.accent }}>
          — ↑/↓ move · ⏎ actions · r reply · Esc back —
        </text>
      ) : scrollOffset > 0 ? (
        <text style={{ flexShrink: 0, fg: theme.muted }}>— ↓ j for newer —</text>
      ) : null}
    </box>
  )
})
