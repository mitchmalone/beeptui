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

import type { MessageEntity } from '@/state/types.ts'
import { attachmentLabel, formatTime, messageStatusMarker } from '@/state/message-format.ts'
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

/** Plain decorations appended after the body: attachments, edited marker,
 *  reactions, delivery status. Unstyled, matching the old single-line render. */
function trailingText(message: MessageEntity): string {
  const parts = (message.attachments ?? []).map((a) => `[${attachmentLabel(a)}]`)
  let out = parts.join(' ')
  if (message.isEdited === true) out = out.length > 0 ? `${out} (edited)` : '(edited)'
  const reactions = (message.reactions ?? [])
    .map((r) => (r.count > 1 ? `${r.key}×${r.count}` : r.key))
    .join(' ')
  if (reactions.length > 0) out = out.length > 0 ? `${out}  ${reactions}` : reactions
  return `${out}${messageStatusMarker(message)}`
}

/** The message body as styled source lines, before wrapping. */
function sourceLines(message: MessageEntity): StyledLine[] {
  const text = message.text ?? ''
  const lines: StyledLine[] = hasHtml(text)
    ? htmlToStyledLines(text)
    : [{ runs: text.length > 0 ? [{ text }] : [] }]

  // A reply marker leads the first line; trailing decorations follow the last.
  if (message.replyToId !== undefined) {
    const first = lines[0] ?? { runs: [] }
    lines[0] = { runs: [{ text: '↩ ' }, ...first.runs] }
  }
  const suffix = trailingText(message)
  if (suffix.length > 0) {
    const lastIndex = Math.max(0, lines.length - 1)
    const last = lines[lastIndex] ?? { runs: [] }
    const joiner = last.runs.length > 0 ? ' ' : ''
    lines[lastIndex] = { runs: [...last.runs, { text: `${joiner}${suffix}` }] }
  }

  const empty = lines.every((l) => l.runs.every((r) => r.text.length === 0))
  return empty ? [{ runs: [{ text: '(no content)' }] }] : lines
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

  for (const line of sourceLines(message)) {
    for (const wrapped of wrapAtoms(toAtoms(line.runs), width)) {
      rows.push({ kind: 'body', runs: toRuns(wrapped) })
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
