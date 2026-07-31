---
title: Slice 14 — Polish, power features & packaging
status: active
created: 2026-07-30
updated: 2026-08-01
links:
  - ../../PRD.md § Phased delivery (Phase 3)
  - PLAN-slice-12-remaining-networks.md
---

# Slice 14 — Polish, power features & packaging

> Phase 3 — coarse outline. **Re-plan (likely split into 2–4 slices) before starting.** Scope also
> depends on pending decisions #1 (name) and #6 (private vs open-source).

## Goal

The v1 quality bar: read-only reactions/receipts where supported, theming/config, notification
hooks, performance tuning, and an installable, documented distribution.

## Context

Everything functional exists after Slice 13. This is the PRD's Phase 3 remainder — the difference
between "works for Mitch's checkout" and "a tool someone installs".

> Being worked incrementally as unblocked items (Mitch: "do the unblocked polish now", 2026-08-01),
> not as one big slice. Naming is resolved (`beeper-tui`); the open-source flip (#6) still gates
> license/README audience but not these features.

## Candidate scope (split when re-planning)

- [x] **Read-only reactions + edits + receipts** where the API exposes them. Reactions
      (`Message.reactions` → aggregated `ReactionSummary`, trailing `👍×2 🎉`); edits (`(edited)`,
      Slice 11); **read receipts** (`Message.seen`, collapsed to `isSeen` across the bool/string/
      per-user shapes → `✓✓` on our own seen messages). Reaction/receipt _actions_ stay out of scope
      (PRD ordering: display first).
- [x] **Notification hooks**: `config.notify.command` runs on each new inbound message in a chat
      you're not reading (`src/tui/notify.ts` — pure decision + redacted args; `runNotifier` spawns
      argv-free). Payload is app + network only, never sender/chat/body (invariant 6). Config schema
      documented in the README; validated with clear errors.
- [ ] **Theme/config customization**: config-file keymap overrides, color themes, densities — schema
      documented; config is validated with clear errors. (Endpoint + notify config landed; keymap
      overrides need `resolveCommand`/`helpGroups` to become config-driven — a wider change.)
- [ ] **Performance tuning**: profile render loop and event application under large inboxes/busy
      channels; hit or beat the PRD timing criteria consistently.
- [ ] **Richer media preview** integration where the terminal supports it (Kitty/iTerm2 image
      protocols) — optional, capability-detected.
- [ ] **Packaging & install docs**: distributable install path (brew tap / `bun` build artifact),
      pinned OpenTUI/Bun/Zig compatibility validated on macOS arm64 per the PRD risk note, README
      install/usage docs, versioned releases.

## Acceptance criteria (draft)

- [ ] A fresh machine installs and runs `beeptui` from the documented path without cloning the
      repo.
- [ ] Reactions/receipts render where supported; absent capabilities remain honestly labeled.
- [ ] PRD success criteria all hold on the tuned build.

## Risks / open questions

- Naming decision blocks public packaging (pending decision #1); open-source decision (#6) gates
  license, repo hygiene, and README audience.
