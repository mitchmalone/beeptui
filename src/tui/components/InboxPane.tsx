import type { InboxRow } from '@/state/selectors.ts'

/** Two-letter network marker for the rail (e.g. WhatsApp → WA). */
export function networkMarker(network: string): string {
  const known: Record<string, string> = {
    WhatsApp: 'WA',
    Slack: 'SL',
    Telegram: 'TG',
    Signal: 'SG',
    Discord: 'DC',
    Instagram: 'IG',
  }
  return known[network] ?? network.slice(0, 2).toUpperCase()
}

export interface InboxPaneProps {
  rows: InboxRow[]
  /** Grow to fill width (narrow single-pane fallback) instead of a fixed rail. */
  grow?: boolean
}

/** Left-rail chat list. Presentational: it renders `selectInboxRows` output and
 *  holds no state, so it's cheap to render-test. */
export function InboxPane({ rows, grow = false }: InboxPaneProps) {
  return (
    <box
      title="Chats"
      border
      style={
        grow
          ? { flexGrow: 1, flexDirection: 'column', padding: 1 }
          : { width: 32, flexShrink: 0, flexDirection: 'column', padding: 1 }
      }
    >
      {rows.length === 0 ? (
        <text>No chats to show.</text>
      ) : (
        rows.map((row) => <InboxRowView key={row.id} row={row} />)
      )}
    </box>
  )
}

function InboxRowView({ row }: { row: InboxRow }) {
  const prefix = row.isSelected ? '›' : ' '
  const unread = row.hasUnread ? ` (${row.unreadCount})` : ''
  const muted = row.isMuted ? ' 🔇' : ''
  const line = `${prefix} ${networkMarker(row.network)}  ${row.title}${unread}${muted}`
  return <text style={row.isSelected ? { bg: '#334155', fg: '#ffffff' } : {}}>{line}</text>
}
