import { describe, expect, test } from 'bun:test'
import { nextBackoffMs, parseWatchMessage, subscribeAllCommand } from '@/beeper/watch-protocol.ts'

// A synthetic message.upserted frame in the real wire shape (invented content).
const messageFrame = JSON.stringify({
  type: 'message.upserted',
  chatID: '!c1:beeper.local',
  ids: ['m1'],
  entries: [
    {
      id: 'm1',
      chatID: '!c1:beeper.local',
      accountID: 'wa',
      senderID: 'them',
      senderName: 'Ada',
      timestamp: '2026-07-31T09:00:00.000Z',
      sortKey: '0001',
      type: 'TEXT',
      text: 'hi',
      isSender: false,
    },
  ],
  seq: 42,
  ts: '2026-07-31T09:00:00.000Z',
})

describe('subscribeAllCommand', () => {
  test('builds the subscriptions.set command for all chats', () => {
    expect(JSON.parse(subscribeAllCommand('r1'))).toEqual({
      type: 'subscriptions.set',
      requestID: 'r1',
      chatIDs: ['*'],
    })
  })
})

describe('parseWatchMessage', () => {
  test('ready and subscribed acks', () => {
    expect(parseWatchMessage(JSON.stringify({ type: 'ready', version: 1, chatIDs: [] }))).toEqual({
      kind: 'ready',
    })
    expect(
      parseWatchMessage(JSON.stringify({ type: 'subscriptions.updated', requestID: 'r1' }))
    ).toEqual({
      kind: 'subscribed',
    })
  })

  test('message.upserted maps entries to domain messages', () => {
    const ev = parseWatchMessage(messageFrame)
    expect(ev).toMatchObject({ kind: 'messages', chatId: '!c1:beeper.local', seq: 42 })
    if (ev.kind !== 'messages') throw new Error('wrong kind')
    expect(ev.messages).toHaveLength(1)
    expect(ev.messages[0]).toMatchObject({
      id: 'm1',
      text: 'hi',
      senderName: 'Ada',
      isSender: false,
    })
  })

  test('chat.upserted and deletes', () => {
    expect(
      parseWatchMessage(JSON.stringify({ type: 'chat.upserted', chatID: '!c1', seq: 5 }))
    ).toEqual({
      kind: 'chat-upserted',
      chatId: '!c1',
      seq: 5,
    })
    expect(
      parseWatchMessage(JSON.stringify({ type: 'message.deleted', chatID: '!c1', seq: 6 }))
    ).toMatchObject({
      kind: 'message-deleted',
    })
  })

  test('error frames and unknown/garbage never throw', () => {
    expect(
      parseWatchMessage(JSON.stringify({ type: 'error', code: 'INVALID_COMMAND', message: 'x' }))
    ).toEqual({
      kind: 'error',
      code: 'INVALID_COMMAND',
      message: 'x',
    })
    expect(parseWatchMessage(JSON.stringify({ type: 'whatever' }))).toEqual({
      kind: 'unknown',
      type: 'whatever',
    })
    expect(parseWatchMessage('{ not json')).toEqual({ kind: 'unknown', type: '<parse-error>' })
  })
})

describe('nextBackoffMs', () => {
  test('grows exponentially and is capped', () => {
    const zero = { random: () => 0 }
    expect(nextBackoffMs(0, { ...zero, baseMs: 500 })).toBe(250)
    expect(nextBackoffMs(1, { ...zero, baseMs: 500 })).toBe(500)
    expect(nextBackoffMs(2, { ...zero, baseMs: 500 })).toBe(1000)
    expect(nextBackoffMs(20, { ...zero, baseMs: 500, capMs: 15000 })).toBe(7500) // capped half
  })

  test('jitter stays within [half, full] of the exponential window', () => {
    const v = nextBackoffMs(3, { baseMs: 500, random: () => 0.999 })
    expect(v).toBeGreaterThanOrEqual(2000)
    expect(v).toBeLessThanOrEqual(4000)
  })
})
