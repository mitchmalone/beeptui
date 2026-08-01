import { memo } from 'react'
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
    Facebook: 'FB',
    Messenger: 'FB',
    X: 'X',
    Twitter: 'X',
    LinkedIn: 'LI',
    iMessage: 'iM',
  }
  return known[network] ?? network.slice(0, 2).toUpperCase()
}

/** Map of network name → accent colour. Config `theme.networkColors` overrides. */
export type NetworkColors = Record<string, string>

const DEFAULT_NETWORK_COLORS: NetworkColors = {
  WhatsApp: '#25d366',
  Slack: '#e01e5a',
  Telegram: '#29a9eb',
  Signal: '#3a76f0',
  Discord: '#5865f2',
  Instagram: '#e1306c',
  Facebook: '#0866ff',
  Messenger: '#0866ff',
  X: '#7dd3fc',
  Twitter: '#7dd3fc',
  LinkedIn: '#0a66c2',
  iMessage: '#34da50',
}

/** Brand-ish accent colour for a network, used to tint its marker so networks
 *  are scannable at a glance. `overrides` (from `config.theme.networkColors`)
 *  win, then the built-in defaults, then a neutral grey for unknown networks. */
export function networkColor(network: string, overrides?: NetworkColors): string {
  return overrides?.[network] ?? DEFAULT_NETWORK_COLORS[network] ?? '#94a3b8'
}

export interface InboxPaneProps {
  rows: InboxRow[]
  /** Grow to fill width (narrow single-pane fallback) instead of a fixed rail. */
  grow?: boolean
  /** Per-network colour overrides from config. */
  networkColors?: NetworkColors | undefined
}

/** Left-rail chat list. Presentational: it renders `selectInboxRows` output and
 *  holds no state, so it's cheap to render-test. */
export const InboxPane = memo(function InboxPane({
  rows,
  grow = false,
  networkColors,
}: InboxPaneProps) {
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
        rows.map((row) => <InboxRowView key={row.id} row={row} networkColors={networkColors} />)
      )}
    </box>
  )
})

function InboxRowView({
  row,
  networkColors,
}: {
  row: InboxRow
  networkColors?: NetworkColors | undefined
}) {
  const prefix = row.isSelected ? '›' : ' '
  const unread = row.hasUnread ? ` (${row.unreadCount})` : ''
  const muted = row.isMuted ? ' 🔇' : ''
  const selected = row.isSelected
  // The network marker is tinted by network; the title stays readable (white on
  // the selection highlight). Row-level bg spans the line via the container.
  return (
    <box style={{ flexDirection: 'row', ...(selected ? { backgroundColor: '#334155' } : {}) }}>
      <text
        style={{ fg: networkColor(row.network, networkColors) }}
      >{`${prefix} ${networkMarker(row.network)}`}</text>
      <text style={selected ? { fg: '#ffffff' } : {}}>{`  ${row.title}${unread}${muted}`}</text>
    </box>
  )
}
