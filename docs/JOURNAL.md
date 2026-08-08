# JOURNAL

> Append-only log of non-obvious learnings, gotchas, and the "why" behind things.
> **Newest at the top.** Keep entries short and factual — one entry per discovery.

---

### 2026-08-08 — Inline images: the spike said no to protocols, cells said yes

- **The emit-point spike did its job by failing usefully.** OSC 1337 raw-emit inside OpenTUI is
  _possible_ — validated headlessly by capturing the pty byte stream (detached tmux +
  `pipe-pane`) — but each proof surfaced a new fragility: OpenTUI's threaded writer interleaves
  frame bytes mid-escape (3 of 6 emissions torn; clean only with `useThread: false`), erased
  images need heuristics over private renderer APIs, iTerm2 modally prompts on a `File=` without
  `name=`/`size=`, and tmux swallows everything without `allow-passthrough`. Full findings in the
  slice plan; pivot recorded in `DECISIONS.md` 2026-08-07. slk (Go Slack TUI) independently
  landed on cells-only for the same reasons — and ships _nothing_ pixel-true on iTerm2.
- **`drawSuperSampleBuffer` samples 2×2 px per cell but has no horizontal bound** — the Zig loop
  runs to the buffer edge (their TODO admits it), painting wrapped garbage past the image. Scissor
  the image's cell rectangle around the call. Found live in `--demo`, pinned by a paint test.
- **Verifying pixels headlessly is a cell-path superpower.** Half-block thumbnails are real cells:
  `tmux capture-pane` and the test renderer's `captureCharFrame`/`captureSpans` see them, so
  paint, scroll, resize and menu overlap were all verified without eyes on a screen.
- **Beeper's `assets.download` returns `srcURL` as a `file://` URL** and the file is an
  **extension-less blob**. The first cost the preview pipeline (reads failed → every block parked
  as a failed placeholder; `os-open.ts` had already learned this); the second broke `open` itself
  (macOS guessed text encoding). Downloads now open as a typed temp copy named from attachment
  metadata.
- **Keyboard input never reaches the app in raw iTerm2** (fine under tmux). Surfaced by the spike,
  reproduced against the real app, pre-existing — all live validation to date had been inside
  tmux. Untangled from this slice; tracked in `STATUS.md` as next.

### 2026-08-04 — Raw `<a href=…>` was rendering, and the translator was innocent

- **Found by doing the manual release pass, not by a test.** A real message containing a link
  rendered its markup verbatim — `<a`, `href="…"`, `rel="noopener"` on separate wrapped lines.
  `htmlToStyledLines` handled anchors correctly all along; `hasHtml` simply did not list `a`, so the
  message never reached the HTML path. A whitelist used as a gate is only as good as its coverage,
  and this one had been written from the tags the _formatter_ implements rather than the tags
  bridges _send_.
- **Widened to the Matrix-permitted set rather than to "anything tag-shaped".** Prose containing
  `<flag>` or `<me@example.com>` has to stay prose — silently eating a word is worse than the markup
  it would catch. Unlisted tags are still stripped once a message is on the HTML path; the gate only
  decides whether it takes that path.

---

### 2026-08-08 — Inline images: the spike said no to protocols, cells said yes

- **The emit-point spike did its job by failing usefully.** OSC 1337 raw-emit inside OpenTUI is
  _possible_ — validated headlessly by capturing the pty byte stream (detached tmux +
  `pipe-pane`) — but each proof surfaced a new fragility: OpenTUI's threaded writer interleaves
  frame bytes mid-escape (3 of 6 emissions torn; clean only with `useThread: false`), erased
  images need heuristics over private renderer APIs, iTerm2 modally prompts on a `File=` without
  `name=`/`size=`, and tmux swallows everything without `allow-passthrough`. Full findings in the
  slice plan; pivot recorded in `DECISIONS.md` 2026-08-07. slk (Go Slack TUI) independently
  landed on cells-only for the same reasons — and ships _nothing_ pixel-true on iTerm2.
- **`drawSuperSampleBuffer` samples 2×2 px per cell but has no horizontal bound** — the Zig loop
  runs to the buffer edge (their TODO admits it), painting wrapped garbage past the image. Scissor
  the image's cell rectangle around the call. Found live in `--demo`, pinned by a paint test.
- **Verifying pixels headlessly is a cell-path superpower.** Half-block thumbnails are real cells:
  `tmux capture-pane` and the test renderer's `captureCharFrame`/`captureSpans` see them, so
  paint, scroll, resize and menu overlap were all verified without eyes on a screen.
- **Beeper's `assets.download` returns `srcURL` as a `file://` URL** and the file is an
  **extension-less blob**. The first cost the preview pipeline (reads failed → every block parked
  as a failed placeholder; `os-open.ts` had already learned this); the second broke `open` itself
  (macOS guessed text encoding). Downloads now open as a typed temp copy named from attachment
  metadata.
- **Keyboard input never reaches the app in raw iTerm2** (fine under tmux). Surfaced by the spike,
  reproduced against the real app, pre-existing — all live validation to date had been inside
  tmux. Untangled from this slice; tracked in `STATUS.md` as next.

### 2026-08-04 — The bare `↩` messages were media, not broken replies

- **Diagnosed rather than guessed, and it was not what it looked like.** The messages rendering as
  `↩ ✓✓` with no body are `type: IMAGE` (and one `VIDEO`) — 21 of 22 image messages across ten real
  chats. Beeper's message list returns them with **no `text` field and no `attachments` array at
  all**, so a body composed from those two alone came out empty. The reply marker was correct:
  `linkedMessageID` really does mean reply-to per the SDK, and these are images sent as replies.
- **Naming the kind is the least we can honestly say.** `MessageSummary` now carries Beeper's
  `type`, and the layout falls back to `[image]` / `[video]` / … when there is neither text nor
  attachment metadata. Real attachment labels and real text both still win — the placeholder is
  only a fallback, with tests pinning that precedence.
- **The reply marker carries its own trailing space**, so joining decorations onto it doubled up
  (`↩  [image]`). Body assembly now joins phrases with a single space unless the line already ends
  in one — the sort of thing that only shows up once two optional pieces meet.

---

### 2026-08-08 — Inline images: the spike said no to protocols, cells said yes

- **The emit-point spike did its job by failing usefully.** OSC 1337 raw-emit inside OpenTUI is
  _possible_ — validated headlessly by capturing the pty byte stream (detached tmux +
  `pipe-pane`) — but each proof surfaced a new fragility: OpenTUI's threaded writer interleaves
  frame bytes mid-escape (3 of 6 emissions torn; clean only with `useThread: false`), erased
  images need heuristics over private renderer APIs, iTerm2 modally prompts on a `File=` without
  `name=`/`size=`, and tmux swallows everything without `allow-passthrough`. Full findings in the
  slice plan; pivot recorded in `DECISIONS.md` 2026-08-07. slk (Go Slack TUI) independently
  landed on cells-only for the same reasons — and ships _nothing_ pixel-true on iTerm2.
- **`drawSuperSampleBuffer` samples 2×2 px per cell but has no horizontal bound** — the Zig loop
  runs to the buffer edge (their TODO admits it), painting wrapped garbage past the image. Scissor
  the image's cell rectangle around the call. Found live in `--demo`, pinned by a paint test.
- **Verifying pixels headlessly is a cell-path superpower.** Half-block thumbnails are real cells:
  `tmux capture-pane` and the test renderer's `captureCharFrame`/`captureSpans` see them, so
  paint, scroll, resize and menu overlap were all verified without eyes on a screen.
