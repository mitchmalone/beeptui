import type { MessageSearchState } from '@/state/types.ts'
import { formatTime } from '@/state/message-format.ts'
import { networkMarker } from '@/tui/components/InboxPane.tsx'
import { useTheme } from '@/tui/theme/context.tsx'

export interface MessageSearchPaletteProps {
  state: MessageSearchState
}

/** The message-search overlay. Type a query, ⏎ runs the search through Beeper;
 *  ↑/↓ move between hits, ⏎ opens the selected one, Esc dismisses. Coverage that
 *  is partial (local fallback / server ignored scope) is labeled honestly.
 *  Presentational — the App owns input and the adapter call. */
/** Result rows shown at once; the visible window follows the selection. */
const VISIBLE_RESULTS = 12

export function MessageSearchPalette({ state }: MessageSearchPaletteProps) {
  const theme = useTheme()
  const { query, status, results, selectedIndex, partial, note, scopeChatId } = state
  const selStyle = { bg: theme.selectionBg, fg: theme.selectionFg }
  const title = scopeChatId !== null ? 'Search messages (this chat)' : 'Search messages'
  const windowStart = Math.max(
    0,
    Math.min(selectedIndex - VISIBLE_RESULTS + 1, results.length - VISIBLE_RESULTS)
  )

  const statusLine =
    status === 'searching'
      ? 'Searching…'
      : status === 'error'
        ? (note ?? 'Search unavailable')
        : status === 'done'
          ? results.length === 0
            ? 'No matches'
            : (note ?? `${results.length} result${results.length === 1 ? '' : 's'}`)
          : query.trim().length === 0
            ? 'Type a query, Enter to search'
            : 'Enter to search'

  return (
    <box
      title={title}
      border
      borderColor={theme.borderFocused}
      style={{ flexGrow: 1, flexDirection: 'column', padding: 1 }}
    >
      <text style={{ flexShrink: 0 }}>{`? ${query}▏`}</text>
      <text style={{ flexShrink: 0, fg: partial ? theme.warning : theme.muted }}>
        {partial ? `${statusLine} · partial` : statusLine}
      </text>
      <box style={{ flexGrow: 1, flexDirection: 'column' }}>
        {/* Window the visible rows around the selection so the cursor can never
            walk off-screen when there are more hits than fit. */}
        {results.slice(windowStart, windowStart + VISIBLE_RESULTS).map((hit, offset) => {
          const index = windowStart + offset
          const selected = index === selectedIndex
          const time = formatTime(hit.timestamp)
          const context = `${networkMarker(hit.network)} ${hit.chatTitle} · ${hit.senderName}${
            time ? ` · ${time}` : ''
          }`
          return (
            <box key={hit.messageId} style={{ flexDirection: 'column' }}>
              <text style={selected ? selStyle : { fg: theme.muted }}>
                {`${selected ? '›' : ' '} ${context}`}
              </text>
              <text style={selected ? selStyle : {}}>{`   ${hit.snippet}`}</text>
            </box>
          )
        })}
      </box>
      <text style={{ flexShrink: 0, fg: theme.muted }}>{'↑/↓ select · ⏎ open · Esc cancel'}</text>
    </box>
  )
}
