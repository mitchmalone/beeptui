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

function attachmentLabel(attachment: AttachmentSummary): string {
  return attachment.fileName ? `${attachment.kind}: ${attachment.fileName}` : attachment.kind
}

/**
 * Build the display fields for a message, degrading gracefully when optional
 * fields are absent (no `undefined`/`NaN` artifacts — Slice 4 acceptance). The
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

  return {
    time: formatTime(message.timestamp),
    sender,
    body,
    status: message.status,
    isSender: message.isSender,
  }
}

/** Single-line rendering used by the conversation list. */
export function messageLine(message: MessageEntity): string {
  const f = formatMessage(message)
  const marker = f.status === 'failed' ? ' ⚠ failed' : f.status === 'pending' ? ' …' : ''
  const time = f.time.length > 0 ? `${f.time} ` : ''
  return `${time}${f.sender}: ${f.body}${marker}`
}
