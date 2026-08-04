import { useRef, useState } from 'react'
import { useKeyboard } from '@opentui/react'
import { applyComposeKey } from '@/tui/compose-editor.ts'
import { useTheme } from '@/tui/theme/context.tsx'

export interface ComposeProps {
  /** Initial text (the chat's persisted draft). Remount per chat via a `key`. */
  draft: string
  focused: boolean
  hasFailedSend: boolean
  /** Reply context to show above the editor while replying, or null. */
  replyContext?: { sender: string; snippet: string } | null
  onEdit: (text: string) => void
  onSend: (text: string) => void
  onBlur: () => void
  /** Cancel an in-progress reply (called when blurring while replying). */
  onCancelReply?: () => void
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
export function Compose({
  draft,
  focused,
  hasFailedSend,
  replyContext,
  onEdit,
  onSend,
  onBlur,
  onCancelReply,
}: ComposeProps) {
  const theme = useTheme()
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
        // Leaving compose abandons an in-progress reply so the quoted context
        // can't linger on the next message.
        if (replyContext) onCancelReply?.()
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
      // The title carries the mode: a reply in progress is a different thing
      // from a fresh message, and the quoted line alone was easy to miss.
      title={
        replyContext
          ? focused
            ? 'Replying in thread ●'
            : 'Replying in thread'
          : focused
            ? 'Compose ●'
            : 'Compose'
      }
      border
      borderColor={focused ? theme.borderFocused : theme.border}
      style={{
        flexShrink: 0,
        minHeight: 3,
        flexDirection: 'column',
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {replyContext ? (
        <text style={{ fg: theme.accent }}>
          {`↩ Replying to ${replyContext.sender}: ${replyContext.snippet}  (Esc to cancel)`}
        </text>
      ) : null}
      {showPlaceholder ? (
        <text style={{ fg: theme.muted }}>Press Tab to write a message…</text>
      ) : (
        lines.map((line, index) => <text key={index}>{line.length > 0 ? line : ' '}</text>)
      )}
      {hasFailedSend ? (
        <text style={{ fg: theme.danger }}>⚠ a send failed — Esc, then R to retry</text>
      ) : null}
    </box>
  )
}
