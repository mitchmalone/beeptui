---
title: inline image rendering in the TUI
status: done
created: 2026-08-03
updated: 2026-08-08
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

**Pivoted 2026-08-07 after the spike** (findings under Steps; decision recorded in
`../../DECISIONS.md`): images render as **cells**, not terminal graphics protocols. Decoded RGBA
goes through OpenTUI's `drawSuperSampleBuffer` into a fixed-height block of image rows. Works in
every terminal including tmux; composes with the row-exact layout by construction; costs two
pure-JS decode deps (PNG, JPEG). The native-protocol path is parked — the spike proved it
workable only atop fragilities nobody should ship first (thread-torn escapes, erase heuristics,
iTerm2's approval modal, tmux passthrough).

Two problems, in order.

**1. Make an image occupy rows in the layout.** Add an image row kind to `message-layout.ts`.
Height is a **fixed block height** — attachment metadata carries no dimensions, so any
aspect-derived height would need the bytes first and force a re-layout (and a scroll lurch) when
they arrive. A constant-height block letterboxed at paint time never re-lays-out, and the reducer
stays trivially predictive. Everything downstream — `visibleRows`, `offsetToShowMessage`, the
caret gutter, the separator — works unchanged because it only ever counts rows.

**2. Paint into those rows.** A conversation-pane renderable draws each visible image block:
decoded RGBA, scaled and letterboxed into the block's cell rectangle via `drawSuperSampleBuffer`
(per-frame, like any other cell content — no reconciler, nothing to erase). Bytes come from
`assets.download` via the adapter, decoded off the render path, cached per attachment with
bounded concurrency. Until decoded — and forever on failure, non-image kinds, or unsupported
formats — the block renders the existing text placeholder centered in row one of the block
(invariant 8; `o`/`s` keep working regardless).

## Steps

- [x] **Spike the emit point** (throwaway, `local/spike-inline-image.ts`): answered — it _can_ be
      made to cooperate, but only with fragilities we decline to ship (below). Re-planned to the
      cell path per `../../DECISIONS.md` 2026-08-07.

  **Spike findings (2026-08-07, `local/spike-inline-image.ts`, headless via detached tmux +
  `pipe-pane` byte capture; visual iTerm2 pass still pending):**
  - **Emit point: a reconciler on `renderer.on('frame')`** writing
    `DECSC · CUP(origin) · OSC 1337 · DECRC` via `process.stdout.write`. In OpenTUI's default
    config (alternate-screen, `externalOutputMode: "passthrough"`) stdout is not intercepted, so
    the write reaches the terminal after the frame's cells. No framebuffer fight.
  - **Survival is real, not hoped-for:** the layout reserves blank rows; OpenTUI's native diff
    never re-addresses cells that didn't change. Verified from the byte stream — during
    ticker-only redraws the diff wrote row 1 only, never the nine image rows.
  - **Scroll:** origin moved → clear `renderer.currentRenderBuffer` (public) → next frame is a
    full cell rewrite, erasing stale image pixels → re-emit at the new origin. Three scroll steps
    produced exactly three emissions at rows 15→14→13→12; zero emissions during idle redraw.
  - **Resize is the trap:** the renderer's own SIGWINCH full repaint erases the image while the
    origin row may be unchanged, so the reconciler must invalidate on `resize` (and any other
    forced-repaint path), not just on origin change.
  - **tmux needs passthrough:** wrap the whole positioned emit in `ESC Ptmux; … ESC \` with ESCs
    doubled, cursor moves _inside_ the wrapper (screen coords, atomic). Requires
    `allow-passthrough on` (Mitch's tmux: off globally, settable per-pane; tmux 3.7b ≥ 3.3 ok).
  - **Height-before-bytes has an answer:** iTerm2 `width=<cells>;height=<cells>` pins the image to
    an exact cell rectangle (`preserveAspectRatio` letterboxes inside it). The layout can commit
    to a fixed row height without the bytes and never re-lay out. Kitty has the equivalent
    (`c=`/`r=`).
  - **The threaded writer races the emit — measured, not theoretical.** With OpenTUI's default
    `useThread: true`, native frame bytes interleave mid-escape: 3 of 6 image emissions torn in
    the captured stream. With `useThread: false`, 7 of 7 intact. There is no public API to enqueue
    raw bytes through the renderer's own writer, so shipping this means running the app with
    `useThread: false` (measure with the frame profiler; consider an upstream OpenTUI ask for a
    raw-output hook).
  - **Visual run on iTerm2 (raw, no tmux):** the image does paint inside the alt screen once
    `name=`/`size=` are declared — an unnamed/zero-byte `File=` triggers iTerm2's _modal_ security
    dialog on every emission. Also surfaced: keyboard input never reached the app in raw iTerm2
    (fine under tmux) — untracked pre-existing bug, investigate separately from this slice.

- [x] Image row kind in `message-layout.ts`: fixed-height block per image attachment (constant
      rows, letterboxed at paint), placeholder text carried on the block's first row; unit tests
      (block height, non-image attachments unaffected, multi-attachment messages, separator).
- [x] Decode: add PNG + JPEG pure-JS decoders (decision in `../../DECISIONS.md`); a
      `decodeImage(bytes, mime) → {rgba, width, height} | null` module, unit-tested against tiny
      synthetic fixtures; unknown formats → null, never a throw.
- [x] Fetch + cache: bytes via `assets.download` through the adapter, decoded off the render
      path, cached per attachment id, bounded concurrent fetches, size guard (oversized →
      placeholder, never a stall).
- [x] Paint: conversation-pane renderable draws visible image blocks with
      `drawSuperSampleBuffer` (scale + letterbox into the block rectangle); placeholder text
      until decoded / on failure / for non-image kinds (invariant 8).
- [x] Verify live in `--demo` **and** against the real family-chat case from the screenshot,
      in tmux and raw iTerm2. (`--demo` in tmux 2026-08-08 — paint, scroll, resize, menu overlap;
      caught the native draw's missing horizontal bound, fixed with a scissor. Real account
      verified by Mitch the same day, in and out of tmux — surfaced the `file://` srcURL and
      extension-less-open fixes. Raw-iTerm2 has its separate known keyboard bug, tracked in
      STATUS.)

