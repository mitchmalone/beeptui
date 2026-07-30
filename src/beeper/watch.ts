import {
  nextBackoffMs,
  parseWatchMessage,
  subscribeAllCommand,
  type BackoffOptions,
  type WatchEvent,
} from '@/beeper/watch-protocol.ts'

export type WatchStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed'

/** Minimal socket surface the client needs — real `WebSocket` satisfies it, and
 *  tests pass a fake to drive open/message/close deterministically. */
export interface SocketLike {
  addEventListener(type: 'open' | 'message' | 'close' | 'error', cb: (ev: unknown) => void): void
  send(data: string): void
  close(): void
}

export type SocketFactory = (url: string, headers: Record<string, string>) => SocketLike

export interface WatchOptions {
  endpoint: string
  accessToken: string
  onEvent: (event: WatchEvent) => void
  onStatus: (status: WatchStatus) => void
  socketFactory?: SocketFactory
  schedule?: (fn: () => void, ms: number) => unknown
  cancel?: (handle: unknown) => void
  backoff?: BackoffOptions
}

export interface WatchHandle {
  close(): void
}

function defaultSocketFactory(url: string, headers: Record<string, string>): SocketLike {
  return new WebSocket(url, { headers } as never) as unknown as SocketLike
}

/** Connect, subscribe to all chats, and stream parsed events — reconnecting
 *  with backoff on drop until `close()`. On reconnect the caller resyncs the
 *  gap (see runtime.applyWatchEvent / resyncAfterReconnect). */
export function startWatch(options: WatchOptions): WatchHandle {
  const factory = options.socketFactory ?? defaultSocketFactory
  const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms))
  const cancel = options.cancel ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  const wsUrl = `${options.endpoint.replace(/^http/, 'ws')}/v1/ws`

  let closed = false
  let attempt = 0
  let socket: SocketLike | null = null
  let timer: unknown = null

  function connect(): void {
    if (closed) return
    options.onStatus(attempt === 0 ? 'connecting' : 'reconnecting')
    socket = factory(wsUrl, { Authorization: `Bearer ${options.accessToken}` })

    socket.addEventListener('open', () => {
      socket?.send(subscribeAllCommand(`sub-${attempt}`))
    })
    socket.addEventListener('message', (ev) => {
      const data = (ev as { data?: unknown }).data
      const event = parseWatchMessage(typeof data === 'string' ? data : String(data))
      if (event.kind === 'subscribed') {
        attempt = 0
        options.onStatus('connected')
      }
      options.onEvent(event)
    })
    socket.addEventListener('close', reconnect)
    socket.addEventListener('error', reconnect)
  }

  function reconnect(): void {
    if (closed) return
    options.onStatus('reconnecting')
    const delay = nextBackoffMs(attempt, options.backoff)
    attempt += 1
    timer = schedule(connect, delay)
  }

  connect()

  return {
    close() {
      closed = true
      if (timer !== null) cancel(timer)
      options.onStatus('closed')
      try {
        socket?.close()
      } catch {
        // ignore
      }
    },
  }
}