- **Beeper's `assets.download` returns `srcURL` as a `file://` URL** and the file is an
  **extension-less blob**. The first cost the preview pipeline (reads failed → every block parked
  as a failed placeholder; `os-open.ts` had already learned this); the second broke `open` itself
  (macOS guessed text encoding). Downloads now open as a typed temp copy named from attachment
  metadata.
- **Keyboard input never reaches the app in raw iTerm2** (fine under tmux). Surfaced by the spike,
  reproduced against the real app, pre-existing — all live validation to date had been inside
  tmux. Untangled from this slice; tracked in `STATUS.md` as next.

### 2026-08-04 — Removing the dead scroll event made the tests honest

- **Fifteen tests reached "scrolled up" through an event no key could produce.** `conversation/
scrolled` had been dead since the message cursor arrived, but the affordance and eviction tests
  still used it to set up their state — so they were exercising a path a user cannot reach, and the
  offsets they asserted (`delta: 6` → `offset 6`) were not offsets any real interaction produces.
- **The replacement is a loop, not a constant.** How far the cursor must walk before the window
  moves depends on message heights and viewport size, so `scrolledUp()` walks until the offset
  leaves the floor and asserts that it did. Hard-coded step counts would silently stop testing
  anything the first time a message wrapped differently.
- Removing dead code is cheap; removing the _fiction it supported_ is where the value was.

---

### 2026-08-08 — Inline images: the spike said no to protocols, cells said yes

- **The emit-point spike did its job by failing usefully.** OSC 1337 raw-emit inside OpenTUI is
  _possible_ — validated headlessly by capturing the pty byte stream (detached tmux +
  `pipe-pane`) — but each proof surfaced a new fragility: OpenTUI's threaded writer interleaves
  frame bytes mid-escape (3 of 6 emissions torn; clean only with `useThread: false`), erased
  images need heuristics over private renderer APIs, iTerm2 modally prompts on a `File=` without
  `name=`/`size=`, and tmux swallows everything without `allow-passthrough`. Full findings in the
  slice plan; pivot recorded in `DECISIONS.md` 2026-08-07. slk (Go Slack TUI) independently
  landed on cells-only for the same reasons — and ships _nothing_ pixel-true on iTerm2.
- **`drawSuperSampleBuffer` samples 2×2 px per cell but has no horizontal bound** — the Zig loop
  runs to the buffer edge (their TODO admits it), painting wrapped garbage past the image. Scissor
  the image's cell rectangle around the call. Found live in `--demo`, pinned by a paint test.
- **Verifying pixels headlessly is a cell-path superpower.** Half-block thumbnails are real cells:
  `tmux capture-pane` and the test renderer's `captureCharFrame`/`captureSpans` see them, so
  paint, scroll, resize and menu overlap were all verified without eyes on a screen.
- **Beeper's `assets.download` returns `srcURL` as a `file://` URL** and the file is an
  **extension-less blob**. The first cost the preview pipeline (reads failed → every block parked
  as a failed placeholder; `os-open.ts` had already learned this); the second broke `open` itself
  (macOS guessed text encoding). Downloads now open as a typed temp copy named from attachment
  metadata.
- **Keyboard input never reaches the app in raw iTerm2** (fine under tmux). Surfaced by the spike,
  reproduced against the real app, pre-existing — all live validation to date had been inside
  tmux. Untangled from this slice; tracked in `STATUS.md` as next.

### 2026-08-04 — A narrow box clips its own flyout, and a memo froze the rail caret

- **`position: 'absolute'` children are clipped by their positioned ancestor.** The conversation
  action menu overflows its pane happily, which read as "OpenTUI lets dropdowns overflow". It does
  not — that pane is just wide enough. Anchored inside the 8-column Net rail, the same pattern
  rendered a 4-column stub with every label cut off. Anchor a flyout on a container at least as wide
  as the flyout; for rail menus that means the app root.
- **A `useMemo` over a selector must list every slice the selector reads.** The App memoized
  `selectNetworkRail` on chats/accounts/filter but not `state.railCursor` — and every rail entry
  carries `isCursor`. The cursor moved in state while the rail kept drawing the stale caret, so
  `j`/`k` looked completely dead. It survived this long because every _other_ rail entry also changes
  the scope, which invalidated the memo by a side door; Settings is the first entry that does not.
- **Test-harness key tokens are uppercase constants, not key names.** `pressKey('escape')` /
  `pressKey('up')` send the literal strings; the real tokens are `ESCAPE`, `ARROW_UP`, `ARROW_DOWN`.
  A test written with the lowercase form passes or fails for reasons unrelated to what it claims to
  check — one of mine "passed" only because the cursor it failed to move was already on the right
  item. Bare `ESCAPE` still is not delivered as an escape event, so that path is verified live.

---

### 2026-08-08 — Inline images: the spike said no to protocols, cells said yes

- **The emit-point spike did its job by failing usefully.** OSC 1337 raw-emit inside OpenTUI is
  _possible_ — validated headlessly by capturing the pty byte stream (detached tmux +
  `pipe-pane`) — but each proof surfaced a new fragility: OpenTUI's threaded writer interleaves
  frame bytes mid-escape (3 of 6 emissions torn; clean only with `useThread: false`), erased
  images need heuristics over private renderer APIs, iTerm2 modally prompts on a `File=` without
  `name=`/`size=`, and tmux swallows everything without `allow-passthrough`. Full findings in the
  slice plan; pivot recorded in `DECISIONS.md` 2026-08-07. slk (Go Slack TUI) independently
  landed on cells-only for the same reasons — and ships _nothing_ pixel-true on iTerm2.
- **`drawSuperSampleBuffer` samples 2×2 px per cell but has no horizontal bound** — the Zig loop
  runs to the buffer edge (their TODO admits it), painting wrapped garbage past the image. Scissor
  the image's cell rectangle around the call. Found live in `--demo`, pinned by a paint test.
- **Verifying pixels headlessly is a cell-path superpower.** Half-block thumbnails are real cells:
  `tmux capture-pane` and the test renderer's `captureCharFrame`/`captureSpans` see them, so
  paint, scroll, resize and menu overlap were all verified without eyes on a screen.
- **Beeper's `assets.download` returns `srcURL` as a `file://` URL** and the file is an
  **extension-less blob**. The first cost the preview pipeline (reads failed → every block parked
  as a failed placeholder; `os-open.ts` had already learned this); the second broke `open` itself
  (macOS guessed text encoding). Downloads now open as a typed temp copy named from attachment
  metadata.
- **Keyboard input never reaches the app in raw iTerm2** (fine under tmux). Surfaced by the spike,
  reproduced against the real app, pre-existing — all live validation to date had been inside
  tmux. Untangled from this slice; tracked in `STATUS.md` as next.

### 2026-08-04 — A false alarm about history paging, and how it happened

- **A negative result from synthetic input needs a positive control.** Driving the TUI with
  `tmux send-keys` in a tight loop, the presses coalesced or were dropped, so the message cursor
  never reached the oldest loaded message and no page was ever requested. The symptoms — hint stuck
  on "more history exists", top timestamp frozen across 45 presses — read exactly like paging
  failing silently. `sleep 0.05` between presses and it worked first try. Prove the input path
  actually delivered before concluding the feature is broken.
- **Two writers, one probe file, one wrong number.** Temporary instrumentation had `openChat` and
  `loadOlderMessages` both read-modify-writing the same JSON path. The race reported `got: 0` for a
  fetch that had returned 20 messages, which is what turned a suspicion into a confident (wrong)
  conclusion. Give each probe point its own file.
- **The conclusion was reported before it was double-checked.** "History paging has never worked and
  `u` was equally broken" went out on the strength of a single instrumented run. A second, cleaner
  measurement contradicted it entirely. Adapter paging was fine all along — confirmed independently
  across eight chats, 20 messages per page, zero overlap.

---

