# TODO — deferred live validation

Tracked follow-ups that are **built, tested, and merged** but whose **live/manual validation has not
been run**. Slices 12 and 13 were closed as _code-complete_ on 2026-08-01 with these tests deferred
by an explicit accepted-risk call (Mitch) so Phase 2/3 wouldn't stay open on infrastructure that
isn't available right now. None of these are code gaps — they are real-world runs that need
accounts/endpoints that don't exist in the current environment.

> Honesty note: until these are ticked, the corresponding capabilities are **unverified in
> production**, not "known good." Do not upgrade the wording in `STATUS.md`/plans to "validated"
> without actually running them.

## Slice 12 — remaining-networks live matrix

- [ ] Connect **Discord**, **Instagram DMs**, and **X DMs** in Beeper Desktop.
- [ ] Run the full validation matrix per network: **list · read · live inbound · send · reply ·
      search · attachments**.
- [ ] Record a redacted results table (no real content/ids) in `PLAN-slice-12` / `STATUS.md` and
      note any Beeper-side flakiness (IG/X bridges historically flakiest — report honestly, don't
      "fix" Beeper).
- [ ] Once green, `STATUS.md` may declare **Phase 2 complete**.

## Slice 13 — remote endpoint OAuth login

- [ ] Stand up / point at a **real remote Server Client endpoint** with `remote_access` enabled
      (or flip remote access on in Beeper settings).
- [ ] Run `beeper-tui login` end-to-end: browser OAuth (Authorization Code + PKCE) → loopback
      capture → live token exchange → token persisted in the OS credential store.
- [ ] Confirm `launch`/`status`/`doctor` resolve the stored remote token; confirm `logout` revokes.
- [ ] Note the first-real-endpoint result in `PLAN-slice-13` / `STATUS.md`.

## Open-source flip — history rewrite first (decided 2026-08-01)

- [x] ~~Run `git filter-repo`~~ — **done 2026-08-01**: dropped the 59 MB `.bun-build` blob and
      replaced the private Notion URL + personal handle across all history; `main` force-pushed
      (`dce00bc` → `95fad87`). Re-clone any other checkouts. Note: GitHub may retain pre-rewrite
      objects via old PR refs until server-side GC — ask GitHub Support to purge if that matters.
- [ ] Then flip the repo public (closes decision #6).

## Slice 11 — per-network reply rendering (minor)

- [ ] Note per-network reply rendering (threaded vs quoted vs unsupported) in `LEARNINGS.md` as
      more networks are exercised. The WhatsApp live send is done (2026-08-01); other networks accrue
      as they're used.
