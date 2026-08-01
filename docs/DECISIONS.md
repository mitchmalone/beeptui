# DECISIONS

> Append-only log of decisions made after the PRD was established (or that refine it). `docs/PRD.md`
> holds the standing product/technical direction; this file records dated changes and reasoning so
> choices aren't relitigated. **Newest at the top.** Lightweight ADR format.

---

### 2026-08-01 · https floor for non-loopback endpoints (config + OAuth discovery)

**Decision.** Plain `http` endpoints are **refused unless the host is loopback**
(`localhost` / `127.x` / `::1`) — in `resolveConfig` for the configured endpoint, and in
`mapInfo`/`authorize` for every OAuth endpoint the server advertises via `/v1/info`. Non-http(s)
schemes are refused everywhere (including `openUrl`, so a hostile `authorization_endpoint` can't
reach an arbitrary OS URL handler).

**Why.** The bearer token rides every request and the WS; over cleartext to a remote host it (and
message content) is MITM-readable — and a MITM'd `/v1/info` could then point `introspection_endpoint`
at an attacker collector that receives the token on the next `doctor` run (invariant 7 violation by
proxy). Discovery is the one place the server tells _us_ where to send credentials, so it is
validated at the mapping choke point, not per call site.

**Consequences.** A remote endpoint must be https (the local Desktop default is unaffected). There
is deliberately no opt-out flag; if a legitimate cleartext-remote need ever appears (e.g. an SSH
tunnel that terminates on a non-loopback bind), revisit with an explicit, named escape hatch.

### 2026-08-01 · Token storage — `Bun.secrets` (closes the security review's open item)

**Decision.** OAuth tokens persist via **`Bun.secrets`**, Bun's built-in cross-platform OS
credential store (macOS Keychain, Linux Secret Service / libsecret, Windows Credential Manager).

**Why.** The prior entry left token _write_ open: the `security` CLI leaks the secret in argv
(invariant 6), and a plaintext file isn't the platform store (invariant 1) — an apparent
FFI-vs-encrypted-file fork. `Bun.secrets` (in Bun ≥1.3.14, which we already require) dissolves it:
it's in-process (argv-free ✓), it _is_ the platform credential store on every OS (invariant 1 ✓),
and it's zero-dependency (it's the runtime, so no violation of "no dep the stdlib covers"). Verified
with a live set/get/delete round-trip on the macOS Keychain.

**Consequence.** `token-store.ts` persists `{clientId, tokens}` (the client id is needed for
refresh/revoke) behind an injectable `SecretStore` so the logic is unit-tested without the real
keychain. **Headless-Linux fallback (built 2026-08-01):** where `Bun.secrets` has no keyring to talk
to (no Secret Service daemon), `getDefaultStore` falls back to `secret-file-store.ts` — an
**AES-256-GCM** (Web Crypto, stdlib) encrypted file at `0600`, key in a sibling `0600` keyfile. Weaker
than an OS keychain (home-dir read access exposes both files) but no plaintext, no argv, no config
leak — the honest best available on a box with no keyring. The choice is probed once and cached. No
FFI, no `security` CLI shelling.

### 2026-08-01 · Slice 13 OAuth security review — passed; token-storage write deferred

**Decision.** The remote-endpoint OAuth 2.0 + PKCE code (`src/beeper/oauth.ts`,
`oauth-loopback.ts`) passed an independent security review with **no
high-confidence exploitable findings**. It is cleared to proceed toward remote
use, subject to the two standing gates below.

**What was verified.** PKCE is **S256-only** (no `plain` path); `code_verifier`
and CSRF `state` are 32-byte `crypto.getRandomValues`; `state` is verified before
code exchange (CSRF); the loopback binds **127.0.0.1 only** and serves only
`/callback`; `redirect_uri` is exact-match across registration/authorize/exchange;
no token, refresh token, or verifier is written to logs, errors, terminal titles,
or process argv (invariant 6); `spawn` is always called with an **args array**
(no shell) so browser/file-open has no injection path; `saveToDownloads` applies
`basename()` (no path traversal); no attacker-controlled SSRF (host/protocol).

**One correctness fix (non-security).** `classifyEndpoint` mislabelled IPv6
loopback because `URL.hostname` brackets it (`[::1]`); now bracket-stripped.