### 2026-08-08 — Inline images: the spike said no to protocols, cells said yes

- **The emit-point spike did its job by failing usefully.** OSC 1337 raw-emit inside OpenTUI is
  _possible_ — validated headlessly by capturing the pty byte stream (detached tmux +
  `pipe-pane`) — but each proof surfaced a new fragility: OpenTUI's threaded writer interleaves
  frame bytes mid-escape (3 of 6 emissions torn; clean only with `useThread: false`), erased
  images need heuristics over private renderer APIs, iTerm2 modally prompts on a `File=` without
  `name=`/`size=`, and tmux swallows everything without `allow-passthrough`. Full findings in the
  slice plan; pivot recorded in `DECISIONS.md` 2026-08-07. slk (Go Slack TUI) independently
  landed on cells-only for the same reasons — and ships _nothing_ pixel-true on iTerm2.
- **`drawSuperSampleBuffer` samples 2×2 px per cell but has no horizontal bound** — the Zig loop
  runs to the buffer edge (their TODO admits it), painting wrapped garbage past the image. Scissor
  the image's cell rectangle around the call. Found live in `--demo`, pinned by a paint test.
- **Verifying pixels headlessly is a cell-path superpower.** Half-block thumbnails are real cells:
  `tmux capture-pane` and the test renderer's `captureCharFrame`/`captureSpans` see them, so
  paint, scroll, resize and menu overlap were all verified without eyes on a screen.
- **Beeper's `assets.download` returns `srcURL` as a `file://` URL** and the file is an
  **extension-less blob**. The first cost the preview pipeline (reads failed → every block parked
  as a failed placeholder; `os-open.ts` had already learned this); the second broke `open` itself
  (macOS guessed text encoding). Downloads now open as a typed temp copy named from attachment
  metadata.
- **Keyboard input never reaches the app in raw iTerm2** (fine under tmux). Surfaced by the spike,
  reproduced against the real app, pre-existing — all live validation to date had been inside
  tmux. Untangled from this slice; tracked in `STATUS.md` as next.

### 2026-08-04 — Selection seeding, and the two lies it exposed

- **"Go to the newest message" and "keep this message visible" are different requests.**
  `offsetToShowMessage` anchors a message taller than the viewport by its _top_ — correct when you
  navigate up into a long message, wrong when you are jumping to the latest. The non-zero offset it
  leaves behind is what the reducer reads as "the user has scrolled up", so opening a chat whose
  newest message overflowed the viewport raised a **false new-messages affordance** on a chat you
  had only just opened. `offsetForSelection` now short-circuits to 0 when the target is the newest,
  fixing open / `v` / `G` / arrow-back-down in one place.
- **A highlighted chat is not an opened chat, and the pane must not pretend otherwise.** Seeding the
  inbox cursor made the conversation render a chat with no fetched history, which said "No messages
  yet." — a claim about the chat rather than about our own state. `ActiveConversation` now carries
  `loaded` so an unopened chat says "Press ⏎ to open this chat." Pre-existing (pressing `j` always
  did it); seeding just moved it to the first thing you see.
- **Auto-selection has to fire on whichever event finishes last.** `⏎` dispatches `chat/selected` +
  `focus/changed` and _then_ fetches history, so `focus/changed` looks at an empty list and seats
  nothing. `messages/loaded` needed the mirror of the same rule. A cursor seeded on one of two
  racing events is seeded on neither.
- **"Every filter change re-seeds the cursor" is only true if you can enumerate every filter
  change.** Two were missed because they do not look like filter changes: `rail/cursorMoved` writes
  `filter: cond ? state.filter : {...}` rather than the `filter: { ... }` shape a grep finds, and it
  is the path `j`/`k` in the Net column takes — so changing network left the Chats column with no
  highlight at all. `chats/upserted` is the same class: archiving the selected chat hides it. Audit
  by asking "what else can change what this list shows", not by pattern-matching source.
- **Ten smoke assertions started with a `j` that only existed to wake the column up.** Deleting them
  is the clearest measure of what this changed.

---

### 2026-08-08 — Inline images: the spike said no to protocols, cells said yes

- **The emit-point spike did its job by failing usefully.** OSC 1337 raw-emit inside OpenTUI is
  _possible_ — validated headlessly by capturing the pty byte stream (detached tmux +
  `pipe-pane`) — but each proof surfaced a new fragility: OpenTUI's threaded writer interleaves
  frame bytes mid-escape (3 of 6 emissions torn; clean only with `useThread: false`), erased
  images need heuristics over private renderer APIs, iTerm2 modally prompts on a `File=` without
  `name=`/`size=`, and tmux swallows everything without `allow-passthrough`. Full findings in the
  slice plan; pivot recorded in `DECISIONS.md` 2026-08-07. slk (Go Slack TUI) independently
  landed on cells-only for the same reasons — and ships _nothing_ pixel-true on iTerm2.
- **`drawSuperSampleBuffer` samples 2×2 px per cell but has no horizontal bound** — the Zig loop
  runs to the buffer edge (their TODO admits it), painting wrapped garbage past the image. Scissor
  the image's cell rectangle around the call. Found live in `--demo`, pinned by a paint test.
- **Verifying pixels headlessly is a cell-path superpower.** Half-block thumbnails are real cells:
  `tmux capture-pane` and the test renderer's `captureCharFrame`/`captureSpans` see them, so
  paint, scroll, resize and menu overlap were all verified without eyes on a screen.
- **Beeper's `assets.download` returns `srcURL` as a `file://` URL** and the file is an
  **extension-less blob**. The first cost the preview pipeline (reads failed → every block parked
  as a failed placeholder; `os-open.ts` had already learned this); the second broke `open` itself
  (macOS guessed text encoding). Downloads now open as a typed temp copy named from attachment
  metadata.
- **Keyboard input never reaches the app in raw iTerm2** (fine under tmux). Surfaced by the spike,
  reproduced against the real app, pre-existing — all live validation to date had been inside
  tmux. Untangled from this slice; tracked in `STATUS.md` as next.

### 2026-08-04 — Live arrivals were invisible once the message window filled up

- **Never infer "did something arrive" from a list's length when that list is capped.**
  `message/received` diffed `items.length` either side of the merge. At `MAX_MESSAGES_PER_CHAT` an
  arrival evicts the oldest, so the length is identical across a real arrival and the whole branch
  was skipped — killing the reading-position hold, the new-messages affordance and cursor-follow on
  exactly the busy chats where they matter. The merge knows what it merged; ask it.
- **A self-echo is not an arrival.** The reconciliation path drops an optimistic placeholder when
  our own message echoes back under a new server id. That is a replacement, not an addition —
  counting it would raise "new messages below" for your own send.
- **Two of the three regression tests passed before the fix, vacuously.** At a full window the
  evicted message and the arrival were the same height, so "the reading position is preserved" held
  at zero drift. It only tested anything once the arrival was made taller than what it evicts. A
  preservation test proves nothing unless the thing would otherwise have moved.
- **The obvious detection cost more than the bug.** Snapshotting the window's 200 ids per merge
  doubled the live-message benchmark (8 → 17µs/event). Checking incoming ids against the map as
  they arrive is O(the arrival), not O(the window).

---

### 2026-08-08 — Inline images: the spike said no to protocols, cells said yes

- **The emit-point spike did its job by failing usefully.** OSC 1337 raw-emit inside OpenTUI is
  _possible_ — validated headlessly by capturing the pty byte stream (detached tmux +
  `pipe-pane`) — but each proof surfaced a new fragility: OpenTUI's threaded writer interleaves
  frame bytes mid-escape (3 of 6 emissions torn; clean only with `useThread: false`), erased
  images need heuristics over private renderer APIs, iTerm2 modally prompts on a `File=` without
  `name=`/`size=`, and tmux swallows everything without `allow-passthrough`. Full findings in the
  slice plan; pivot recorded in `DECISIONS.md` 2026-08-07. slk (Go Slack TUI) independently
  landed on cells-only for the same reasons — and ships _nothing_ pixel-true on iTerm2.
