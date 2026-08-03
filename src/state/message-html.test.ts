import { describe, expect, test } from 'bun:test'
import {
  decodeEntities,
  hasHtml,
  htmlToPlainText,
  htmlToStyledLines,
} from '@/state/message-html.ts'

/** Flatten styled lines to `string[]` for terse assertions. */
function texts(html: string): string[] {
  return htmlToStyledLines(html).map((l) => l.runs.map((r) => r.text).join(''))
}

describe('decodeEntities', () => {
  test('named, decimal, and hex entities', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39; &#x27;f&#x27;')).toBe(
      `a & b <c> "d" 'e' 'f'`
    )
  })
  test('&nbsp; becomes a space; unknown entities are left alone', () => {
    expect(decodeEntities('a&nbsp;b &frobnicate;')).toBe('a b &frobnicate;')
  })
})

describe('htmlToStyledLines — inline styling', () => {
  test('plain text is one line, one run', () => {
    const lines = htmlToStyledLines('hello world')
    expect(lines).toHaveLength(1)
    expect(lines[0]!.runs).toEqual([{ text: 'hello world' }])
  })

  test('<b>/<strong> → bold, <i>/<em> → italic, <u> → underline', () => {
    expect(htmlToStyledLines('a <b>x</b> <i>y</i> <u>z</u>')[0]!.runs).toEqual([
      { text: 'a ' },
      { text: 'x', bold: true },
      { text: ' ' },
      { text: 'y', italic: true },
      { text: ' ' },
      { text: 'z', underline: true },
    ])
    expect(htmlToStyledLines('<strong>s</strong> <em>e</em>')[0]!.runs).toEqual([
      { text: 's', bold: true },
      { text: ' ' },
      { text: 'e', italic: true },
    ])
  })

  test('nested styles combine', () => {
    expect(htmlToStyledLines('<b><i>hi</i></b>')[0]!.runs).toEqual([
      { text: 'hi', bold: true, italic: true },
    ])
  })

  test('a stray/malformed close tag never leaves styling stuck on', () => {
    expect(htmlToStyledLines('</b>plain')[0]!.runs).toEqual([{ text: 'plain' }])
  })
})

describe('htmlToStyledLines — breaks and lists', () => {
  test('<br> splits lines', () => {
    expect(texts('a<br>b')).toEqual(['a', 'b'])
  })

  test('double <br> collapses to a single blank line between paragraphs', () => {
    expect(texts('a<br><br>b')).toEqual(['a', '', 'b'])
  })

  test('<ul> renders a dash list', () => {
    expect(texts('<ul><li>one</li><li>two</li></ul>')).toEqual(['- one', '- two'])
  })

  test('<ol> renders a numbered list, honouring start=', () => {
    expect(texts('<ol><li>a</li><li>b</li></ol>')).toEqual(['1. a', '2. b'])
    expect(texts('<ol start="2"><li>x</li></ol>')).toEqual(['2. x'])
  })

  test('nested lists indent', () => {
    expect(texts('<ul><li>a<ul><li>b</li></ul></li></ul>')).toEqual(['- a', '  - b'])
  })
})

describe('htmlToStyledLines — stripping unknown markup', () => {
  test('unknown tags are removed but their text kept', () => {
    expect(texts('<div class="x">hi</div><span>there</span>')).toEqual(['hi', 'there'])
  })

  test('a lone < with no > is treated as text', () => {
    expect(texts('2 < 3 is true')).toEqual(['2 < 3 is true'])
  })
})

describe('htmlToPlainText + hasHtml', () => {
  test('flattens styled lines to newline-joined plain text (no tags)', () => {
    expect(htmlToPlainText('a<br><ul><li><b>x</b></li></ul>')).toBe('a\n- x')
  })

  test('hasHtml detects markup / entities, false for plain text', () => {
    expect(hasHtml('hi there')).toBe(false)
    expect(hasHtml('a <b>bold</b>')).toBe(true)
    expect(hasHtml('a &amp; b')).toBe(true)
  })
})

describe('htmlToStyledLines — the real-world example', () => {
  const sample =
    "You're right, and I'm sorry. Honest diagnosis: <br><br><strong>What's wrong right now:</strong>" +
    '<br><br><ol><li><strong>WhatsApp gateway is flapping</strong> — disconnecting every ~60 seconds.</li></ol>' +
    '<br><ol start="2"><li><strong>Exec approvals blocking me</strong> — basic shell commands.</li></ol>' +
    '<br><strong>Quick fixes:</strong><br><ul><li>Re-link WhatsApp</li><li>Switch me to Sonnet</li></ul>'

  test('no angle-bracket tags survive in the output', () => {
    const flat = htmlToPlainText(sample)
    expect(flat).not.toMatch(/<[^>]+>/)
  })

  test('lists become dash/numbered lines and bold is captured', () => {
    const lines = htmlToStyledLines(sample)
    const flat = lines.map((l) => l.runs.map((r) => r.text).join(''))
    expect(flat).toContain('1. WhatsApp gateway is flapping — disconnecting every ~60 seconds.')
    expect(flat).toContain('2. Exec approvals blocking me — basic shell commands.')
    expect(flat).toContain('- Re-link WhatsApp')
    expect(flat).toContain('- Switch me to Sonnet')
    // The "What's wrong right now:" header keeps its bold run.
    const header = lines.find((l) => l.runs.some((r) => r.text.includes("What's wrong")))
    expect(header?.runs.every((r) => r.bold)).toBe(true)
  })
})