**Open gate — token persistence write.** Not implemented. Writing to the macOS
Keychain via `security add-generic-password -w <secret>` exposes the secret in
argv (invariant 6), and a plaintext 0600 file isn't the platform credential store.
An argv-free write mechanism (native keystore binding, or an accepted encrypted
store) must be chosen before the remote flow can persist tokens end-to-end. Until
then the flow returns tokens to the caller but does not save them.

**Open gate — live validation.** The full flow is unvalidatable without a real
remote endpoint (`remote_access` is `false` on the local Desktop). Unit tests
cover it against a fake authorization server.

### 2026-07-31 · tmux unread badge uses `rename-window`, and only ever shows a count

**Decision.** The terminal/tmux unread badge sets the tmux **window name** to
`Beeper [n]` via `tmux rename-window` (plus an OSC 2 terminal-tab title
everywhere), and restores tmux's `automatic-rename` on exit. It emits **only** the
app name and an integer count — never a chat name, sender, or preview. Count is
total unread across non-archived chats.

**Why.** OSC 2 alone doesn't drive the tmux window name under default settings
(modern `automatic-rename` follows `pane_current_command`, not the pane title; the
`ESC k` rename escape needs `allow-rename on`, off by default). `rename-window`
works with zero user config. Restricting the payload to a count keeps it clear of
invariant 6 (no message content in terminal titles) and shoulder-surf-safe.

**Consequence.** Shelling out to `tmux` (not the `beeper` CLI — invariant 2 is
about Beeper, unaffected), best-effort and non-fatal if tmux is absent. It's not a
network call (invariant 7 holds). Configurability / bell / desktop notifications
remain Slice 14.

### 2026-07-31 · The network rail IS a focus target, and archive is an action (reverses the earlier same-day call)

**Decision.** After live use of the Slice 10 build, reverse two decisions from the entry below:

1. **The rail is a real focus target.** `FocusTarget` gains `'rail'` (ordered outer→inner: rail →
   inbox → conversation → compose). `Esc`/`h`/`←` walks out one level (conversation → list → rail);
   `l`/`→`/`Enter` drills back in; `j`/`k` switch networks while the rail is focused. The `[`/`]`
   quick-keys still work from anywhere.
2. **Archive is an action, not only a view.** `Shift+A` archives/unarchives a chat via
   `chats.archive` — from the list (on the highlighted chat) or an open conversation — **gated on
   `chat.capabilities.archive`**; an unsupported platform shows a named notice and makes no call.
   It's non-optimistic (await → refetch → reconcile; never fake success), then selects the chat that
   takes the archived one's slot and returns focus to the list (cursor stays put for rapid
   archiving).

**Why.** The quick-keys-only rail failed the hand test: a column you can see, you try to step into
with `Esc`/`←`, and nothing happening reads as broken. And Mitch asked for an archive key directly.
The original "view-only" scoping was a deferral, not a principle — the API supports the write and
reports the capability, so doing it properly (capability-gated, visible degrade, no fake success)
honors invariants 1 and 8 rather than violating them.

**Consequence.** Adds a `notice` primitive (`state.notice`, shown in the status bar). The
out-of-scope line in the Slice 10 plan (archive actions deferred) is superseded. Deep-linking in
message search remains partial (Slice 11).

### 2026-07-31 · The network rail is a quick-key filter, not a fourth focus pane; archive is view-only

**Decision.** The `slk`-style leftmost network rail (Slice 10) switches inbox scope via app-wide
quick keys — `[`/`]` cycle All + per-network, `a` toggles archived, `U` toggles unread-only — rather
than being a pane you Tab/arrow into. Archived is a **view filter over Beeper's per-chat archive
state**, composing with the selected scope; the TUI does **not** archive/unarchive. Message search
gets its own opener (`S`), distinct from chat search (`/`).