- **`drawSuperSampleBuffer` samples 2×2 px per cell but has no horizontal bound** — the Zig loop
  runs to the buffer edge (their TODO admits it), painting wrapped garbage past the image. Scissor
  the image's cell rectangle around the call. Found live in `--demo`, pinned by a paint test.
- **Verifying pixels headlessly is a cell-path superpower.** Half-block thumbnails are real cells:
  `tmux capture-pane` and the test renderer's `captureCharFrame`/`captureSpans` see them, so
  paint, scroll, resize and menu overlap were all verified without eyes on a screen.
- **Beeper's `assets.download` returns `srcURL` as a `file://` URL** and the file is an
  **extension-less blob**. The first cost the preview pipeline (reads failed → every block parked
  as a failed placeholder; `os-open.ts` had already learned this); the second broke `open` itself
  (macOS guessed text encoding). Downloads now open as a typed temp copy named from attachment
  metadata.
- **Keyboard input never reaches the app in raw iTerm2** (fine under tmux). Surfaced by the spike,
  reproduced against the real app, pre-existing — all live validation to date had been inside
  tmux. Untangled from this slice; tracked in `STATUS.md` as next.

### 2026-08-04 — Doc updates can fail silently, and did — three times

- **A `str.replace` whose anchor is missing is a no-op, not an error.** Scripted STATUS and JOURNAL
  edits anchored on the _previous_ slice's entry. Each slice was on its own branch cut from `main`,
  so the previous entry was not there yet, and three STATUS entries plus two JOURNAL entries wrote
  nothing while the script printed `ok`. Three PRs claimed "docs updated" and shipped without them.
- **The edits that used `assert old in s` all worked**, and the one that failed said so loudly. The
  difference between the two groups was entirely whether failure was allowed to be silent.
- Anchor doc inserts on something stable — the section heading, the `---` under the intro — not on
  the previous entry. And verify the file after writing rather than trusting the exit status of a
  string operation.

---

### 2026-08-08 — Inline images: the spike said no to protocols, cells said yes

- **The emit-point spike did its job by failing usefully.** OSC 1337 raw-emit inside OpenTUI is
  _possible_ — validated headlessly by capturing the pty byte stream (detached tmux +
  `pipe-pane`) — but each proof surfaced a new fragility: OpenTUI's threaded writer interleaves
  frame bytes mid-escape (3 of 6 emissions torn; clean only with `useThread: false`), erased
  images need heuristics over private renderer APIs, iTerm2 modally prompts on a `File=` without
  `name=`/`size=`, and tmux swallows everything without `allow-passthrough`. Full findings in the
  slice plan; pivot recorded in `DECISIONS.md` 2026-08-07. slk (Go Slack TUI) independently
  landed on cells-only for the same reasons — and ships _nothing_ pixel-true on iTerm2.
- **`drawSuperSampleBuffer` samples 2×2 px per cell but has no horizontal bound** — the Zig loop
  runs to the buffer edge (their TODO admits it), painting wrapped garbage past the image. Scissor
  the image's cell rectangle around the call. Found live in `--demo`, pinned by a paint test.
- **Verifying pixels headlessly is a cell-path superpower.** Half-block thumbnails are real cells:
  `tmux capture-pane` and the test renderer's `captureCharFrame`/`captureSpans` see them, so
  paint, scroll, resize and menu overlap were all verified without eyes on a screen.
- **Beeper's `assets.download` returns `srcURL` as a `file://` URL** and the file is an
  **extension-less blob**. The first cost the preview pipeline (reads failed → every block parked
  as a failed placeholder; `os-open.ts` had already learned this); the second broke `open` itself
  (macOS guessed text encoding). Downloads now open as a typed temp copy named from attachment
  metadata.
- **Keyboard input never reaches the app in raw iTerm2** (fine under tmux). Surfaced by the spike,
  reproduced against the real app, pre-existing — all live validation to date had been inside
  tmux. Untangled from this slice; tracked in `STATUS.md` as next.

### 2026-08-04 — `login` guards on `remote_access`, not on locality

- **The gate is `server.remote_access`, not whether the endpoint is localhost.** The plan proposed
  refusing a browser login when the endpoint is local _or_ remote access is off. Shipped narrower:
  refuse iff `remote_access` is off. That flag is what says the advertised OAuth endpoints are
  real — a local endpoint with remote access switched **on** serves a genuine authorization page,
  which is how you would pair a remote client. Refusing on locality alone would block a working
  flow on no evidence. The reported bug (local + access off) is caught either way, and the endpoint
  kind still picks which way out the message points at.
- **A refusal is only useful if it says what to do instead.** The local message names the situation
  and sends the user to `beeptui` (local auth is a token they already have if `doctor` is green);
  the remote one says to turn remote access on. Asserted in tests, so the guidance can't rot into a
  bare error string.

---

### 2026-08-08 — Inline images: the spike said no to protocols, cells said yes

- **The emit-point spike did its job by failing usefully.** OSC 1337 raw-emit inside OpenTUI is
  _possible_ — validated headlessly by capturing the pty byte stream (detached tmux +
  `pipe-pane`) — but each proof surfaced a new fragility: OpenTUI's threaded writer interleaves
  frame bytes mid-escape (3 of 6 emissions torn; clean only with `useThread: false`), erased
  images need heuristics over private renderer APIs, iTerm2 modally prompts on a `File=` without
  `name=`/`size=`, and tmux swallows everything without `allow-passthrough`. Full findings in the
  slice plan; pivot recorded in `DECISIONS.md` 2026-08-07. slk (Go Slack TUI) independently
  landed on cells-only for the same reasons — and ships _nothing_ pixel-true on iTerm2.
- **`drawSuperSampleBuffer` samples 2×2 px per cell but has no horizontal bound** — the Zig loop
  runs to the buffer edge (their TODO admits it), painting wrapped garbage past the image. Scissor
  the image's cell rectangle around the call. Found live in `--demo`, pinned by a paint test.
- **Verifying pixels headlessly is a cell-path superpower.** Half-block thumbnails are real cells:
  `tmux capture-pane` and the test renderer's `captureCharFrame`/`captureSpans` see them, so
  paint, scroll, resize and menu overlap were all verified without eyes on a screen.
- **Beeper's `assets.download` returns `srcURL` as a `file://` URL** and the file is an
  **extension-less blob**. The first cost the preview pipeline (reads failed → every block parked
  as a failed placeholder; `os-open.ts` had already learned this); the second broke `open` itself
  (macOS guessed text encoding). Downloads now open as a typed temp copy named from attachment
  metadata.
- **Keyboard input never reaches the app in raw iTerm2** (fine under tmux). Surfaced by the spike,
  reproduced against the real app, pre-existing — all live validation to date had been inside
  tmux. Untangled from this slice; tracked in `STATUS.md` as next.

### 2026-08-04 — PR #36 swept in two unrelated commits that were parked on local `main`

- **A feature branch inherits whatever is unpushed on the branch it is cut from.** `main` was two
  commits ahead of `origin/main` (the website version-stamp workflow, parked because the `gh` token
  lacks the `workflow` scope). Branching from it put both commits in the PR, and the squash merge
  landed them on `main` under a title that describes neither. Check `git rev-list --count
origin/main..main` before branching, and rebase or stash anything that isn't yours.
- **Pushing over SSH sidesteps the `workflow` OAuth scope.** The parked commit pushed without
  complaint as part of the feature branch — the remote is `git@github.com:…`, and the scope check
  only applies to HTTPS pushes with a `gh` token. The commit had been sitting unpushed for a day
  for no reason.
