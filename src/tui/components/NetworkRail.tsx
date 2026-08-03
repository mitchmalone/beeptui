import { memo } from 'react'
import type { NetworkRailEntry } from '@/state/selectors.ts'
import { networkColor, networkMarker, type NetworkColors } from '@/tui/components/InboxPane.tsx'
import { useTheme } from '@/tui/theme/context.tsx'

export interface NetworkRailProps {
  entries: NetworkRailEntry[]
  /** Whether the archived view is active (footer indicator). */
  archived: boolean
  /** Whether the unread-only filter is active (footer indicator). */
  unreadOnly: boolean
  /** Whether the rail has keyboard focus (shows a focus title + border tint). */
  focused?: boolean
  /** Per-network colour overrides from config. */
  networkColors?: NetworkColors | undefined
}

/**
 * The leftmost `slk`-style rail: switch network scope (an `All` entry plus one
 * per connected network), with per-network unread dots and a footer that names
 * the active view filters. Presentational — the App owns the keys that cycle it
 * (`[` / `]`, `a`, `U`); this only renders `selectNetworkRail` output.
 */
export const NetworkRail = memo(function NetworkRail({
  entries,
  archived,
  unreadOnly,
  focused = false,
  networkColors,
}: NetworkRailProps) {
  const theme = useTheme()
  return (
    <box
      title={focused ? 'Net●' : 'Net'}
      border
      borderColor={focused ? theme.borderFocused : theme.border}
      style={{ width: 8, flexShrink: 0, flexDirection: 'column' }}
    >
      <box style={{ flexGrow: 1, flexDirection: 'column' }}>
        {entries.map((entry) => {
          const marker = entry.network === null ? 'All' : networkMarker(entry.network)
          const caret = entry.isSelected ? '›' : ' '
          const dot = entry.unreadCount > 0 ? '•' : ''
          // Tint each entry by its network; 'All' stays neutral, the selected row
          // takes the shared active-highlight.
          const color =
            entry.network === null ? theme.fg : networkColor(entry.network, networkColors)
          return (
            <text
              key={entry.id}
              style={
                entry.isSelected ? { bg: theme.selectionBg, fg: theme.selectionFg } : { fg: color }
              }
            >
              {`${caret}${marker}${dot}`}
            </text>
          )
        })}
      </box>
      {archived ? <text style={{ flexShrink: 0, fg: theme.warning }}>arc</text> : null}
      {unreadOnly ? <text style={{ flexShrink: 0, fg: theme.warning }}>unr</text> : null}
    </box>
  )
})
