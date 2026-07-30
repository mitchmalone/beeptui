# Learnings

> Hard-won project-specific knowledge: blockers, workarounds, dependency quirks, non-obvious setup.
> Concise, grouped by topic, pruned when obsolete. Never duplicate global AGENTS.md rules here.
> The narrative "why" behind events lives in `docs/JOURNAL.md`; this file is the quick-reference.

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
