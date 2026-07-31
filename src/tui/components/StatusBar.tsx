import type { ConnectionBanner } from '@/state/selectors.ts'

export interface StatusBarProps {
  banner: ConnectionBanner | null
  accountCount: number
  /** Active network-rail scope label (e.g. 'All', 'WhatsApp'). */
  scopeLabel: string
  archived: boolean
  unreadOnly: boolean
}

/** Bottom status bar: the connection banner when degraded, otherwise a healthy
 *  summary. Also surfaces the active inbox filter (scope / archived / unread) so
 *  it stays visible when the rail is collapsed on a narrow terminal. Degrading
 *  visibly is the point — never a silent empty state (CLAUDE.md invariant 8). */
export function StatusBar({
  banner,
  accountCount,
  scopeLabel,
  archived,
  unreadOnly,
}: StatusBarProps) {
  const status = banner
    ? banner.message
    : `Connected · ${accountCount} account${accountCount === 1 ? '' : 's'}`
  const filters = [scopeLabel, archived ? 'archived' : null, unreadOnly ? 'unread' : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <box style={{ height: 1, flexDirection: 'row', paddingLeft: 1, paddingRight: 1 }}>
      <text style={{ flexGrow: 1 }}>{status}</text>
      <text style={{ fg: '#94a3b8' }}>{`${filters}  `}</text>
      <text>{'[ ] net · a arch · q quit'}</text>
    </box>
  )
}
