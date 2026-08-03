import { Fragment, type ReactNode } from 'react'
import type { MessageEntity } from '@/state/types.ts'
import { attachmentLabel, formatTime, messageStatusMarker } from '@/tui/message-format.ts'
import { htmlToStyledLines, type StyledRun } from '@/state/message-html.ts'
import { useTheme } from '@/tui/theme/context.tsx'

export interface MessageViewProps {
  message: MessageEntity
  selected: boolean
  /** `›` when this is the cursor row, else a space. */
  caret: string
}

/** Render one styled run as nested bold/italic/underline modifier spans — those
 *  set the real terminal attributes (a `style` bool on `<span>` does not). */
function renderRun(run: StyledRun, key: number): ReactNode {
  let node: ReactNode = run.text
  if (run.underline) node = <u>{node}</u>
  if (run.italic) node = <i>{node}</i>
  if (run.bold) node = <b>{node}</b>
  return <Fragment key={key}>{node}</Fragment>
}

/** Plain trailing decorations (attachments, edited, reactions) appended after the
 *  message body — kept unstyled, matching the single-line renderer. */
function trailingText(message: MessageEntity): string {
  const parts = (message.attachments ?? []).map((a) => `[${attachmentLabel(a)}]`)
  let out = parts.join(' ')
  if (message.isEdited === true) out = out.length > 0 ? `${out} (edited)` : '(edited)'
  const reactions = (message.reactions ?? [])
    .map((r) => (r.count > 1 ? `${r.key}×${r.count}` : r.key))
    .join(' ')
  if (reactions.length > 0) out = out.length > 0 ? `${out}  ${reactions}` : reactions
  return out
}

/**
 * A message whose body carries HTML markup, rendered as multi-line styled text:
 * `<b>`→bold, `<i>`→italic, `<u>`→underline, `<br>`→line break, `<ul>/<ol>`→
 * dash/numbered lists, entities decoded, unknown tags stripped (see
 * `message-html.ts`). Ordinary messages skip this and take the single-line path.
 */
export function MessageView({ message, selected, caret }: MessageViewProps) {
  const theme = useTheme()
  const time = formatTime(message.timestamp)
  const sender = message.senderName ?? (message.isSender ? 'You' : message.senderId)
  const header = `${caret} ${time.length > 0 ? `${time} ` : ''}${sender}: ${
    message.replyToId !== undefined ? '↩ ' : ''
  }`
  const lines = htmlToStyledLines(message.text ?? '')
  const suffix = `${trailingText(message)}${messageStatusMarker(message)}`

  // Selection highlight wins; else failed/pending tint. `fg` on the line cascades
  // to the modifier spans, which only add bold/italic/underline.
  const fg = selected
    ? theme.selectionFg
    : message.status === 'failed'
      ? theme.danger
      : message.status === 'pending'
        ? theme.muted
        : undefined
  const lineStyle = fg !== undefined ? { fg } : {}

  return (
    <box
      style={{
        flexDirection: 'column',
        ...(selected ? { backgroundColor: theme.selectionBg } : {}),
      }}
    >
      {lines.map((line, i) => (
        <text key={i} style={lineStyle}>
          {i === 0 ? header : ''}
          {line.runs.map((run, ri) => renderRun(run, ri))}
          {i === lines.length - 1 && suffix.length > 0 ? ` ${suffix}` : ''}
        </text>
      ))}
    </box>
  )
}
