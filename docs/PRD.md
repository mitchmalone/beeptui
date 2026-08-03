# PRD: Beeper terminal chat TUI

> Source of truth for product scope.

**Status:** Accepted — in delivery (see `STATUS.md`)
**Owner:** Mitch Malone
**Product:** Local-first terminal chat client
**Name:** `beeptui`

## Summary

`beeptui` is a fast, keyboard-first terminal interface for the unified inbox already connected to
Beeper. It turns Beeper's Desktop/Server Client API into a proper chat application: browse
conversations across networks, read and search history, receive live updates, compose and send
replies, and move between conversations without leaving the terminal.

Beeper remains the account, network, sync, and encryption boundary. This product is a local client
over that API — not a new bridge, Matrix client, credential store, or messaging service.

## Problem

Beeper's CLI can list chats, read messages, search, and send a message, but it is command-oriented.
A command sequence is useful for scripts and agents; it is miserable for continuous human
conversation. The desktop app solves this visually, but a terminal-first workflow needs the same
unified inbox in a compact, keyboard-driven surface.

Mitch wants one terminal chat home for the conversations that matter, rather than switching among
seven native apps or treating messaging as a pile of shell commands.

## Vision

A Slack-inspired terminal workspace where the left rail is a unified inbox, the center is the active
conversation, and the bottom is a proper compose box.

```
┌ Accounts / chats ───────────┬ Conversation ───────────────────────────────┐
│ ● Unread                    │ Sarah · WhatsApp                             │
│ ● @ada (X DM)               │                                              │
│   #product (Slack)          │ 09:41 Sarah  Are we still on for Friday?     │
│ ● Tom · Telegram            │ 09:42 You    Yep — 10am works.               │
│                             │                                              │
│ [j/k] move · [Enter] open   │ ──────────────────────────────────────────── │
│ [/ ] search · [q] quit      │ Reply…                                  [↵]  │
└─────────────────────────────┴──────────────────────────────────────────────┘
```

The interface should feel immediate, calm, and legible in a normal terminal — not like a browser app
squeezed into ASCII furniture.

## Goals

- Show a single, navigable inbox spanning connected Beeper accounts.
- Read conversation history, with clear author, timestamp, network, reply, and delivery-state
  treatment.
- Receive and render new messages without manually refreshing.
- Compose and send plain-text messages, including replies to a selected message.
- Provide fast fuzzy search for chats and messages.
- Make unread/attention state obvious without noisy notifications.
- Work locally against Beeper Desktop or Beeper Server Client API; no proprietary cloud or new
  network credentials.
- Be usable entirely by keyboard and remain pleasant over SSH/tmux in a capable terminal.

## Non-goals for v1

- Implementing any messaging protocol, bridge, account linking, or encryption scheme.
- Replacing Beeper Desktop's account management, settings, calls, native contact flow, or moderation
  tools.
- A GUI, web app, mobile app, or shared hosted service.
- Full-fidelity rich-media authoring, voice messages, calls, polls, stickers, or GIF picker.
- Reactions beyond read-only display where the API exposes them.
- Perfect feature parity across every network. A network's actual capabilities are dictated by
  Beeper and its upstream provider.

## Primary user and first use case

**Primary user:** a terminal-heavy person with Beeper accounts already connected.

**First use case:** Mitch opens `beeptui` from tmux. The inbox contains X DMs, Telegram, Slack,
Discord, Instagram DMs, WhatsApp, and Signal. He jumps to a conversation, reads recent and older
messages, receives an incoming message live, replies with text, then switches to the next unread
chat without touching the mouse or opening a native messaging app.

The seven named networks are day-one validation targets, not a promise that every network-specific
action exists in v1.

## Product requirements

### Inbox and navigation

- Load recent chats from Beeper and group/filter by all, unread, account, and archive state.
- Each row shows a network marker, chat name, last-message preview/time, and unread indicator when
  exposed by the API.
- Support keyboard navigation, open/back behavior, quick jump, fuzzy chat search, and a command/help
  overlay.
- Preserve the last selected chat and scroll position locally between restarts where safe.
- Degrade visibly when an account, API endpoint, or chat operation is unavailable; never silently
  pretend a send succeeded.

### Conversation reading