## Acceptance criteria

- [x] Image attachments render inline as supersampled-cell thumbnails in any terminal, including
      under tmux, and scroll with the conversation.
- [x] The reducer's row counts match what is drawn — scrolling past images does not drift, and the
      viewport pin test still holds.
- [x] The `o`/`s` open/save behaviour is exactly as it is today (and improved: typed-copy open).
- [x] A failed or slow fetch, an unsupported format, or an oversized image degrades to the text
      placeholder without stalling the UI.
- [x] No path logs attachment bytes or file paths (invariant 6).
- [x] `bun run typecheck` + `bun test` green; pure logic unit-tested.

## Out of scope

- Native graphics protocols: the iTerm2 OSC 1337 reconciler (parked with its spike findings above)
  and kitty Unicode placeholders (the recorded high-fidelity upgrade path for kitty/ghostty/
  WezTerm — see `../../DECISIONS.md` 2026-08-07).
- Video/audio preview. The screenshot shows `[video: … 4.1 MB]`; it stays a placeholder.
- Animated images.
- WebP/HEIC and other beyond-PNG/JPEG formats — placeholder until a format earns its decoder.
- The raw-iTerm2 dead-keyboard bug the spike surfaced — real, pre-existing, separate fix.

## Risks / open questions

- ~~Framebuffer cooperation~~ / ~~row height without bytes~~ / ~~dependency call~~ — all closed by
  the spike + pivot: cells cooperate by construction, block height is fixed (letterbox at paint),
  and the decode-dep exception is recorded in `../../DECISIONS.md` (2026-08-07).
- **Decode cost on the JS thread.** Pure-JS JPEG decode of a phone photo is not free; it must not
  jank the render loop. Decode in a worker or chunked/idle — measure with the frame profiler
  before deciding.
- **Thumbnail legibility.** Supersampled half-blocks at ~8 rows may be too coarse to recognise
  faces. If so, the knob is block height, not architecture — verify against the real family-chat
  case early.
