---
title: inline image rendering in the TUI
status: planned
created: 2026-08-03
updated: 2026-08-04
links:
  - PLAN-v03-release.md # step 7 of the 0.3 ladder
  - ../../PERF.md § Inline image preview — feasibility (spike, 2026-08-02)
  - ../done/PLAN-conversation-message-layout.md # the row model images must fit into
  - src/tui/media-preview.ts
  - PLAN-v1-polish-backlog.md
---

# inline image rendering in the TUI

## Goal

Render image attachments **inline in the conversation flow**, where the terminal supports it,
instead of the text placeholder. Today every image is a line of metadata —
`[image: image-1945363329481508.jpg · 205 KB]` — and a chat that is mostly photos is unreadable
(reported 2026-08-04 with a screenshot; a family chat rendered as fourteen consecutive placeholder
lines).

## Context

- `src/tui/media-preview.ts` already does protocol detection (kitty / iTerm2 / WezTerm),
  image-attachment identification, and escape-sequence building — all unit-tested. `doctor` reports
  support honestly.
- Attachment bytes are already fetchable via `assets.download` (Slice 11).
- Spike findings (`docs/PERF.md`): OpenTUI exposes two viable paths —
  1. `OptimizedBuffer.drawSuperSampleBuffer(x, y, rgbaPtr, …)` — RGBA → supersampled cells; works in
     **any** terminal, but needs **decoded RGBA pixels** (PNG/JPEG decode is not in Bun/stdlib → a
     dependency).
  2. Native protocol (kitty graphics / iTerm2 inline images) via the escapes we already build —
     takes **encoded** bytes (no decode dep) but only renders on capable terminals.

**New since the spike — the conversation is now a row-exact layout.** `state/message-layout.ts`
turns each message into a fixed list of rows and the reducer predicts those row counts to drive
scrolling. An inline image is not free-floating: it occupies a known number of rows that both the
reducer and the view have to agree on, exactly like a wrapped text line. This is the integration
point the original plan predates, and it is probably the bigger half of the work.

## Approach

Two problems, in order.

**1. Make an image occupy rows in the layout.** Add an image row kind to `message-layout.ts` with a
computed height (derived from the image's aspect ratio and the content width, clamped to a sane
maximum so one photo cannot fill the viewport). Everything downstream — `visibleRows`,
`offsetToShowMessage`, the caret gutter, the separator — then works unchanged, because it only ever
counts rows. Height must be computable **without** the bytes, or the reducer stalls: fall back to a
fixed placeholder height until dimensions are known, and re-lay out when they arrive.

**2. Paint into those rows.** Native-protocol path first — no new dependency, and iTerm2 is
detected on Mitch's terminal. Emit the built escape sequence positioned at the image row's origin.
The open question from the spike stands: **where** to emit so it cooperates with OpenTUI's
framebuffer and survives redraws (a custom renderable vs. a positioned raw write per frame). Close
that first, with a throwaway spike, before building anything else.

Keep the placeholder + `o`/`s` as the honest fallback on terminals without protocol support
(invariant 8). The any-terminal `drawSuperSampleBuffer` path stays a follow-up, gated on accepting a
decode dependency.

## Steps

- [ ] **Spike the emit point** (throwaway): get one known image painting inside the running App on
      iTerm2 and confirm it survives scrolling, a resize, and an unrelated redraw. If it cannot be
      made to cooperate, stop and re-plan — everything below depends on it.
- [ ] Decide and record how row height is derived before bytes arrive; add the image row kind to
      `message-layout.ts` with unit tests (height maths, clamping, fallback height).
- [ ] Fetch bytes via `assets.download`, cached per attachment; never block the render loop on a
      transfer, and bound concurrent fetches.
- [ ] Paint at the row origin via `buildImageSequence`; re-paint on scroll/resize.
- [ ] Honest fallback: unsupported terminal, non-image attachment, failed fetch → the current
      placeholder, never a blank gap or a dead control.
- [ ] Size/format guards; a huge image must degrade, not stall.
- [ ] Verify live in `--demo` **and** against the real family-chat case from the screenshot.

## Acceptance criteria

- [ ] On iTerm2/kitty, image attachments render inline in the conversation and scroll with it.
- [ ] The reducer's row counts match what is drawn — scrolling past images does not drift, and the
      viewport pin test still holds.
- [ ] On other terminals, the placeholder + open/save behaviour is exactly as it is today.
- [ ] A failed or slow fetch degrades to the placeholder without stalling the UI.
- [ ] No path logs attachment bytes or file paths (invariant 6).
- [ ] `bun run typecheck` + `bun test` green; pure logic unit-tested.

## Out of scope

- The any-terminal `drawSuperSampleBuffer` path (needs an image-decode dependency) — separate
  decision if/when wanted.
- Video/audio preview. The screenshot shows `[video: … 4.1 MB]`; it stays a placeholder.
- Animated images.

## Risks / open questions

- **This is the riskiest item in the 0.3 ladder** and the one most likely to need re-planning after
  the spike. It is sequenced last for that reason — everything else ships regardless of how it goes.
- **Framebuffer cooperation:** OpenTUI owns the screen; the emit point must not get overwritten on
  redraw. Unknown until the spike closes it.
- **Row height without bytes.** If dimensions are only knowable after download, the layout must
  reserve a provisional height and re-lay out on arrival — which moves content under the user's
  cursor. Decide how to avoid a lurch (e.g. only re-lay out above the viewport, or commit to a fixed
  height per image and letterbox).
- **Dependency call** (only if pursuing the any-terminal path): a decode dep vs. the "no dep a
  Bun/stdlib API covers" rule — record the decision in `../DECISIONS.md`.
