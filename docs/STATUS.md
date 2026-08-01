# STATUS

> The cursor: where we are right now. Keep this **terse** — a snapshot, not a history.
> History lives in git, `plans/done/`, and `JOURNAL.md`.
>
> Last updated: 2026-08-01

## Where we are

**Phase 2 done bar live matrix; Phase 3 (13–14) core landed** on
`feat/slice-10-filters-message-search` (staying on the branch Mitch is testing; PR #12 retitled for
Slices 10–13). A `slk`-style **leftmost network rail** scopes the inbox (All + per-network,
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

**Slice 12 (remaining networks & capability messaging) — code done, live matrix blocked.** The two
capability-gated actions (reply, archive) now route through one shared `checkCapability` /
`capabilityUnavailableMessage` (`src/state/capabilities.ts`) — honest, source-naming ("Replies not
available for Slack via Beeper"), no ad-hoc strings. Added a burst-stability smoke scenario (12 rapid
inbound while scrolled up keeps reading position). A **redacted live capability probe** on the 3
connected networks confirms the plumbing (reply reported-supported on WhatsApp + Facebook). The full
Discord/Instagram/X matrix — and declaring Phase 2 complete — is **blocked** on those networks being
connected (manual gate, Mitch).

**Slice 13 (remote endpoint & OAuth) — core + security review done; end-to-end gated.** API
re-investigated: auth is OAuth 2.0 Authorization Code + PKCE with RFC 7591 dynamic registration,
discovered from `/v1/info` (`ServerInfo.oauth`, all six endpoints live-confirmed). `src/beeper/oauth.ts`
implements PKCE (S256) + CSRF state + registration + exchange/refresh/revoke + an `authorize`
orchestrator, unit-tested against a fake auth server; `oauth-loopback.ts` is the real
127.0.0.1 loopback + browser open. **Independent security review passed** (no exploitable findings;
`DECISIONS.md` 2026-08-01). `doctor` distinguishes local vs remote. **Gates:** token _persistence
write_ deferred (invariant-6 argv tension — needs an argv-free keystore mechanism), and end-to-end
needs a real remote endpoint (`remote_access:false` locally).

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
- Clear the manual gates below to fully close Slices 11–13 and declare Phase 2 complete.

## Manual gates (Mitch) — needed to fully close Slices 11–13

- **Slice 13 remote flow:** a real remote Server Client endpoint (`remote_access` on) to validate
  end-to-end auth, and an argv-free token-storage-write mechanism (the security review's open item).

- **Slice 11 live reply send:** send a reply from the TUI on WhatsApp and confirm it lands threaded
  (invariant 5 forbids auto-sending a real message, so this can't be automated). Everything else in
  Slice 11 is done + green; the reply _adapter param_ and _attachment download_ are live-validated.
- **Slice 12 live matrix:** connect Discord / Instagram DMs / X DMs in Beeper Desktop, then run the
  validation matrix (list/read/send/reply/search/attachments) per network. The capability probe on
  the currently-connected networks passed; the other three can't be exercised until connected. Once
  done, `docs/STATUS.md` can declare **Phase 2 complete**.

## Deferred / follow-ups

- `doctor` should report token scope (read-only token looks send-capable). Candidate for Slice 14.
- Slice 6 deferrals: polling fallback (this build has the WS), delete-event application, the
  quit-Beeper-mid-draft manual dance, and cross-network send-echo id confirmation — all for Slice 9.
- Slice 7 deferral: scroll-anchor _restore_ into the loaded page (Slice 6/9 territory).

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
