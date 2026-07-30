import { describe, expect, test } from 'bun:test'
import { startWatch, type SocketLike, type WatchStatus } from '@/beeper/watch.ts'
import type { WatchEvent } from '@/beeper/watch-protocol.ts'

class FakeSocket implements SocketLike {
  handlers: Record<string, Array<(ev: unknown) => void>> = {}
  sent: string[] = []
  closed = false
  addEventListener(type: string, cb: (ev: unknown) => void): void {
    ;(this.handlers[type] ??= []).push(cb)
  }
  send(data: string): void {
    this.sent.push(data)
  }
  close(): void {
    this.closed = true
  }
  emit(type: string, ev?: unknown): void {
    for (const cb of this.handlers[type] ?? []) cb(ev)
  }
}

function harness() {
  const sockets: FakeSocket[] = []
  const scheduled: Array<{ fn: () => void; ms: number }> = []
  const statuses: WatchStatus[] = []
  const events: WatchEvent[] = []
  const handle = startWatch({
    endpoint: 'http://127.0.0.1:23373',
    accessToken: 'tok',
    onEvent: (e) => events.push(e),
    onStatus: (s) => statuses.push(s),
    socketFactory: () => {
      const s = new FakeSocket()
      sockets.push(s)
      return s
    },
    schedule: (fn, ms) => {
      scheduled.push({ fn, ms })
      return scheduled.length - 1
    },
    backoff: { random: () => 0, baseMs: 500 },
  })
  return { sockets, scheduled, statuses, events, handle }
}

const subscribed = JSON.stringify({ type: 'subscriptions.updated', requestID: 'x' })
const msgFrame = JSON.stringify({
  type: 'message.upserted',
  chatID: '!c1',
  entries: [
    {
      id: 'm1',
      chatID: '!c1',
      accountID: 'a',
      senderID: 's',
      timestamp: 't',
      sortKey: '1',
      text: 'hi',
      isSender: false,
    },
  ],
  seq: 1,
})

describe('startWatch', () => {
  test('subscribes on open and reports connected on the ack', () => {
    const h = harness()
    expect(h.statuses[0]).toBe('connecting')
    h.sockets[0]!.emit('open')
    expect(JSON.parse(h.sockets[0]!.sent[0]!)).toMatchObject({
      type: 'subscriptions.set',
      chatIDs: ['*'],
    })
    h.sockets[0]!.emit('message', { data: subscribed })
    expect(h.statuses).toContain('connected')
  })

  test('emits parsed message events', () => {
    const h = harness()
    h.sockets[0]!.emit('open')
    h.sockets[0]!.emit('message', { data: msgFrame })
    const messages = h.events.find((e) => e.kind === 'messages')
    expect(messages).toMatchObject({ kind: 'messages', chatId: '!c1' })
  })

  test('reconnects with backoff on close, creating a new socket', () => {
    const h = harness()
    h.sockets[0]!.emit('open')
    h.sockets[0]!.emit('close')
    expect(h.statuses).toContain('reconnecting')
    expect(h.scheduled).toHaveLength(1)
    h.scheduled[0]!.fn() // fire the scheduled reconnect
    expect(h.sockets).toHaveLength(2) // a fresh socket
  })

  test('close() stops reconnection and closes the socket', () => {
    const h = harness()
    h.sockets[0]!.emit('open')
    h.handle.close()
    expect(h.statuses.at(-1)).toBe('closed')
    expect(h.sockets[0]!.closed).toBe(true)
    // A late close event must not schedule another reconnect.
    h.sockets[0]!.emit('close')
    expect(h.scheduled).toHaveLength(0)
  })
})
