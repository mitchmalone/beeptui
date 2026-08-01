import type { MessageSearchState } from '@/state/types.ts'
import { formatTime } from '@/tui/message-format.ts'
import { networkMarker } from '@/tui/components/InboxPane.tsx'

export interface MessageSearchPaletteProps {
  state: MessageSearchState
}

/** The message-search overlay. Type a query, ⏎ runs the search through Beeper;
 *  ↑/↓ move between hits, ⏎ opens the selected one, Esc dismisses. Coverage that
 *  is partial (local fallback / server ignored scope) is labeled honestly.
 *  Presentational — the App owns input and the adapter call. */
export function MessageSearchPalette({ state }: MessageSearchPaletteProps) {
  const { query, status, results, selectedIndex, partial, note, scopeChatId } = state
  const title = scopeChatId !== null ? 'Search messages (this chat)' : 'Search messages'

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
    <box title={title} border style={{ flexGrow: 1, flexDirection: 'column', padding: 1 }}>
      <text style={{ flexShrink: 0 }}>{`? ${query}▏`}</text>
      <text style={{ flexShrink: 0, fg: partial ? '#f59e0b' : '#94a3b8' }}>
        {partial ? `${statusLine} · partial` : statusLine}
      </text>
      <box style={{ flexGrow: 1, flexDirection: 'column' }}>
        {results.slice(0, 12).map((hit, index) => {
          const selected = index === selectedIndex
          const time = formatTime(hit.timestamp)
          const context = `${networkMarker(hit.network)} ${hit.chatTitle} · ${hit.senderName}${
            time ? ` · ${time}` : ''
          }`
          return (
            <box key={hit.messageId} style={{ flexDirection: 'column' }}>
              <text style={selected ? { bg: '#334155', fg: '#ffffff' } : { fg: '#94a3b8' }}>
                {`${selected ? '›' : ' '} ${context}`}
              </text>
              <text style={selected ? { bg: '#334155', fg: '#ffffff' } : {}}>
                {`   ${hit.snippet}`}
              </text>
            </box>
          )
        })}
      </box>
      <text style={{ flexShrink: 0, fg: '#94a3b8' }}>{'↑/↓ select · ⏎ open · Esc cancel'}</text>
    </box>
  )
}
