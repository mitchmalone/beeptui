import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { MessageSearchPalette } from '@/tui/components/MessageSearchPalette.tsx'
import {
  initialMessageSearch,
  type MessageSearchHit,
  type MessageSearchState,
} from '@/state/types.ts'

function hit(over: Partial<MessageSearchHit> = {}): MessageSearchHit {
  return {
    messageId: 'm1',
    chatId: 'c1',
    chatTitle: 'Grace Hopper',
    network: 'WhatsApp',
    senderName: 'Grace',
    timestamp: '2026-07-30T09:41:00.000Z',
    snippet: 'Are we still on for Friday?',
    ...over,
  }
}

async function frameOf(over: Partial<MessageSearchState> = {}): Promise<string> {
  const state: MessageSearchState = { ...initialMessageSearch, ...over }
  const { renderOnce, captureCharFrame } = await testRender(
    <MessageSearchPalette state={state} />,
    { width: 70, height: 20 }
  )
  await renderOnce()
  return captureCharFrame()
}

describe('MessageSearchPalette', () => {
  test('prompts for a query when idle', async () => {
    expect(await frameOf()).toContain('Type a query')
  })

  test('shows searching state', async () => {
    expect(await frameOf({ query: 'friday', status: 'searching' })).toContain('Searching')
  })

  test('renders hits with chat context, sender, time, and snippet', async () => {
    const frame = await frameOf({ status: 'done', results: [hit()] })
    expect(frame).toContain('Grace Hopper')
    expect(frame).toContain('WA') // network marker
    expect(frame).toContain('09:41') // time
    expect(frame).toContain('Are we still on for Friday?')
  })

  test('labels partial coverage honestly', async () => {
    const frame = await frameOf({
      status: 'done',
      results: [hit()],
      partial: true,
      note: 'Local results — server search unavailable',
    })
    expect(frame).toContain('partial')
    expect(frame).toContain('Local results')
  })

  test('done with no results says so', async () => {
    expect(await frameOf({ query: 'zzz', status: 'done', results: [] })).toContain('No matches')
  })

  test('error state surfaces the note', async () => {
    expect(await frameOf({ status: 'error', note: 'Search unavailable' })).toContain(
      'Search unavailable'
    )
  })

  test('scoped search names the chat scope', async () => {
    expect(await frameOf({ scopeChatId: 'c1' })).toContain('this chat')
  })
})