- **`gh pr merge --delete-branch` moves your working tree.** It checks out the default branch and
  tries to fast-forward it. With a diverged local `main` the pull fails, leaving you on a stale
  `main` — which reads exactly like the merge failed. It hadn't; check the PR state before
  reacting to the local error.

---

### 2026-08-08 — Inline images: the spike said no to protocols, cells said yes

- **The emit-point spike did its job by failing usefully.** OSC 1337 raw-emit inside OpenTUI is
  _possible_ — validated headlessly by capturing the pty byte stream (detached tmux +
  `pipe-pane`) — but each proof surfaced a new fragility: OpenTUI's threaded writer interleaves
  frame bytes mid-escape (3 of 6 emissions torn; clean only with `useThread: false`), erased
  images need heuristics over private renderer APIs, iTerm2 modally prompts on a `File=` without
  `name=`/`size=`, and tmux swallows everything without `allow-passthrough`. Full findings in the
  slice plan; pivot recorded in `DECISIONS.md` 2026-08-07. slk (Go Slack TUI) independently
  landed on cells-only for the same reasons — and ships _nothing_ pixel-true on iTerm2.
- **`drawSuperSampleBuffer` samples 2×2 px per cell but has no horizontal bound** — the Zig loop
  runs to the buffer edge (their TODO admits it), painting wrapped garbage past the image. Scissor
  the image's cell rectangle around the call. Found live in `--demo`, pinned by a paint test.
- **Verifying pixels headlessly is a cell-path superpower.** Half-block thumbnails are real cells:
  `tmux capture-pane` and the test renderer's `captureCharFrame`/`captureSpans` see them, so
  paint, scroll, resize and menu overlap were all verified without eyes on a screen.
- **Beeper's `assets.download` returns `srcURL` as a `file://` URL** and the file is an
  **extension-less blob**. The first cost the preview pipeline (reads failed → every block parked
  as a failed placeholder; `os-open.ts` had already learned this); the second broke `open` itself
  (macOS guessed text encoding). Downloads now open as a typed temp copy named from attachment
  metadata.
- **Keyboard input never reaches the app in raw iTerm2** (fine under tmux). Surfaced by the spike,
  reproduced against the real app, pre-existing — all live validation to date had been inside
  tmux. Untangled from this slice; tracked in `STATUS.md` as next.

### 2026-08-04 — Conversation block layout; the viewport now counts rows, not messages

- **The 2-column drift was structural, not a padding bug.** The caret lived _inside_ the message
  string (`` `${caret} ${line}` ``), so it only existed on the first line — every wrapped or
  `<br>`-broken line after it started at column 0 of the text element. opentui's `<text>` exposes
  `wrapMode` but no hanging indent (`TextBufferRenderable._firstLineOffset` is protected, not a
  prop), so the fix had to be a real layout column: a 2-wide caret box beside a `flexGrow` content
  box. Everything in the content box now starts and wraps at the same column.
- **Variable-height messages break a message-counting viewport, and it was already broken.**
  `visibleMessages` sliced by message count while `capacity` was `height - CHROME_ROWS` in rows;
  the two only agreed because messages were assumed to be one row. Multi-line HTML already
  violated that. Fixed by laying messages out into rows in pure state and slicing rows on both
  sides — see `DECISIONS.md`.
- **`CHROME_ROWS` was wrong by two (9 → 11) and nothing caught it.** With one `<text>` per message
  an over-count clipped invisibly; with fixed-height row boxes it made rows render _on top of each
  other_ (the sender name and body drew into the same terminal row, interleaving as
  `Liveehello`). Two fixes: rows are `height: 1, flexShrink: 0` so an over-tight pane clips instead
  of collapsing, and the bottom hint row is drawn unconditionally (blank when idle) so the chrome
  height is a constant that stays true. `smoke.test.tsx` now pins the constant against a real
  render at three terminal heights.
- **The perf benchmark was measuring nothing relevant.** It never dispatched `viewport/measured`,
  so `measured()` was false and the reducer skipped the layout path entirely. With the viewport set,
  a scrolled-up arrival costs ~2.5ms and a cursor move ~1.5ms at a near-full window.
- **Found while benchmarking, not fixed here:** at a full message window
  (`MAX_MESSAGES_PER_CHAT`), a live arrival evicts the oldest message, so `added` is 0 and the
  `message/received` branch that preserves reading position and raises the new-messages affordance
  never runs. Pre-existing (the guard is unchanged), and orthogonal to this slice.

---

### 2026-08-08 — Inline images: the spike said no to protocols, cells said yes

- **The emit-point spike did its job by failing usefully.** OSC 1337 raw-emit inside OpenTUI is
  _possible_ — validated headlessly by capturing the pty byte stream (detached tmux +
  `pipe-pane`) — but each proof surfaced a new fragility: OpenTUI's threaded writer interleaves
  frame bytes mid-escape (3 of 6 emissions torn; clean only with `useThread: false`), erased
  images need heuristics over private renderer APIs, iTerm2 modally prompts on a `File=` without
  `name=`/`size=`, and tmux swallows everything without `allow-passthrough`. Full findings in the
  slice plan; pivot recorded in `DECISIONS.md` 2026-08-07. slk (Go Slack TUI) independently
  landed on cells-only for the same reasons — and ships _nothing_ pixel-true on iTerm2.
- **`drawSuperSampleBuffer` samples 2×2 px per cell but has no horizontal bound** — the Zig loop
  runs to the buffer edge (their TODO admits it), painting wrapped garbage past the image. Scissor
  the image's cell rectangle around the call. Found live in `--demo`, pinned by a paint test.
- **Verifying pixels headlessly is a cell-path superpower.** Half-block thumbnails are real cells:
  `tmux capture-pane` and the test renderer's `captureCharFrame`/`captureSpans` see them, so
  paint, scroll, resize and menu overlap were all verified without eyes on a screen.
- **Beeper's `assets.download` returns `srcURL` as a `file://` URL** and the file is an
  **extension-less blob**. The first cost the preview pipeline (reads failed → every block parked
  as a failed placeholder; `os-open.ts` had already learned this); the second broke `open` itself
  (macOS guessed text encoding). Downloads now open as a typed temp copy named from attachment
  metadata.
- **Keyboard input never reaches the app in raw iTerm2** (fine under tmux). Surfaced by the spike,
  reproduced against the real app, pre-existing — all live validation to date had been inside
  tmux. Untangled from this slice; tracked in `STATUS.md` as next.

### 2026-08-04 — Version display made release-driven; README now installs-first

- **The website's version string is now stamped by the release workflow**, not hand-edited: a new
  gated `website` job in `release.yml` pushes `src/data/release.json` to the web repo on each `v*`
  tag (mirroring the tap job). Motivation: the site still said "v0.x" at `v0.2.0` — any value a
  human must remember to update will drift. Was blocked on push at time of writing (`gh` token
  lacks the `workflow` scope); it landed on `main` in PR #36 — pushing over SSH sidesteps the scope
  entirely (`LEARNINGS.md`). Remaining setup (`WEB_REPO` variable, `WEB_REPO_TOKEN` secret) in
  `STATUS.md`.
- **README restructured installs-first** (Homebrew default → binary → source) after it was caught
  walking new users through the contributor `bun install` flow; OSS badges added. Both pushed.

---

### 2026-08-03 — Release version stamped from the tag; `v0.2.0` was doc-only

