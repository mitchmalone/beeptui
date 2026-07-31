# JOURNAL

> Append-only log of non-obvious learnings, gotchas, and the "why" behind things.
> **Newest at the top.** Keep entries short and factual — one entry per discovery.

---

### 2026-08-01 — Slice 13 OAuth core + Slice 14 reactions; security review passed

- **OAuth is fully discoverable — no guessing.** `/v1/info` advertises the whole OAuth 2.0 endpoint
  set (`endpoints.oauth`: authorize/token/register/introspect/revoke/userinfo — RFC 8414 discovery +
  RFC 7591 dynamic registration). SDK docstring confirms bearer tokens via "OAuth2 PKCE flow." So the
  flow is Authorization Code + PKCE against advertised URLs; the SDK doesn't implement it (takes
  `baseURL`+`accessToken` only) — it's ours. Surfaced the endpoints on `ServerInfo.oauth` so the flow
  targets discovered URLs, not hard-coded ones.
- **Kept the flow unit-testable by injecting all I/O.** `authorize` takes `startLoopback`,
  `openBrowser`, and an `OAuthHttp` (fetch + injected clock) — so register→browser→loopback→exchange
  is tested end-to-end against a fake auth server with no sockets and deterministic expiry. The real
  loopback (Bun.serve on 127.0.0.1:0) + browser-open live in `oauth-loopback.ts`, unwired from tests.
- **Token persistence write is the genuinely-hard gate.** macOS `security add-generic-password -w`
  puts the secret in argv (invariant 6 violation); a plaintext 0600 file isn't the platform store.
  Rather than ship either, the flow returns tokens and leaves persistence unimplemented, flagged for
  the security review to resolve (native binding vs accepted encrypted store). Don't paper over this.
- **Security review passed** (independent subagent): S256-only PKCE, `crypto.getRandomValues`, state
  verified pre-exchange, loopback 127.0.0.1-only, exact redirect match, no secret/path leakage,
  `spawn` with arg arrays (no shell), `basename()` defeats save-path traversal. One non-security fix:
  `classifyEndpoint` mislabelled `[::1]` (URL.hostname brackets IPv6) — bracket-stripped.
- **Reactions were as cheap as edits.** `Message.reactions` maps to a per-key aggregate
  (`ReactionSummary {key,count,isEmoji}`); `formatMessage` appends `👍×2 🎉`. Read-only, no capability
  gate — display what's there. Same pattern as attachments/edits: map → format → fixture test.

### 2026-07-31 — Slice 12: capability messaging unified; live matrix blocked on unconnected networks

- **One capability-unavailable pattern.** Reply + archive were the only two gated actions, each with
  its own ad-hoc notice string. Centralized into `src/state/capabilities.ts`: `checkCapability(chat,
cap)` returns `{allowed}` or `{allowed:false, notice}`, and `capabilityUnavailableMessage` renders
  one source-naming template ("Replies not available for Slack via Beeper" — PRD scenario 6). Absent
  flag → allowed (attempt-then-degrade), only an explicit `false` blocks. Verb-agnostic phrasing so
  one template covers plural (Replies) and singular (Archiving) capabilities.
- **Live capability matrix (redacted, connected networks).** WhatsApp + Facebook **report** reply
  support (all chats ✓); Beeper/Matrix doesn't report it; **archive is unreported on all three** →
  the explicit-unsupported branch is fixture-covered, not live-hit here. Useful truth: the reply gate
  is grounded in real data; archive leans on attempt-then-degrade for now.
- **Blocked, honestly.** Discord/Instagram/X aren't connected on this Beeper, so the slice's headline
  live matrix can't run and **Phase 2 isn't declarable complete**. Recorded as a manual gate rather
  than faked. The code hardening (the durable deliverable) is done + tested; a burst smoke scenario
  (12 rapid inbound while scrolled up) proves reading position holds under busy-channel load.

### 2026-07-31 — Slice 11: replies, edits & attachments

- **Reply keys can't use `resolveCommand`.** The plan wanted `r` = reply, but `r` is the global
  refresh binding and `s` collides with save; `resolveCommand` is context-blind (first match wins).
  Fix: a message-selection _mode_ (entered with `v`, tracked by `state.selectedMessageId`), and while
  it's active the app matches `r`/`o`/`s` on the **raw key** before falling through — so the global
  bindings are untouched outside the mode. The mode keys are documented via a `MESSAGE_SELECT_HELP`
  block (like `COMPOSE_HELP`), not real KEYMAP entries, to avoid the same collision in help.
