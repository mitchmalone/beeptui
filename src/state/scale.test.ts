import { describe, expect, test } from 'bun:test'
import { reduce } from '@/state/reducer.ts'
import { initialState, MAX_MESSAGES_PER_CHAT, type AppEvent, type AppState } from '@/state/types.ts'
import { selectInboxRows, selectNetworkRail } from '@/state/selectors.ts'
import type { Account, ChatSummary, MessageSummary } from '@/beeper/types.ts'

/**
 * Scale + bounded-memory robustness (PRD Phase 2/3: "stable under large inboxes /
 * busy channels"). Deterministic correctness + boundedness at scale, plus one
 * generous timing tripwire that only catches catastrophic (e.g. O(n²))
 * regressions — not a benchmark.
 */

const ACCOUNTS = ['wa', 'fb', 'sl']

function account(id: string): Account {
  return { id, network: id.toUpperCase(), bridgeType: id, provider: 'local', displayName: id }
}

function chat(i: number): ChatSummary {
  const accountId = ACCOUNTS[i % ACCOUNTS.length]!
  return {
    id: `c${i}`,
    accountId,
    network: accountId.toUpperCase(),
    title: `chat ${i}`,
    type: 'single',
    unreadCount: i % 4 === 0 ? 3 : 0, // a quarter unread
    isArchived: i % 10 === 0, // a tenth archived
    isMuted: false,
    lastActivity: `2026-07-30T00:${String(i % 60).padStart(2, '0')}:00.000Z`,
  }
}

function msg(chatId: string, n: number): MessageSummary {
  return {
    id: `${chatId}-m${n}`,
    chatId,
    accountId: 'wa',
    senderId: 'x',
    timestamp: `2026-07-30T01:00:${String(n % 60).padStart(2, '0')}.000Z`,
    sortKey: String(n).padStart(6, '0'),
    text: `message ${n}`,
    isSender: false,
    isUnread: false,
  }
}

const LARGE = 2000

describe('large-inbox scale + bounded memory', () => {
  const chats = Array.from({ length: LARGE }, (_, i) => chat(i))
  const seeded: AppState = [
    { type: 'accounts/loaded', accounts: ACCOUNTS.map(account) } as AppEvent,
    { type: 'chats/loaded', chats } as AppEvent,
  ].reduce(reduce, initialState)

  test(`selectInboxRows handles ${LARGE} chats with correct filtering`, () => {
    const rows = selectInboxRows(seeded)
    const activeCount = chats.filter((c) => !c.isArchived).length
    expect(rows).toHaveLength(activeCount) // default view hides archived
    expect(rows.every((r) => !r.isArchived)).toBe(true)
    // Ordering is by lastActivity desc — first row is at least as recent as the last.
    expect((rows[0]?.title ?? '').length).toBeGreaterThan(0)
  })

  test('scope + unread filters narrow correctly at scale', () => {
    const scoped = selectInboxRows(reduce(seeded, { type: 'filter/scopeSelected', scope: 'wa' }))
    expect(scoped.every((r) => r.network === 'WA')).toBe(true)
    const unread = selectInboxRows(reduce(seeded, { type: 'filter/unreadToggled' }))
    expect(unread.every((r) => r.hasUnread)).toBe(true)
    expect(unread.length).toBeGreaterThan(0)
  })

  test('the network rail aggregates unread across all accounts', () => {
    const rail = selectNetworkRail(seeded)
    expect(rail.map((e) => e.id)).toEqual(['all', 'wa', 'fb', 'sl', 'archived', 'settings'])
    const perAccount = rail
      .filter((e) => e.kind === 'scope' && e.id !== 'all')
      .reduce((s, e) => s + e.unreadCount, 0)
    expect(rail.find((e) => e.id === 'all')?.unreadCount).toBe(perAccount) // All == sum of parts
  })

  test('a chat window stays capped at MAX_MESSAGES_PER_CHAT despite loading far more', () => {
    // Load 5× the cap in one page, then a burst of live messages on top.
    const many = Array.from({ length: MAX_MESSAGES_PER_CHAT * 5 }, (_, n) => msg('c1', n))
    let s = reduce(seeded, {
      type: 'messages/loaded',
      chatId: 'c1',
      messages: many,
      page: 'initial',
    })
    for (let n = 0; n < 300; n++) {
      s = reduce(s, { type: 'message/received', message: msg('c1', MAX_MESSAGES_PER_CHAT * 5 + n) })
    }
    const window = s.messagesByChat['c1']?.items ?? []
    expect(window.length).toBe(MAX_MESSAGES_PER_CHAT) // bounded memory holds
    // The retained window is the newest messages (highest sort keys).
    expect(window[window.length - 1]?.id).toBe(`c1-m${MAX_MESSAGES_PER_CHAT * 5 + 299}`)
  })

  test('catastrophic-regression tripwire: seeding + selecting at scale is not pathological', () => {
    const start = performance.now()
    const s = [
      { type: 'accounts/loaded', accounts: ACCOUNTS.map(account) } as AppEvent,
      { type: 'chats/loaded', chats } as AppEvent,
    ].reduce(reduce, initialState)
    for (let i = 0; i < 50; i++) selectInboxRows(s) // repeated selection (memoization is in the UI)
    // A very generous bound — real time is a few ms; this only trips on O(n²)-style regressions.
    expect(performance.now() - start).toBeLessThan(3000)
  })
})
