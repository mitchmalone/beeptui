---
title: settings menu in the Net rail
status: done
created: 2026-08-04
updated: 2026-08-04
links:
  - PLAN-v03-release.md # step 6 of the 0.3 ladder
  - src/tui/components/NetworkRail.tsx
  - src/tui/components/ConversationActionMenu.tsx # the flyout pattern to reuse
---

# Settings menu in the Net rail

## Goal

Give settings a home. A `Settings` entry pinned to the bottom of the Net rail opens a flyout menu;
its first (and for now only) item is Theme, which opens a second flyout listing the available
themes. Somewhere to hang everything that is currently a hidden keystroke.

## Context

- The Net rail (`NetworkRail.tsx`, width 8) renders `All`, one entry per network, and an `Archived`
  toggle, from `selectNetworkRail`. It already has a footer slot — the `unr` unread-only indicator
  sits below a `flexGrow: 1` box.
- The flyout pattern is established and worth copying exactly: `ConversationActionMenu` /
  `EmojiPicker` are content-sized boxes rendered at `position: 'absolute'` with `top`/`left`/
  `zIndex` inside a `position: 'relative'` parent, over panes that stay mounted. `LEARNINGS.md`
  records why (rendering an overlay _instead of_ the pane tree causes a full-screen repaint).
- Theme selection already exists as state: `state.themeName`, the `theme/selected` event, and a
  `themeRegistry` (built-ins + user themes from `~/.config/beeptui/themes/*.json`) that the App
  owns and resolves. Today the only way to change it is `t`, which blind-cycles.
- Overlays are a closed union (`Overlay` in `src/state/types.ts`) with a cursor per overlay
  (`actionCursor`, `emojiCursor`). Two new members follow the same shape.

## Approach

Model this as two more overlays in the existing pattern rather than inventing a settings subsystem.
`settingsMenu` lists settings categories; `themePicker` lists theme names and dispatches the
`theme/selected` that already exists. The rail gains a focusable `settings` entry pinned to the
bottom, reached by the rail's own `j`/`k` cursor so it needs no new global key.

The theme list comes from the registry, which lives in the App — so the picker is fed names as a
prop, the way the emoji picker is fed its set. The reducer stores a cursor, not the list.

Keep the rail's width honest: at 8 columns, `Settings` does not fit. It needs an abbreviation
(`Set`/`⚙`) consistent with `Arc○` — and per `LEARNINGS.md`, check the glyph's _display width_
before choosing, since a wide glyph silently breaks the rail (the `●` title bug).

## Steps

- [x] Extend `selectNetworkRail` with a pinned `settings` entry, or render it in the rail's footer
      slot and include it in the cursor's range — whichever keeps the cursor maths in one place.
      Unit-test the rail selector.
- [x] Add `settingsMenu` and `themePicker` to `Overlay`, each with a cursor in `AppState`, following
      `actionCursor`/`emojiCursor` exactly (including the reset-on-open behaviour).
- [x] Reducer: open/close/move for both, and `themePicker` choose → `theme/selected`. Tests first.
- [x] `SettingsMenu` component modelled on `ConversationActionMenu`; `ThemePicker` modelled on
      `EmojiPicker`, marking the currently active theme.
- [x] Anchor both flyouts off the rail (`position: 'relative'` on the rail, absolute child), with
      the same open-up/open-down overflow handling the conversation menu uses.
- [x] Wire the App's rail key handler: `⏎` on Settings opens the menu; `⏎` on Theme opens the
      picker; `Esc` steps back one level, not straight out.
- [x] Update the help overlay and status-bar hints — the settings path must be discoverable there
      too, and `t` keeps working as the shortcut.
- [x] Verify live in `--demo`: open both flyouts, pick each built-in theme, confirm it applies and
      persists in state.

## Acceptance criteria

- [x] The Net rail shows a Settings entry pinned to the bottom of the pane, reachable with the
      rail's existing cursor keys.
- [x] `⏎` opens a flyout containing Theme; `⏎` on Theme opens a flyout of available themes with the
      active one marked; choosing one applies it live.
- [x] `Esc` closes one level at a time.
- [x] The rail's layout is unbroken at width 8 (no dropped title, no clipped entry).
- [x] `bun run typecheck`, `bun run lint`, `bun test` green.

## Out of scope

- Any setting other than Theme (density, network colours, keymap) — the menu is built to take them,
  but this slice ships one.
- Writing settings back to `~/.config/beeptui/config.json`. Theme selection stays session state, as
  it is today.
- Restyling the rail.

## Outcome

Done. Settings is pinned to the foot of the Net rail (`Set`, abbreviated for the 8-column width),
reached by the rail's own cursor; `⏎` opens a Settings flyout, `⏎` on Theme opens the theme list with
the active theme marked, and `Esc` steps back one level rather than closing out. `t` still cycles.

Two things the plan got wrong, both found live:

- **The flyout cannot live inside the rail.** The plan assumed it would overflow right over the Chats
  column, the way the conversation action menu overflows its pane. It does not: an 8-column box
  clips its own absolutely-positioned children, and the menu rendered as a 4-column stub with the
  labels cut off. It is anchored on the app root instead, above the status bar.
- **The rail's caret was frozen, and had been all along.** `selectNetworkRail` is memoized in the App
  on `chats/chatOrder/accounts/accountOrder/filter` — but every entry carries `isCursor`, which
  depends on `state.railCursor`, and that was missing from the deps. The cursor moved in state while
  the rail kept drawing the old caret until an unrelated change happened to invalidate the memo. Not
  introduced here; it only became obvious because Settings is the one rail entry whose cursor does
  not also change the scope (and so had nothing else to invalidate the memo).

**Not covered by a test:** `Esc` stepping back one level. The mock input does not deliver a bare
`\x1B` as an escape key event, so an assertion there would pass without testing anything. Verified
live instead.

## Risks / open questions

- **Width.** Eight columns is tight; the entry label and the flyout's `left` offset both need
  checking against the real render, not arithmetic.
- **Where the flyout anchors.** The rail is the leftmost pane, so a flyout anchored inside it will
  want to overflow right, over the Chats column. The conversation menu already demonstrates that
  overflowing a narrow box is fine and is correct dropdown behaviour — confirm it visually.
- **Two levels of overlay** is new; existing overlays are single-level and `Esc` closes to `none`.
  Make sure the back-one-level behaviour does not leave a stale cursor in the parent menu.
