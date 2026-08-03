/**
 * Terminal display width in cells. Pure — the layout code has to predict how
 * many columns a string occupies without a terminal to ask, so that the reducer
 * and the view agree on row counts (see `message-layout.ts`).
 *
 * This is an estimate, not an oracle: no two terminals agree on every exotic
 * grapheme. Where it is unsure it **rounds up**, because the wrapper's failure
 * modes are asymmetric — over-estimating a width wraps a line early (a short
 * line, harmless), under-estimating overflows the box (clipped text, or a
 * second wrap by the renderer that throws the row count off).
 */

/** Grapheme clusters, so a ZWJ sequence / flag / base+mark counts once. */
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** Combining marks, which render into the preceding cell. */
const ZERO_WIDTH_MARK = /^[\p{Mn}\p{Me}]$/u

/** Pictographs; only those from U+1F000 up have default emoji presentation and
 *  so are drawn double-width without a variation selector. */
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u

/** Ranges that East Asian Width classes Wide (W) or Fullwidth (F). */
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f], // Hangul Jamo
  [0x2e80, 0x303e], // CJK radicals, Kangxi, CJK symbols
  [0x3041, 0x33ff], // Kana, Bopomofo, Hangul Compatibility Jamo, CJK compat
  [0x3400, 0x4dbf], // CJK Unified Ideographs Extension A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xa000, 0xa4cf], // Yi
  [0xa960, 0xa97f], // Hangul Jamo Extended-A
  [0xac00, 0xd7a3], // Hangul syllables
  [0xf900, 0xfaff], // CJK compatibility ideographs
  [0xfe10, 0xfe19], // Vertical forms
  [0xfe30, 0xfe6f], // CJK compatibility forms
  [0xff00, 0xff60], // Fullwidth forms
  [0xffe0, 0xffe6], // Fullwidth signs
  [0x17000, 0x187f7], // Tangut
  [0x1b000, 0x1b001], // Kana supplement
  [0x20000, 0x2fffd], // CJK Extension B and beyond
  [0x30000, 0x3fffd],
]

function isWide(cp: number): boolean {
  return WIDE_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)
}

/** Control (C0/C1) and the invisible formatting characters a terminal swallows. */
function isZeroWidth(cp: number): boolean {
  if (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f)) return true // C0 / DEL / C1
  if (cp >= 0x200b && cp <= 0x200f) return true // ZWSP, ZWNJ, ZWJ, marks
  if (cp >= 0xfe00 && cp <= 0xfe0f) return true // variation selectors
  if (cp >= 0x2060 && cp <= 0x2064) return true // word joiner, invisible operators
  return cp === 0xfeff // BOM / zero-width no-break space
}

/** Width of one grapheme cluster: 0, 1 or 2 cells. */
function clusterWidth(cluster: string): number {
  const points = [...cluster]
  const first = points[0]
  if (first === undefined) return 0
  const cp = first.codePointAt(0) ?? 0

  // Emoji presentation is double-width however the cluster got there: an
  // explicit variation selector, a regional-indicator flag pair, or a
  // pictograph that defaults to emoji presentation.
  if (cluster.includes('\uFE0F')) return 2
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff) return 2
  if (cp >= 0x1f000 && PICTOGRAPHIC.test(first)) return 2

  if (isZeroWidth(cp)) return 0
  if (ZERO_WIDTH_MARK.test(first)) return 0
  return isWide(cp) ? 2 : 1
}

/** Cells `text` occupies when printed to a terminal. Never negative. */
export function displayWidth(text: string): number {
  let width = 0
  for (const { segment } of GRAPHEMES.segment(text)) width += clusterWidth(segment)
  return width
}

/** `text` split into grapheme clusters — the smallest unit the wrapper may cut
 *  between without tearing an emoji sequence or orphaning a combining mark. */
export function toGraphemes(text: string): string[] {
  const out: string[] = []
  for (const { segment } of GRAPHEMES.segment(text)) out.push(segment)
  return out
}
