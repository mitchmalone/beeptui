---
title: inline image rendering in the TUI
status: planned
created: 2026-08-03
updated: 2026-08-03
links:
  - ../../PERF.md § Inline image preview — feasibility (spike, 2026-08-02)
  - src/tui/media-preview.ts
  - PLAN-v1-polish-backlog.md
---

# inline image rendering in the TUI

## Goal

Render image attachments **inline** in the conversation view where the terminal supports it, instead
of the text placeholder. Feasibility is confirmed (spike, `docs/PERF.md`); this is the
implementation slice.

## Context

- `src/tui/media-preview.ts` already does protocol detection (kitty / iTerm2 / WezTerm),
  image-attachment identification, and escape-sequence building — all unit-tested. `doctor` reports
  support honestly.
- Spike findings (`docs/PERF.md`): OpenTUI exposes two viable paths —
  1. `OptimizedBuffer.drawSuperSampleBuffer(x, y, rgbaPtr, …)` — RGBA → supersampled cells; works in
     **any** terminal, but needs **decoded RGBA pixels** (PNG/JPEG decode is not in Bun/stdlib → a
     dependency).
  2. Native protocol (kitty graphics / iTerm2 inline images) via the escapes we already build —
     takes **encoded** bytes (no decode dep) but only renders on capable terminals.
- Attachment bytes are already fetchable via `assets.download` (Slice 11).

## Approach

**Recommended: native-protocol path first** — no new dependency, and Mitch's terminal is iTerm2
(detected). Emit the built escape sequence for the selected image attachment where
`detectImageProtocol` returns non-null; keep the text placeholder + `o`/`s` as the honest fallback
everywhere else (invariant 8). The open question is _where_ to emit it so it cooperates with
OpenTUI's framebuffer (a custom renderable / `FrameBufferRenderable`, or a positioned raw write on
each frame) — resolve that during the slice. The any-terminal `drawSuperSampleBuffer` path is a
follow-up if we later accept a decode dependency.

## Steps

- [ ] Spike the emit point: get a single known image to render inside the running App on iTerm2
      (custom renderable vs. positioned raw write; validate it survives redraws).
- [ ] Add a "preview" action on a selected image attachment (keymap binding via the keymap layer),
      gated on `detectImageProtocol(env) !== null` and `isImageAttachment`.
- [ ] Fetch bytes via `assets.download`; build the escape via `buildImageSequence`; render.
- [ ] Honest fallback: unsupported terminal / non-image → keep the placeholder + open/save; never a
      dead control.
- [ ] Bound the work: size/format guards; never block the render loop on a large decode/transfer.

## Acceptance criteria

- [ ] On iTerm2/kitty, a selected image attachment renders inline; on other terminals it degrades
      visibly to the current placeholder.
- [ ] No path logs the attachment bytes or file path (invariant 6).
- [ ] `bun run typecheck` + `bun test` green; pure logic unit-tested.

## Out of scope

- The any-terminal `drawSuperSampleBuffer` path (needs an image-decode dependency) — separate
  decision if/when wanted.
- Video/audio preview.

## Risks / open questions

- **Framebuffer cooperation:** OpenTUI owns the screen; the emit point must not get overwritten on
  redraw. This is the main unknown to close in the first step.
- **Dependency call** (only if pursuing the any-terminal path): a decode dep vs. the "no dep a
  Bun/stdlib API covers" rule — record the decision in `../DECISIONS.md`.
