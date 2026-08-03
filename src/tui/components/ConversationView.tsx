import { Fragment, memo, type ReactNode } from 'react'
import { useTerminalDimensions } from '@opentui/react'
import type { ActiveConversation } from '@/state/selectors.ts'
import type { Density, MessageEntity } from '@/state/types.ts'
import type { StyledRun } from '@/state/message-html.ts'
import { layOutMessages, totalRows, type LayoutRow } from '@/state/message-layout.ts'
import { networkColor, type NetworkColors } from '@/tui/components/InboxPane.tsx'
import {
  CARET_GUTTER,
  clampOffset,
  conversationCapacity,
  conversationContentWidth,
  maxScrollOffset,
  visibleRows,
} from '@/state/conversation-scroll.ts'
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
  /** Test override for the content width in columns. */
  widthOverride?: number
  /** Per-network colour overrides from config. */
  networkColors?: NetworkColors | undefined
  /** Layout density; `compact` strips pane padding and the message separator. */
  density?: Density | undefined
}

/** Rows a floating menu occupies (border + rows + hint), for open-up/down choice. */
function menuHeight(menu: NonNullable<ConversationMenu>): number {
  // border (2) + hint (1) + content rows.
  return menu.kind === 'emoji' ? 2 + 1 + 1 : 2 + 1 + CONVERSATION_ACTIONS.length
}

function rowStyle(
  message: MessageEntity | undefined,
  selected: boolean,
  theme: Theme
): { fg?: string } {
  // Selection highlight wins visually — it's the active cursor.
  if (selected) return { fg: theme.selectionFg }
  if (message?.status === 'failed') return { fg: theme.danger }
  if (message?.status === 'pending') return { fg: theme.muted }
  return {}
}

/** Render one styled run as nested bold/italic/underline modifier spans — those
 *  set the real terminal attributes (a `style` bool on `<span>` does not). */
function renderRun(run: StyledRun, key: number): ReactNode {
  let node: ReactNode = run.text
  if (run.underline) node = <u>{node}</u>
  if (run.italic) node = <i>{node}</i>
  if (run.bold) node = <b>{node}</b>
  return <Fragment key={key}>{node}</Fragment>
}

/** One laid-out row, drawn inside the content column so that every line —
 *  header, body, wrapped continuation — starts at the same column. */
function RowContent({ row, style }: { row: LayoutRow; style: { fg?: string } }) {
  if (row.kind === 'blank') return <text> </text>
  if (row.kind === 'body') {
    return <text style={style}>{row.runs.map((run, i) => renderRun(run, i))}</text>
  }
  // Header: sender hard left, timestamp hard right, a flex spacer between them
  // so the time stays pinned to the pane edge across a resize.
  return (
    <box style={{ flexDirection: 'row' }}>
      <text style={style}>
        <b>{row.sender}</b>
      </text>
      <box style={{ flexGrow: 1 }} />
      <text style={style}>{row.time}</text>
    </box>
  )
}

/**
 * Center pane: the selected chat's message history as a computed, bottom-pinned
 * window over the loaded messages (`scrollOffset` from state). Scrolling and
 * paging are driven by the reducer; this component only renders.
 *
 * The window is measured in rows, not messages — a message is a header row plus
 * however many rows its body wraps onto, plus a separator. `message-layout.ts`
 * computes that and the reducer slices with the same functions, so the drawn
 * window and the reducer's idea of it cannot drift apart.
 */
export const ConversationView = memo(function ConversationView({
  conversation,
  focused,
  menu = null,
  capacityOverride,
  widthOverride,
  networkColors,
  density = 'comfortable',
}: ConversationViewProps) {
  const theme = useTheme()
  const { height, width } = useTerminalDimensions()
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

  const capacity = capacityOverride ?? conversationCapacity(height, density)
  const contentWidth = widthOverride ?? conversationContentWidth(width, density)
  const layouts = layOutMessages(messages, contentWidth, { separator: density !== 'compact' })
  const total = totalRows(layouts)
  const visible = visibleRows(layouts, capacity, scrollOffset)

  const atOldestLoaded =
    clampOffset(scrollOffset, total, capacity) >= maxScrollOffset(total, capacity)
  const topHint = atOldestLoaded
    ? hasMoreOlder
      ? '— press u to load older —'
      : '— start of history —'
    : '— ↑ older —'

  // Anchor the floating menu on the selected message's *first* row within the
  // visible window: open downward just under it, or upward when it would
  // overflow the bottom. `top`/`left` are relative to the (position:relative)
  // messages box, whose row 0 is the first visible row.
  const menuRow =
    menu !== null ? visible.findIndex((r) => r.messageId === selectedMessageId && r.first) : -1
  const showMenu = menu !== null && menuRow >= 0
  const menuTop =
    showMenu && menu !== null
      ? menuRow + 1 + menuHeight(menu) <= capacity
        ? menuRow + 1
        : Math.max(0, menuRow - menuHeight(menu))
      : 0

  const byId = new Map(messages.map((m) => [m.id, m]))

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
          visible.map((vr, i) => {
            const selected = vr.messageId === selectedMessageId
            const style = rowStyle(byId.get(vr.messageId), selected, theme)
            // The separator belongs to the message above it but not to its
            // block — tinting it would run the highlight a row too far.
            const tinted = selected && vr.row.kind !== 'blank'
            // A `›` caret marks the message cursor, mirroring the Net/Chats
            // rails. It lives in its own column rather than in the text, so
            // wrapped lines stay aligned under the sender name.
            return (
              <box
                key={`${vr.messageId}-${i}`}
                style={{
                  flexDirection: 'row',
                  height: 1,
                  flexShrink: 0,
                  ...(tinted ? { backgroundColor: theme.selectionBg } : {}),
                }}
              >
                <box style={{ width: CARET_GUTTER, flexShrink: 0 }}>
                  <text style={style}>{selected && vr.first ? '›' : ' '}</text>
                </box>
                <box style={{ flexGrow: 1, flexDirection: 'column' }}>
                  <RowContent row={vr.row} style={style} />
                </box>
              </box>
            )
          })
        )}
        {showMenu && menu !== null ? (
          <box style={{ position: 'absolute', top: menuTop, left: CARET_GUTTER, zIndex: 20 }}>
            {menu.kind === 'actions' ? (
              <ConversationActionMenu cursor={menu.actionCursor} />
            ) : (
              <EmojiPicker cursor={menu.emojiCursor} />
            )}
          </box>
        ) : null}
      </box>
      {/* The new-messages affordance takes priority — it's transient and time
          sensitive — then the selection hint, then the plain scrolled-up hint.
          The row is always drawn, blank when there is nothing to say: a
          conditional row would make the chrome height vary, and the viewport
          capacity is a constant that has to stay true. */}
      {newMessagesBelow ? (
        <text style={{ flexShrink: 0, height: 1, fg: theme.accent }}>
          — ↓ new messages — press G for latest —
        </text>
      ) : selectedMessageId !== null ? (
        <text style={{ flexShrink: 0, height: 1, fg: theme.accent }}>
          — ↑/↓ move · ⏎ actions · r reply · Esc back —
        </text>
      ) : scrollOffset > 0 ? (
        <text style={{ flexShrink: 0, height: 1, fg: theme.muted }}>— ↓ j for newer —</text>
      ) : (
        <text style={{ flexShrink: 0, height: 1 }}> </text>
      )}
    </box>
  )
})
