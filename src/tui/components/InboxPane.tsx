import { memo } from 'react'
import { useTerminalDimensions } from '@opentui/react'
import type { InboxRow } from '@/state/selectors.ts'
import type { Density } from '@/state/types.ts'
import { useTheme } from '@/tui/theme/context.tsx'

/** Truncate `text` to `max` columns, marking the cut with a single-column `…`.
 *  Keeps chat names on one line (clip, not wrap). Uses string length as a width
 *  proxy — fine for the mostly-ASCII names the rail shows. */
export function clipText(text: string, max: number): string {
  if (max <= 0) return ''
  if (text.length <= max) return text
  if (max === 1) return '…'
  return text.slice(0, max - 1) + '…'
}

/** Fixed width of the chat rail (non-grow). */
const RAIL_WIDTH = 32

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
  /** Whether this pane has keyboard focus (shows a focus indicator in the title). */
  focused?: boolean
  /** Per-network colour overrides from config. */
  networkColors?: NetworkColors | undefined
  /** Layout density; `compact` strips the pane padding. Defaults to comfortable. */
  density?: Density | undefined
}

/** Left-rail chat list. Presentational: it renders `selectInboxRows` output and
 *  holds no state, so it's cheap to render-test. */
export const InboxPane = memo(function InboxPane({
  rows,
  grow = false,
  focused = false,
  networkColors,
  density = 'comfortable',
}: InboxPaneProps) {
  const theme = useTheme()
  const { width } = useTerminalDimensions()
  const pad = density === 'compact' ? 0 : 1
  // Columns available for a row's text (pane width minus border + padding). The
  // grow pane fills the terminal; the rail is fixed.
  const contentWidth = Math.max(1, (grow ? width : RAIL_WIDTH) - 2 - 2 * pad)
  return (
    <box
      title={focused ? 'Chats ●' : 'Chats'}
      border
      borderColor={focused ? theme.borderFocused : theme.border}
      style={
        grow
          ? { flexGrow: 1, flexDirection: 'column', padding: pad }
          : { width: RAIL_WIDTH, flexShrink: 0, flexDirection: 'column', padding: pad }
      }
    >
      {rows.length === 0 ? (
        <text>No chats to show.</text>
      ) : (
        rows.map((row) => (
          <InboxRowView
            key={row.id}
            row={row}
            networkColors={networkColors}
            contentWidth={contentWidth}
          />
        ))
      )}
    </box>
  )
})

function InboxRowView({
  row,
  networkColors,
  contentWidth,
}: {
  row: InboxRow
  networkColors?: NetworkColors | undefined
  contentWidth: number
}) {
  const theme = useTheme()
  const prefix = row.isSelected ? '›' : ' '
  const unread = row.hasUnread ? ` (${row.unreadCount})` : ''
  const muted = row.isMuted ? ' 🔇' : ''
  const selected = row.isSelected
  const marker = `${prefix} ${networkMarker(row.network)}`
  // Clip the title so the whole row fits one line: budget = content width minus
  // the marker, the two-space gap, and the unread/mute suffixes (kept intact).
  const titleBudget = contentWidth - marker.length - 2 - unread.length - muted.length
  const title = clipText(row.title, titleBudget)
  // The network marker is tinted by network; the title stays readable on the
  // selection highlight. `height: 1` + overflow guarantees no wrap even if a
  // width estimate is off.
  return (
    <box
      style={{
        flexDirection: 'row',
        height: 1,
        overflow: 'hidden',
        ...(selected ? { backgroundColor: theme.selectionBg } : {}),
      }}
    >
      <text style={{ fg: networkColor(row.network, networkColors) }}>{marker}</text>
      <text style={selected ? { fg: theme.selectionFg } : {}}>{`  ${title}${unread}${muted}`}</text>
    </box>
  )
}
