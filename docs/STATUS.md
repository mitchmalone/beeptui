# STATUS

> The cursor: where we are right now. Keep this **terse** — a snapshot, not a history.
> History lives in git, `plans/done/`, and `JOURNAL.md`.
>
> Last updated: 2026-08-01

## Where we are

**Open-source prep pass done (2026-08-01, `chore/open-source-prep`)** — a full security + quality
audit ahead of the public flip (`docs/plans/active/PLAN-open-source-prep.md`). Fixed: an
accidentally-committed 59 MB build binary (untracked; history rewrite recommended before flipping
public), personal identifiers scrubbed (fixture handle, private Notion URL, PRD mockup), an https
floor for non-loopback endpoints (config + discovered OAuth endpoints), a state-armed OAuth loopback,
control-character sanitization on OAuth error text, collision-safe attachment saves, honest
`openFile` failures, live-buffer bounding + eviction pagination honesty in the reducer, keymap-honest
rebinds for `/` `?` `[` `]`, a windowed search palette, a top-level CLI error handler + `--version`,
the `Store` moved to `src/state/`, and a repo-wide sweep of slice-numbered comments. **429 tests**
green. **Licensed MIT** (Mitch, 2026-08-01). **Decision #6 closed 2026-08-01:** history rewrite done,
repo is **public**, and post-flip hardening applied — branch protection on `main` with required CI
checks (`checks (ubuntu-latest)`, `checks (macos-latest)`, `gitleaks`), no force pushes, code-owner
review; and private vulnerability reporting enabled.

**Slices 10–14 code landed and merged to `main`** (PRs #12–#22). **Slices 11, 12 and 13 are now
closed** — 11 fully (live reply send done 2026-08-01); 12 and 13 as **code-complete with their live
tests deferred to `TODO.md`** (accepted-risk call, Mitch 2026-08-01: no Discord/IG/X accounts and no
remote endpoint available to run them). A `slk`-style **leftmost network rail** scopes the inbox (All + per-network,
unread dots) with archived (`a`) and unread-only (`U`) toggles. Per Mitch's live-use feedback the
rail is now a **real focus target**: `Esc`/`h`/`←` walks out (conversation → list → rail), `j`/`k`
switch networks in the rail, `l`/`→`/`Enter` drill back in — quick-keys still work. **`Shift+A`
archives/unarchives a chat** — from the list (on the highlighted chat) or an open conversation — via
Beeper's endpoint — **optimistic** (instant flip, rolls back + notifies on failure); the list cursor
lands on the neighbouring chat (below, else above) so you can archive several in a row. Network
markers are **colour-tinted** (list, rail, conversation header) for scannability. Compose typing no
longer re-renders the whole tree (panels are `memo`-ised on their exact state slices). **Message
search** (`S`) runs through the adapter with verified scope + labeled local fallback. **Search
endpoint live-validated 2026-07-31** (redacted run, 3 connected networks): the real server honors
chat- and account-scope, caps/paginates, and returns deep-linkable hits — Slice 10 is fully done.

**Slice 11 (replies, edits & attachments) done:** a message-selection cursor (`v`, `j`/`k`, `Esc`,
highlighted row) drives three actions on the selected message — `r` **reply** (compose shows a quoted
header; capability-gated on `canReply`; adapter carries `replyToMessageID`), and `o`/`s` **open/save
attachment** via `assets.download` (OS side-effects injected; no path ever logged). Inbound **edits
render in place** with `(edited)`. Help overlay rebalanced to two row-balanced columns so the new
bindings don't overflow. **315 tests** green; typecheck + lint + format clean; 10 smoke scenarios.
**Live reply send validated 2026-08-01** (Mitch sent real replies from the TUI on a connected
network — the one invariant-5-gated step): **Slice 11 is fully done.**

**Slice 12 (remaining networks & capability messaging) — CLOSED; live matrix deferred to `TODO.md`.** The two
capability-gated actions (reply, archive) now route through one shared `checkCapability` /
`capabilityUnavailableMessage` (`src/state/capabilities.ts`) — honest, source-naming ("Replies not
available for Slack via Beeper"), no ad-hoc strings. Added a burst-stability smoke scenario (12 rapid
inbound while scrolled up keeps reading position). A **redacted live capability probe** on the 3
connected networks confirms the plumbing (reply reported-supported on WhatsApp + Facebook). The full
Discord/Instagram/X matrix — and declaring Phase 2 complete — is **deferred to `TODO.md`** (accepted
risk, Mitch 2026-08-01): the slice is closed on the code, the live run is a tracked follow-up once
those networks are connected.

**Slice 13 (remote endpoint & OAuth) — CLOSED; live remote login deferred to `TODO.md`.** API
re-investigated: auth is OAuth 2.0 Authorization Code + PKCE with RFC 7591 dynamic registration,
discovered from `/v1/info` (`ServerInfo.oauth`, all six endpoints live-confirmed). `src/beeper/oauth.ts`
implements PKCE (S256) + CSRF state + registration + exchange/refresh/revoke + an `authorize`
orchestrator, unit-tested against a fake auth server; `oauth-loopback.ts` is the real
127.0.0.1 loopback + browser open. **Independent security review passed** (no exploitable findings;
`DECISIONS.md` 2026-08-01). `doctor` distinguishes local vs remote. **Token persistence now built**
(`token-store.ts` + `auth-session.ts`): backed by **`Bun.secrets`** — Bun's cross-platform OS
credential store (Keychain / Secret Service / Credential Manager), in-process (argv-free), zero-dep —
which closes the security review's open item. `beeper-tui login` / `logout` wire the full lifecycle
(authorize → persist → refresh-on-expiry → revoke); `launch`/`status`/`doctor` resolve the active
token through it (env/legacy → stored OAuth). Live-verified the Keychain round-trip. **Headless-Linux
fallback** (`secret-file-store.ts`): AES-256-GCM encrypted `0600` file when no keyring is present.
**`doctor` reports token scope** (RFC 7662 introspection — "read, write; can read and send"), and
**named endpoints** (`config.endpoints` `{name: url}`) let the `endpoint` selector be a URL or a name.
**Only unrun item** (now deferred to `TODO.md`, accepted risk): running `login` against a real remote
endpoint (`remote_access:false` locally).

**Slice 14 (polish) — unblocked features landed.** Read-only **reactions** (`👍×2 🎉`, aggregated),
**read receipts** (`✓✓` on own seen messages), **notification hooks** (`config.notify.command` runs a
redacted app+network-only command on new inbound messages, argv-free), and **config-file
customization** — `config.keymap` rebinds any command (validated, help reflects it) and
`config.theme.networkColors` overrides the per-network accent colours (validated hex). **Packaging:**
`bun run build` compiles a standalone `dist/beeper-tui` (~69 MB Mach-O arm64) that runs
`--help`/`doctor`/TUI with no Bun at runtime — OpenTUI/Bun compat validated on macOS arm64; README
has Install + Configuration docs. **366 tests** green; typecheck + lint + format + security review
clean. Remaining Slice 14 (densities, perf profiling, media preview, brew tap/releases) is
fuzzy-scoped profiling, terminal-specific media, or gated on decision #6 (open-source flip →
license + public distribution) — the plan calls for a re-plan/split.

