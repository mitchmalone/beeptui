import { memo } from 'react'
import type { NetworkRailEntry } from '@/state/selectors.ts'
import { networkColor, networkMarker, type NetworkColors } from '@/tui/components/InboxPane.tsx'
import { useTheme } from '@/tui/theme/context.tsx'

export interface NetworkRailProps {
  entries: NetworkRailEntry[]
  /** Whether the unread-only filter is active (footer indicator). */
  unreadOnly: boolean
  /** Whether the rail has keyboard focus (shows a focus title + border tint). */
  focused?: boolean
  /** Per-network colour overrides from config. */
  networkColors?: NetworkColors | undefined
}

/**
 * The leftmost `slk`-style rail: an `All` entry, one per connected network, and
 * an `Archived` toggle at the bottom. The `›` caret marks the rail cursor; the
 * active scope keeps the shared highlight; Archived shows its on/off state.
 * Presentational — the App owns the keys (`j`/`k` cursor, `⏎` toggle/drill,
 * `[`/`]`, `U`); this only renders `selectNetworkRail` output.
 */
export const NetworkRail = memo(function NetworkRail({
  entries,
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
          const caret = entry.isCursor ? '›' : ' '
          // The Archived toggle: a compact `Arc` marker with an on/off glyph,
          // tinted (warning) when the archived view is active.
          if (entry.kind === 'archived') {
            return (
              <text key={entry.id} style={{ fg: entry.active ? theme.warning : theme.muted }}>
                {`${caret}Arc${entry.active ? '●' : '○'}`}
              </text>
            )
          }
          const marker = entry.network === null ? 'All' : networkMarker(entry.network)
          const dot = entry.unreadCount > 0 ? '•' : ''
          // Tint each entry by its network; 'All' stays neutral, the active scope
          // takes the shared highlight.
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
      {unreadOnly ? <text style={{ flexShrink: 0, fg: theme.warning }}>unr</text> : null}
    </box>
  )
})
