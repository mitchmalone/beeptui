import { afterEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { defaultDbPath, openUiStore } from '@/store/store.ts'
import type { ChatSummary } from '@/beeper/types.ts'

let counter = 0
const paths: string[] = []
function tempPath(): string {
  const p = `${tmpdir()}/beeper-tui-test-${process.pid}-${counter++}.db`
  paths.push(p)
  return p
}

afterEach(() => {
  for (const p of paths.splice(0)) {
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        rmSync(p + suffix)
      } catch {
        /* ignore */
      }
    }
  }
})

function chat(id: string, over: Partial<ChatSummary> = {}): ChatSummary {
  return {
    id,
    accountId: 'acc',
    network: 'WhatsApp',
    title: `Chat ${id}`,
    type: 'single',
    unreadCount: 0,
    isArchived: false,
    isMuted: false,
    ...over,
  }
}

describe('defaultDbPath', () => {
  test('honors XDG_STATE_HOME, else ~/.local/state, under beeper-tui/', () => {
    expect(defaultDbPath({ XDG_STATE_HOME: '/xdg' }, '/home/ada')).toBe('/xdg/beeper-tui/ui.db')
    expect(defaultDbPath({}, '/home/ada')).toBe('/home/ada/.local/state/beeper-tui/ui.db')
  })
})

describe('drafts', () => {
  test('set, get, update, and delete-on-empty', () => {
    const store = openUiStore({ path: tempPath() })
    store.setDraft('c1', 'hello')
    store.setDraft('c2', 'world')
    expect(store.getDrafts()).toEqual({ c1: 'hello', c2: 'world' })
    store.setDraft('c1', 'hello again')
    expect(store.getDrafts().c1).toBe('hello again')
    store.setDraft('c2', '') // empty deletes
    expect(store.getDrafts()).toEqual({ c1: 'hello again' })
    store.close()
  })

  test('drafts survive a reopen (durability)', () => {
    const path = tempPath()
    const first = openUiStore({ path })
    first.setDraft('c1', 'unsent thought')
    first.close()
    const second = openUiStore({ path })
    expect(second.getDrafts()).toEqual({ c1: 'unsent thought' })
    second.close()
  })

  test('a committed draft survives a simulated crash (no close())', () => {
    const path = tempPath()
    const store = openUiStore({ path })
    store.setDraft('c1', 'typed before kill -9')
    // Do NOT close — simulate the process being killed mid-session.
    const recovered = openUiStore({ path })
    expect(recovered.getDrafts().c1).toBe('typed before kill -9')
    recovered.close()
  })
})

describe('view state', () => {
  test('defaults to nulls, round-trips, and persists', () => {
    const path = tempPath()
    const store = openUiStore({ path })
    expect(store.getViewState()).toEqual({ lastSelectedChatId: null, scrollAnchorMessageId: null })
    store.setViewState({ lastSelectedChatId: 'c9', scrollAnchorMessageId: 'm3' })
    store.setViewState({ lastSelectedChatId: 'c9', scrollAnchorMessageId: 'm7' }) // upsert single row
    store.close()
    const reopened = openUiStore({ path })
    expect(reopened.getViewState()).toEqual({
      lastSelectedChatId: 'c9',
      scrollAnchorMessageId: 'm7',
    })
    reopened.close()
  })
})

describe('chat metadata cache', () => {
  test('write-through, ordered read, upsert, and durability', () => {
    const path = tempPath()
    const store = openUiStore({ path })
    store.putCachedChats([
      chat('a', { lastActivity: '2026-07-30T01:00:00.000Z', unreadCount: 2 }),
      chat('b', { lastActivity: '2026-07-30T03:00:00.000Z', network: 'Slack', isMuted: true }),
    ])
    let cached = store.getCachedChats()
    expect(cached.map((c) => c.id)).toEqual(['b', 'a']) // desc by lastActivity
    expect(cached.find((c) => c.id === 'b')).toMatchObject({ network: 'Slack', isMuted: true })
    // Upsert updates in place.
    store.putCachedChats([chat('a', { lastActivity: '2026-07-30T09:00:00.000Z', unreadCount: 5 })])
    store.close()
    const reopened = openUiStore({ path })
    cached = reopened.getCachedChats()
    expect(cached.find((c) => c.id === 'a')).toMatchObject({ unreadCount: 5 })
    expect(cached).toHaveLength(2)
    reopened.close()
  })
})

describe('no secrets / schema hygiene (invariant 1)', () => {
  test('schema has no table for message bodies or tokens', () => {
    const path = tempPath()
    const store = openUiStore({ path })
    store.close()
    const db = new Database(path)
    const tables = (
      db.query(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all() as Array<{
        name: string
      }>
    ).map((r) => r.name)
    db.close()
    expect(tables).toEqual(['chat_cache', 'drafts', 'schema_meta', 'view_state'])
    expect(tables.some((t) => /message|token|secret|credential/i.test(t))).toBe(false)
  })

  test('the DB file never contains a token, even after writes', () => {
    const path = tempPath()
    const store = openUiStore({ path })
    store.setDraft('c1', 'a normal unsent draft')
    store.putCachedChats([chat('a', { title: 'Ada Lovelace' })])
    store.setViewState({ lastSelectedChatId: 'c1', scrollAnchorMessageId: null })
    store.close()
    const bytes = readFileSync(path, 'latin1')
    // Metadata IS stored (that's allowed); a token never is.
    expect(bytes).toContain('a normal unsent draft')
    expect(bytes).not.toContain('beeper_sk_')
    expect(bytes).not.toContain('Bearer ')
  })
})
