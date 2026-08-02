import { createElement } from 'react'
import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App } from '@/tui/app.tsx'
import { createStore } from '@/state/store.ts'
import type { AppEvent } from '@/state/types.ts'
import { formatFrameSummary, summarizeFrameTimes } from '@/tui/frame-profiler.ts'
import type { Account, ChatSummary, MessageSummary } from '@/beeper/types.ts'

/**
 * Render-loop profiler. Seeds a large synthetic inbox, renders the real App,
 * replays a burst of live inbound messages on the open conversation, and
 * measures inter-frame times via the renderer's frame callback.
 *
 * Needs a real TTY + the native OpenTUI renderer, so it can't run in the
 * headless unit suite (the maths lives in `frame-profiler.ts`, which is tested).
 * Run it in a terminal:  `bun run src/tui/profile.ts`
 *
 * Output (stderr): p50/p95/p99/max inter-frame times + mean FPS, plus the
 * terminal's detected image capabilities (kitty graphics / sixel) — the latter
 * feeds the media-preview work (docs/PERF.md, polish backlog).
 */

const ACCOUNTS = ['wa', 'fb', 'sl', 'tg', 'dc']
const N_CHATS = 3000
const BURST = 300
const BURST_GAP_MS = 8

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
    isArchived: false,
    isMuted: false,
    lastActivity: `2026-07-30T00:${String(i % 60).padStart(2, '0')}:00.000Z`,
  }
}

function msg(n: number): MessageSummary {
  return {
    id: `c1-m${n}`,
    chatId: 'c1',
    accountId: 'wa',
    senderId: 'x',
    timestamp: `2026-07-30T01:00:${String(n % 60).padStart(2, '0')}.000Z`,
    sortKey: String(n).padStart(6, '0'),
    text: `message ${n} — the quick brown fox jumps over the lazy dog`,
    isSender: false,
    isUnread: false,
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const noop = () => {}

async function main(): Promise<void> {
  const store = createStore()
  ;(
    [
      { type: 'accounts/loaded', accounts: ACCOUNTS.map(account) },
      { type: 'chats/loaded', chats: Array.from({ length: N_CHATS }, (_, i) => chat(i)) },
      { type: 'chat/selected', chatId: 'c1' },
      {
        type: 'messages/loaded',
        chatId: 'c1',
        messages: Array.from({ length: 200 }, (_, n) => msg(n)),
        page: 'initial',
      },
    ] as AppEvent[]
  ).forEach(store.dispatch)

  let renderer
  try {
    renderer = await createCliRenderer()
  } catch (err) {
    process.stderr.write(
      `[profile] could not start the renderer — run this in a real terminal (TTY).\n${String(err)}\n`
    )
    process.exit(1)
  }

  const deltas: number[] = []
  let recording = false
  renderer.setGatherStats(true)
  renderer.setFrameCallback(async (deltaTime: number) => {
    if (recording) deltas.push(deltaTime)
  })

  createRoot(renderer).render(
    createElement(App, {
      store,
      onQuit: noop,
      onRefresh: noop,
      onOpenChat: noop,
      onLoadOlder: noop,
      onSend: noop,
      onRetry: noop,
      onSearchMessages: noop,
      onArchiveChat: noop,
      onOpenAttachment: noop,
      onSaveAttachment: noop,
    })
  )

  await sleep(600) // warm-up: let the first frames + layout settle
  recording = true
  for (let n = 200; n < 200 + BURST; n++) {
    store.dispatch({ type: 'message/received', message: msg(n) })
    await sleep(BURST_GAP_MS)
  }
  await sleep(400) // let the tail of the burst flush
  recording = false

  const summary = summarizeFrameTimes(deltas)
  const caps = renderer.capabilities
  renderer.destroy()

  process.stderr.write(
    `\n${formatFrameSummary(summary, `inbound burst (${BURST} msgs @ ${BURST_GAP_MS}ms, ${N_CHATS}-chat inbox)`)}\n`
  )
  if (caps !== null) {
    process.stderr.write(
      `[profile] image caps — kitty_graphics: ${caps.kitty_graphics}, sixel: ${caps.sixel}\n`
    )
  }
  process.exit(0)
}

if (import.meta.main) {
  void main()
}
