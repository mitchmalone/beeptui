import type { MessageSummary } from '@/beeper/types.ts'
import type { AppState, MessageSearchHit } from '@/state/types.ts'

/**
 * Message-search helpers shared by the runtime. `toHit` enriches a bare message
 * with the chat context the palette renders; `localSearchMessages` is the honest
 * fallback used when the server search is unavailable or ignores our scope — it
 * only sees history already loaded in memory, so callers must label it partial.
 */

const SNIPPET_MAX = 80

/** Turn a message into a search hit, pulling title/network from the chat cache. */
export function toHit(state: AppState, message: MessageSummary): MessageSearchHit {
  const chat = state.chats[message.chatId]
  const senderName = message.senderName ?? (message.isSender ? 'You' : 'Unknown')
  return {
    messageId: message.id,
    chatId: message.chatId,
    chatTitle: chat?.title ?? message.chatId,
    network: chat?.network ?? '',
    senderName,
    timestamp: message.timestamp,
    snippet: (message.text ?? '').replace(/\s+/g, ' ').trim().slice(0, SNIPPET_MAX),
  }
}

/**
 * Case-insensitive substring search over messages already in memory, newest
 * first. Scoped to one chat when `scopeChatId` is set, otherwise across all
 * loaded chats. Coverage is inherently partial (loaded history only) — the
 * caller labels it as such (CLAUDE.md invariant 8).
 */
export function localSearchMessages(
  state: AppState,
  query: string,
  scopeChatId: string | null
): MessageSearchHit[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return []
  const chatIds = scopeChatId !== null ? [scopeChatId] : Object.keys(state.messagesByChat)
  const hits: MessageSearchHit[] = []
  for (const chatId of chatIds) {
    for (const message of state.messagesByChat[chatId]?.items ?? []) {
      if ((message.text ?? '').toLowerCase().includes(q)) hits.push(toHit(state, message))
    }
  }
  hits.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return hits
}
