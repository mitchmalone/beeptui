import { describe, expect, test } from 'bun:test'
import { formatMessage, formatTime, messageLine } from '@/tui/message-format.ts'
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

describe('formatMessage', () => {
  test('uses sender name, or You for own messages, or the id as fallback', () => {
    expect(formatMessage(message({ senderName: 'Grace' })).sender).toBe('Grace')
    expect(formatMessage(message({ isSender: true })).sender).toBe('You')
    expect(formatMessage(message({})).sender).toBe('them@server')
  })

  test('folds in reply marker, attachments, and edited marker', () => {
    const f = formatMessage(
      message({
        text: 'see this',
        replyToId: 'm0',
        isEdited: true,
        attachments: [{ kind: 'image', fileName: 'a.png' }],
      })
    )
    expect(f.body).toBe('↩ see this [image: a.png] (edited)')
  })

  test('attachment-only message shows a placeholder, never blank or undefined', () => {
    const f = formatMessage(message({ attachments: [{ kind: 'file' }] }))
    expect(f.body).toBe('[file]')
    expect(f.body).not.toContain('undefined')
  })

  test('a message with no text and no attachments degrades to (no content)', () => {
    expect(formatMessage(message({})).body).toBe('(no content)')
  })
})

describe('messageLine', () => {
  test('renders time, sender, body', () => {
    expect(messageLine(message({ senderName: 'Grace', text: 'hi' }))).toBe('09:05 Grace: hi')
  })

  test('marks pending and failed sends', () => {
    expect(
      messageLine(message({ status: 'pending', isSender: true, senderName: 'You' }))
    ).toContain('…')
    expect(messageLine(message({ status: 'failed', isSender: true, senderName: 'You' }))).toContain(
      '⚠ failed'
    )
  })

  test('omits the time prefix cleanly when the timestamp is unparseable', () => {
    expect(messageLine(message({ senderName: 'X', text: 'y', timestamp: '' }))).toBe('X: y')
  })
})
