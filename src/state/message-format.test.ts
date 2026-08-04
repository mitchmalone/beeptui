import { describe, expect, test } from 'bun:test'
import {
  attachmentLabel,
  formatSize,
  formatTime,
  messageStatusMarker,
} from '@/state/message-format.ts'
import type { MessageEntity } from '@/state/types.ts'

// Base omits the optional fields (senderName, text, …) so tests add only what
// they need — `exactOptionalPropertyTypes` forbids passing them as `undefined`.
function message(over: Partial<MessageEntity> = {}): MessageEntity {
  return {
    id: 'm',
    chatId: 'c',
    accountId: 'a',
    senderId: 'them@server',
    timestamp: '2026-07-30T09:05:00.000Z',
    sortKey: '1',
    isSender: false,
    isUnread: false,
    status: 'sent',
    ...over,
  }
}

describe('formatTime', () => {
  test('extracts HH:MM from ISO, empty on garbage (never NaN)', () => {
    expect(formatTime('2026-07-30T09:05:00.000Z')).toBe('09:05')
    expect(formatTime('not-a-date')).toBe('')
  })
})

describe('formatSize', () => {
  test('renders bytes, KB, MB with sensible rounding', () => {
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(20480)).toBe('20 KB')
    expect(formatSize(1536)).toBe('1.5 KB')
    expect(formatSize(1_500_000)).toBe('1.4 MB')
  })
})

describe('attachmentLabel', () => {
  test('names the file when known, and includes the size when known', () => {
    expect(attachmentLabel({ kind: 'file' })).toBe('file')
    expect(attachmentLabel({ kind: 'image', fileName: 'a.png' })).toBe('image: a.png')
    expect(attachmentLabel({ kind: 'image', fileName: 'a.png', fileSize: 20480 })).toBe(
      'image: a.png · 20 KB'
    )
  })
})

describe('messageStatusMarker', () => {
  test('marks pending and failed sends', () => {
    expect(messageStatusMarker(message({ status: 'pending' }))).toContain('…')
    expect(messageStatusMarker(message({ status: 'failed' }))).toContain('⚠ failed')
  })

  test('shows a ✓✓ read receipt on our own seen messages, not on inbound or unseen', () => {
    expect(messageStatusMarker(message({ isSender: true, isSeen: true }))).toContain('✓✓')
    // Not on an inbound message, even if flagged seen.
    expect(messageStatusMarker(message({ isSender: false, isSeen: true }))).not.toContain('✓✓')
    // Not on our own message that isn't seen yet.
    expect(messageStatusMarker(message({ isSender: true }))).not.toContain('✓✓')
  })

  test('an ordinary sent message gets no marker', () => {
    expect(messageStatusMarker(message())).toBe('')
  })
})