- **Edit-in-place was already free.** `mergeMessages` dedupes by id (`{...existing, ...incoming}`),
  so an inbound edit with the same id replaces the row; `formatMessage` already appended `(edited)`
  from `isEdited`. Slice 11 only needed a reducer test to lock it in — no new machinery.
- **Reply capability is a −2..2 scale.** `chat.capabilities.reply` (−2 rejected … 2 fully) maps to
  `canReply = reply >= 1`. Gate like archive: `canReply === false` → named notice, else attempt.
  `undefined` (not reported) → attempt-then-degrade, consistent with archive.
- **Attachment open/save side-effects are injected.** `openAttachment`/`saveAttachment` (runtime)
  take a `FileOpener`/`FileSaver` so they stay pure + unit-testable; the real `open`/`xdg-open` +
  copy-to-Downloads live in `os-open.ts`, wired only in `launch.ts`. Invariant 6: the local path is
  passed to the OS as a process **argument**, never through a shell or a notice — tests assert the
  path never appears in any `notice/shown` message (the notice names the _file_, not its location).
- **Live-validated the read-only halves:** `messages.send`'s `replyToMessageID` param shape, and
  `assets.download` returning a local path for a real image attachment (redacted). **Did NOT** send a
  live reply — that posts a real message to a contact (invariant 5), so it's a manual gate for Mitch.
- **Help overlay overflow (again).** The two-column split was by group _count_; a 5th group made the
  left column 3 heavy groups tall and its flex boxes **overlapped** (OpenTUI boxes overlap, not clip
  — the garble the earlier note warned about). Fixed by balancing columns by **row weight** (greedy:
  each group joins the shorter column). Added a `HelpOverlay` test asserting the balance invariant.

### 2026-07-31 — Slice 10 done: search endpoint live-validated (scope + caps + deep-link)

- Ran a **redacted** live probe against Beeper Desktop's real `messages.search` (3 connected
  networks: WhatsApp/Facebook/Beeper). Findings that were "unknown until probed" in the plan:
  - **Scope is genuinely honored server-side.** Chat-scoped search returned only hits in the
    requested chat; account-scoped returned only hits in the requested account. Our
    `scopeHonored` cross-check (every hit matches the requested chat/account) came back `true` for
    both — so the labeled-fallback path is a real safety net, not the normal case, on these networks.
  - **Results cap/paginate.** A broad query hit the 50-item limit → `capped=true`, as designed.
  - **Deep-linking is supported.** Every hit carries `id`+`chatId`+`accountId`, so opening a result
    lands in the right chat and loads its recent page. Anchoring to an _older, off-page_ message is
    still Slice 11 (needs history paging to the match).
- **Caveat:** Discord isn't connected on this setup, so the literal scenario-5 network wasn't
  exercised; the endpoint _semantics_ (the actual risk) were, across three real networks.
- Probe was throwaway (`local/`, gitignored); prints only counts/booleans/network-types — no message
  text, ids, or names (invariant 9).

### 2026-07-31 — Slice 10 follow-up: sent messages showed twice

- **Root cause:** the optimistic send path _synthesized_ a "sent" message with the server's
  `pendingMessageID`, but the live `message.upserted` echo carries the message's own (different) id
  and the real sender name — so dedup-by-id failed and you saw both `You: …` and `mitchmalone: …`.
