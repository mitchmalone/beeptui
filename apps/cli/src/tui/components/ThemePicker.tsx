import { useTheme } from '@/tui/theme/context.tsx'

export interface ThemePickerProps {
  /** Theme names in registry order (built-ins, then user themes). */
  names: readonly string[]
  /** Index of the highlighted name. */
  cursor: number
  /** The theme currently applied, marked so the list says where you are. */
  active: string
}

/**
 * The theme list, reached from Settings → Theme. The names come from the App,
 * which owns the registry (built-ins plus `~/.config/beeptui/themes/*.json`);
 * this only renders them. Presentational — the App owns input.
 */
export function ThemePicker({ names, cursor, active }: ThemePickerProps) {
  const theme = useTheme()
  const bg = theme.menuBg
  return (
    <box
      title="Theme"
      border
      borderColor={theme.borderFocused}
      style={{ flexDirection: 'column', backgroundColor: bg, paddingLeft: 1, paddingRight: 1 }}
    >
      {names.map((name, index) => (
        <text
          key={name}
          style={index === cursor ? { bg: theme.selectionBg, fg: theme.selectionFg } : { bg }}
        >
          {`${index === cursor ? '›' : ' '} ${name === active ? '●' : ' '} ${name}`}
        </text>
      ))}
      <text style={{ fg: theme.muted, bg }}>⏎ · Esc</text>
    </box>
  )
}