- **The binary version now comes from the git tag, not `package.json`.** `release.yml` writes
  `github.ref_name` (minus `v`) into `package.json` before `bun build --compile`, so a `vX.Y.Z` tag
  always produces a binary that reports `X.Y.Z`. `v0.1.0` shipped `0.0.0` because the version was
  hand-maintained and drifted; the tag is now the single source of truth.
- **`v0.2.0` existed only in docs/`package.json` — never a git tag or GitHub Release.** Commit
  messages said "shipped as v0.2.0" but `git tag` / `gh release list` showed only `v0.1.0`. The
  rename release (`v0.2.0`) is the first real tag since, folding in the never-released UX pass.
- **Bumped `actions/checkout` + `upload/download-artifact` v4 → v5** to clear the Node-20
  deprecation warning on the release run (warning only; wasn't failing).

### 2026-08-03 — Renamed `beeper-tui` → `beeptui` everywhere

- **The name is now a single token, matching the repo.** Package/bin, config dir
  (`~/.config/beeptui/`), state dir (`~/.local/state/beeptui/`), keychain service, endpoint env var
  (`BEEPTUI_ENDPOINT`), OAuth `client_name`, notify prefix, and the Homebrew formula
  (`beeptui.rb`, `class Beeptui`) all dropped the hyphen. Reverses the 2026-07-30 lock
  (`DECISIONS.md`).
- **Hard break, no compat shim** (pre-1.0): the keychain service and config/state dirs changed, so
  existing local installs orphan their token + config — re-run `login` / `doctor`. Scripts using
  `BEEPER_TUI_ENDPOINT` must switch to `BEEPTUI_ENDPOINT`.
- **`sed -i '' ...` silently no-ops when GNU sed is on PATH** (Homebrew): it consumed the `''` as an
  input filename and matched nothing. Used `perl -i -pe` for the cross-platform in-place pass.

### 2026-08-03 — Demo mode = real TUI + a synthetic Gateway

- **`--demo` swaps the `Gateway`, nothing else.** The runtime already talks to an abstract `Gateway`
  (the smoke tests fake it), so `beeptui --demo` just injects `createDemoGateway()` and the whole
  real app runs on fictitious data — no auth, no network. Reads return fixtures; writes resolve as
  no-ops so the optimistic UI behaves.
- **Must skip persistence + the status writer in demo.** Otherwise the synthetic inbox/drafts would
  overwrite the user's real cached UI store, and fake unread counts would rewrite their tmux title.
  Guarded both behind `demo`.
- **Module-load order bit me:** a `let sortSeq = 0` referenced by the message fixtures was declared
  below them → TDZ crash at import. Hoist counters/consts above the data literals that use them
  (function declarations hoist; `let`/`const` don't).
- **Verified live via tmux** (`capture-pane`) — the session's only real end-to-end visual check.
  Confirmed the demo inbox, auto-opened conversation, the Archived rail toggle revealing the hidden
  chat, and the HTML translator's bold/`- `/`1.`/line-breaks all render. `bun run dev --demo` in a
  120x32 tmux window is the repeatable recipe.

### 2026-08-03 — Archived as a rail entry needs a cursor decoupled from scope

- **The archived-per-scope capability already existed** — `matchesFilter` gates on `scope` AND
  `archived`, and `a` is a global toggle, so archived worked at All and per-network before this. The
  ticket was really discoverability. Verified before building (don't rebuild working code).
- **A "toggle" entry in the rail forces a cursor separate from the active scope.** The rail cursor was
  implicitly `filter.scope` (j/k changed scope live). To let the cursor _rest on_ Archived without
  changing scope, added `railCursor` state: `rail/cursorMoved` walks `['all', ...accounts,
'archived']`, live-selects scope entries but leaves scope when on Archived; `scopeSelected`/
  `scopeCycled`/`focus→rail` keep `railCursor` synced to scope so it never starts stale on Archived.
- **Help-overlay overflow bites again (third time — see prior entries).** Longer `RAIL_HELP`
  descriptions wrapped in the ~48-col help column, adding a row that tipped a group past the 24-row
  test terminal, where OpenTUI _overlaps_ sibling boxes rather than clipping — silently garbling the
  `Search chats` row. Keep help descriptions short enough not to wrap (≤~35 chars after the padded
  key display). A wrapped help line reads as "data loss" but is a render collision.

### 2026-08-03 — `system` theme = terminal light/dark via OpenTUI, not raw OSC

- **OpenTUI already OSC-queries the terminal fg/bg for a light/dark `themeMode`** and exposes
  `renderer.themeMode` + `await renderer.waitForThemeMode(timeoutMs)` (`"dark" | "light" | null`). It
  does **not** expose the exact fg/bg RGB (private). So `system` detection uses the light/dark signal
  and picks a curated `SYSTEM_LIGHT`/`SYSTEM_DARK`, rather than cloning the exact palette.
- **Chose OpenTUI's path over hand-rolled raw OSC 10/11 stdin parsing.** Raw parsing would need
  raw-mode stdin reads before `createCliRenderer`, is terminal-specific, can't be validated live in
  this environment, and — worst — a botched teardown could corrupt input for the renderer. Leaning on
  the library's tested detection is the responsible call; exact-colour extraction is a future,
  live-tested experiment.
- **Resolve once, before first paint.** `await renderer.waitForThemeMode(200)` then
  `registry.set('system', systemThemeForMode(mode))` between `createCliRenderer` and the first render,
  mutating the same registry Map the App holds — so initial selection and `t`-cycling both see the
  detected variant with no flash. Wrapped in try/catch → dark fallback; the 200ms is the only cost.

### 2026-08-03 — Theme foundation: semantic tokens + built-ins + custom theme files

- **Theming via a token context, not prop-drilling.** A `Theme` of ~11 semantic tokens lives behind a
  React `ThemeProvider`/`useTheme()`. Context (default = `DEFAULT_THEME`) means components read tokens
  with zero prop threading **and** every existing isolated component test keeps passing unchanged (it
  gets the default). Only `launch.ts` wraps the tree in a provider. Replacing hardcoded hex with tokens
  also unified the active-highlight across all columns for free (they'd drifted: bright cyan in the
  conversation, muted slate elsewhere).
- **OpenTUI supports `borderColor`/`focusedBorderColor` per box** — so the focused column's border is
  just `borderColor={focused ? theme.borderFocused : theme.border}` on each pane. No global focus
  machinery needed.
- **`captureSpans()` is how you test colour.** `captureCharFrame()` is plain text (no styling), so it
  can't verify a theme. `captureSpans()` returns per-span `fg`/`bg` (RGBA) + `attributes`; with
  `rgbToHex()` you can assert the selected row actually paints the theme's `selectionBg`. This is also
  the tool for the upcoming HTML slice (verify bold/italic/underline via `attributes`).
- **Theme files are partial-merge onto the default** (like Dracula's distributed themes — define only
  what differs), validated per-token as hex with a clear message; a custom file may override a built-in
  of the same name. Built-ins + `~/.config/beeptui/themes/*.json` build one name→Theme registry;
  unknown/absent selection degrades to default, never crashes. Network **brand** colours stay
  theme-independent (recognizable markers, still `theme.networkColors`-overridable).

### 2026-08-03 — Conversation cursor navigation + an ENTER action menu + reactions

- **The Conversation is now cursor-driven, not scroll-driven.** Focusing it auto-selects the newest
  message (reducer `focus/changed → conversation`); ↑/↓ move a `›` cursor via `messageSelection/moved`
  (delta widened to `number` so g/G jump to the edges). This replaced arrows-scroll + `v`-to-select,
  per Mitch's UX call — the goal was parity with the Net/Chats rails.
- **Keeping the cursor on screen needs the viewport height, which lives in the view, not the pure
  reducer.** Solved by a `viewport/measured` event: the App measures `conversationCapacity(height,
density)` in a `useEffect` and dispatches it; the reducer then uses the pure `offsetToShowIndex`
  helper to follow the selection. This keeps all scroll math in the reducer (invariant 4) and fully
  unit-testable without a terminal.
- **Live-message behaviour split cleanly by "am I following the bottom?"**: if the cursor is on the
  newest message (pinned), a new message moves the cursor to the new newest (stays pinned); if
  scrolled up (`offset > 0`), it holds position and flags new-below. An earlier attempt keyed the
  "hold" on "cursor not newest" — that mis-fired on short conversations that fit on screen (nothing is
  actually below the fold), so `offset > 0` remains the honest signal. The smoke scenarios that used
  to force a scroll by pressing `k` once (old scroll clamped to `count-1`, not the viewport) now
  render at a short height so a few messages genuinely overflow.
- **Reactions are now writable.** Beeper's SDK exposes `chats.messages.reactions.add(messageID,
{ chatID, reactionKey })` (POST `/v1/chats/{chat}/messages/{msg}/reactions`) and a per-chat
  `reaction` capability on the same −2..2 scale as `reply`. Mapped to `ChatSummary.canReact`; the
  ENTER action menu → limited emoji picker writes via a `sendReaction` runtime helper with an honest
  notice (no optimistic fake — reaction counts are read-only and reconcile on the next update).
- **`conversation-scroll.ts` moved `src/tui/ → src/state/`.** It's pure viewport math and the reducer
  now needs it; importing tui-layer code into the state layer was the only such edge, so relocating
  keeps the dependency direction clean (state never imports tui).

### 2026-08-03 — `login` opens a dead page on a local endpoint; session tidy-up

- **`beeptui login` against a local Desktop opens a dead localhost page.** Root cause: `login`
  runs the remote OAuth flow unconditionally — it opens the advertised `authorization_endpoint` and
  waits on a loopback. On a **local** Desktop (`remote_access: false`) that endpoint isn't a real
  consent page, so you get a static tab and a callback that never arrives. Local auth is a **token**
  (already green in `doctor`), not a browser login. Fix is a preflight guard — refuse with guidance
  before opening a browser (invariant 8, no dead controls): `PLAN-login-guard-local-endpoint.md`.
- **`--version` prints `0.0.0`** — the CLI reads `version` from `package.json`, never bumped. The
  `v0.1.0` Release/formula are correct; only the embedded binary is wrong. Fix + tag-stamping in
  `PLAN-release-hygiene-versioning.md`.
- **Tidy-up:** deleted all merged/orphaned branches (local + remote) — only `main` remains both
  places, plus pruned stale remote-tracking refs. Note: the pre-rewrite branches had **no common
  ancestor** with `main` (the open-source `git filter-repo` rewrote history), so `--merged` couldn't
  detect them and `compare` 404s — they're orphaned refs whose content is on `main`; safe to drop.
  `dist/` (69 MB, gitignored) left for a manual `rm -rf dist` (the tool sandbox blocks `rm -rf`).

### 2026-08-01 — v1 polish pass (density, perf, media-preview, brew) in one branch

- Did all four optional-polish items on `feat/v1-polish` at Mitch's "break the rules, do it all"
  call. **452 tests** (was 429). Kept the non-negotiables: TDD, and honest "degrade visibly" where
  a feature can't be fully realised here.
- **Help overlay overflow, again.** Adding one global binding (`D` density) tipped a help column
  past the 24-row test terminal, and OpenTUI **overlaps** overflowing sibling boxes rather than
  clipping — so `/ Search chats` got overwritten by the other column (looked like data loss; it was
  a render collision). Fix: dropped the inter-group blank line in `HelpOverlay` (cyan titles already
  separate groups), reclaiming a row per group. Lesson: the two-column balancer only helps until
  total rows exceed 2× the terminal height — every added binding eats headroom.
- **Media preview is honestly partial.** Built + tested the pure parts (protocol detection,
  escape-sequence builders for kitty/iTerm2) and surfaced support via `doctor`, but did **not** fake
  in-TUI rendering: emitting image escapes inside the running OpenTUI screen needs framebuffer
  coordination I can't validate headlessly. Marked `[~]` in the backlog, not `[x]`.
- **Perf reality check:** the PRD's 3s/2s budgets are I/O-bound; our reducer/selectors are
  microseconds (8µs/event, 0.2ms to select 5000 chats). So the useful deliverable was a
  regression-tripwire benchmark + `docs/PERF.md`, not an optimisation.
- **Workflow-scope push wall:** pushing this branch failed — GitHub refuses a push that edits
  `.github/workflows/release.yml` unless the token carries the `workflow` scope, which the session's
  HTTPS token lacks. Worked around it by landing `feat/v1-polish-core` (everything _except_ the
  release.yml change) and holding the release.yml commit on `feat/v1-polish` for a workflow-scoped
  push. Lesson: any branch touching a workflow file can't be pushed with the plain gh token.
- **Brew without a tap:** the release job's tap-publish step is guarded on `vars.HOMEBREW_TAP_REPO`
  so it's an honest skipped no-op until the tap repo + token exist — never a failed release. The
  formula renderer is a tested pure function; only a real `v*` tag exercises the workflow.

### 2026-08-01 — Slices 12–14 closed on code; repo public; branch-protection gotcha

- **Verified in code, not docs:** all Slice 12/13/14 source exists and is wired
  (`src/state/capabilities.ts`; `src/beeper/oauth*.ts` + `token-store`/`auth-session`/`secret-file-store`
  - `login`/`logout` in `src/cli/index.ts`; reactions/receipts in `src/tui/message-format.ts`,
    `src/tui/notify.ts`, keymap + `theme.networkColors`; `release.yml` + `bun build --compile`).
    **429 tests pass.** So Slices 0–14 are done on the "code-complete + tests green" bar; only
    production live-runs (Discord/IG/X matrix, real remote `login`) remain — tracked in `TODO.md`,
    not code gaps. Slice 14 closed; its fuzzy remainder parked in `plans/backlog/PLAN-v1-polish-backlog.md`.
- **Branch-protection gotcha:** `main` had a protection object (code-owner review, linear history,
  no force-push) but **no `required_status_checks` block** — so CI was green-but-not-gating; a PR
  could merge with red checks. Re-applied with the three strict contexts
  (`checks (ubuntu-latest)`, `checks (macos-latest)`, `gitleaks`). These + private-vulnerability-reporting
  were 403 while the repo was private on the free plan; both only took once the repo went public.
- **Env note:** this session had no SSH key — `git push` over `git@github.com` fails publickey.
  Workaround: `gh auth setup-git` then push the `https://github.com/...` URL (gh token as credential
  helper). Not a repo issue; just how to unblock a push here.

### 2026-08-01 — Open-source prep audit: what the reviews actually caught

- A **59 MB compiled binary** (`.bun-build` intermediate) had been committed in PR #12 despite a
  gitignore rule for `*.bun-build` — the file was added before the rule could help, and nothing in
  CI flagged repository size. Untracked now; it (plus a private Notion URL) lives on in history, so
  a `git filter-repo` pass before the public flip is the recommendation.
- **The security review's one theme:** everything the server says via `/v1/info` was trusted
  verbatim. Combined with plain `http` being accepted for remote endpoints, a MITM could redirect
  token POSTs (introspection sends the token to whatever `introspection_endpoint` claims). Fixed
  structurally: an https-or-loopback floor at _both_ choke points (config validation and OAuth
  discovery mapping) rather than per-call checks.
- **Two "fake success" honesty bugs**, both in OS side-effects: `openFile` resolved before spawn
  confirmed (missing `xdg-open` still showed "Opened attachment.") and `saveToDownloads` silently
  overwrote an existing file with a **sender-controlled filename** (`Setup.dmg` attack). Fixed with
  spawn-event resolution + `COPYFILE_EXCL` suffix loops. Lesson: injected side-effect seams hid
  these from the (otherwise thorough) runtime tests — the seam itself needs tests too.
- **Reducer bounded-memory gap:** live messages created a window for _every_ chat that received
  traffic (200 × N chats on a big account). Now only the selected chat or already-viewed windows
  buffer; list rows update via `chats/upserted` regardless. And front-eviction now re-flags
  `hasMoreOlder` so a fully-paged chat can't falsely claim "start of conversation" after overflow.
- **Rebind honesty:** `/` `?` `[` `]` were raw-sequence-matched in `app.tsx`, so config rebinds of
  `search`/`help`/`network-cycle` were accepted (help even displayed them) but silently ignored.
  The fix moved raw-sequence fallback _into_ the keymap layer (`resolveKey`) so every binding
  resolves the same way — and `network-cycle` reports which key matched for direction.
- The slice-numbered comments ("Slice 13", "Slice 10 follow-up") read as an internal changelog to
  an outside reader; a repo-wide sweep rewrote them as behavior descriptions. `git grep Slice src/`
  is now clean and worth keeping that way.

### 2026-08-01 — Slices 12 & 13 closed with live tests deferred (accepted risk)

- Mitch chose to **close Slices 12 and 13 on the code** rather than hold them open on live gates he
  can't clear right now (no Discord/IG/X accounts connected; no remote endpoint with `remote_access`
  on). Both were already merged to `main`, green (401 tests, typecheck clean), and — for 13 —
  security-reviewed. The unrun production checks moved to a new root-level **`TODO.md`**.
