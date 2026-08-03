import type { AttachmentSummary } from '@/beeper/types.ts'
import type { MessageDeliveryStatus, MessageEntity } from '@/state/types.ts'

export interface FormattedMessage {
  time: string
  sender: string
  body: string
  status: MessageDeliveryStatus
  isSender: boolean
}

/** Extract `HH:MM` from an ISO timestamp; empty string if unparseable, so a
 *  missing/odd timestamp never renders `undefined` or `NaN`. */
export function formatTime(timestamp: string): string {
  const match = /T(\d{2}:\d{2})/.exec(timestamp)
  return match?.[1] ?? ''
}

/** Compact human-readable byte size (e.g. `20 KB`, `1.4 MB`). */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let size = bytes / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  const rounded = size >= 10 ? Math.round(size) : Math.round(size * 10) / 10
  return `${rounded} ${units[unit]}`
}

export function attachmentLabel(attachment: AttachmentSummary): string {
  const name = attachment.fileName ? `${attachment.kind}: ${attachment.fileName}` : attachment.kind
  return attachment.fileSize !== undefined ? `${name} · ${formatSize(attachment.fileSize)}` : name
}

/** The trailing status glyph for a message (`⚠ failed`, `…`, `✓✓`), or ''. Shared
 *  by the single-line `messageLine` and the rich multi-line renderer. */
export function messageStatusMarker(message: MessageEntity): string {
  if (message.status === 'failed') return ' ⚠ failed'
  if (message.status === 'pending') return ' …'
  if (message.isSender && message.isSeen === true) return ' ✓✓'
  return ''
}

/**
 * Build the display fields for a message, degrading gracefully when optional
 * fields are absent (no `undefined`/`NaN` artifacts). The
 * body folds in a reply marker, attachment placeholders, and an edited marker.
 */
export function formatMessage(message: MessageEntity): FormattedMessage {
  const sender = message.senderName ?? (message.isSender ? 'You' : message.senderId)

  const parts: string[] = []
  if (message.replyToId !== undefined) parts.push('↩')
  if (message.text !== undefined && message.text.length > 0) parts.push(message.text)
  for (const attachment of message.attachments ?? []) parts.push(`[${attachmentLabel(attachment)}]`)
  let body = parts.join(' ')
  if (message.isEdited === true) body = body.length > 0 ? `${body} (edited)` : '(edited)'
  if (body.length === 0) body = '(no content)'
  // Read-only reactions render as a trailing summary: `😄×2 👍`.
  const reactions = (message.reactions ?? [])
    .map((r) => (r.count > 1 ? `${r.key}×${r.count}` : r.key))
    .join(' ')
  if (reactions.length > 0) body = `${body}  ${reactions}`

  return {
    time: formatTime(message.timestamp),
    sender,
    body,
    status: message.status,
    isSender: message.isSender,
  }
}

/** Single-line rendering used by the conversation list. A read receipt (`✓✓`)
 *  shows on our own delivered messages the recipient has seen. */
export function messageLine(message: MessageEntity): string {
  const f = formatMessage(message)
  const time = f.time.length > 0 ? `${f.time} ` : ''
  return `${time}${f.sender}: ${f.body}${messageStatusMarker(message)}`
}
