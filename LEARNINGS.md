# Learnings

> Hard-won project-specific knowledge: blockers, workarounds, dependency quirks, non-obvious setup.
> Concise, grouped by topic, pruned when obsolete. Never duplicate global AGENTS.md rules here.
> The narrative "why" behind events lives in `docs/JOURNAL.md`; this file is the quick-reference.

## GitHub / tooling

- **Always branch from `main`, never from another feature branch.** Done twice in one session with
  the same result: the parent branch's commits ride along into the child's PR and land under a title
  that describes neither. Once from a `main` that was two commits ahead of `origin/main` (check
  `git rev-list --count origin/main..main` before branching), and once from an open PR's branch,
  which silently merged that PR's content and left its own PR stale. If a branch genuinely must
  stack, say so on the PR and rebase onto `main` the moment the parent lands — a squash merge makes
  the parent's commits unreachable, so without the rebase the child's diff re-proposes all of them.
- **`gh pr merge --delete-branch` moves your working tree.** It checks out the default branch and
  tries to fast-forward. With a diverged local `main` the pull fails, leaving you on a stale `main`
  — which reads exactly like the merge failed. Check the PR state before reacting to the local error.
- **Pushing `.github/workflows/*` changes needs the `workflow` OAuth scope.** The `gh` CLI's
  default token doesn't have it, so any push touching a workflow file is rejected ("refusing to
  allow an OAuth App to create or update workflow … without `workflow` scope" — and on `main` it
  can surface as an opaque GH013 rules error). Fix once: `gh auth refresh -h github.com -s workflow`.
  Pushing over SSH avoids the issue entirely.

## Dependencies

