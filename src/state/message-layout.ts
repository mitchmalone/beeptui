/**
 * Turns messages into the exact rows the conversation pane draws.
 *
 * Wrapping happens here rather than in the renderer because the reducer has to
 * predict how tall a message is — viewport-follow and the scroll window are
 * row-based, and a height it cannot compute without a terminal would put the
 * reducer and the view back out of sync (the bug this module exists to kill).
 *
 * Pure: no I/O, no rendering, testable without a terminal.
 */

import type { AttachmentSummary, MessageKind } from '@/beeper/types.ts'
import type { MessageEntity } from '@/state/types.ts'
import {
  attachmentLabel,
  formatTime,
  isImageAttachment,
  messageStatusMarker,
} from '@/state/message-format.ts'
import {
  hasHtml,
  htmlToStyledLines,
  type StyledLine,
  type StyledRun,
} from '@/state/message-html.ts'
import { displayWidth, toGraphemes } from '@/state/text-width.ts'

/** One drawn row. `header` is always a single row — the view flexes the sender
 *  left and the time right within it, and clips rather than wrapping. */
export type LayoutRow =
  | { kind: 'header'; sender: string; time: string }
  | { kind: 'body'; runs: StyledRun[] }
  | { kind: 'blank' }
  | {
      kind: 'image'
      /** Download id (`assets.download`) — a block only exists when it has one. */
      attachmentId: string
      /** The text placeholder this block replaces — drawn while pixels are
       *  pending and forever when decode/fetch fails (invariant 8). */
      placeholder: string
      /** Which row of the block this is, 0-based, and the block height. */
      slice: number
      of: number
    }

/**
 * Every image block is exactly this many rows. Fixed, not aspect-derived:
 * attachment metadata carries no dimensions, so a true height would need the
 * bytes first and force a re-layout (a scroll lurch) when they arrive. The
 * painter letterboxes the decoded image inside the block instead
 * (DECISIONS 2026-08-07).
 */
export const IMAGE_BLOCK_ROWS = 8

/** The attachments this message renders as inline image blocks: image-kind
 *  with a download id. Everything else stays a text placeholder. */
function imageBlockAttachments(message: MessageEntity): AttachmentSummary[] {
  return (message.attachments ?? []).filter((a) => isImageAttachment(a) && a.id !== undefined)
}

export interface MessageLayout {
  messageId: string
  rows: LayoutRow[]
}

export interface LayoutOptions {
  /** Blank row of relief between messages. Off for compact density. */
  separator?: boolean
}

/** A grapheme carrying the style it inherited, so wrapping can cut anywhere
 *  without losing bold/italic/underline. */
interface Atom {
  g: string
  bold: boolean
  italic: boolean
  underline: boolean
}

function toAtoms(runs: readonly StyledRun[]): Atom[] {
  const atoms: Atom[] = []
  for (const run of runs) {
    for (const g of toGraphemes(run.text)) {
      atoms.push({
        g,
        bold: run.bold === true,
        italic: run.italic === true,
        underline: run.underline === true,
      })
    }
  }
  return atoms
}

/** Re-group styled graphemes into the fewest runs, dropping false flags so the
 *  output matches what `htmlToStyledLines` produces for unstyled text. */
function toRuns(atoms: readonly Atom[]): StyledRun[] {
  const runs: StyledRun[] = []
  let last: Atom | null = null
  for (const atom of atoms) {
    const sameStyle =
      last !== null &&
      last.bold === atom.bold &&
      last.italic === atom.italic &&
      last.underline === atom.underline
    const tail = runs[runs.length - 1]
    if (sameStyle && tail !== undefined) {
      tail.text += atom.g
    } else {
      runs.push({
        text: atom.g,
        ...(atom.bold ? { bold: true } : {}),
        ...(atom.italic ? { italic: true } : {}),
        ...(atom.underline ? { underline: true } : {}),
      })
    }
    last = atom
  }
  return runs
}

function atomsWidth(atoms: readonly Atom[]): number {
  let w = 0
  for (const atom of atoms) w += displayWidth(atom.g)
  return w
}

