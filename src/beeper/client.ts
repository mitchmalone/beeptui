import BeeperDesktop from '@beeper/desktop-api'
import { normalizeError } from '@/beeper/errors.ts'
import {
  mapAccount,
  mapChat,
  mapInfo,
  mapMessage,
  mapSendResult,
  type Account,
  type ChatSummary,
  type MessageSummary,
  type SendResult,
  type ServerInfo,
} from '@/beeper/types.ts'

/** One page of message history from the adapter. */
export interface MessageHistoryPage {
  messages: MessageSummary[]
  /** Whether older history exists beyond this page. */
  hasMore: boolean
  /** Cursor for fetching the next older page, or null at the start of history. */
  cursor: string | null
}

export interface BeeperAdapterOptions {
  endpoint: string
  /** Bearer token. Omit for an unauthenticated client (auth'd calls will 401). */
  accessToken?: string | undefined
  /** Per-request timeout in ms. */
  timeoutMs?: number
  /** Custom fetch — the seam fixture tests use to serve synthetic responses. */
  fetch?: typeof fetch
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_PAGE_LIMIT = 50

/**
 * The typed adapter over the Beeper Desktop API — the only place the app talks
 * to Beeper. Wraps the official `@beeper/desktop-api` SDK, returns our domain
 * models, and collapses every failure into a `BeeperError`. Retries are disabled
 * (`maxRetries: 0`) so retry policy stays ours, expressed via
 * `BeeperError.retryable`, not hidden in the SDK.
 */
export class BeeperAdapter {
  readonly #client: BeeperDesktop

  constructor(options: BeeperAdapterOptions) {
    this.#client = new BeeperDesktop({
      baseURL: options.endpoint,
      // Empty string, not undefined: the SDK throws at construction on an
      // undefined token, but `/v1/info` is usable pre-auth. An empty token
      // simply yields a 401 on authenticated calls, which we surface honestly.
      accessToken: options.accessToken ?? '',
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: 0,
      ...(options.fetch ? { fetch: options.fetch } : {}),
    })
  }

  async getInfo(): Promise<ServerInfo> {
    return this.#guard(async () => mapInfo(await this.#client.info.retrieve()))
  }

  async listAccounts(): Promise<Account[]> {
    return this.#guard(async () => (await this.#client.accounts.list()).map(mapAccount))
  }

  async listChats(options: { limit?: number } = {}): Promise<ChatSummary[]> {
    const limit = options.limit ?? DEFAULT_PAGE_LIMIT
    return this.#guard(async () => {
      const chats = await this.#collect(this.#client.chats.list(), limit)
      return chats.map(mapChat)
    })
  }

  /**
   * Fetch one page of a chat's messages, newest-first from the API but returned
   * oldest-first. Pass `cursor` (a prior page's `cursor`) with `direction:
   * 'before'` to page backward through history. Returns the cursor + whether
   * more older history exists so the caller can keep paging.
   *
   * The `direction` enum is `'before' | 'after'` — confirmed against Beeper
   * Desktop 4.2.1004 (live validation 2026-07-31).
   */
  async listMessages(
    chatID: string,
    options: { limit?: number; cursor?: string } = {}
  ): Promise<MessageHistoryPage> {
    const limit = options.limit ?? DEFAULT_PAGE_LIMIT
    return this.#guard(async () => {
      const query =
        options.cursor === undefined ? {} : { cursor: options.cursor, direction: 'before' }
      const page = await this.#client.messages.list(chatID, query)
      return {
        messages: page.items.slice(0, limit).map(mapMessage),
        hasMore: page.hasMore,
        cursor: page.oldestCursor,
      }
    })
  }

  async sendMessage(chatID: string, text: string): Promise<SendResult> {
    return this.#guard(async () =>
      mapSendResult(await this.#client.messages.send(chatID, { text }))
    )
  }

  /** Run an SDK call, normalizing any thrown value into a `BeeperError`. */
  async #guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      throw normalizeError(err)
    }
  }

  /** Drain an auto-paginating list up to `limit` items (bounded memory). */
  async #collect<T>(iterable: AsyncIterable<T>, limit: number): Promise<T[]> {
    const out: T[] = []
    for await (const item of iterable) {
      out.push(item)
      if (out.length >= limit) break
    }
    return out
  }
}
