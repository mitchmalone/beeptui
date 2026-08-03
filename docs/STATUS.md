# STATUS

> The cursor: where we are right now. Keep this **terse** — a snapshot, not a history.
> History lives in git, `plans/done/`, and `JOURNAL.md`.
>
> Last updated: 2026-08-04

## Where we are

**Renamed to `beeptui` + released `v0.2.0`** (2026-08-03, PR #35). The app is `beeptui` everywhere
— package/bin, config `~/.config/beeptui/`, state `~/.local/state/beeptui/`, keychain service,
`BEEPTUI_ENDPOINT`, and the Homebrew formula (`beeptui.rb`, `class Beeptui`) — reversing the
2026-07-30 `beeper-tui` lock (`DECISIONS.md`). Breaking, no compat shim (pre-1.0): existing installs
re-run `login`/`doctor`. Same PR fixed **release version stamping** — the binary now embeds the git
tag (v0.1.0 had shipped `0.0.0`) — bumped the release actions off Node-20, and made the tap
self-retire the old formula + refresh its README on release. `v0.2.0` folds in the earlier UX pass,
which had a doc version but was never tagged/released.

**TUI UX pass** — merged to `main` (2026-08-03, PR #33, squash-merged; released as part of `v0.2.0`
above). A batch of interaction/visual work, built and committed feature-by-feature:

- **Theming** — semantic token system behind `ThemeProvider`/`useTheme()`; built-in **default /
  dracula / system** (system adapts to the terminal's light/dark via `waitForThemeMode`) + user themes
  in `~/.config/beeptui/themes/*.json`; `t` cycles live. Tokenizing the chrome unified the
  active-highlight across columns and added focused-column borders.
- **Conversation nav + reactions** — focus auto-selects the newest message, ↑/↓ move a `›` cursor
  (viewport-follow); **⏎ opens a floating action menu** anchored under the cursor; **React** → limited
  emoji picker → adapter `reactions.add` (capability-gated `canReact`, honest notice).
- **Focus indicators** (`●`) in every column title; **context-aware status-bar hints**.
- **Ellipsis** chat-name clipping (no wrap); a dedicated **Archived** toggle in the Net rail (new
  `railCursor` decoupled from scope — works at All + per-network).
- **HTML → terminal formatting** — translate `<b>/<i>/<u>`, `<br>`, `<ul>`/`<ol>`, entities; strip the
  rest (a translator, not a renderer). Applied in the conversation, search snippets, reply preview.
- **Demo mode** — `beeptui --demo` runs the real TUI on a synthetic gateway (no Beeper/auth/net),
  fictitious multi-network data. **Verified live in tmux.**

Version bumped `0.0.0 → 0.2.0` (was stale; `--version` correct now). **539 tests** green; typecheck +
lint clean. Per-slice detail in `JOURNAL.md` + `plans/done/`. **Deferred:** exact-colour `system`
extraction, line-aware HTML menu anchoring, self-driving demo choreography.

**First tagged release — `v0.1.0` (2026-08-02).** Pushed tag `v0.1.0`; the release workflow built
both binaries (darwin-arm64 + linux-x64), published a GitHub Release with `sha256sums.txt`, and
pushed `Formula/beeptui.rb` to `mitchmalone/homebrew-tap` (SHA-256s match). `brew install
mitchmalone/tap/beeptui` resolves. The brew/release polish item is **done** — end-to-end, not
just structural. (The Node-20 action-major warning was cleared in `v0.2.0`.)

**v1 polish pass (`feat/v1-polish`, 2026-08-01).** Knocked out the optional backlog in one branch
(Mitch: "break the rules, do it all"): **layout density** toggle (`D`, seeded from
`config.theme.density`; compact strips pane padding); a **state performance benchmark**
(`src/state/perf.test.ts`) + `docs/PERF.md` — reducer/selectors sit 3–4 orders of magnitude inside
the PRD's 3s/2s budgets; **inline image-preview capability** (`src/tui/media-preview.ts`: kitty /
iTerm2 / WezTerm detection + escape-sequence builders, all tested; `doctor` reports support
honestly — in-TUI rendering deferred, degrades visibly); and **Homebrew packaging**
(`src/packaging/homebrew.ts` formula renderer, tested; README documents it). **452 tests** green;
typecheck + lint clean. **All merged to `main`** (PRs #27 + #28) — including the `release.yml`
change (publishes `sha256sums.txt` + a guarded tap-publish job). Residuals (in-TUI image render,
live render-loop profiling, and the first real tagged release + tap) tracked in the polish backlog.

**Open-source prep pass done (2026-08-01, `chore/open-source-prep`)** — a full security + quality
audit ahead of the public flip (`docs/plans/done/PLAN-open-source-prep.md`). Fixed: an
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

**Slice 12 (remaining networks & capability messaging) — DONE (code-complete, tests green); live matrix tracked in `TODO.md`.** The two
capability-gated actions (reply, archive) now route through one shared `checkCapability` /
`capabilityUnavailableMessage` (`src/state/capabilities.ts`) — honest, source-naming ("Replies not
available for Slack via Beeper"), no ad-hoc strings. Added a burst-stability smoke scenario (12 rapid
inbound while scrolled up keeps reading position). A **redacted live capability probe** on the 3
connected networks confirms the plumbing (reply reported-supported on WhatsApp + Facebook). The full
Discord/Instagram/X matrix is a tracked follow-up in `TODO.md` (accepted risk, Mitch 2026-08-01):
the slice ships on the code + tests; the multi-network live run happens once those networks are
connected.

**Slice 13 (remote endpoint & OAuth) — DONE (code-complete, tests green); live remote login tracked in `TODO.md`.** API
re-investigated: auth is OAuth 2.0 Authorization Code + PKCE with RFC 7591 dynamic registration,
discovered from `/v1/info` (`ServerInfo.oauth`, all six endpoints live-confirmed). `src/beeper/oauth.ts`
implements PKCE (S256) + CSRF state + registration + exchange/refresh/revoke + an `authorize`
orchestrator, unit-tested against a fake auth server; `oauth-loopback.ts` is the real
127.0.0.1 loopback + browser open. **Independent security review passed** (no exploitable findings;
`DECISIONS.md` 2026-08-01). `doctor` distinguishes local vs remote. **Token persistence now built**
(`token-store.ts` + `auth-session.ts`): backed by **`Bun.secrets`** — Bun's cross-platform OS
credential store (Keychain / Secret Service / Credential Manager), in-process (argv-free), zero-dep —
which closes the security review's open item. `beeptui login` / `logout` wire the full lifecycle
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
`bun run build` compiles a standalone `dist/beeptui` (~69 MB Mach-O arm64) that runs
`--help`/`doctor`/TUI with no Bun at runtime — OpenTUI/Bun compat validated on macOS arm64; README
has Install + Configuration docs. **429 tests** green; typecheck + lint + format + security review
clean. **Slice 14 closed** (plan moved to `plans/done/`): the power features + packaging shipped;
the remaining candidates (layout densities, perf profiling vs the PRD timing criteria, richer
Kitty/iTerm2 media preview, brew tap / versioned releases) are optional/fuzzy polish parked in
`docs/plans/backlog/PLAN-v1-polish-backlog.md` — none block v1.

**Phases 1–3 are code-complete and green (429 tests).** Slices 0–14 are done on code + tests. The
only outstanding items are production-only runs that need external accounts/endpoints, tracked in
`TODO.md` — they are unverified in production, not code gaps.

**🎉 Phase 1 complete — Slices 0–9 done (all merged to `main`).**
The MVP is real and live-validated against Beeper Desktop 4.2.1004: browse the inbox, read history
(paged), send real messages (a WhatsApp send received by Mitch), live updates over WebSocket, drafts
that persist restart, `/` fuzzy search, `?` help. **Slice 9** added a golden-path smoke harness
(scenarios 1–4 via the headless renderer, +7 in the CLI test) and ran the redacted live matrix —
launch-to-usable ~29ms (≤3s target), all connected networks (WhatsApp/Facebook/Beeper) list+read with
no silent failures. Fixed pagination resilience along the way. **199 tests** green.

## Next up

All planned slices (0–14) are done, `v0.1.0` is released and installable via Homebrew, and the tree
is tidy (only `main` locally + remote). Two tracks remain:

**Ready-to-work code slices** (in `docs/plans/backlog/`, each a standalone plan — pick one, move to
`active/`, branch, TDD):

- **`PLAN-login-guard-local-endpoint.md`** — `login` refuses on a local / remote-access-off endpoint
  instead of opening a dead browser tab (found 2026-08-03). Small, no hardware needed.
- **`PLAN-inline-image-rendering.md`** — inline image attachments (native protocol first; feasibility
  confirmed, `docs/PERF.md`). `PLAN-v1-polish-backlog.md` indexes these.

**Production-only validation → `TODO.md`** — the Slice 12 multi-network matrix (Discord/IG/X) and the
Slice 13 remote-endpoint `login` need external accounts/endpoints not available here (accepted risk).
Declaring **Phase 2 fully validated in production** waits on the Slice 12 matrix actually running.

> Mitch is running a UX pass next, then working these slices.

**Committed but unpushed — website version stamping** (2026-08-04, commit `681211e` on local
`main`): `release.yml` gains a `website` job that pushes `src/data/release.json` to the web repo on
each `v*` tag (same gated pattern as the tap job), so beeptui.com renders the real version. The
push is blocked because the local `gh` OAuth token lacks the `workflow` scope (see `LEARNINGS.md`).
To land it: `gh auth refresh -h github.com -s workflow`, push `main`, then set repo variable
`WEB_REPO=mitchmalone/beeptui-web` and secret `WEB_REPO_TOKEN` (fine-grained PAT, contents:write on
`beeptui-web`). The web side is already live (`beeptui-web` renders the hero version from
`src/data/release.json`, seeded 0.2.0).

## Deferred live validation (accepted risk, Mitch 2026-08-01) → `TODO.md`

Slices 11–13 closed; these are the **unrun production checks**, not code gaps. Full detail + checklists
live in `TODO.md`.

- ~~**Slice 11 live reply send**~~ — **done 2026-08-01** (real replies sent from the TUI on a
  connected network; the one invariant-5-gated step). Slice 11 fully closed.
- **Slice 13 remote login** — run `beeptui login` against a real remote endpoint with
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

1. ~~Final name~~ — **resolved:** the name is `beeptui` everywhere (`DECISIONS.md` 2026-08-03,
   superseding the 2026-07-30 `beeper-tui` lock).
2. Phase 1 = local Beeper Desktop only? (Assumed **yes** by the slice plans.)
3. Terminal support baseline: rich terminals only vs conservative baseline. (Slice plans assume
   rich terminals — Ghostty/Kitty/iTerm2/WezTerm — first.)
4. First four validation accounts on Mitch's real Beeper setup.
5. Cache policy: metadata/drafts only vs opt-in message-body cache. (Slice 7 assumes
   metadata/drafts only for v1.)
6. Private tool vs open-source from first public commit. **Partially resolved 2026-07-30:** the
   repo is treated as publishable from day one regardless (`DECISIONS.md`); only the
   when/whether-to-flip-public call remains open.
