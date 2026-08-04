/**
 * Translate the small HTML subset some networks put in message bodies into
 * terminal-native formatting. This is NOT an HTML renderer — it strips the tags
 * so the user never sees the markup, and maps a handful to formatting:
 *
 *   <b>/<strong> → bold   <i>/<em> → italic   <u> → underline
 *   <br>/<p>     → line break
 *   <ul><li>     → "- item"   <ol><li> → "1. item" (honours `start`)
 *   everything else is stripped (its text kept); HTML entities are decoded.
 *
 * Output is a list of lines, each a list of styled runs — the conversation
 * renders them with real bold/italic/underline; plain contexts (search snippet,
 * reply preview) flatten via `htmlToPlainText`.
 */

export interface StyledRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

export interface StyledLine {
  runs: StyledRun[]
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
}

/** Decode HTML entities: named (`&amp;`), decimal (`&#39;`), hex (`&#x27;`). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const codePoint =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10)
      if (Number.isFinite(codePoint) && codePoint > 0) {
        try {
          return String.fromCodePoint(codePoint)
        } catch {
          return match
        }
      }
      return match
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match
  })
}

interface ParsedTag {
  name: string
  closing: boolean
  attrs: string
}

/** Parse a `<...>` tag body (already without the angle brackets). Lenient about
 *  stray whitespace (`</ li>`, `<ol >`). Returns null for comments / non-tags. */
function parseTag(inner: string): ParsedTag | null {
  const m = /^\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([\s\S]*?)\/?\s*$/.exec(inner)
  if (m === null) return null
  return { closing: m[1] === '/', name: m[2]!.toLowerCase(), attrs: m[3] ?? '' }
}

/** Read `start="N"` (or `start=N`) from an `<ol>`'s attributes, default 1. */
function readOrderedStart(attrs: string): number {
  const m = /start\s*=\s*["']?\s*(\d+)/i.exec(attrs)
  const n = m ? parseInt(m[1]!, 10) : NaN
  return Number.isFinite(n) ? n : 1
}

interface ListCtx {
  ordered: boolean
  next: number
}

export function htmlToStyledLines(input: string): StyledLine[] {
  interface Line {
    marker: string
    runs: StyledRun[]
  }
  const lines: Line[] = []
  let line: Line = { marker: '', runs: [] }
  let bold = 0
  let italic = 0
  let underline = 0
  const lists: ListCtx[] = []

  const breakLine = (marker = ''): void => {
    lines.push(line)
    line = { marker, runs: [] }
  }
  const emitText = (raw: string): void => {
    // Collapse whitespace runs (incl. source newlines) to single spaces, like a
    // browser would; explicit <br>/<li> are what create real breaks.
    const text = decodeEntities(raw).replace(/\s+/g, ' ')
    if (text.length === 0) return
    const run: StyledRun = { text }
    if (bold > 0) run.bold = true
    if (italic > 0) run.italic = true
    if (underline > 0) run.underline = true
    line.runs.push(run)
  }

  let i = 0
  while (i < input.length) {
    const lt = input.indexOf('<', i)
    if (lt === -1) {
      emitText(input.slice(i))
      break
    }
    if (lt > i) emitText(input.slice(i, lt))
    const gt = input.indexOf('>', lt)
    if (gt === -1) {
      // A stray '<' with no closing '>': treat the rest as text.
      emitText(input.slice(lt))
      break
    }
    const tag = parseTag(input.slice(lt + 1, gt))
    i = gt + 1
    if (tag === null) continue
    switch (tag.name) {
      case 'b':
      case 'strong':
        bold += tag.closing ? -1 : 1
        break
      case 'i':
      case 'em':
        italic += tag.closing ? -1 : 1
        break
      case 'u':
        underline += tag.closing ? -1 : 1
        break
      case 'br':
        breakLine()
        break
      case 'p':
      case 'div':
        // Block boundary: start a fresh line (avoid runaway empties later).
        if (line.runs.length > 0 || line.marker.length > 0) breakLine()
        break
      case 'ul':
        if (!tag.closing) lists.push({ ordered: false, next: 1 })
        else lists.pop()
        break
      case 'ol':
        if (!tag.closing) lists.push({ ordered: true, next: readOrderedStart(tag.attrs) })
        else lists.pop()
        break
      case 'li': {
        if (tag.closing) break
        const ctx = lists[lists.length - 1]
        const indent = '  '.repeat(Math.max(0, lists.length - 1))
        const marker = indent + (ctx?.ordered ? `${ctx.next++}. ` : '- ')
        // Reuse an already-empty line (e.g. after a <br> before the list) instead
        // of leaving a blank line before the first item.
        if (line.runs.length === 0 && line.marker.length === 0) line.marker = marker
        else breakLine(marker)
        break
      }
      default:
        break // unknown tag: stripped, its text kept
    }
    // Clamp negatives from malformed close tags.
    if (bold < 0) bold = 0
    if (italic < 0) italic = 0
    if (underline < 0) underline = 0
  }
  lines.push(line)

  // Finalise: trim each line's text edges, drop fully-empty lines at the ends,
  // and collapse runs of blank lines to a single blank.
  const finalized: StyledLine[] = []
  let blanks = 0
  for (const l of lines) {
    const runs = trimRuns(l.runs)
    const isBlank = l.marker.length === 0 && runs.length === 0
    if (isBlank) {
      blanks++
      if (finalized.length === 0) continue // no leading blanks
      if (blanks > 1) continue // collapse consecutive blanks
      finalized.push({ runs: [] })
      continue
    }
    blanks = 0
    finalized.push({ runs: l.marker.length > 0 ? [{ text: l.marker }, ...runs] : runs })
  }
  while (finalized.length > 0 && finalized[finalized.length - 1]!.runs.length === 0) {
    finalized.pop()
  }
  return finalized.length > 0 ? finalized : [{ runs: [] }]
}

/** Trim leading whitespace of the first run and trailing of the last. */
function trimRuns(runs: StyledRun[]): StyledRun[] {
  const out = runs.map((r) => ({ ...r }))
  if (out.length > 0) out[0]!.text = out[0]!.text.replace(/^\s+/, '')
  if (out.length > 0) out[out.length - 1]!.text = out[out.length - 1]!.text.replace(/\s+$/, '')
  return out.filter((r) => r.text.length > 0)
}

/** Flatten to plain text (markers kept, styling dropped, lines joined with \n).
 *  For search snippets, reply previews, and anywhere styling can't be shown. */
export function htmlToPlainText(input: string): string {
  return htmlToStyledLines(input)
    .map((l) => l.runs.map((r) => r.text).join(''))
    .join('\n')
}

/** True when the text contains any of the markup we translate — lets callers
 *  keep the cheap single-line path for ordinary messages. */
/** The tags Matrix permits in formatted bodies — which is what the bridges
 *  behind Beeper emit. Deliberately a list rather than "anything that looks like
 *  a tag": prose containing `<flag>` or `<me@example.com>` must stay prose, and
 *  losing a word to an over-eager matcher is worse than the markup it would
 *  catch. Tags not listed here are still stripped by `htmlToStyledLines` once a
 *  message is on the HTML path — this only decides whether it takes that path. */
const HTML_TAGS =
  'a|b|strong|i|em|u|s|del|br|p|div|span|code|pre|blockquote|ul|ol|li|h[1-6]|img|hr|table|thead|tbody|tr|th|td'

export function hasHtml(text: string): boolean {
  return new RegExp(`</?(${HTML_TAGS})\\b|&(#x?[0-9a-fA-F]+|[a-zA-Z]+);`, 'i').test(text)
}