**Why.** Keeping the rail out of the focus ring preserves the proven `inbox → conversation → compose`
flow (no reflow of existing keymaps/tests) and matches how Slack's workspace switcher actually
behaves (jump keys, not a list you traverse). Archive-as-view honors invariant 1 (Beeper owns state;
we're a client) and the Slice 10 scope line "archiving is Beeper's job; we only filter by its state";
archive/unarchive _actions_ are a separate adapter-write + capability-gating concern, deferred.
Separate openers avoid overloading `Enter`/`/` with mode ambiguity.

**Consequence.** Archive/unarchive actions remain unbuilt (candidate for a later slice). Message
search verifies server scope rather than trusting it, falling back to a labeled local search — so a
scope-ignoring or unavailable endpoint degrades visibly, never returns silently-wrong results.

### 2026-07-30 · Bindings use a thin in-repo keymap, not the `@opentui/keymap` package

**Decision.** Declare keybindings in a small in-repo module (`src/tui/keymap.ts`) — a static data
structure mapping keys → command + human description — and dispatch via `@opentui/react`'s
`useKeyboard`. This deviates from CLAUDE.md/AGENTS.md, which name `@opentui/keymap` as the keymap
layer.

**Why.** `@opentui/keymap@0.4.5` is a full keybinding _runtime_ (activation contexts, dispatch
decisions, multi-key sequences, its own registry/emitter services) and its framework bindings
peer-depend on Solid + `@opentui/solid`. That's heavy machinery for our need: a handful of static,
single-key bindings. The _reason_ the convention exists — "the help overlay is generated from the
same source" — is fully satisfied by a single declarative binding table, which is also trivially
unit-testable. Pulling in the runtime now adds weight and coupling for no benefit.

**Consequences.** `@opentui/keymap` is not a dependency. `src/tui/keymap.ts` is the single source of
bindings; the Slice 8 help overlay is generated from it. If we later need chords, per-mode contexts,
or remapping, revisit adopting `@opentui/keymap` then. Recorded so the CLAUDE.md mention isn't read
as an unmet requirement.

### 2026-07-30 · The Beeper adapter wraps the official `@beeper/desktop-api` SDK

**Decision.** `src/beeper/` builds on the official TypeScript SDK `@beeper/desktop-api` (exact-pinned)
rather than hand-rolling an HTTP client and a from-scratch Zod schema layer for the whole API. The
adapter still owns everything the PRD assigns it — auth/token via Keychain, our normalized
`BeeperError` taxonomy, capability detection, redaction, and our own domain method signatures — but
delegates transport, request/response typing, and cursor pagination to the SDK. Nothing outside
`src/beeper/` imports the SDK (invariant 3 holds).

**Why.** Beeper ships and recommends this SDK; it's the documented "call the API directly" path, not
the `beeper` CLI (invariant 2 holds — the SDK is an HTTP client library). It provides typed models
for the entire surface (accounts/chats/messages/send/info), cursor pagination helpers, and a clean
error hierarchy that maps 1:1 onto our taxonomy. It runs on Bun 1.0+ (smoke-verified under Bun
1.3.14) and pulls **zero transitive dependencies**. Hand-rolling all of that would be strictly more
code to maintain and would drift from the API. The SDK's constructor takes a custom `fetch`, so
fixture-based tests inject synthetic responses with no live Beeper — satisfying the "fixtures over
live calls" rule.

**Consequences.**

- `@beeper/desktop-api@5.0.0` is a runtime dependency, exact-pinned; upgrades are deliberate.
- Slice 1's "typed models" and "HTTP client" steps become "wrap SDK types into our domain models"
  and "normalize SDK errors → `BeeperError`" — the plan is amended accordingly.
- Adapter tests inject a fake `fetch` returning synthetic fixtures; error-class mapping is unit
  tested against the SDK's `APIConnectionError`/`AuthenticationError`/`RateLimitError`/etc.
- Capability detection reads `client.info.retrieve()` (GET /v1/info).
- Live updates (Slice 6) use the SDK/WebSocket `ws://…/v1/ws`; reactions/edits/assets (Slice 11)
  and OAuth remote access (Slice 13) are already covered by the same SDK surface.

### 2026-07-30 · Pin TypeScript to the 6.x line (not 7.x) for toolchain compatibility

**Decision.** Pin `typescript@6.0.3`, not the newer `7.0.2`. TypeScript 7.0 is the native (Go)
compiler rewrite; `typescript-eslint` does not yet support it (tracking:
typescript-eslint#10940), so under TS 7 `bun run lint` hard-fails with "typescript-eslint does not
support TS 7.0". TS 6 is the last JS-based compiler and is fully supported by the lint toolchain.

**Why.** Typecheck and lint must run on the same compiler for a coherent gate. TS 7 buys nothing
for a greenfield scaffold and would cost us all TS-aware linting until the ecosystem catches up.
Pinning is cheap and reversible; this is exactly the "deliberate, tested version pin" the project
`AGENTS.md` calls for.

**Consequences.** `typescript@6.0.3` exact-pinned. When `typescript-eslint` ships TS 7 support,
re-evaluate bumping both together. TS 7 already forced one config change kept for compatibility:
`tsconfig` `baseUrl` is removed in TS 7, so the `@/*` alias uses a relative `paths` mapping
(`./src/*`) that works on both lines. Quirks recorded in `LEARNINGS.md`.

### 2026-07-30 · Package/CLI/config name is `beeper-tui`

**Decision.** The npm package name, CLI binary, and config directory are `beeper-tui` (config at
`~/.config/beeper-tui/`). The git repo stays `beeptui`. Resolves PRD open question #1.

**Why.** `beeper-tui` reads clearly and matches the PRD's working name; the repo shortening to
`beeptui` is cosmetic and doesn't need to propagate into user-facing surfaces. Locking it before
Slice 0 avoids a later rename touching `package.json`, the bin entry, and config paths.

**Consequences.** Slice 0 `package.json` `name`/`bin` use `beeper-tui`. `docs/RUNBOOK.md`'s Slice 1
`status`/`doctor` command examples update from `beeptui` to `beeper-tui`.

### 2026-07-30 · Treat the repo as public from day one

**Decision.** The project may be open-sourced (PRD open question #6). Regardless of when that
decision lands, **every commit must be publishable as-is** — code, docs, plans, journal entries,
test fixtures, snapshots, and commit messages. Concretely:

- Test fixtures and smoke snapshots are **synthetic or fully scrubbed**: invented names, chat
  titles, message bodies, and identifiers. Never commit a captured real API response unscrubbed.
- Validation results (Slices 9/12) are recorded in **redacted form**: network + capability +
  outcome only — no chat names, contact names, message content, or account identifiers.
- `JOURNAL.md` / `LEARNINGS.md` entries describe API shapes and behaviors, never real
  conversation content, contacts, or personal endpoints/hostnames.
- Anything genuinely private (real validation account details, personal notes) lives in `local/`,
  which is gitignored.

**Why.** Git history is permanent: one leaked commit forces a history rewrite or kills
open-sourcing. Enforcing publishability from the first commit costs almost nothing; retrofitting it
costs everything. This also matches the product invariant that the app itself never leaks message
content or tokens — repo and runtime hold the same bar.

**Consequences.** CLAUDE.md gains invariant 9 and the project AGENTS.md a hygiene section; slice
plans referencing fixtures/validation were amended. Reviewing for accidental personal data is part
of every close-out.

### 2026-07-30 · Bun is the runtime, package manager, and test runner (overrides global AGENTS.md)

**Decision.** This project uses **Bun** for everything the global AGENTS.md assigns to npm/Node/
Vitest: dependency management (`bun install`, `bun.lock` committed), script running, the runtime,
and testing (`bun test`).

**Why.** The PRD's technical approach mandates Bun + OpenTUI: OpenTUI's native Zig core and
`@opentui/react` are built and distributed for the Bun runtime, and the PRD names Bun's test runner
for component/reducer tests. Splitting package management (npm) from runtime (Bun) would mean two
lockfile ecosystems and untested install paths for a native-addon dependency. This is exactly the
"specific, justified reason" the global rule allows.

**Consequences.**

- No `package-lock.json`; `bun.lock` is the lockfile. CI installs with `bun install --frozen-lockfile`.
- Tests use `bun:test` (Jest-compatible API), named `*.test.ts(x)` per the global convention.
- Git hooks still use Husky + lint-staged + commitlint per global AGENTS.md — they run fine under
  Bun (`bunx husky`).
- All other global AGENTS.md rules stand: ESM only, strict TS, Prettier config, naming, TDD,
  conventional commits.

### 2026-07-30 · Docs protocol adapted from psyke, simplified for a solo local tool

**Decision.** Adopt psyke's docs system — `STATUS.md` (cursor), `JOURNAL.md` (append-only
learnings), `DECISIONS.md` (this file), `ROADMAP.md` (slices), `plans/` (backlog → active → done,
one plan per slice from `_TEMPLATE.md`) — but drop the parts that only pay off with a team and
deployed environments: Linear tickets, the worktree guard hook, staging branches, and preview
environments. Branches follow the global convention (`feat/…`, `fix/…`).

**Why.** The docs protocol is what makes the repo agent-ready — an agent can orient from STATUS,
pick up a slice plan, and close out without human context transfer. The ceremony psyke layers on top
exists for parallel contributors and cloud infra, which this project doesn't have.

**Consequences.** Plans in `plans/backlog/` are the unit of work handed to agents. Session protocol
lives in `CLAUDE.md`. If parallel agent sessions become the norm, revisit worktree isolation.