**🎉 Phase 1 complete — Slices 0–9 done (all merged to `main`).**
The MVP is real and live-validated against Beeper Desktop 4.2.1004: browse the inbox, read history
(paged), send real messages (a WhatsApp send received by Mitch), live updates over WebSocket, drafts
that persist restart, `/` fuzzy search, `?` help. **Slice 9** added a golden-path smoke harness
(scenarios 1–4 via the headless renderer, +7 in the CLI test) and ran the redacted live matrix —
launch-to-usable ~29ms (≤3s target), all connected networks (WhatsApp/Facebook/Beeper) list+read with
no silent failures. Fixed pagination resilience along the way. **199 tests** green.

## Next up

- **Slice 14 re-plan** (split into 2–4): reactions/receipts, notification hooks, keymap + colour
  config, and the standalone binary all landed. Remaining candidates: layout densities, perf
  profiling vs the PRD timing criteria, richer media preview (Kitty/iTerm2 image protocols), and
  brew tap / versioned releases (gated on decision #6).
- **Deferred live validation → see `TODO.md`.** Slices 12 and 13 are closed on the code; their live
  runs (Discord/IG/X matrix; remote-endpoint `login`) are tracked there, accepted-risk. Declaring
  **Phase 2 complete** waits on the Slice 12 matrix actually running — the code is done, the
  production run is not, and the docs won't claim otherwise.

## Deferred live validation (accepted risk, Mitch 2026-08-01) → `TODO.md`

Slices 11–13 closed; these are the **unrun production checks**, not code gaps. Full detail + checklists
live in `TODO.md`.

- ~~**Slice 11 live reply send**~~ — **done 2026-08-01** (real replies sent from the TUI on a
  connected network; the one invariant-5-gated step). Slice 11 fully closed.
- **Slice 13 remote login** — run `beeper-tui login` against a real remote endpoint with
  `remote_access` on (browser OAuth + live token exchange). All code built + unit-tested.
- **Slice 12 live matrix** — connect Discord / Instagram DMs / X DMs, then run
  list/read/send/reply/search/attachments per network. Clears the last item before **Phase 2 complete**.

## Deferred / follow-ups

- ~~`doctor` should report token scope~~ — **done 2026-08-01:** `doctor` introspects the token
  (RFC 7662, via the discovered `introspection_endpoint`) and reports its scopes, flagging a
  read-only token so it no longer looks send-capable (live: "Scopes: read, write — can read and send").
- Slice 6 deferrals: polling fallback (this build has the WS), delete-event application, the
  quit-Beeper-mid-draft manual dance, and cross-network send-echo id confirmation — all for Slice 9.
- Slice 7 deferral: scroll-anchor _restore_ into the loaded page (Slice 6/9 territory).
- Open-source-prep follow-ups (2026-08-01): extract the ~265-line modal key router in
  `src/tui/app.tsx` into a pure, unit-testable `routeKey` module; add a refetch path for
  scrollback after live-overflow eviction when the stored older-cursor is stale/null (the reducer
  now re-flags `hasMoreOlder` honestly; reopening the chat reloads cleanly).

## Pending decisions (from PRD "Open questions")

Record outcomes in `DECISIONS.md` when made.

1. ~~Final name~~ — **resolved 2026-07-30:** package/CLI/config is `beeper-tui`, repo stays
   `beeptui` (`DECISIONS.md`).
2. Phase 1 = local Beeper Desktop only? (Assumed **yes** by the slice plans.)
3. Terminal support baseline: rich terminals only vs conservative baseline. (Slice plans assume
   rich terminals — Ghostty/Kitty/iTerm2/WezTerm — first.)
4. First four validation accounts on Mitch's real Beeper setup.
5. Cache policy: metadata/drafts only vs opt-in message-body cache. (Slice 7 assumes
   metadata/drafts only for v1.)
6. Private tool vs open-source from first public commit. **Partially resolved 2026-07-30:** the
   repo is treated as publishable from day one regardless (`DECISIONS.md`); only the
   when/whether-to-flip-public call remains open.