- Load recent messages on open and fetch older history on upward scroll or an explicit shortcut.
- Render sender identity, timestamp, text, replies/quotes, edits, and delivery/error states when
  returned by Beeper.
- Render safe, readable placeholders and open/download actions for attachments; do not attempt a
  full media gallery in v1.
- Display the source network on every conversation and avoid implying a cross-network feature exists
  where it does not.
- Use a bounded in-memory cache and page history rather than downloading entire accounts.

### Live updates and unread state

- Subscribe to Beeper's watch/WebSocket capability when available; fall back to bounded refresh only
  when it is not.
- Apply new-message, edit, receipt, and chat-summary events to the inbox and active conversation
  without disrupting typing or scroll position.
- If the active view is scrolled away from the latest message, show a compact "new messages"
  affordance instead of snapping the user to the bottom.
- Keep connection state visible and reconnect with backoff. A temporary disconnect must not crash
  the TUI or lose an in-progress draft.

### Compose and sending

- Provide a multiline compose editor with explicit send and newline shortcuts.
- Send plain text to the active chat; show pending, sent, and failed states based on the API result.
- Reply to the currently selected message.
- Persist an unsent draft locally per chat and restore it after a crash/restart.
- Never send automatically on launch, reconnect, or focus change.

### Search

- Fuzzy search chats locally from loaded metadata.
- Search messages through Beeper, scoped to the active chat when selected; allow a local-history
  fallback where Beeper's endpoint is capped or ignores scope.
- Present result context and navigate directly to the matching conversation/message where the API
  supports focus/deep-link behavior.

### Configuration, privacy, and diagnostics

- Default to a local Beeper Desktop endpoint; support a user-configured remote Server Client
  endpoint using the API's supported OAuth/auth mechanism.
- Store endpoint configuration and tokens using the platform credential store where available;
  never write access tokens into logs or shell history.
- Provide `status`, `doctor`, and verbose-redacted diagnostics for endpoint reachability, auth,
  account availability, and event-stream health.
- Do not make outbound requests except to the configured Beeper API endpoint. No analytics or
  telemetry in v1.

## Technical approach

### Architecture

Build a standalone TypeScript application with Bun and OpenTUI. Use `@opentui/react` for the
component model, a declared keymap layer for explicit keyboard commands (in-repo — see
`DECISIONS.md` 2026-07-30), and OpenTUI's native Zig core for rendering and input. This gives v1 a
high-performance terminal renderer while keeping product iteration in the TypeScript ecosystem.

1. **Beeper client adapter** — typed HTTP client plus WebSocket/watch client for the documented
   Desktop/Server Client API. It owns authentication, pagination, capability detection, and error
   normalization. The TUI calls the API directly; it must not spawn or scrape the `beeper` CLI.
2. **Application state** — normalized accounts, chats, messages, drafts, selection, connection
   state, and optimistic sends. State changes flow through a small event reducer so UI rendering is
   deterministic and testable.
3. **OpenTUI renderer** — React components rendered by `@opentui/react`, with a three-pane
   responsive layout and compact single-pane fallback for narrow terminals. It owns focus, keyboard
   bindings, scrolling, modals, and rendering only.
4. **Local store** — small SQLite database or equivalent for non-authoritative UI state:
   credential-backed endpoint token reference, drafts, cached chat metadata, and last-view state.
   Beeper remains the source of truth for messages.
5. **CLI shell** — Bun/TypeScript commands for `run`, `status`, `doctor`, and configuration;
   structured errors suitable for humans and scripts.

### Data flow

```
Beeper Desktop or Server Client API
        │ HTTP: accounts, chats, history, search, sends
        │ WebSocket/watch: message and chat updates
        ▼
Typed Beeper adapter ──► event reducer ──► local cache/drafts
                              │
                              ▼
                       OpenTUI terminal UI
```

## Constraints and risks

- Beeper Desktop must be running locally for the Desktop API path. Server mode has its own
  availability and authentication requirements.
- OpenTUI has a native Zig core. The build and release pipeline must pin compatible
  OpenTUI/Bun/Zig versions and validate the macOS arm64 distribution before calling the tool
  installable.
- The API surface and capabilities may vary by Beeper version, account type, and connected network.
  Capability detection and clear fallback states are mandatory.