- **Discipline kept:** the docs mark these **code-complete, live-validation deferred** — not
  "validated." `TODO.md` carries an explicit note against upgrading that wording without actually
  running the checks. Phase 2 is still _not_ declared complete (that waits on the Slice 12 matrix).
  This is invariant 8 (degrade visibly) applied to our own status docs.

### 2026-08-01 — Slice 11 closed: live reply send cleared (manual gate)

- The last open item in Slice 11 was the **live reply send** — invariant 5 forbids the app (or the
  agent) auto-sending a real message to a real person, so this could only ever be a human keystroke.
  Mitch sent real replies from the TUI on a connected network and confirmed it works. Slice 11 is now
  fully done; the manual gate is removed from `STATUS.md`.
- Reconfirmed via read-only `doctor`/`status` at the same time: local endpoint, authenticated, **3
  accounts (Beeper, Facebook, WhatsApp)**, remote access **off** — so Slices 12 (needs Discord/IG/X
  connected) and 13 (needs a remote endpoint) remain genuinely gated on infrastructure, not code.

### 2026-08-01 — `doctor` token scope via OAuth introspection (long-deferred item)

- The "a read-only token looks send-capable" gap (open since Slice 1) is now closed: the OAuth
  **introspection endpoint** (`/oauth/introspect`, RFC 7662) that `/v1/info` advertises works for the
  _in-app_ local token too — a redacted probe returned `{active:true, scope:"read write", exp, …}`. So
  `doctor` POSTs the token to it, splits the space-delimited scopes, and reports send-capability
  ("Scopes: read, write — can read and send" / "read-only; sends will fail"). Injected as
  `ctx.introspect` so doctor never handles the raw token and stays testable; unsupported/errored
  introspection just omits the check (no noise, no hard failure). Live-verified.

