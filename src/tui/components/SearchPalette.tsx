import type { ChatSearchResult } from '@/tui/fuzzy.ts'
import { networkMarker } from '@/tui/components/InboxPane.tsx'
import { useTheme } from '@/tui/theme/context.tsx'

export interface SearchPaletteProps {
  query: string
  results: ChatSearchResult[]
}

/** The `/` chat-search palette. Type to fuzzy-filter; ⏎ jumps to the top
 *  (highlighted) result; Esc dismisses. Presentational — the App owns input. */
export function SearchPalette({ query, results }: SearchPaletteProps) {
  const theme = useTheme()
  const shown = results.slice(0, 12)
  return (
    <box
      title="Search chats"
      border
      borderColor={theme.borderFocused}
      style={{ flexGrow: 1, flexDirection: 'column', padding: 1 }}
    >
      <text style={{ flexShrink: 0 }}>{`/ ${query}▏`}</text>
      <text style={{ flexShrink: 0, fg: theme.muted }}>
        {results.length === 0 && query.length > 0 ? 'No matches' : 'Enter to jump · Esc to cancel'}
      </text>
      <box style={{ flexGrow: 1, flexDirection: 'column' }}>
        {shown.map((result, index) => (
          <text
            key={result.id}
            style={index === 0 ? { bg: theme.selectionBg, fg: theme.selectionFg } : {}}
          >
            {`${index === 0 ? '›' : ' '} ${networkMarker(result.network)}  ${result.title}`}
          </text>
        ))}
      </box>
    </box>
  )
}
