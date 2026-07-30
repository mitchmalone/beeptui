/**
 * Pure text-editing logic for the compose box. Kept out of the component (and
 * out of OpenTUI's `<textarea>`, whose internal state is opaque to tests) so
 * every keystroke transition is deterministic and unit-testable.
 *
 * `cursor` is a character index in `[0, text.length]`.
 */

export interface EditorKey {
  name: string
  shift?: boolean
  ctrl?: boolean
  meta?: boolean
  /** Raw character(s) for the key, if any. */
  sequence?: string
}

export type ComposeAction =
  | { type: 'edit'; text: string; cursor: number }
  | { type: 'send' }
  | { type: 'blur' }
  | { type: 'none' }

function insert(text: string, cursor: number, chunk: string): ComposeAction {
  const next = text.slice(0, cursor) + chunk + text.slice(cursor)
  return { type: 'edit', text: next, cursor: cursor + chunk.length }
}

/** The printable character a key produces, or null for non-text keys. */
function printableChar(key: EditorKey): string | null {
  if (key.ctrl === true || key.meta === true) return null
  if (key.name === 'space') return ' '
  const seq = key.sequence
  if (seq !== undefined && seq.length === 1 && seq >= ' ' && seq !== '') return seq
  return null
}

/**
 * Apply a keypress to the editor state. Enter sends; Shift+Enter inserts a
 * newline; Esc/Tab blur; Backspace/arrows/Home/End edit; printable keys insert.
 * Sending is only ever the result of an explicit Enter here (invariant 5).
 */
export function applyComposeKey(text: string, cursor: number, key: EditorKey): ComposeAction {
  const clampedCursor = Math.min(Math.max(0, cursor), text.length)

  switch (key.name) {
    case 'return':
    case 'enter':
      return key.shift === true ? insert(text, clampedCursor, '\n') : { type: 'send' }
    case 'escape':
    case 'tab':
      return { type: 'blur' }
    case 'backspace':
      if (clampedCursor === 0) return { type: 'none' }
      return {
        type: 'edit',
        text: text.slice(0, clampedCursor - 1) + text.slice(clampedCursor),
        cursor: clampedCursor - 1,
      }
    case 'left':
      return { type: 'edit', text, cursor: Math.max(0, clampedCursor - 1) }
    case 'right':
      return { type: 'edit', text, cursor: Math.min(text.length, clampedCursor + 1) }
    case 'home':
      return { type: 'edit', text, cursor: 0 }
    case 'end':
      return { type: 'edit', text, cursor: text.length }
    default: {
      const char = printableChar(key)
      return char === null ? { type: 'none' } : insert(text, clampedCursor, char)
    }
  }
}