- **Fix:** `send/succeeded` no longer synthesizes anything — it just flips the optimistic message to
  `sent`, keeping its `clientId`. `mergeMessages` now reconciles: a real self-echo (an `isSender`
  message with **no** `clientId`) supersedes our optimistic placeholder, matched by chat-local
  **text** (ids don't line up). `effectiveKey` pins any `clientId`-bearing message to the bottom
  until its echo replaces it. Reconcile is gated to the `newer` page so loading old history with a
  repeated phrase can't evict a genuine pending send. Dropped `message` from the `send/succeeded`
  event and the `sentMessage()` builder.
- **Text-match caveat:** if Beeper ever echoes transformed text (markdown→HTML) the match could miss
  and the duplicate return; plain-text sends (the norm) reconcile cleanly. Revisit if it bites.

### 2026-07-31 — Slice 10 follow-up: rail focus + archive action (live-use feedback)

- **The quick-keys-only rail was wrong in the hand.** Live-testing, Mitch pressed `Esc`/`←` to step
  into the leftmost column and nothing happened. Reversed the 10a decision: the rail is now a real
  focus target. `FocusTarget` gained `'rail'` (ordered outer→inner: rail → inbox → conversation →
  compose); `Esc`/`h`/`←` walks out one level, `l`/`→`/`Enter` drills back in. Lesson: a spatial UI
  element people can _see_ they'll try to _enter_ — don't make it keys-only just to avoid a focus
  state.
- **Archive action pulled in from deferred.** `chats.archive(id, {archived})` exists, and the chat
  payload reports `capabilities.archive` — so we gate honestly: `Shift+A` archives/unarchives the
  open chat, but a platform that reports `archive:false` gets a named notice and no call (degrade
  visibly). Non-optimistic (await the call, then refetch → `chats/upserted`) so we never fake
  success; then deselect + focus the list (gmail-style close).
- **Added a general `notice` primitive** (`state.notice`, shown in the status bar, cleared on
  `chat/selected`) rather than overloading the connection `error`. Reusable for future per-action
  feedback.
- **Archive works from the list too** (feedback: don't make me open a chat to archive it). `Shift+A`
  is bound in both inbox and conversation contexts; `archiveChat` takes the target id (not "the open
  chat") and, after the chat leaves the view, selects the chat that takes its slot so the cursor
  doesn't jump to the top — quick successive archiving. Needed a store-threaded test harness: the
  "select next" logic reads `getState()` _after_ the reconcile, which a fixed fake `getState` can't
  model.
- **Help overlay went two-column.** Adding bindings pushed it past a 24-row terminal; the nested
  flex group-boxes _overlap_ (not clip) when they can't fit, silently garbling rows. Splitting groups
  into two columns halves the height. Watch this ceiling as bindings grow.
- **Archive "select next" must be computed _before_ the call, not after.** First cut read the list
  after the reconcile and picked the row in the vacated slot — but Beeper's archived state can
  propagate a beat late, so the row lingered, selection stayed on it, and when a live event finally
  removed it the next keypress fell back to the top (`moveSelection`'s not-found → row[0]). Fix:
  compute the neighbour (below, else above) from the pre-archive list and select it up front.
- **Per-network colour** (`networkColor`, alongside `networkMarker` in `InboxPane.tsx`) tints the
  network marker in the chat list, the rail, and the conversation header so networks are scannable.
  Colours aren't visible in `captureCharFrame`, so it's covered by a pure unit test, not a render one.
- **Archive is optimistic now** (feedback: the await made it feel slow). Flip state immediately,
  fire the call in the background, roll back + notice on failure. Dropped the post-call `getChat`
  refetch entirely — the live `chat.upserted` event reconciles the full object, so the extra
  round-trip was pure latency. Still honest: a failed archive visibly reappears with a reason.
- **Typing jank was whole-tree re-render per keystroke.** `Compose` mirrors each key to the store
  (`draft/changed`) for persistence, and `useSyncExternalStore` re-renders the whole App — so the
  conversation panel (every message line) repainted on every key. Fix: `memo()` the four panels
  (Inbox/Rail/Conversation/StatusBar) and derive their props via `useMemo` keyed on the _specific_
  state slices they read. Since `draft/changed` only replaces `state.drafts`, those memo deps stay
  referentially identical (guarded by a reducer test), so the panels skip re-rendering while typing.
  `exhaustive-deps` wants the whole `state`; disabled for that block on purpose (would defeat it).
- **Title width gotcha:** an OpenTUI `box` `title` longer than the inner width silently renders
  blank. The width-8 rail dropped `'Net ●'` (5 chars) entirely; `'Net●'` (4) fits. Also `◂` didn't
  render in the test char-frame but `●` does — mirror ConversationView's proven `●` focus marker.

### 2026-07-31 — Slice 10: network rail, filters & message search

- **The rail is a filter, not a new focus target.** Scope (`[`/`]`), archived (`a`), unread-only
  (`U`) are app-wide keys handled _before_ the per-focus switch in `app.tsx`, so the
  `inbox → conversation → compose` flow is untouched. Bracket keys are matched on `key.sequence`
  (like `/` and `?`) because terminals name them inconsistently; letters go through `resolveCommand`.
- **`selectInboxRows` is now filter-aware; `selectNetworkRail` derives the rail.** Rail unread dots
  honor the current archived view (so counts match the visible list) but ignore unread-only (that's
  a list filter, not a rail concern). Kept marker derivation (`networkMarker`) in the component —
  `src/state` must not import `src/tui`.
- **Test-data bug surfaced by scoping:** `app.test.tsx`'s `seededStore` hardcoded `accountId:'a'`
  for _both_ chats, so a per-account scope couldn't distinguish them. Fixed the helper to map
  network→account. Lesson: filter/scope features expose latent inconsistencies in shared fixtures.
- **Message search verifies scope, never trusts it.** The adapter requests `chatIDs`/`accountIDs`
  but then checks every hit actually matches; a scope-ignoring server reports `scopeHonored:false`
  so the runtime scopes locally + labels it partial. Server failure → local search over loaded
  history (labeled partial), or a named error when even that is empty. No silent wrong results
  (invariant 8).
- **Message search is a two-phase overlay:** type → `Enter` runs the adapter search; with results,
  `↑`/`↓` select and `Enter` opens. Disambiguated by `status` (`done` + results → open, else run).
  `j`/`k` can't move the selection — letters must type — so selection uses arrows only.
- **Deep-link is honest-partial:** opening a hit selects + loads the chat's recent page; if the hit
  is older than that page it isn't anchored yet (message-anchored loading is Slice 11 territory).
  Not a dead control — you land in the right conversation.

### 2026-07-31 — tmux/terminal unread badge

- Shows `1: Beeper [n]` in the tmux status line. The app sets the window **name**
  to `Beeper [n]`; tmux prepends its own window **index** (`1:`).
- **Prototyped the escape first** (the one real unknown). OSC 2 sets only the
  _pane title_; modern tmux `automatic-rename` follows `pane_current_command`, not
  the title, so the window name stayed `bash`. The native `ESC k` rename escape
  needs `allow-rename on` (off by default). What works config-free is
  `tmux rename-window`; restore via `set-window-option -u automatic-rename`.
- `createStatusWriter` (env/write/tmux-runner injectable → tty-free unit tests)
  dedupes on the count, so it costs nothing on unrelated store changes (typing).
  Also verified end-to-end against a real isolated tmux server, not just mocks.
- **Only ever emits `Beeper [n]`** — no chat name/sender/content in a terminal
  title (invariant 6). Total unread across non-archived chats.

### 2026-07-31 — Slice 9: Phase 1 validated & closed

- **Golden-path smoke harness** (`smoke.test.tsx`): drives the real App by keyboard against a fake
  gateway + injected watch events through OpenTUI's headless renderer — the "fixture Beeper server"
  done without a pty (deterministic; runs in the existing CI test job). Covers PRD scenarios 1–4;
  7 (doctor) is the CLI test.
- **Live matrix (redacted):** launch-to-usable **~29ms** (target ≤3s); WhatsApp/Facebook/Beeper all
  list+read cleanly. A Facebook media message with no `text` renders `(no content)` — graceful, no
  silent failure. Send + live inbound already validated live (Slice 5/6).
- **Real finding, fixed:** multi-page chat pagination intermittently `400`s on Beeper 4.2.x. Made
  `#collect` resilient — a failed _continuation_ page returns pages already collected (better to show
  the first page than fail the inbox); a first-page failure still surfaces. First-page transient
  `400`s during Beeper's startup sync clear on retry — acceptable degradation.
- The account set here is WhatsApp/Facebook/Beeper, not the assumed Slack/Telegram/Signal — the
  matrix validates what's actually connected. `doctor` token-scope reporting has no clean read-only
  detection; deferred to Slice 14.

### 2026-07-31 — Slice 8 built: chat search & help overlay

- `/` fuzzy chat search (pure `searchChats` — subsequence match, recency-weighted, highlight spans)
  in a modal palette; `?` help overlay **generated from the keymap** (`helpGroups()`), with a test
  asserting every binding renders so it can't drift.
- **Stale-closure fix, generalized:** the App keyboard handler now reads `store.getState()` per
  keypress instead of the render-closure `state` — fast typing (`pressKeys`) was losing all but the
  last char (search "eng" → "g"). Openers (`/`, `?`) match `key.sequence` since terminals name them
  inconsistently. Both in `LEARNINGS.md`.
- Kept `state/` pure: search results are computed in the App from `selectInboxRows` + `searchChats`,
  not a state selector (fuzzy lives in `src/tui/`, which state must not import).

### 2026-07-31 — Slice 6 built + live-validated: live updates

- **Probed the real `/v1/ws` to nail the protocol** (huge advantage of having live Beeper): command
  is `subscriptions.set` (not `subscribe`), `message.upserted` carries full `entries` that map with
  `mapMessage`, `chat.upserted` carries only an id (refetch). Full protocol in `LEARNINGS.md`.
- **End-to-end live smoke passed:** real socket → `subscriptions.set` → `message.upserted` →
  `applyWatchEvent` → `message/received` → store. A self-message produced 3 status-upsert events that
  **deduped to 1** stored message — confirming replay/reconnect can't duplicate (invariant 5).
- Pure protocol (`watch-protocol.ts`) + fake-socket/fake-scheduler client tests (`watch.ts`); the
  reconnect loop doesn't block quit (PTY-verified clean exit with the watch active).
- New-messages affordance: appending while scrolled up bumps `conversationOffset` so the reading
  window is unchanged and flags `newMessagesBelow`; scrolling to bottom / `G` dismisses it.
- Built **in parallel with Slice 7** (a forked subagent in a worktree). Coordination worked: the
  fork left the shared cursor docs to me and gave clean `launch.ts` reconciliation notes.

### 2026-07-31 — Live validation pass (Beeper Desktop 4.2.1004)

First run against a real Beeper. Read paths all pass; found + fixed one real bug; hit a token-scope
wall on send. (No personal data recorded — redacted smokes only.)

- **`doctor`/`status` live:** reachable, token accepted, 3 accounts, server version/platform mapped.
- **Adapter reads validated:** chats (multi-network, paginated), messages (fields present), and
  **older paging** — after fixing the `direction` token.
- **Bug fixed:** backward paging used `direction: 'older'` (a Slice-4 guess) → `400`. The API enum is
  `'before' | 'after'`; changed to `'before'`, re-validated (fresh older messages paged in).
- **Send blocked by scope, then confirmed with a write token:** a read-only token `403`s on
  `messages.send`/`chats.start` (`"missing: write"`). With a write-scoped token the **full send path
  validated end-to-end** against real WhatsApp: `chats.start` resolved the DM, `adapter.sendMessage`
  delivered, and a re-fetch found the message with `isSender: true`. The core loop (browse → read →
  reply → send) now works live. Adapter maps the read-only 403 to `unauthorized`; follow-up: `doctor`
  should report token scope. See `LEARNINGS.md`.
- Saw a transient startup-sync `400` that self-resolved.

### 2026-07-31 — Slice 5 built: compose & send

- **The core loop closes.** `applyComposeKey` (pure) drives a `Compose` strip; `submitSend` wires
  the Slice-2 optimistic lifecycle to `adapter.sendMessage`. Send success reconciles from the local
  text + the API's `pendingMessageID` (the send call returns only a pending id, not the echoed
  message — the real one arrives via live updates in Slice 6), parked at the bottom via a sentinel
  sortKey.
- **Invariant 5 is structural + guard-tested**: the sole `send/requested` emitter is `submitSend`,
  called only from an explicit `⏎` on a non-empty draft; bootstrap/refresh/openChat/loadOlder are
  asserted never to emit it.
- **Modal input gotchas** (both in `LEARNINGS.md`): (1) `useKeyboard` closures go stale under fast
  `pressKeys` — hold editor state in a `useRef`, mirror to state for render, remount per chat via
  `key`; (2) while compose is focused the global keymap must be bypassed entirely or `q`/`j`/… run
  commands instead of typing.

### 2026-07-30 — Slice 4 built: conversation view

- **Read a chat.** The center pane renders history via pure `formatMessage`/`messageLine` (degrades
  cleanly on absent fields — no `undefined`/`NaN`), with a focus model (inbox ↔ conversation) and
  cursor-threaded older-paging (adapter `listMessages` now returns `{messages, hasMore, cursor}`).
- **Ditched `<scrollbox>` for a computed window.** Its `stickyStart="bottom"` scrolls short content
  out of the headless capture frame (and the scrollbar renders but content vanished). A sliced
  visible-window (`conversation-scroll.ts`, offset in state) is deterministic and testable, and I
  control the bottom-pin exactly. Two layout gotchas: `flexGrow` siblings shrink `text` to 0 height
  (need `flexShrink: 0`); terminal `Esc` is parser-ambiguous so bind `h`/`←` too. All in
  `LEARNINGS.md`.
- **Unvalidated guess:** the `direction: 'older'` cursor token for backward paging — confirm against
  a live Beeper in Slice 6.

### 2026-07-30 — Slice 3 built: TUI shell & inbox

- **The product renders.** `store` (observable wrapper over the reducer) → `useSyncExternalStore` →
  selectors → components. Nav dispatches `chat/selected`; selection lives in the reducer so it
  survives re-renders and refreshes. `launch.ts` wires the real adapter and fires `bootstrap`.
- **OpenTUI is very testable** — `testRender` + `captureCharFrame` for content, `mockInput.pressKey`
  for real keyboard events, `resize` for breakpoints. So the inbox render, j/k/G navigation, narrow
  fallback, and `q`-quit are all covered in `bun test` (no PTY needed for those). This retired the
  Slice 3 "unknown testability" risk. (Benign React `act()` warnings from mock input — ignore.)
- **Skipped `@opentui/keymap`.** It's a full keybinding runtime (contexts, sequences, Solid peer
  deps); our need is a handful of static bindings. A thin in-repo `keymap.ts` table is the single
  source (help-overlay ready) and trivially testable. Recorded in `DECISIONS.md`.
- `text` styles use `fg`/`bg`; `box` uses `backgroundColor` — don't mix them (tsc catches it).

### 2026-07-30 — Slice 2 built: pure state core

- **Reducer + selectors are fully pure** — verified every `@/beeper` import in `src/state/` is
  `import type` (erased at build), so there's no adapter/OpenTUI runtime coupling. Entity types are
  the adapter's domain models, not duplicated.
- **Optimistic send reconciliation** keys off a `clientId`: `send/requested` adds a pending message
  (sorted last via a sentinel key), `send/succeeded` drops the pending and merges the server message
  (deduped by id, so a live echo of the same id is a no-op). Covered the races — success after
  failure, duplicate succeeded, reconnect replay.
- **Bounded message windows**: ordered array per chat capped at `MAX_MESSAGES_PER_CHAT`, deduped by
  id; eviction keeps the messages nearest the page direction the user just loaded from. Simple
  window now; finer scroll-anchoring can come with the UI slices.
- Message-identity reconciliation is designed but unvalidated against the real API — that's the
  Slice 6 (live updates) checkpoint.

### 2026-07-30 — Slice 1 built: adapter + status/doctor

- **Adapter wraps the SDK cleanly.** `BeeperAdapter` (`src/beeper/client.ts`) is the only SDK
  consumer; it returns lean domain models (`types.ts`) and collapses every failure to `BeeperError`
  (`errors.ts`). `maxRetries: 0` keeps retry policy ours (`BeeperError.retryable`), not the SDK's.
- **Fixture testing via injected `fetch`** worked exactly as hoped — the whole adapter (happy paths +
  401/429/connection-refused error mapping) is tested with synthetic responses, no live Beeper.
- **Two SDK gotchas.** (1) The client constructor _throws_ if `accessToken` is `undefined` and
  `BEEPER_ACCESS_TOKEN` is unset — so the adapter passes `''` when no token, letting the pre-auth
  `/v1/info` reachability check still run while authed calls 401. (2) `exactOptionalPropertyTypes`
  means mappers must omit optional keys (conditional spread), not set them to `undefined`.
- **Keychain write is deferred on purpose.** `security add-generic-password` takes the secret as a
  CLI argument, which invariant 6 forbids; reads (`security … -w`) are argv-safe. So Slice 1 reads
  the token (env or Keychain) but leaves secure storage to the auth/login flow.
- **`doctor` is provable offline.** A spawned-CLI test points at a closed port → connection refused
  → `unreachable` → named failure + exit 1 (PRD scenario 7), no live Beeper needed.

### 2026-07-30 — Slice 1 research: Beeper Desktop API surface

Studied the official [Beeper Desktop API](https://developers.beeper.com/desktop-api) (no live
Beeper needed; docs + SDK source only). Key shapes:

- **There's an official TypeScript SDK, `@beeper/desktop-api`** (npm, v5.0.0), a typed wrapper over
  the local REST API. Docs explicitly say "use our SDKs." Supports **Bun 1.0+** (smoke-verified).
- **Transport:** local REST at `http://127.0.0.1:23373` by default. Beeper Desktop must be running.
- **Auth:** `Authorization: Bearer <token>`. Token is minted in Beeper Desktop → Settings →
  Integrations → Approved connections (`+`). OAuth 2.0 + PKCE (`/.well-known/oauth-authorization-server`)
  exists for remote access — that's Slice 13, not now.
- **SDK client:** `new BeeperDesktop({ accessToken, baseURL, timeout, maxRetries, fetch, logger })`.
  The `fetch` option lets us inject a synthetic fetch → **fixture-based tests need no live Beeper**.
- **Pagination:** cursor-based, both auto (`for await…of page`) and manual (`page.items`,
  `page.hasNextPage()`, `page.getNextPage()`).
- **Errors:** base `APIError` + subclasses — `APIConnectionError` (no connection),
  `AuthenticationError` (401), `PermissionDeniedError` (403), `NotFoundError` (404),
  `RateLimitError` (429), `InternalServerError` (≥500), `BadRequestError` (400),
  `UnprocessableEntityError` (422). These map cleanly onto our `BeeperError` taxonomy.
- **Surface used by the roadmap:** `info.retrieve()` (GET /v1/info — status/doctor + capabilities),
  `accounts.list()`, `chats.list/search`, `messages.list(chatID)/search/send(chatID)`. Live updates
  are a WebSocket at `ws://…/v1/ws` with `chat.upserted`/`message.upserted` domain events (Slice 6);
  reactions/edits/assets exist for Slice 11.

Implication: Slice 1 **wraps the SDK** rather than hand-rolling HTTP + a full Zod schema layer. See
`DECISIONS.md`.

### 2026-07-30 — Slice 0: scaffold & toolchain landed

- **OpenTUI proven first, as planned.** `@opentui/react@0.4.5` renders a three-pane layout on
  macOS arm64 under Bun 1.3.14; `q` exits cleanly (PTY-confirmed code 0). The riskiest dependency
  is retired before any product code. Headless render smoke via `@opentui/react/test-utils`
  `testRender` runs in CI without a TTY.
- **Had to pin TypeScript to the 6 line.** Newest TS is 7.0 (native Go compiler), but
  `typescript-eslint` doesn't support it yet — `bun run lint` hard-fails under TS 7. Pinned
  `typescript@6.0.3` so typecheck and lint share one compiler. Recorded in `DECISIONS.md`;
  quick-reference in `LEARNINGS.md`.
- **TS 7 also removed `tsconfig` `baseUrl`** (surfaced before the pin); the `@/*` path alias now
  uses a relative mapping (`./src/*`), which works on both TS 6 and 7.
- Toolchain wired: ESLint 10 flat config + `typescript-eslint`, Prettier (single quotes, es5
  commas, no semis), Husky v9 (pre-commit lint-staged + gitleaks, commit-msg commitlint, pre-push
  `bun test`), gitleaks secret scanning locally and in CI, and GitHub Actions (typecheck/lint/
  format/test on macOS arm64 + ubuntu, plus a full-history gitleaks job).
- Name locked: package/CLI/config is `beeper-tui` (repo stays `beeptui`).

### 2026-07-30 — Repo scaffolded docs-first

- Docs protocol modeled on the `psyke` repo (STATUS / JOURNAL / DECISIONS / ROADMAP / plans),
  adapted for a solo local-first tool: no Linear tickets, no worktree guard, no staging environment.
- The PRD mandates Bun + OpenTUI, which overrides the global AGENTS.md "npm only" and "Vitest"
  rules — see `DECISIONS.md` 2026-07-30 and the project `AGENTS.md`.
