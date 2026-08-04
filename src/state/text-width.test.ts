import { describe, expect, test } from 'bun:test'
import { displayWidth } from '@/state/text-width.ts'

// Anything invisible or decomposable is spelled with escapes rather than pasted
// as a glyph: the widths under test are exactly what such a character hides.
describe('displayWidth', () => {
  test('one cell per ASCII character', () => {
    expect(displayWidth('')).toBe(0)
    expect(displayWidth('hello')).toBe(5)
    expect(displayWidth('a b')).toBe(3)
  })

  test('two cells for East Asian wide and fullwidth characters', () => {
    expect(displayWidth('日本語')).toBe(6) // CJK
    expect(displayWidth('한글')).toBe(4) // Hangul
    expect(displayWidth('ＡＢ')).toBe(4) // fullwidth AB
    expect(displayWidth('a日b')).toBe(4)
  })

  test('combining marks add no width', () => {
    expect(displayWidth('é')).toBe(1) // e + combining acute
    expect(displayWidth('café')).toBe(4)
    expect(displayWidth('é')).toBe(1) // precomposed e-acute
  })

  test('emoji occupy two cells, including modifiers, ZWJ sequences and flags', () => {
    expect(displayWidth('\u{1F600}')).toBe(2)
    expect(displayWidth('\u{1F44D}\u{1F3FD}')).toBe(2) // thumbs up + skin tone
    expect(displayWidth('\u{1F469}‍\u{1F4BB}')).toBe(2) // ZWJ sequence
    expect(displayWidth('\u{1F1E6}\u{1F1FA}')).toBe(2) // regional-indicator pair
    expect(displayWidth('hi \u{1F600}')).toBe(5)
  })

  test('a variation selector promotes emoji presentation without adding width', () => {
    expect(displayWidth('❤️')).toBe(2) // red heart, emoji presentation
  })

  test('control and zero-width characters take no cells', () => {
    expect(displayWidth('ab')).toBe(2) // BEL
    expect(displayWidth('​')).toBe(0) // zero-width space
    expect(displayWidth('a​b')).toBe(2)
  })

  test('width is additive across glyph boundaries', () => {
    // The wrapper slices text and sums the pieces; that only holds if width is
    // additive where it cuts.
    expect(displayWidth('ab') + displayWidth('日')).toBe(displayWidth('ab日'))
  })
})
