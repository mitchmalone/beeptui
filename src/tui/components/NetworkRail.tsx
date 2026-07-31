import type { NetworkRailEntry } from '@/state/selectors.ts'
import { networkMarker } from '@/tui/components/InboxPane.tsx'

export interface NetworkRailProps {
  entries: NetworkRailEntry[]
  /** Whether the archived view is active (footer indicator). */
  archived: boolean
  /** Whether the unread-only filter is active (footer indicator). */
  unreadOnly: boolean
  /** Whether the rail has keyboard focus (shows a focus title + border tint). */
  focused?: boolean
}

/**
 * The leftmost `slk`-style rail: switch network scope (an `All` entry plus one
 * per connected network), with per-network unread dots and a footer that names
 * the active view filters. Presentational — the App owns the keys that cycle it
 * (`[` / `]`, `a`, `U`); this only renders `selectNetworkRail` output.
 */
export function NetworkRail({ entries, archived, unreadOnly, focused = false }: NetworkRailProps) {
  return (
    <box
      title={focused ? 'Net●' : 'Net'}
      border
      style={{ width: 8, flexShrink: 0, flexDirection: 'column' }}
    >
      <box style={{ flexGrow: 1, flexDirection: 'column' }}>
        {entries.map((entry) => {
          const marker = entry.network === null ? 'All' : networkMarker(entry.network)
          const caret = entry.isSelected ? '›' : ' '
          const dot = entry.unreadCount > 0 ? '•' : ''
          return (
            <text key={entry.id} style={entry.isSelected ? { bg: '#334155', fg: '#ffffff' } : {}}>
              {`${caret}${marker}${dot}`}
            </text>
          )
        })}
      </box>
      {archived ? <text style={{ flexShrink: 0, fg: '#f59e0b' }}>arc</text> : null}
      {unreadOnly ? <text style={{ flexShrink: 0, fg: '#f59e0b' }}>unr</text> : null}
    </box>
  )
}
