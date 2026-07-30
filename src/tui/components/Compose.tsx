import { useRef, useState } from 'react'
import { useKeyboard } from '@opentui/react'
import { applyComposeKey } from '@/tui/compose-editor.ts'

export interface ComposeProps {
  /** Initial text (the chat's persisted draft). Remount per chat via a `key`. */
  draft: string
  focused: boolean
  hasFailedSend: boolean
  onEdit: (text: string) => void
  onSend: (text: string) => void
  onBlur: () => void
}

const CARET = '▏'

interface EditorState {
  text: string
  cursor: number
}

/**
 * The compose strip. Editing runs through the pure `applyComposeKey`; the
 * component owns the live editor state (in a ref so the keyboard handler never
 * reads a stale closure) and mirrors the text to the reducer draft for
 * persistence. Enter sends only a non-empty message — the single explicit send
 * trigger (invariant 5).
 */
export function Compose({ draft, focused, hasFailedSend, onEdit, onSend, onBlur }: ComposeProps) {
  const [editor, setEditor] = useState<EditorState>(() => ({ text: draft, cursor: draft.length }))
  const ref = useRef(editor)
  ref.current = editor

  function commit(next: EditorState): void {
    ref.current = next
    setEditor(next)
  }

  useKeyboard((key) => {
    if (!focused) return
    const { text, cursor } = ref.current
    const result = applyComposeKey(text, cursor, {
      name: key.name,
      shift: key.shift,
      ctrl: key.ctrl,
      meta: key.meta,
      sequence: key.sequence,
    })
    switch (result.type) {
      case 'edit':
        commit({ text: result.text, cursor: result.cursor })
        onEdit(result.text)
        break
      case 'send':
        if (text.trim().length > 0) {
          onSend(text)
          commit({ text: '', cursor: 0 })
        }
        break
      case 'blur':
        onBlur()
        break
      case 'none':
        break
    }
  })

  const { text, cursor } = editor
  const shown = focused ? text.slice(0, cursor) + CARET + text.slice(cursor) : text
  const lines = shown.length > 0 ? shown.split('\n') : ['']
  const showPlaceholder = !focused && text.length === 0

  return (
    <box
      title={focused ? 'Compose ●' : 'Compose'}
      border
      style={{
        flexShrink: 0,
        minHeight: 3,
        flexDirection: 'column',
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {showPlaceholder ? (
        <text style={{ fg: '#94a3b8' }}>Press Tab to write a message…</text>
      ) : (
        lines.map((line, index) => <text key={index}>{line.length > 0 ? line : ' '}</text>)
      )}
      {hasFailedSend ? (
        <text style={{ fg: '#f87171' }}>⚠ a send failed — press R to retry</text>
      ) : null}
    </box>
  )
}