/**
 * Greedy word wrap over styled graphemes. Breaks at the last space that fits;
 * a word longer than the whole width is cut mid-word rather than overflowing.
 * A non-positive width degenerates to a single unwrapped line — the caller is
 * mid-resize and a loop here would hang the render.
 */
function wrapAtoms(atoms: readonly Atom[], width: number): Atom[][] {
  if (width <= 0 || atoms.length === 0) return [[...atoms]]
  const lines: Atom[][] = []
  let cur: Atom[] = []
  let curWidth = 0

  for (const atom of atoms) {
    const w = displayWidth(atom.g)
    if (curWidth + w > width && cur.length > 0) {
      let breakAt = -1
      for (let i = cur.length - 1; i > 0; i -= 1) {
        if (cur[i]?.g === ' ') {
          breakAt = i
          break
        }
      }
      if (breakAt > 0) {
        lines.push(cur.slice(0, breakAt))
        cur = cur.slice(breakAt + 1) // the space itself is consumed by the break
      } else {
        lines.push(cur)
        cur = []
      }
      curWidth = atomsWidth(cur)
    }
    // A continuation row never starts with the whitespace that pushed it over;
    // leading space on the *first* row is real indentation and is kept.
    if (atom.g === ' ' && cur.length === 0 && lines.length > 0) continue
    cur.push(atom)
    curWidth += w
  }
  if (cur.length > 0) lines.push(cur)
  return lines.length > 0 ? lines : [[]]
}

/** What to call a media message that arrived with no attachment metadata at
 *  all. Beeper's list endpoint returns IMAGE/VIDEO messages carrying neither
 *  text nor an `attachments` array, and rendered from those two alone they came
 *  out as an empty line — the reply marker and read receipt with nothing between
 *  them. Naming the kind is the least we can honestly say (invariant 8). */
const MEDIA_PLACEHOLDER: Partial<Record<MessageKind, string>> = {
  IMAGE: '[image]',
  VIDEO: '[video]',
  VOICE: '[voice message]',
  AUDIO: '[audio]',
  FILE: '[file]',
  STICKER: '[sticker]',
  LOCATION: '[location]',
}

/** Attachment placeholders and the edited marker — the decorations that read as
 *  part of the body. Reactions and delivery status trail further behind. */
function bodyDecorations(message: MessageEntity, hasText: boolean): string {
  const blocks = new Set(imageBlockAttachments(message))
  const labelled = (message.attachments ?? [])
    .filter((a) => !blocks.has(a))
    .map((a) => `[${attachmentLabel(a)}]`)
  // Only a fallback: real attachment metadata, real text, and an image block
  // all win over the bare media-kind label.
  const placeholder =
    labelled.length === 0 && !hasText && blocks.size === 0 && message.kind !== undefined
      ? MEDIA_PLACEHOLDER[message.kind]
      : undefined
  let out = (placeholder !== undefined ? [placeholder] : labelled).join(' ')
  if (message.isEdited === true) out = out.length > 0 ? `${out} (edited)` : '(edited)'
  return out
}

/** The read-only reaction summary (`👍×2 🎉`), or ''. */
function reactionSummary(message: MessageEntity): string {
  return (message.reactions ?? [])
    .map((r) => (r.count > 1 ? `${r.key}×${r.count}` : r.key))
    .join(' ')
}

/** Append text to the last of a run of styled lines, unstyled. */
function appendToLast(lines: StyledLine[], text: string): void {
  if (text.length === 0) return
  const index = Math.max(0, lines.length - 1)
  const last = lines[index] ?? { runs: [] }
  lines[index] = { runs: [...last.runs, { text }] }
}

function isEmpty(lines: readonly StyledLine[]): boolean {
  return lines.every((l) => l.runs.every((r) => r.text.length === 0))
}

/** Append `text` to the last line, separated by a single space — unless there is
 *  nothing to separate from, or the line already ends in one. The reply marker
 *  carries its own trailing space, so a blind join doubles it up. */
function appendPhrase(lines: StyledLine[], text: string): void {
  if (text.length === 0) return
  const last = lines[Math.max(0, lines.length - 1)]?.runs.map((r) => r.text).join('') ?? ''
  const gap = last.length === 0 || last.endsWith(' ') ? '' : ' '
  appendToLast(lines, `${gap}${text}`)
}

