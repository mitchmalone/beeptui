import type { ConnectionBanner } from '@/state/selectors.ts'

export interface StatusBarProps {
  banner: ConnectionBanner | null
  accountCount: number
}

/** Bottom status bar: the connection banner when degraded, otherwise a healthy
 *  summary. Degrading visibly is the point — never a silent empty state
 *  (CLAUDE.md invariant 8). */
export function StatusBar({ banner, accountCount }: StatusBarProps) {
  const status = banner
    ? banner.message
    : `Connected · ${accountCount} account${accountCount === 1 ? '' : 's'}`
  return (
    <box style={{ height: 1, flexDirection: 'row', paddingLeft: 1, paddingRight: 1 }}>
      <text style={{ flexGrow: 1 }}>{status}</text>
      <text>j/k move · ⏎ open · q quit</text>
    </box>
  )
}