- **Toolchain is pinned to the TypeScript 6 line, not TS 7.** TypeScript 7.0 is the native (Go)
  compiler rewrite; `typescript-eslint` does not support it yet (tracking:
  typescript-eslint#10940). Running TS 7 makes `bun run lint` hard-fail with "typescript-eslint
  does not support TS 7.0". We pin `typescript@6.0.3` so typecheck and lint share one compatible
  compiler. Revisit when typescript-eslint ships TS 7 support. See `docs/DECISIONS.md`.
- `@opentui/core` and `@opentui/react` are exact-pinned at `0.4.5` and must share that version;
  upgrade them together. `@opentui/keymap` is intentionally _not_ used (see `docs/DECISIONS.md`).

## Beeper API (live-validated against Beeper Desktop 4.2.1004, 2026-07-31)

- **Message paging `direction` enum is `'before' | 'after'`** — NOT `'older'`/`'newer'`. Passing
  anything else is a `400 VALIDATION_ERROR`. Older history = `direction: 'before'` with the prior
  page's `oldestCursor`. (Fixed a wrong Slice-4 guess.)
- **Write operations need the `write` token scope.** A read-only token authenticates fine and reads
  everything, but `POST` calls (`messages.send`, `chats.start`) return `403 forbidden` —
  `"Required scopes: write, missing: write"`. Create the token with write scope to send. The adapter
  maps this 403 to `unauthorized` (degrade visibly). Follow-up: `doctor` should surface token scope
  so a read-only token doesn't look send-capable.
- **`chats.start({ accountID, user: { phoneNumber } })`** resolves-or-creates a DM and returns
  `{ chatID, status: 'existing' | 'created' }` — no need to look up a participant id to start a chat.
- Transient `400 VALIDATION_ERROR` can occur while Beeper Desktop is still syncing on startup; it
  clears on its own. The adapter normalizes it; callers just retry.
- **WebSocket live protocol** (`/v1/ws`, Bearer header; `info.endpoints.ws_events` gives the URL as
  `http://…` — upgrade to `ws://`). Flow: on connect the server sends `{type:'ready', version,
chatIDs:[]}`; then send **`{type:'subscriptions.set', requestID, chatIDs:['*']}`** (the command is
  `subscriptions.set`, NOT `subscribe`; unknown types → `{type:'error', code:'INVALID_COMMAND'}`;
  `['*']`=all, `[]`=pause, and `'*'` can't mix with specific ids) → `subscriptions.updated` ack.
  Events then stream: `message.upserted {chatID, ids:[…], entries:[Message…], seq, ts}` (entries are
  full Message objects — map with `mapMessage`), `chat.upserted {chatID, ids, seq, ts}` (no entry —
  refetch the chat), plus `message.deleted` / `chat.deleted`. `seq` is monotonic — usable for
  gap-detection on reconnect. No auto-delivery: nothing arrives until you subscribe.
- **Message search** = `GET /v1/messages/search` (`messages.search(params)`), cursor-paginated
  (`{items, hasMore, oldestCursor, newestCursor}`, items are full `Message`s → `mapMessage`).
  `MessageSearchParams` scopes via `chatIDs` / `accountIDs` arrays, plus `chatType`, `dateAfter/Before`,
  `sender` ('me'/'others'/id), `mediaTypes`, `query` (literal words, non-semantic). **Don't trust the
  scope** — the adapter verifies every hit matches the requested chat/account and reports
  `scopeHonored`; a server that ignores scope is handled, not surfaced as wrong results. Real-endpoint
  scope/cap/deep-link behavior per network is still unverified (live-validate before relying on it).
- **Archive** = `chats.archive(chatID, { archived })` (dedicated endpoint, `POST …/archive`). Per-chat
  support is reported at `chat.capabilities.archive` (boolean) → mapped to `ChatSummary.canArchive`;
  gate the action on it (a `false` chat gets a named notice, no call). Absent capability = attempt +
  degrade on error. `mark_read`/`mark_unread`/`delete` endpoints also exist for later slices.

- **`assets.download` returns `srcURL` as a `file://` URL** (current desktop builds) pointing at an
  **extension-less blob**. Normalize with `toLocalPath` before reading, and never hand the bare
  blob to `open`/`xdg-open` — macOS guesses text encoding and fails; copy to a typed temp name
  from the attachment's `fileName`/`mimeType` first.

## OpenTUI / rendering

- **Verified: `@opentui/react@0.4.5` renders on macOS arm64 under Bun 1.3.14.** The native core
  paints a three-pane layout, and `q` (via `renderer.destroy()` + `process.exit(0)`) restores the
  terminal and exits cleanly (PTY-confirmed exit code 0).
- **Bootstrap pattern:** `await createCliRenderer()` → `createRoot(renderer).render(<App />)`.
  There is no top-level `render()` helper. Use the `useRenderer()` and `useKeyboard()` hooks inside
  components; `KeyEvent.name` holds the key.
- **JSX config:** `tsconfig` uses `"jsx": "react-jsx"` + `"jsxImportSource": "@opentui/react"`.
  Intrinsic elements (`box`, `text`, `scrollbox`, …) come from OpenTUI's JSX namespace.
- **Running an OpenTUI `.tsx` file from _outside_ the project tree fails** with
  `Cannot find module 'react/jsx-dev-runtime'` — Bun resolves `@opentui/react` from its global
  cache, where React (a peer dep) isn't reachable. Keep scripts that import the app inside the
  project so React resolves from local `node_modules`.
- **`●` (U+25CF) renders as a _wide_ 2-cell glyph.** The focus-indicator title `Net ●` overflows
  the width-8 Net rail (inner width 6) and OpenTUI silently drops the whole title. Use `Net●` (no
  space) on the narrow rail; the wider panes (`Chats ●`, `Conversation ●`, `Compose ●`) have room.
  When a box title vanishes, suspect glyph width before logic.
- **Viewport-dependent scroll math needs the dimensions _in state_, not just the view.** Keeping
  the message cursor on screen (`offsetToShowMessage`) requires the viewport, which only the view
  knows (`useTerminalDimensions`). The reducer must own scroll (invariant 4), so the App measures
  `conversationCapacity(height, density)` in a `useEffect` and dispatches `viewport/measured` with
  both `rows` and `cols`; the reducer reads `state.viewportRows` / `state.viewportCols`. **Width
  matters as much as height** — message height depends on where text wraps, so a reducer that
  guessed the width differently from the view would mis-predict every row count. Guard the dispatch
  on a real change (and no-op in the reducer) so it doesn't loop. `conversation-scroll.ts`
  therefore lives in `src/state/`, not `src/tui/` — it's pure math the reducer imports, and state
  must never import the tui layer. It also owns the shared column geometry (`NARROW_WIDTH`, rail
  widths, caret gutter) so the components and the reducer cannot drift apart.
- **The conversation viewport counts rows, not messages.** A message is a header row plus however
  many rows its body wraps onto plus a separator (`message-layout.ts`), so "capacity" and "number
  of messages" are different numbers. Anything that used to add or clamp by message count —
  `conversation/scrolled`'s ceiling, the offset bump when a message arrives while scrolled up —
  has to convert to rows or it stops short of the top and drifts the reading position.
- **`<text>` has no hanging indent, so a gutter must be a layout column.** opentui exposes
  `wrapMode` on `<text>` but nothing to indent continuation lines (`TextBufferRenderable` has a
  protected `_firstLineOffset`, not surfaced as a prop). A caret or bullet baked into the string
  only exists on line 1; every wrapped line after it starts at column 0 of the element. Put the
  gutter in its own fixed-width box beside a `flexGrow` content box instead.
- **Give stacked rows an explicit `height: 1` + `flexShrink: 0`.** Yoga shrinks unbounded children
  when they don't fit, and a row squeezed to height 0 doesn't disappear — the next row paints into
  the same terminal line, interleaving two strings character by character (a sender name and body
  rendered as `Liveehello`). Fixed-height rows clip cleanly instead, which is the failure mode you
  can actually see and debug.
- **A conditional chrome row makes every capacity constant a lie.** The conversation's bottom hint
  used to render only when there was something to say, so the rows available for messages changed
  with app state and no single `CHROME_ROWS` could be right. Draw the row unconditionally (blank
  when idle) and the constant becomes true — and pin it against a real render, because arithmetic
  on border/padding/title rows is easy to get off by one and nothing else checks it.
- **"Am I scrolled up?" is `conversationOffset > 0`, not "cursor ≠ newest".** With a message cursor,
  it's tempting to hold reading position whenever the cursor is on an older message — but on a
  conversation that fits on screen nothing is below the fold, so that mis-fires the new-messages
  affordance. Key the hold/affordance on the offset; on a live message, follow the cursor to the new
  newest only when pinned at the bottom (offset 0 _and_ cursor was on the previous newest).
- **Floating overlays (dropdowns/popups) work via `position:'absolute'` + `top`/`left` + `zIndex`.**
  OpenTUI honours all three (verified). An absolute child anchors to the nearest ancestor with
  `position:'relative'`, its `top`/`left` are that box's content coords (row 0 = first child), a
  `backgroundColor` makes it paint solid over siblings, and a higher `zIndex` wins the paint order —
  all without disturbing sibling flex layout. This is how the action-menu / emoji-picker "dropdown"
  floats over the messages instead of replacing the panes. The old full-screen feel came from
  rendering the overlay _instead of_ the pane tree (`overlayPane ?? panes`) with a `flexGrow:1` box:
  that unmounts everything and repaints. Keep the panes mounted and layer a small content-sized box
  over them. Content past the narrow box's right edge still shows — that's correct dropdown behaviour.
- **Status-bar key hints must be context-aware, or they lie.** Compose returns early from the input
  handler (every key types into the draft) and open overlays capture input for themselves, so the
  global `[ ] / a / q` shortcuts don't fire in either — advertising them there is a dead control
  (invariant 8). Gate the hint on `focus`/`overlay`: compose → `⏎ send · Esc back`, overlay →
  `Esc close`, else the global trio.

- **`drawSuperSampleBuffer` is unbounded horizontally** — the native loop paints from `posX` to
  the buffer edge, sampling 2×2 px per cell and reading wrapped garbage once past your pixel rows
  (`TODO` in opentui's `buffer.zig` admits it). Always `pushScissorRect` the target cell rectangle
  around the call. It _does_ respect scissors.
- **The threaded renderer (`useThread: true`, the default) owns stdout on a native thread** — raw
  `process.stdout.write` escapes interleave mid-sequence with frame bytes. Anything that must reach
  the terminal atomically has to go through cells, or the app must run `useThread: false`.
- **Raw iTerm2 (no tmux) does not deliver keyboard input to the app** — unresolved; all live runs
  before 2026-08-08 were inside tmux and never noticed. Reproduce with any build outside tmux.

## Theming

- **Colours flow through a `useTheme()` context, not props.** `src/tui/theme/` defines a `Theme` of
  semantic tokens; a `ThemeProvider` (default = `DEFAULT_THEME`) means components read tokens with no
  prop threading, and isolated component tests keep passing without a provider (they get the default).
  Only `launch.ts` wraps the tree. Use tokens, never hardcoded hex — except network **brand** marker
  colours (`DEFAULT_NETWORK_COLORS`), which stay theme-independent and config-overridable.
- **`captureCharFrame()` can't test colour — use `captureSpans()`.** The char frame is plain text.
  `captureSpans()` returns per-span `fg`/`bg` (RGBA) and `attributes` (bold/italic/underline bitfield);
  `rgbToHex()` from `@opentui/core` converts back to compare. Assert a themed element paints the right
  token (e.g. selected row bg === `theme.selectionBg`). This is also how to test styled/HTML text.
- **Per-box `borderColor` + `focusedBorderColor` exist** — the focused-column border is just
  `borderColor={focused ? theme.borderFocused : theme.border}` on each pane box (a direct box
  attribute, like `border`/`title`, not a `style` field).
- **Custom theme files partial-merge onto the default.** A user file in `~/.config/beeptui/themes/`
  defines only the tokens that differ (like Dracula's distributed themes); each is validated as hex,
  and a file may override a built-in of the same name. Unknown/absent selection → default (no crash).

## Text width and wrapping

- **Terminal display width is an estimate; round _up_ when unsure.** `state/text-width.ts`
  segments by grapheme cluster (so ZWJ emoji, flags and base+combining-mark count once) and scores
  East Asian Wide/Fullwidth and emoji-presentation clusters as 2 cells. No two terminals agree on
  every exotic grapheme, and the wrapper's failure modes are asymmetric: over-estimating wraps a
  line early (a short line, harmless), under-estimating overflows the box or provokes a second
  wrap by the renderer that throws the row count off.
- **Wrap in state, keep the renderer's word-wrap as a net.** Because we err narrow, our lines
  always fit the box, so opentui's `wrapMode: 'word'` never actually fires — but leaving it on
  means a width disagreement degrades to a slightly short line instead of clipped text.

## Message HTML

- **It's a translator, not a renderer.** Some networks embed a small HTML subset in message bodies.
  Don't build an HTML layout engine — strip the tags and map a handful to terminal formatting
  (`<b>`→bold, `<i>`→italic, `<u>`→underline, `<br>`→line break, `<ul>`→`- `, `<ol>`→`1.`), decode
  entities, drop the rest. `src/state/message-html.ts` is the pure parser (`htmlToStyledLines` /
  `htmlToPlainText` / `hasHtml`); it's in `src/state/` because a selector (reply preview) needs it and
  tui must not be imported by state.
- **Bold/italic/underline need the `<b>/<i>/<u>` elements, not `style`.** A `style={{ bold: true }}`
  on `<text>`/`<span>` is ignored (verified via `captureSpans().attributes` = 0). The dedicated
  modifier elements set the real attribute bits (bold=1, italic=4, underline=8); nest them for
  combinations. `fg`/`bg` on the parent `<text>` cascades into the modifier spans, which only add
  attributes — so set the selection/status colour on the line and let runs inherit it.

## Testing

- **Headless render tests work via `@opentui/react/test-utils`.** `testRender(<App />, { width,
height })` returns `{ renderOnce, captureCharFrame, … }`; assert on the captured char frame. No
  TTY needed, so it runs in CI — this is the Slice 0 render smoke.
- Do not unit-test the quit path: the handler calls `process.exit(0)`, which would kill the test
  runner. Verify clean exit with a PTY smoke instead.
- **OpenTUI components are very testable** (resolves the Slice 3 risk). `testRender(<C/>, {width,
height})` gives a headless render; `captureCharFrame()` asserts content, `mockInput.pressKey('j',
{shift})` drives real keyboard events, and `resize(w,h)` tests responsive breakpoints. Keyboard
  nav and the narrow-pane fallback are all covered this way. Expect benign React `act(...)` warnings
  from mock-input state updates — the assertions are still valid; ignore the warnings.
- Style props differ by element: `box` takes `backgroundColor`; **`text` takes `fg`/`bg`**, not
  `backgroundColor` (tsc catches the mixup).
- **A `box` `title` longer than the inner width renders blank** — no truncation, the whole title just
  disappears. The width-8 network rail dropped a 5-char title (`'Net ●'`); a 4-char one (`'Net●'`)
  fits. Also some glyphs don't render in the headless char-frame (`◂` blank, `●` fine) — reuse a
  glyph already proven elsewhere in the UI.
- **Shared test fixtures can hide inconsistencies until a filter exposes them.** `app.test.tsx`'s
  `seededStore` gave every chat `accountId:'a'` while assigning different networks — invisible until
  Slice 10's per-account scope tried to tell them apart. When adding a scope/filter feature, audit
  shared fixtures for fields the feature newly depends on.
- **`<scrollbox stickyStart="bottom">` misrenders short content** under the headless test renderer —
  it scrolls earlier lines out of the captured frame even when everything fits. The conversation
  list uses a **computed visible window** (`conversation-scroll.ts` — slice the last N by a scroll
  offset in state) instead: deterministic, unit-testable, and exact control over the bottom-pin.
- **A `flexGrow` child shrinks its `text` siblings to zero height** (default `flexShrink: 1`), so
  fixed header/hint lines above a growing list overlap. Give them `style={{ flexShrink: 0 }}`.
- **`useKeyboard` handlers capture a stale closure** — `mockInput.pressKeys([...])` fires several
  keys before React re-renders, so a handler reading a `prop`/`useState` sees the value from the
  render when it subscribed (typing "hi" landed as "i"). For an input, hold the editing state in a
  `useRef` the handler reads/writes, mirror it to `useState` for rendering, and remount per context
  with a `key`. The compose editor uses this pattern.
- **Modal input**: while the compose box is focused the global keymap must be fully bypassed
  (`if (focus === 'compose') return` before resolving any command) or letters like `q` fire commands
  instead of typing. Two `useKeyboard` handlers (App + Compose) coexist; each guards on focus.
- **Read `store.getState()` inside the keyboard handler**, not the render-closure `state` —
  `pressKeys([...])` (and fast real typing) fires several keys before React re-renders, so the
  closure's `state`/selectors are stale (search "eng" landed as "g"). The App handler recomputes
  `selectInboxRows(store.getState())` etc. per keypress; the render still uses `useSyncExternalStore`.
- Overlay/search openers (`/`, `?`) are matched on `key.sequence` (the raw char), since terminals
  report the _name_ inconsistently. Frame assertions after a key-driven state change need an extra
  `await renderOnce()` to flush before `captureCharFrame()`.
- Multiple `testRender`s + a second `useKeyboard` trip a benign "EventTarget memory leak … 11 entry
  listeners" warning — test-env noise, not a real leak.
- Terminal **Esc is ambiguous** (the parser buffers it as an escape-sequence prefix), so it's
  unreliable to test — bind an unambiguous alias too (`h`/`←` for "back") and test that one.
- **Fake tokens in fixtures must not _look_ like secrets.** A synthetic `beeper_sk_…` test token
  tripped gitleaks' `generic-api-key` rule and blocked the commit. Use low-entropy, obviously-fake
  placeholders (e.g. `example-placeholder-token-value`); redaction/auth tests key off the `Bearer`
  prefix and key names, not token format, so content doesn't matter.
- Inject the SDK's `fetch` option to drive adapter tests from synthetic responses — the pagination
  wire shape is `{ items, hasMore, oldestCursor, newestCursor }`; `accounts.list` returns a bare
  array. `doctor`/`status` are exercised end-to-end by spawning the CLI against a closed port.

## Tooling / CI

- **`gitleaks` is a required local tool** (`brew install gitleaks`). The pre-commit hook hard-fails
  if it's missing rather than skipping the secret scan (invariant 9). CI installs the pinned
  binary and scans full history.
- Husky v9 hooks are the bare command (no boilerplate); `bunx husky` sets `core.hooksPath=.husky/_`.
- **Prettier reformats Markdown prose.** A wrapped line starting with `+`/`-` gets turned into a
  list item — keep continuation lines from starting with those characters in committed docs.
