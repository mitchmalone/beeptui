import type BeeperDesktop from '@beeper/desktop-api'
import { mapMessage, type MessageSummary } from '@/beeper/types.ts'

/**
 * Pure Beeper `/v1/ws` protocol: the subscribe command, event parsing, and
 * reconnect backoff. No I/O — the `WatchClient` wires these to a socket.
 * Protocol confirmed live against Beeper Desktop 4.2.1004 (see LEARNINGS.md).
 */

export type WatchEvent =
  | { kind: 'ready' }
  | { kind: 'subscribed' }
  | { kind: 'messages'; chatId: string; messages: MessageSummary[]; seq: number }
  | { kind: 'chat-upserted'; chatId: string; seq: number }
  | { kind: 'message-deleted'; chatId: string; seq: number }
  | { kind: 'chat-deleted'; chatId: string; seq: number }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'unknown'; type: string }

/** The command that subscribes to all chats. `subscriptions.set` fully replaces
 *  the current subscription set; `['*']` = all. */
export function subscribeAllCommand(requestID: string): string {
  return JSON.stringify({ type: 'subscriptions.set', requestID, chatIDs: ['*'] })
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

/** Parse a raw WS frame into a typed event. Never throws. */
export function parseWatchMessage(raw: string): WatchEvent {
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { kind: 'unknown', type: '<parse-error>' }
  }
  const type = typeof payload.type === 'string' ? payload.type : ''
  const chatId = typeof payload.chatID === 'string' ? payload.chatID : ''
  const seq = num(payload.seq)

  switch (type) {
    case 'ready':
      return { kind: 'ready' }
    case 'subscriptions.updated':
      return { kind: 'subscribed' }
    case 'message.upserted': {
      const entries = Array.isArray(payload.entries)
        ? (payload.entries as BeeperDesktop.Message[])
        : []
      return { kind: 'messages', chatId, messages: entries.map(mapMessage), seq }
    }
    case 'chat.upserted':
      return { kind: 'chat-upserted', chatId, seq }
    case 'message.deleted':
      return { kind: 'message-deleted', chatId, seq }
    case 'chat.deleted':
      return { kind: 'chat-deleted', chatId, seq }
    case 'error':
      return {
        kind: 'error',
        code: typeof payload.code === 'string' ? payload.code : 'unknown',
        message: typeof payload.message === 'string' ? payload.message : '',
      }
    default:
      return { kind: 'unknown', type }
  }
}

export interface BackoffOptions {
  baseMs?: number
  capMs?: number
  /** Injectable [0,1) source so jitter is deterministic in tests. */
  random?: () => number
}

/** Exponential backoff with full jitter, for reconnect attempts (0-indexed). */
export function nextBackoffMs(attempt: number, options: BackoffOptions = {}): number {
  const base = options.baseMs ?? 500
  const cap = options.capMs ?? 15_000
  const random = options.random ?? Math.random
  const exp = Math.min(cap, base * 2 ** Math.max(0, attempt))
  return Math.round(exp / 2 + random() * (exp / 2))
}
