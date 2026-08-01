import type { AttachmentSummary } from '@/beeper/types.ts'

/**
 * Terminal inline-image support. Two protocols cover the common capable
 * terminals: Kitty's graphics protocol and iTerm2's inline-images protocol
 * (also spoken by WezTerm). Everything here is pure — detection from the
 * environment and escape-sequence construction — so it's fully unit-testable.
 *
 * NB: emitting these sequences *inside* the running OpenTUI screen requires
 * coordinating with the native renderer (which owns the framebuffer); that
 * integration is deliberately not wired here (see docs/PERF.md /
 * docs/plans/backlog/PLAN-v1-polish-backlog.md). Until it is, attachments
 * degrade visibly to the existing text placeholder + open/save actions
 * (invariant 8) and `doctor` reports honestly whether preview is available.
 */

export type ImageProtocol = 'kitty' | 'iterm2'

/** Detect the terminal's inline-image protocol from the environment, or null
 *  when none is recognised. Recognises kitty (and terminals that export
 *  `KITTY_WINDOW_ID`), iTerm2, WezTerm, and `LC_TERMINAL=iTerm2`. */
export function detectImageProtocol(env: Record<string, string | undefined>): ImageProtocol | null {
  const term = env.TERM ?? ''
  const termProgram = env.TERM_PROGRAM ?? ''
  if (term.includes('kitty') || env.KITTY_WINDOW_ID !== undefined) return 'kitty'
  if (termProgram === 'iTerm.app' || termProgram === 'WezTerm' || env.LC_TERMINAL === 'iTerm2') {
    return 'iterm2'
  }
  return null
}

/** Is this attachment an image we could preview inline? Trusts an explicit
 *  `image` kind, or an `image/*` MIME type when the kind is coarser. */
export function isImageAttachment(attachment: AttachmentSummary): boolean {
  return attachment.kind === 'image' || (attachment.mimeType?.startsWith('image/') ?? false)
}

export interface ImageSequenceOptions {
  /** Original filename, surfaced to the terminal where the protocol supports it. */
  name?: string
  /** Payload size in bytes, when known (iTerm2 uses it for progress). */
  size?: number
  /** Kitty pixel format: 100 = PNG (default), 24 = RGB, 32 = RGBA. */
  kittyFormat?: 24 | 32 | 100
}

/** Kitty caps each escape's payload at 4096 base64 bytes; larger images are
 *  split across continuation chunks (`m=1` until the final `m=0`). */
const KITTY_CHUNK = 4096

/**
 * Build the terminal escape sequence that renders a base64-encoded image inline
 * for the given protocol. Pure string construction — no I/O, no stdout write —
 * so callers control when/whether it reaches the terminal.
 */
export function buildImageSequence(
  protocol: ImageProtocol,
  base64: string,
  options: ImageSequenceOptions = {}
): string {
  if (protocol === 'iterm2') {
    const params = ['inline=1']
    if (options.size !== undefined) params.push(`size=${options.size}`)
    if (options.name !== undefined) {
      params.push(`name=${Buffer.from(options.name, 'utf8').toString('base64')}`)
    }
    // OSC 1337 File=… : <base64> ST (BEL)
    return `\x1b]1337;File=${params.join(';')}:${base64}\x07`
  }

  // Kitty graphics protocol: a=T (transmit + display), f=<format>. The control
  // keys ride the first chunk; continuation chunks carry only the `m` flag.
  const format = options.kittyFormat ?? 100
  const chunks: string[] = []
  for (let i = 0; i < base64.length; i += KITTY_CHUNK) chunks.push(base64.slice(i, i + KITTY_CHUNK))
  if (chunks.length === 0) chunks.push('')
  return chunks
    .map((chunk, index) => {
      const isLast = index === chunks.length - 1
      const more = isLast ? 0 : 1
      const control = index === 0 ? `a=T,f=${format},m=${more}` : `m=${more}`
      return `\x1b_G${control};${chunk}\x1b\\`
    })
    .join('')
}

/** A one-line, human-readable summary of inline-image support, for `doctor`. */
export function describeImagePreview(env: Record<string, string | undefined>): string {
  const protocol = detectImageProtocol(env)
  if (protocol === 'kitty') return 'Supported — kitty graphics protocol detected.'
  if (protocol === 'iterm2') return 'Supported — iTerm2 inline-images protocol detected.'
  return 'Not detected — attachments show a text placeholder; use o/s to open or save.'
}
