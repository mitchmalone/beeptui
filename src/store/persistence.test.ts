import { afterEach, describe, expect, test } from 'bun:test'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { openUiStore } from '@/store/store.ts'
import { attachPersistence } from '@/store/persistence.ts'
import { createStore } from '@/tui/store.ts'
import type { ChatSummary } from '@/beeper/types.ts'

let counter = 0
const paths: string[] = []
function tempPath(): string {
  const p = `${tmpdir()}/beeper-tui-persist-${process.pid}-${counter++}.db`
  paths.push(p)
  return p
}
afterEach(() => {
  for (const p of paths.splice(0))
    for (const s of ['', '-wal', '-shm'])
      try {
        rmSync(p + s)
      } catch {
        /* ignore */
      }
})

function chat(id: string, over: Partial<ChatSummary> = {}): ChatSummary {
  return {
    id,
    accountId: 'a',
    network: 'WhatsApp',
    title: `Chat ${id}`,
    type: 'single',
    unreadCount: 0,
    isArchived: false,
    isMuted: false,
    ...over,
  }
}

describe('hydration', () => {
  test('restores cached chats, drafts, and the last selected chat (where safe)', () => {
    const path = tempPath()
    const seed = openUiStore({ path })
    seed.putCachedChats([chat('c1', { lastActivity: '2026-07-30T02:00:00.000Z' }), chat('c2')])
    seed.setDraft('c1', 'unsent')
    seed.setViewState({ lastSelectedChatId: 'c1', scrollAnchorMessageId: null })
    seed.close()

    const ui = openUiStore({ path })
    const app = createStore()
    attachPersistence(ui, app)
    const state = app.getState()
    expect(state.chatOrder).toContain('c1')
    expect(state.drafts.c1).toBe('unsent')
    expect(state.selectedChatId).toBe('c1')
    ui.close()
  })

  test('does not restore selection for a chat that no longer exists', () => {
    const path = tempPath()
    const seed = openUiStore({ path })
    seed.setViewState({ lastSelectedChatId: 'ghost', scrollAnchorMessageId: null })
    seed.close()

    const ui = openUiStore({ path })
    const app = createStore()
    attachPersistence(ui, app)
    expect(app.getState().selectedChatId).toBeNull()
    ui.close()
  })
})

describe('write-through', () => {
  test('persists drafts on change and deletes them when cleared (e.g. on send)', () => {
    const ui = openUiStore({ path: tempPath() })
    const app = createStore()
    const handle = attachPersistence(ui, app)

    app.dispatch({ type: 'draft/changed', chatId: 'c1', text: 'hello' })
    handle.flush()
    expect(ui.getDrafts()).toEqual({ c1: 'hello' })

    app.dispatch({ type: 'draft/changed', chatId: 'c1', text: '' }) // cleared (send)
    handle.flush()
    expect(ui.getDrafts()).toEqual({})
    handle.detach()
    ui.close()
  })

  test('persists the chat cache and last-view for the next launch', () => {
    const path = tempPath()
    const ui = openUiStore({ path })
    const app = createStore()
    const handle = attachPersistence(ui, app)

    app.dispatch({ type: 'chats/loaded', chats: [chat('c1'), chat('c2')] })
    app.dispatch({ type: 'chat/selected', chatId: 'c2' })
    handle.flush()
    handle.detach()
    ui.close()

    // Fresh launch from the same DB restores it.
    const ui2 = openUiStore({ path })
    const app2 = createStore()
    attachPersistence(ui2, app2)
    expect(app2.getState().chatOrder.sort()).toEqual(['c1', 'c2'])
    expect(app2.getState().selectedChatId).toBe('c2')
    ui2.close()
  })

  test('a draft is never sent by persistence — only draft/view/cache events are used', () => {
    const ui = openUiStore({ path: tempPath() })
    const app = createStore()
    let sawSend = false
    const original = app.dispatch
    app.dispatch = (e) => {
      if (e.type === 'send/requested') sawSend = true
      original(e)
    }
    const handle = attachPersistence(ui, app)
    app.dispatch({ type: 'draft/changed', chatId: 'c1', text: 'not a send' })
    handle.flush()
    expect(sawSend).toBe(false)
    handle.detach()
    ui.close()
  })
})
