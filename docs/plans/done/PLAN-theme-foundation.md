---
title: Theme foundation — token system, built-in themes, custom theme files
status: done
created: 2026-08-03
updated: 2026-08-03
links:
  - docs/PRD.md
  - src/beeper/config.ts (ThemeConfig)
  - https://github.com/dracula/dracula-theme (palette reference)
---

# Theme foundation

## Goal

Give beeptui real, cohesive color that a user can change. Introduce a semantic **theme token**
system, ship built-in themes (**default**, open-source **Dracula**, and a **system** placeholder),
let users drop custom themes in `~/.config/beeptui/themes/*.json`, and select one via config. Replace
the scattered hardcoded hex values with tokens — which by itself delivers three of the UX asks:
**unified active-highlight color** across all columns, a **focused-column border**, and
theme-detectable accents.

## Decisions (confirmed with Mitch 2026-08-03)

- **Start here** (theme foundation before the other UX asks — they depend on tokens).
- **Custom themes:** built-ins selectable by name **plus** a `~/.config/beeptui/themes/*.json` folder
  for user-authored themes (Dracula-style distribution).
- **`system`** is the intended default theme; real terminal-color detection is the _next_ slice, so
  here `system` is registered as a placeholder resolving to the default palette.
- **Config-selected this slice**; runtime theme-cycling (a key to try themes live) is a fast follow.

## Approach

1. **Theme module (`src/tui/theme/`).** A `Theme` interface of semantic tokens (`fg`, `muted`,
   `selectionBg/Fg`, `border`, `borderFocused`, `accent`, `warning`, `danger`, `success`, `menuBg`),
   the built-ins, and a resolver that merges a partial custom theme file onto the default and builds
   a name→Theme registry (I/O injected, so it's unit-testable).
2. **Context, not prop-drilling.** A React `ThemeProvider` + `useTheme()` (defaulting to the default
   theme) so components read tokens without threading a prop through every one — and existing
   component tests keep passing unchanged (they get the default).
3. **Config.** Add `theme.name` to `ThemeConfig`/`parseTheme` (validated string). Keep
   `networkColors`/`density`.
4. **Rewire components** to `useTheme()` tokens; set each pane's `borderColor` from `focused`.
5. **Launch** resolves `config.theme.name` → Theme via the registry (built-ins + folder) and wraps
   the App render in `<ThemeProvider>`.

## Steps

- [x] `theme.ts` — `Theme` type + `DEFAULT_THEME`, `DRACULA_THEME`, `SYSTEM_THEME`, `BUILTIN_THEMES`
- [x] `resolve.ts` — parse/validate a custom theme file (partial merge onto default), build registry,
      resolve by name (I/O injected) + tests
- [x] `context.tsx` — `ThemeProvider` + `useTheme()` (default = `DEFAULT_THEME`)
- [x] `config.ts` — `theme.name` parse + validation + tests
- [x] Rewire: ConversationView, InboxPane, NetworkRail, Compose, StatusBar, SearchPalette,
      MessageSearchPalette, HelpOverlay, ConversationActionMenu, EmojiPicker → tokens
- [x] Focused-column border color on the four panes (rail / inbox / conversation / compose)
- [x] `launch.ts` — resolve theme + wrap in `ThemeProvider`
- [x] Docs: STATUS, JOURNAL, LEARNINGS; move plan to done

## Acceptance criteria

- [x] `theme.name: "dracula"` in config paints the whole UI in the Dracula palette
- [x] A `~/.config/beeptui/themes/mytheme.json` (partial) is selectable by `theme.name: "mytheme"`
- [x] Active-highlight bg/fg is identical across Net / Chats / Conversation; the focused column's
      border is tinted with `borderFocused`
- [x] Unknown / missing theme name degrades to the default (never a crash) with tokens intact
- [x] `bun run typecheck`, `bun run lint`, `bun test` green

## Out of scope (later slices)

- Real `system` terminal-color detection (OSC 10/11/4) — next slice.
- Runtime theme cycling via a keybinding — fast follow after this.
- Re-theming the per-network brand marker colors (kept as recognizable brand defaults, still
  overridable via `theme.networkColors`).

## Risks / open questions

- Theme file schema: partial-merge onto the default so a user can define only what differs; validate
  each provided token is a hex colour, with a clear per-field error.
