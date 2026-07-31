import { useTerminalDimensions } from '@opentui/react'
import type { ActiveConversation } from '@/state/selectors.ts'
import type { MessageEntity } from '@/state/types.ts'
import { messageLine } from '@/tui/message-format.ts'
import { networkColor } from '@/tui/components/InboxPane.tsx'
import { visibleMessages } from '@/tui/conversation-scroll.ts'

export interface ConversationViewProps {
  conversation: ActiveConversation
  focused: boolean
  /** Test override for the viewport height in rows. */
  capacityOverride?: number
}

/** Rows the surrounding chrome (border, padding, header, hints, status bar)
 *  takes from the terminal height, leaving the rest for messages. */
const CHROME_ROWS = 9

function rowStyle(message: MessageEntity): { fg?: string } {
  if (message.status === 'failed') return { fg: '#f87171' }
  if (message.status === 'pending') return { fg: '#94a3b8' }
  return {}
}

/**
 * Center pane: the selected chat's message history as a computed, bottom-pinned
 * window over the loaded messages (`scrollOffset` from state). Scrolling and
 * paging are driven by the reducer; this component only renders.
 */
export function ConversationView({
  conversation,
  focused,
  capacityOverride,
}: ConversationViewProps) {
  const { height } = useTerminalDimensions()
  const { chat, messages, hasMoreOlder, scrollOffset, newMessagesBelow } = conversation

  if (chat === null) {
    return (
      <box title="Conversation" border style={{ flexGrow: 1, padding: 1 }}>
        <text>Select a chat with j/k, then ⏎.</text>
      </box>
    )
  }

  const capacity = capacityOverride ?? Math.max(1, height - CHROME_ROWS)
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
      style={{ flexGrow: 1, flexDirection: 'column', padding: 1 }}
    >
      <box style={{ flexShrink: 0, flexDirection: 'row' }}>
        <text>{`${chat.title} · `}</text>
        <text style={{ fg: networkColor(chat.network) }}>{chat.network}</text>
      </box>
      <text style={{ flexShrink: 0, fg: '#94a3b8' }}>{topHint}</text>
      <box style={{ flexGrow: 1, flexDirection: 'column' }}>
        {visible.length === 0 ? (
          <text>No messages yet.</text>
        ) : (
          visible.map((message) => (
            <text key={message.id} style={rowStyle(message)}>
              {messageLine(message)}
            </text>
          ))
        )}
      </box>
      {newMessagesBelow ? (
        <text style={{ flexShrink: 0, fg: '#38bdf8' }}>
          — ↓ new messages — press G for latest —
        </text>
      ) : scrollOffset > 0 ? (
        <text style={{ flexShrink: 0, fg: '#94a3b8' }}>— ↓ j for newer —</text>
      ) : null}
    </box>
  )
}
