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

/** How to narrow a message search. Omit both to search everything. */
export interface MessageSearchOptions {
  /** Restrict to one chat (PRD: search scoped to the active chat when selected). */
  chatId?: string
  /** Restrict to one account/network. */
  accountId?: string
  limit?: number
}

/** Result of a message search through the Beeper API. */
export interface MessageSearchPage {
  messages: MessageSummary[]
  /**
   * Whether the server actually honored the requested scope — verified by
   * checking every hit matches the chat/account we asked for. A server that
   * ignores scope (returns cross-chat hits) reports `false`, so the caller can
   * label the results honestly / fall back rather than show wrong results
   * (CLAUDE.md invariant 8).
   */
  scopeHonored: boolean
  /** True when the result was truncated at `limit` — more may exist server-side. */
  capped: boolean
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
const DEFAULT_SEARCH_LIMIT = 50

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

  /** Fetch a single chat summary (used to refresh an inbox row on a live
   *  `chat.upserted` event). */
  async getChat(chatID: string): Promise<ChatSummary> {
    return this.#guard(async () => mapChat(await this.#client.chats.retrieve(chatID)))
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

  /**
   * Search messages across chats through Beeper's search endpoint. Scoping is
   * requested via `chatIDs` / `accountIDs`, but never trusted blindly: the
   * result reports whether the server honored that scope so the caller can fall
   * back to a labeled local search instead of surfacing cross-chat hits as if
   * they were scoped.
   */
  async searchMessages(
    query: string,
    options: MessageSearchOptions = {}
  ): Promise<MessageSearchPage> {
    const limit = options.limit ?? DEFAULT_SEARCH_LIMIT
    return this.#guard(async () => {
      const params: BeeperDesktop.MessageSearchParams = { query }
      if (options.chatId !== undefined) params.chatIDs = [options.chatId]
      if (options.accountId !== undefined) params.accountIDs = [options.accountId]
      const items = await this.#collect(this.#client.messages.search(params), limit)
      const messages = items.map(mapMessage)
      const scopeHonored = messages.every(
        (m) =>
          (options.chatId === undefined || m.chatId === options.chatId) &&
          (options.accountId === undefined || m.accountId === options.accountId)
      )
      return { messages, scopeHonored, capped: messages.length >= limit }
    })
  }

  /**
   * Send a message. Pass `replyToId` to send it as a reply to an existing
   * message (the network must support replies — the caller gates on
   * `chat.canReply`; Beeper still owns the final say).
   */
  async sendMessage(
    chatID: string,
    text: string,
    options: { replyToId?: string } = {}
  ): Promise<SendResult> {
    return this.#guard(async () =>
      mapSendResult(
        await this.#client.messages.send(chatID, {
          text,
          ...(options.replyToId !== undefined ? { replyToMessageID: options.replyToId } : {}),
        })
      )
    )
  }

  /**
   * Download a message attachment to Beeper's device and return the local file
   * path. `id` is the attachment identifier (typically an `mxc://` URL) surfaced
   * on `AttachmentSummary`. Throws a `BeeperError` if the download fails or the
   * server returns no local path — the caller degrades visibly (invariant 8).
   * The returned path is never logged (invariant 6).
   */
  async downloadAttachment(id: string): Promise<{ localPath: string }> {
    return this.#guard(async () => {
      const result = await this.#client.assets.download({ url: id })
      if (result.error !== undefined || result.srcURL === undefined) {
        throw new Error(result.error ?? 'Attachment download returned no file path')
      }
      return { localPath: result.srcURL }
    })
  }

  /** Archive (or unarchive) a chat via Beeper's dedicated endpoint. Beeper owns
   *  the state; we just request the change (capability is gated by the caller). */
  async setArchived(chatID: string, archived: boolean): Promise<void> {
    return this.#guard(async () => {
      await this.#client.chats.archive(chatID, { archived })
    })
  }

  /** Add a reaction to a message (only on an explicit user action — invariant 5).
   *  Capability is gated by the caller; Beeper owns the final say and a rejection
   *  surfaces as a normalized error the caller shows honestly (invariant 8). */
  async addReaction(chatID: string, messageID: string, reactionKey: string): Promise<void> {
    return this.#guard(async () => {
      await this.#client.chats.messages.reactions.add(messageID, { chatID, reactionKey })
    })
  }

  /** Run an SDK call, normalizing any thrown value into a `BeeperError`. */
  async #guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      throw normalizeError(err)
    }
  }

  /** Drain an auto-paginating list up to `limit` items (bounded memory). A
   *  failure fetching a *continuation* page is non-fatal — we return what we
   *  already collected (Beeper 4.2.x intermittently 400s on pagination
   *  continuations; better to show the first page than fail the whole load). A
   *  first-page failure still propagates so real errors surface. */
  async #collect<T>(iterable: AsyncIterable<T>, limit: number): Promise<T[]> {
    const out: T[] = []
    try {
      for await (const item of iterable) {
        out.push(item)
        if (out.length >= limit) break
      }
    } catch (err) {
      if (out.length === 0) throw err
    }
    return out
  }
}
