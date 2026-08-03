---
title: HTML message translation (not rendering)
status: done
created: 2026-08-03
updated: 2026-08-03
links:
  - src/state/message-html.ts
  - src/tui/components/MessageView.tsx
---

# HTML message translation

## Goal

Some networks put a small HTML subset in message bodies. Don't render HTML — **translate** it to
terminal-native formatting so the user never sees the tags: `<b>/<strong>`→bold, `<i>/<em>`→italic,
`<u>`→underline, `<br>/<p>`→line break, `<ul>`→`- ` list, `<ol>`→`1.` list (honours `start`), decode
entities, strip everything else. (Mitch's correction: it's a translator, not an HTML renderer.)

## Approach

- **`src/state/message-html.ts` (pure):** a tolerant tokenizer → `htmlToStyledLines()` returning
  lines of styled runs (`{text, bold?, italic?, underline?}`), plus `htmlToPlainText()` (flatten for
  plain contexts) and `hasHtml()` (cheap gate). Lives in `src/state/` because a state-layer selector
  (reply preview) also needs it — tui may import state, not the reverse.
- **`MessageView.tsx`:** renders styled lines with nested `<b>/<i>/<u>` modifier elements (they set
  the real attribute bits; a `style` bool on `<span>` does NOT). `fg` on the line cascades to the
  spans. Multi-line block per HTML message; selection highlight spans the block.
- **ConversationView:** `hasHtml(text)` gates the rich path; ordinary messages keep the cheap
  single-line render (byte-identical to before — zero risk to the common case).
- **Plain contexts stripped too:** search snippet (`toHit`) and reply preview
  (`selectReplyContext`) run `htmlToPlainText` so nasties don't leak there either.

## Verified

- Parser unit tests incl. the real-world example (no `<...>` survives; lists → `1.`/`- `; bold kept).
- `MessageView` render test via `captureSpans().attributes`: `<b>`→bold bit, `<i>`→italic bit; no
  tags in the char frame; entities decoded.
- 534 tests green; typecheck + lint clean.

## Out of scope / notes

- The floating action-menu anchor + viewport still count by message (a tall HTML message's dropdown
  can sit a row off — same pre-existing imprecision as wrapped long text). Line-aware anchoring is a
  possible follow-up.
- Links (`<a>`), tables, images, colours: stripped to text for now.
