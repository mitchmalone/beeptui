import { describe, expect, test } from 'bun:test'
import {
  buildImageSequence,
  describeImagePreview,
  detectImageProtocol,
  isImageAttachment,
} from '@/tui/media-preview.ts'
import type { AttachmentSummary } from '@/beeper/types.ts'

describe('detectImageProtocol', () => {
  test('detects kitty via TERM and via KITTY_WINDOW_ID', () => {
    expect(detectImageProtocol({ TERM: 'xterm-kitty' })).toBe('kitty')
    expect(detectImageProtocol({ KITTY_WINDOW_ID: '1' })).toBe('kitty')
  })

  test('detects the iTerm2 protocol for iTerm2, WezTerm, and LC_TERMINAL', () => {
    expect(detectImageProtocol({ TERM_PROGRAM: 'iTerm.app' })).toBe('iterm2')
    expect(detectImageProtocol({ TERM_PROGRAM: 'WezTerm' })).toBe('iterm2')
    expect(detectImageProtocol({ LC_TERMINAL: 'iTerm2' })).toBe('iterm2')
  })

  test('returns null for an unsupported terminal', () => {
    expect(
      detectImageProtocol({ TERM: 'xterm-256color', TERM_PROGRAM: 'Apple_Terminal' })
    ).toBeNull()
    expect(detectImageProtocol({})).toBeNull()
  })
})

describe('isImageAttachment', () => {
  const base: AttachmentSummary = { kind: 'file' }
  test('trusts an explicit image kind', () => {
    expect(isImageAttachment({ ...base, kind: 'image' })).toBe(true)
  })
  test('falls back to an image/* MIME type', () => {
    expect(isImageAttachment({ ...base, kind: 'file', mimeType: 'image/png' })).toBe(true)
  })
  test('rejects non-images', () => {
    expect(isImageAttachment({ ...base, kind: 'video' })).toBe(false)
    expect(isImageAttachment({ ...base, kind: 'file', mimeType: 'application/pdf' })).toBe(false)
    expect(isImageAttachment(base)).toBe(false)
  })
})

describe('buildImageSequence', () => {
  test('iterm2 wraps base64 in an OSC 1337 File sequence with size + encoded name', () => {
    const seq = buildImageSequence('iterm2', 'QUJD', { size: 3, name: 'a.png' })
    expect(seq.startsWith('\x1b]1337;File=inline=1;size=3;name=')).toBe(true)
    expect(seq).toContain(`name=${Buffer.from('a.png').toString('base64')}`)
    expect(seq.endsWith(':QUJD\x07')).toBe(true)
  })

  test('iterm2 omits optional params when not provided', () => {
    expect(buildImageSequence('iterm2', 'QUJD')).toBe('\x1b]1337;File=inline=1:QUJD\x07')
  })

  test('kitty emits a single graphics escape for a small payload', () => {
    const seq = buildImageSequence('kitty', 'QUJD')
    expect(seq).toBe('\x1b_Ga=T,f=100,m=0;QUJD\x1b\\')
  })

  test('kitty chunks a large payload with m=1 continuations and a final m=0', () => {
    const big = 'x'.repeat(4096 + 100) // just over one chunk
    const seq = buildImageSequence('kitty', big)
    const escapes = seq.split('\x1b\\').filter((s) => s.length > 0)
    expect(escapes).toHaveLength(2)
    expect(escapes[0]).toContain('a=T,f=100,m=1') // first chunk: control keys + more
    expect(escapes[1]).toContain(';') // continuation
    expect(escapes[1]).toContain('m=0') // final chunk closes the transmission
    expect(escapes[1]).not.toContain('a=T') // control keys only on the first
    // The full base64 payload survives the round-trip through the chunks.
    const payload = escapes.map((e) => e.slice(e.indexOf(';') + 1)).join('')
    expect(payload).toBe(big)
  })

  test('kitty format override is honoured', () => {
    expect(buildImageSequence('kitty', 'QUJD', { kittyFormat: 32 })).toContain('f=32')
  })
})

describe('describeImagePreview', () => {
  test('reports the detected protocol, else an honest fallback', () => {
    expect(describeImagePreview({ TERM: 'xterm-kitty' })).toMatch(/kitty/)
    expect(describeImagePreview({ TERM_PROGRAM: 'iTerm.app' })).toMatch(/iTerm2/)
    expect(describeImagePreview({})).toMatch(/Not detected/)
  })
})