### 2026-08-01 — Slice 13 token persistence: `Bun.secrets` dissolved the "hard decision"

- **I over-blocked twice, then found the clean answer.** I'd framed token-storage-write as a fraught
  fork (macOS-keychain FFI vs. an encrypted file that dents invariant 1). First I missed that
  `security -i` reads the secret from **stdin** (argv-free) — verified it round-trips. Then I found
  the real answer: **`Bun.secrets`** (built into Bun ≥1.3.14) is a cross-platform OS-credential-store
  API (`get`/`set`/`delete`) — macOS Keychain, Linux Secret Service, Windows Credential Manager. It's
  in-process (argv-free, invariant 6 ✓), _is_ the platform store (invariant 1 ✓), and zero-dep. Lesson:
  when something feels like an unavoidable security-design fork, check the runtime first — Bun had
  already solved it. Verified with a live set/get/delete round-trip on the Keychain.
- **Persist `{clientId, tokens}`, not just tokens.** Dynamic client registration issues a _new_
  `clientId` per login, and refresh + revoke both require the same client — so the client id must be
  stored alongside the tokens or the session can't be refreshed after restart.
- **Kept it all testable by injecting the backend + clock + `getInfo`.** `token-store.ts` takes a
  `SecretStore` (fake in tests); `auth-session.ts`'s `login`/`logout`/`currentAccessToken`/
  `resolveActiveToken` take an `OAuthHttp` (fetch + injected `nowMs`) and a `getInfo` thunk — so the
  whole lifecycle (incl. refresh-on-expiry persisting the new token) is unit-tested with no keychain,
  no sockets, no real clock. Only `beeptui login`'s browser step needs a human + a live endpoint.
- **Token resolution precedence:** env/legacy keychain first (fast, offline-friendly), then the
  stored OAuth session (which reads `/v1/info` for the OAuth endpoints and refreshes if expired). So
  a `BEEPER_ACCESS_TOKEN` still short-circuits without any network call.

### 2026-08-01 — Slice 14 unblocked features: receipts, notification hooks, standalone binary

- **Read receipts were the same map→format pattern as reactions.** `Message.seen` has three shapes
  (bool | timestamp string | per-user map); `mapSeen` collapses any truthy signal to `isSeen`, and
  `messageLine` shows `✓✓` only on our own (`isSender`) seen messages. Completes the PRD
  reactions/edits/receipts display trio — all read-only, no capability gate (display what's there).
- **Notification hooks stay honest by construction.** `config.notify.command` runs on new inbound
  messages in a chat you're not reading. The pure part (`shouldNotify` + `notificationText`) is
  testable; the payload is app + **network name only** — never sender, chat, or body (invariant 6) —
  and `runNotifier` spawns with an arg array (no shell), best-effort (a missing notifier can't crash
  the TUI). Config validated with explicit errors so a typo never silently disables it.
- **`bun build --compile` just works on macOS arm64.** One command → a 69 MB standalone `dist/beeptui`
  that runs `--help`/`doctor`/TUI with no Bun at runtime, native OpenTUI renderer bundled. This was
  the PRD's flagged compatibility risk (OpenTUI/Bun/Zig on macOS arm64); validated by running the
  built binary's `doctor` (all checks green). `dist/` was already gitignored.
- **Where I stopped, and why.** Config keymap overrides is only ~3 call sites in `app.tsx` but crosses
  the `src/beeper` (config) → `src/tui` (keymap/Command names) layer boundary for validation, plus
  display-string regeneration — real complexity for a nice-to-have. Left it, perf profiling, media
  preview, and brew/releases (gated on #6) for a Slice-14 re-plan rather than grind marginal items.

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
  and the real sender name — so dedup-by-id failed and you saw both `You: …` and `<own-handle>: …`.
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
- Name locked: package/CLI/config is `beeptui`.

### 2026-07-30 — Repo scaffolded docs-first

- Docs protocol modeled on the `psyke` repo (STATUS / JOURNAL / DECISIONS / ROADMAP / plans),
  adapted for a solo local-first tool: no Linear tickets, no worktree guard, no staging environment.
- The PRD mandates Bun + OpenTUI, which overrides the global AGENTS.md "npm only" and "Vitest"
  rules — see `DECISIONS.md` 2026-07-30 and the project `AGENTS.md`.
