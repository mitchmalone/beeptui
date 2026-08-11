import type { AttachmentSummary } from '@/beeper/types.ts'
import type { MessageEntity } from '@/state/types.ts'

/** Extract `HH:MM` from an ISO timestamp; empty string if unparseable, so a
 *  missing/odd timestamp never renders `undefined` or `NaN`. */
export function formatTime(timestamp: string): string {
  const match = /T(\d{2}:\d{2})/.exec(timestamp)
  return match?.[1] ?? ''
}

/** Is this attachment an image we could preview inline? Trusts an explicit
 *  `image` kind, or an `image/*` MIME type when the kind is coarser. */
export function isImageAttachment(attachment: AttachmentSummary): boolean {
  return attachment.kind === 'image' || (attachment.mimeType?.startsWith('image/') ?? false)
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

/** The trailing status glyph for a message (`⚠ failed`, `…`, `✓✓`), or ''.
 *  Appended after the body by the message layout. */
export function messageStatusMarker(message: MessageEntity): string {
  if (message.status === 'failed') return ' ⚠ failed'
  if (message.status === 'pending') return ' …'
  if (message.isSender && message.isSeen === true) return ' ✓✓'
  return ''
}
