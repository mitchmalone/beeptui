import { memo } from 'react'
import { useTerminalDimensions } from '@opentui/react'
import type { ActiveConversation } from '@/state/selectors.ts'
import type { Density, MessageEntity } from '@/state/types.ts'
import { messageLine } from '@/tui/message-format.ts'
import { networkColor, type NetworkColors } from '@/tui/components/InboxPane.tsx'
import { visibleMessages } from '@/tui/conversation-scroll.ts'

export interface ConversationViewProps {
  conversation: ActiveConversation
  focused: boolean
  /** Test override for the viewport height in rows. */
  capacityOverride?: number
  /** Per-network colour overrides from config. */
  networkColors?: NetworkColors | undefined
  /** Layout density; `compact` strips pane padding (freeing two message rows). */
  density?: Density | undefined
}

/** Rows the surrounding chrome (border, padding, header, hints, status bar)
 *  takes from the terminal height, leaving the rest for messages. Compact
 *  density drops the pane's top+bottom padding, freeing two rows. */
const CHROME_ROWS = 9
const CHROME_ROWS_COMPACT = 7

function rowStyle(message: MessageEntity, selected: boolean): { fg?: string; bg?: string } {
  // Selection highlight wins visually — it's the active cursor.
  if (selected) return { fg: '#0f172a', bg: '#38bdf8' }
  if (message.status === 'failed') return { fg: '#f87171' }
  if (message.status === 'pending') return { fg: '#94a3b8' }
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
  capacityOverride,
  networkColors,
  density = 'comfortable',
}: ConversationViewProps) {
  const { height } = useTerminalDimensions()
  const { chat, messages, hasMoreOlder, scrollOffset, newMessagesBelow, selectedMessageId } =
    conversation
  const pad = density === 'compact' ? 0 : 1

  if (chat === null) {
    return (
      <box title="Conversation" border style={{ flexGrow: 1, padding: pad }}>
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

  return (
    <box
      title={focused ? 'Conversation ●' : 'Conversation'}
      border
      style={{ flexGrow: 1, flexDirection: 'column', padding: pad }}
    >
      <box style={{ flexShrink: 0, flexDirection: 'row' }}>
        <text>{`${chat.title} · `}</text>
        <text style={{ fg: networkColor(chat.network, networkColors) }}>{chat.network}</text>
      </box>
      <text style={{ flexShrink: 0, fg: '#94a3b8' }}>{topHint}</text>
      <box style={{ flexGrow: 1, flexDirection: 'column' }}>
        {visible.length === 0 ? (
          <text>No messages yet.</text>
        ) : (
          visible.map((message) => (
            <text key={message.id} style={rowStyle(message, message.id === selectedMessageId)}>
              {messageLine(message)}
            </text>
          ))
        )}
      </box>
      {selectedMessageId !== null ? (
        <text style={{ flexShrink: 0, fg: '#38bdf8' }}>
          — selecting: r reply · o open · s save · Esc exit —
        </text>
      ) : newMessagesBelow ? (
        <text style={{ flexShrink: 0, fg: '#38bdf8' }}>
          — ↓ new messages — press G for latest —
        </text>
      ) : scrollOffset > 0 ? (
        <text style={{ flexShrink: 0, fg: '#94a3b8' }}>— ↓ j for newer —</text>
      ) : null}
    </box>
  )
})
