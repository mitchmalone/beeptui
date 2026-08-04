import { describe, expect, test } from 'bun:test'
import { reduce } from '@/state/reducer.ts'
import { initialState, MAX_MESSAGES_PER_CHAT, type AppEvent, type AppState } from '@/state/types.ts'
import { selectInboxRows, selectActiveConversation } from '@/state/selectors.ts'
import type { Account, ChatSummary, MessageSummary } from '@/beeper/types.ts'

/**
 * Performance benchmark for the parts we own: event application (reducer) and
 * selector computation. The PRD success criteria are end-to-end and
 * I/O-dominated (inbox usable within 3s of launch; a new message rendered
 * within 2s of receipt) — so the reducer/selector cost must stay a *tiny*
 * fraction of those budgets, leaving essentially all of it to Beeper + the
 * network. These assertions are deliberately generous regression tripwires
 * (~10× real), not tight SLAs, so they don't flake on a loaded CI runner; the
 * measured numbers are printed for the record (docs/PERF.md).
 *
 * NB: this covers state throughput only. Render-loop profiling needs the live
 * OpenTUI renderer and is tracked separately (docs/PERF.md) — it can't be
 * measured from a headless unit test.
 */

const ACCOUNTS = ['wa', 'fb', 'sl', 'tg', 'dc']

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
    unreadCount: i % 4 === 0 ? 3 : 0,
    isArchived: i % 10 === 0,
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

/** Median of repeated timings — robust to a single GC pause skewing the mean. */
function medianMs(iterations: number, fn: () => void): number {
  const samples: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    fn()
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  return samples[Math.floor(samples.length / 2)] ?? 0
}

const N_CHATS = 5000
const N_LIVE = 2000

describe('state performance benchmark', () => {
  const chats = Array.from({ length: N_CHATS }, (_, i) => chat(i))

  test(`seeding ${N_CHATS} chats is well under the launch budget`, () => {
    const seedMs = medianMs(5, () => {
      ;[
        { type: 'accounts/loaded', accounts: ACCOUNTS.map(account) } as AppEvent,
        { type: 'chats/loaded', chats } as AppEvent,
      ].reduce(reduce, initialState)
    })
    console.log(`  [perf] seed ${N_CHATS} chats: ${seedMs.toFixed(2)}ms (median of 5)`)
    // Generous: leaves the 3s launch budget almost entirely to I/O.
    expect(seedMs).toBeLessThan(300)
  })

  const seeded: AppState = [
    { type: 'accounts/loaded', accounts: ACCOUNTS.map(account) } as AppEvent,
    { type: 'chats/loaded', chats } as AppEvent,
  ].reduce(reduce, initialState)

  test(`selectInboxRows over ${N_CHATS} chats stays interactive`, () => {
    const selMs = medianMs(20, () => {
      selectInboxRows(seeded)
    })
    console.log(`  [perf] selectInboxRows(${N_CHATS}): ${selMs.toFixed(2)}ms (median of 20)`)
    // A single unmemoized selection must be imperceptible; the UI also memoizes.
    expect(selMs).toBeLessThan(50)
  })

  test(`applying ${N_LIVE} live messages averages well under a millisecond each`, () => {
    let s = reduce(seeded, { type: 'chat/selected', chatId: 'c1' })
    // Measure the viewport: without it the reducer skips the row-layout path
    // entirely and this benchmark would not see its cost at all.
    s = reduce(s, { type: 'viewport/measured', rows: 40, cols: 120 })
    const start = performance.now()
    for (let n = 0; n < N_LIVE; n++) {
      s = reduce(s, { type: 'message/received', message: msg('c1', n) })
    }
    const totalMs = performance.now() - start
    const perEventUs = (totalMs / N_LIVE) * 1000
    console.log(
      `  [perf] ${N_LIVE} live message/received: ${totalMs.toFixed(2)}ms total, ` +
        `${perEventUs.toFixed(1)}µs/event`
    )
    // Selecting the active conversation after the burst is still cheap.
    const convMs = medianMs(20, () => {
      selectActiveConversation(s)
    })
    console.log(`  [perf] selectActiveConversation after burst: ${convMs.toFixed(2)}ms`)
    // Each event well under the 2s render budget with vast headroom.
    expect(totalMs / N_LIVE).toBeLessThan(2)
    expect(convMs).toBeLessThan(50)
  })

  test('scrolled-up arrivals and cursor moves stay cheap with a full message window', () => {
    // Both paths lay the whole loaded window out into rows to work in row
    // units, so they are the most expensive things the reducer does. Fill the
    // window first so this measures the worst case, not an empty chat.
    let s = reduce(seeded, { type: 'chat/selected', chatId: 'c1' })
    s = reduce(s, { type: 'viewport/measured', rows: 40, cols: 120 })
    // A genuinely full window — the worst case, and the one that used to skip the
    // offset-bump branch entirely and make this measurement vacuous.
    for (let n = 0; n < MAX_MESSAGES_PER_CHAT; n++) {
      s = reduce(s, { type: 'message/received', message: msg('c1', n) })
    }
    s = reduce(s, { type: 'conversation/scrolled', delta: 20 })

    // Arrival while scrolled up: lays out before and after to bump the offset
    // by the rows that were added.
    const arrivalMs = medianMs(20, () => {
      reduce(s, { type: 'message/received', message: msg('c1', 99_999) })
    })
    console.log(
      `  [perf] scrolled-up arrival (${MAX_MESSAGES_PER_CHAT} loaded): ${arrivalMs.toFixed(2)}ms`
    )

    const withCursor = reduce(s, { type: 'messageSelection/started' })
    const moveMs = medianMs(20, () => {
      reduce(withCursor, { type: 'messageSelection/moved', delta: -1 })
    })
    console.log(`  [perf] cursor move (${MAX_MESSAGES_PER_CHAT} loaded): ${moveMs.toFixed(2)}ms`)

    // A keypress must feel instant; the PRD's budget is 2s and these are the
    // reducer's heaviest events.
    expect(arrivalMs).toBeLessThan(50)
    expect(moveMs).toBeLessThan(50)
  })
})