/**
 * The message body as styled source lines, before wrapping. The order matters
 * and mirrors what the single-line renderer did: reply marker, text,
 * attachments and edit marker, then the `(no content)` fallback if all of that
 * came to nothing, and only then the reactions (set off by a double space) and
 * the delivery marker.
 */
function sourceLines(message: MessageEntity): StyledLine[] {
  const text = message.text ?? ''
  let lines: StyledLine[] = hasHtml(text)
    ? htmlToStyledLines(text)
    : [{ runs: text.length > 0 ? [{ text }] : [] }]

  // Captured before the reply marker goes on: the marker is not body text, and
  // treating it as such would suppress the media placeholder on exactly the
  // messages that need it — an image sent as a reply.
  const hasText = !isEmpty(lines)

  if (message.replyToId !== undefined) {
    const first = lines[0] ?? { runs: [] }
    lines[0] = { runs: [{ text: '↩ ' }, ...first.runs] }
  }

  appendPhrase(lines, bodyDecorations(message, hasText))
  // An image block is content: a message it fully represents needs no
  // `(no content)` stand-in and no empty body row under the block.
  if (isEmpty(lines) && imageBlockAttachments(message).length === 0) {
    lines = [{ runs: [{ text: '(no content)' }] }]
  }

  const reactions = reactionSummary(message)
  if (reactions.length > 0) {
    // The double space sets reactions off from body text; an empty line (an
    // image-only message whose body is just reactions) has nothing to set
    // them off from.
    const last = lines[Math.max(0, lines.length - 1)]?.runs.map((r) => r.text).join('') ?? ''
    appendToLast(lines, `${last.length === 0 ? '' : '  '}${reactions}`)
  }
  appendToLast(lines, messageStatusMarker(message))

  return lines
}

/**
 * Lay one message out into rows at a given content width — the columns
 * available *inside* the caret gutter, not the pane width.
 */
export function layOutMessage(
  message: MessageEntity,
  width: number,
  options: LayoutOptions = {}
): MessageLayout {
  const sender = message.senderName ?? (message.isSender ? 'You' : message.senderId)
  const rows: LayoutRow[] = [{ kind: 'header', sender, time: formatTime(message.timestamp) }]

  const blocks = imageBlockAttachments(message)
  for (const line of sourceLines(message)) {
    // With a block present, a body line that came to nothing draws nothing —
    // reactions/status still earn their row, but there is no empty line to
    // hold open between the header and the image.
    if (blocks.length > 0 && line.runs.every((r) => r.text.length === 0)) continue
    for (const wrapped of wrapAtoms(toAtoms(line.runs), width)) {
      rows.push({ kind: 'body', runs: toRuns(wrapped) })
    }
  }
  for (const attachment of blocks) {
    const placeholder = `[${attachmentLabel(attachment)}]`
    for (let slice = 0; slice < IMAGE_BLOCK_ROWS; slice += 1) {
      // id is present by construction (imageBlockAttachments filters on it).
      rows.push({
        kind: 'image',
        attachmentId: attachment.id ?? '',
        placeholder,
        slice,
        of: IMAGE_BLOCK_ROWS,
      })
    }
  }
  if (options.separator === true) rows.push({ kind: 'blank' })

  return { messageId: message.id, rows }
}

/** Rows this message occupies. */
export function layoutHeight(layout: MessageLayout): number {
  return layout.rows.length
}

/**
 * Lay out a run of messages, separating them with a blank row. The last message
 * gets no trailing blank — the list is bottom-pinned, and a trailing separator
 * would float it a row off the floor.
 */
export function layOutMessages(
  messages: readonly MessageEntity[],
  width: number,
  options: LayoutOptions = {}
): MessageLayout[] {
  const separator = options.separator !== false
  return messages.map((message, i) =>
    layOutMessage(message, width, { separator: separator && i < messages.length - 1 })
  )
}

/** Total rows a laid-out run occupies. */
export function totalRows(layouts: readonly MessageLayout[]): number {
  let n = 0
  for (const layout of layouts) n += layout.rows.length
  return n
}
