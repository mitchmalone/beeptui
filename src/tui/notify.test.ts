import { describe, expect, test } from 'bun:test'
import { buildNotifyArgs, notificationText, shouldNotify } from '@/tui/notify.ts'

describe('notification hooks (Slice 14)', () => {
  test('notificationText is redacted — app + network only, no content', () => {
    const text = notificationText('WhatsApp')
    expect(text).toBe('beeper-tui: new message on WhatsApp')
    // Must never carry a sender, chat title, or message body.
    expect(text).not.toMatch(/message on WhatsApp.+:/)
  })

  test('fires for an inbound message in a non-focused chat', () => {
    expect(shouldNotify({ isSender: false, chatId: 'c2' }, 'c1')).toBe(true)
    expect(shouldNotify({ isSender: false, chatId: 'c2' }, null)).toBe(true)
  })

  test('does not fire for our own sends', () => {
    expect(shouldNotify({ isSender: true, chatId: 'c2' }, 'c1')).toBe(false)
  })

  test('does not fire for the chat you are currently reading', () => {
    expect(shouldNotify({ isSender: false, chatId: 'c1' }, 'c1')).toBe(false)
  })

  test('buildNotifyArgs appends the redacted summary to the configured command', () => {
    expect(buildNotifyArgs({ command: ['terminal-notifier', '-message'] }, 'Slack')).toEqual([
      'terminal-notifier',
      '-message',
      'beeper-tui: new message on Slack',
    ])
  })
})