- End-to-end encryption, media, message formatting, edits, receipts, and reactions are
  provider-dependent. The TUI must faithfully expose what Beeper gives it, rather than promise
  universal semantics.
- A terminal UI can safely display sensitive conversation content; it must not leak it through
  debug logs, crash reports, terminal titles, or shell arguments.
- OAuth/token handling deserves a security review before supporting a remote endpoint.
- The Beeper API is the product dependency and possible single point of compatibility failure. Pin
  tested versions and maintain a small fixture-based integration suite.

## Success criteria

- On a healthy local Beeper Desktop setup, the inbox becomes usable within three seconds of launch
  after initial cache warm-up.
- A new inbound message appears in the active conversation and updates its inbox row within two
  seconds of receipt by Beeper.
- A text reply can be composed and sent without leaving the TUI, with an unambiguous
  pending/success/failure result.
- The seven day-one validation networks can each list chats and read messages where Beeper exposes
  them; text sending is validated individually and any unsupported operation is clearly reported.
- An API disconnect preserves the current draft and reconnects without a crash or duplicate send.
- `doctor` identifies the common failures: Beeper not running, endpoint unreachable, authentication
  failure, and no connected accounts.
- No message body, attachment path, or auth token appears in default logs.

## Phased delivery

### Phase 1 — vertical-slice MVP

- Bun/TypeScript + OpenTUI project scaffold, configuration, local Desktop API connection, and
  `doctor`.
- Inbox list, active conversation, paged history, keyboard navigation, and text sending.
- WebSocket/watch integration for live inbound messages and basic reconnect behavior.
- Component and reducer tests using Bun's test runner, plus a terminal smoke-test harness for the
  key inbox/reply flows.
- Local draft persistence and automated tests around state reduction and API fixtures.
- Validate against WhatsApp, Slack, Telegram, and Signal first.

### Phase 2 — multi-network hardening

- Validate and polish Discord, Instagram DMs, and X DMs.
- Account/unread/archive filters, fuzzy chat search, message search, reply composition, network
  capability messaging, attachment placeholders/download/open flow, and stable scroll behavior.

### Phase 3 — quality and power-user features

- Remote Server Client endpoint with secure OAuth/token storage.
- Read-only reactions/edits/receipts where supported; optional reaction actions after API and UX
  validation.
- Theme/config customization, notification hooks, richer media preview integration, performance
  tuning, and packaging/install docs.

## Open questions for PRD approval

- ~~Name~~ — resolved: the name is `beeptui` everywhere (`DECISIONS.md` 2026-08-03, superseding
  2026-07-30).
- Is local Beeper Desktop-only the correct Phase 1 constraint, with Server Client/OAuth deferred to
  Phase 3?
- Should v1 target rich terminals only (Kitty, Ghostty, iTerm2, WezTerm), or commit to a
  conservative compatibility baseline such as macOS Terminal and common SSH terminals?
- What should be the first four validation accounts on Mitch's actual Beeper setup, and which can be
  synthetic/test accounts?
- Should local cached message bodies be opt-in, or should v1 cache metadata/drafts only and re-fetch
  message history each session?
- Is this a private Mitch tool first, or intended as an open-source project from its first public
  commit?

## Acceptance scenarios

1. Launch `beeptui` with Beeper Desktop running. The inbox loads chats from at least two connected
   networks and the status bar reports connected.
2. Select a WhatsApp chat, page upward through history, type a multiline response, and send it. The
   message shows pending then sent/failure without leaving the chat.
3. While viewing a Slack conversation, receive a new message. It renders live; if the view is
   scrolled up, a new-message affordance appears without moving the reading position.
4. Disconnect or quit Beeper Desktop while editing a Telegram draft. The TUI shows disconnected,
   retains the draft, and resumes after Beeper returns without auto-sending it.
5. Search for a known message in a Discord chat. Select a result and land in the correct
   conversation with surrounding context where the API permits.
6. Open a connected account whose API does not permit an operation. The UI names the unavailable
   capability and its source, rather than offering a dead control.
7. Run `beeptui doctor` with Beeper closed. It explains that the local endpoint requires the
   Desktop app to be running and exits non-zero.
