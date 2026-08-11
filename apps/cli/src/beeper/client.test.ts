import { describe, expect, test } from 'bun:test'
import { BeeperAdapter } from '@/beeper/client.ts'
import {
  accountsFixture,
  chatsFixture,
  infoFixture,
  messagesFixture,
  searchFixture,
  sendFixture,
} from '@/beeper/fixtures.ts'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function page(items: unknown[]): Response {
  return json({ items, hasMore: false, oldestCursor: null, newestCursor: null })
}

/** A fetch stub that routes by method + pathname to fixture responses. */
function fakeFetch(handler: (method: string, path: string) => Response): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString())
    const method = (init?.method ?? 'GET').toUpperCase()
    return handler(method, url.pathname)
  }) as unknown as typeof fetch
}

function adapter(fetchImpl: typeof fetch, accessToken = 'test-token'): BeeperAdapter {
  return new BeeperAdapter({ endpoint: 'http://127.0.0.1:23373', accessToken, fetch: fetchImpl })
}

describe('BeeperAdapter happy paths', () => {
  test('getInfo returns mapped ServerInfo', async () => {
    const a = adapter(fakeFetch((_m, p) => (p === '/v1/info' ? json(infoFixture) : json({}, 404))))
    const info = await a.getInfo()
    expect(info.appVersion).toBe('4.2.900')
    expect(info.baseUrl).toBe('http://127.0.0.1:23373')
  })

  test('listAccounts returns mapped accounts', async () => {
    const a = adapter(
      fakeFetch((_m, p) => (p === '/v1/accounts' ? json(accountsFixture) : json({}, 404)))
    )
    const accounts = await a.listAccounts()
    expect(accounts.map((x) => x.network)).toEqual(['WhatsApp', 'Slack'])
  })

  test('listChats returns mapped chat summaries, bounded by limit', async () => {
    const a = adapter(
      fakeFetch((_m, p) => (p === '/v1/chats' ? page(chatsFixture) : json({}, 404)))
    )
    const chats = await a.listChats({ limit: 1 })
    expect(chats).toHaveLength(1)
    expect(chats[0]?.title).toBe('Grace Hopper')
  })

  test('a failing pagination continuation returns the first page (not a hard error)', async () => {
    let calls = 0
    const flaky = (async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input.toString())
      if (url.pathname !== '/v1/chats') return json({}, 404)
      calls += 1
      return calls === 1
        ? json({ items: chatsFixture, hasMore: true, oldestCursor: 'c', newestCursor: 'c' })
        : json({ code: 'VALIDATION_ERROR', message: 'Invalid input' }, 400)
    }) as unknown as typeof fetch
    const chats = await adapter(flaky).listChats({ limit: 100 })
    expect(chats).toHaveLength(chatsFixture.length) // first page survived the bad continuation
    expect(calls).toBeGreaterThanOrEqual(2) // it did attempt the continuation
  })

  test('listMessages returns a page of mapped messages with cursor + hasMore', async () => {
    const a = adapter(
      fakeFetch((_m, p) => (p.endsWith('/messages') ? page(messagesFixture) : json({}, 404)))
    )
    const result = await a.listMessages('!wa-1:beeper.local')
    expect(result.messages).toHaveLength(2)
    expect(result.messages[1]?.isSender).toBe(true)
    expect(result.hasMore).toBe(false)
    expect(result.cursor).toBeNull()
  })

  test('listMessages passes the cursor when paging older history', async () => {
    let sentQuery = ''
    const capturingFetch = (async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input.toString())
      sentQuery = url.search
      return page(messagesFixture)
    }) as unknown as typeof fetch
    const a = adapter(capturingFetch)
    await a.listMessages('!wa-1:beeper.local', { cursor: 'CURSOR-1' })
    expect(sentQuery).toContain('cursor=CURSOR-1')
    expect(sentQuery).toContain('direction=before')
  })

  test('searchMessages returns mapped hits and reports scope honored when unscoped', async () => {
    const a = adapter(
      fakeFetch((_m, p) => (p.endsWith('/messages/search') ? page(searchFixture) : json({}, 404)))
    )
    const result = await a.searchMessages('Friday')
    expect(result.messages.map((m) => m.id)).toEqual(['search-wa-1', 'search-slack-1'])
    expect(result.scopeHonored).toBe(true) // nothing requested to honor
    expect(result.capped).toBe(false)
  })

  test('searchMessages passes the query and chat scope', async () => {
    let sentQuery = ''
    const capturing = (async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input.toString())
      sentQuery = url.search
      return page(searchFixture)
    }) as unknown as typeof fetch
    await adapter(capturing).searchMessages('Friday', { accountId: 'local-whatsapp' })
    expect(sentQuery).toContain('query=Friday')
    expect(sentQuery).toContain('local-whatsapp')
  })

  test('a scope-ignoring server is detected (scopeHonored false), never silently wrong', async () => {
    // We ask for one chat; the server returns hits from another chat too.
    const a = adapter(
      fakeFetch((_m, p) => (p.endsWith('/messages/search') ? page(searchFixture) : json({}, 404)))
    )
    const result = await a.searchMessages('Friday', { chatId: '!wa-1:beeper.local' })
    expect(result.messages.length).toBe(2) // includes the out-of-scope slack hit
    expect(result.scopeHonored).toBe(false) // so the caller can fall back / label
  })

  test('a scope-honoring server reports scopeHonored true', async () => {
    const onlyWa = searchFixture.filter((m) => m.chatID === '!wa-1:beeper.local')
    const a = adapter(
      fakeFetch((_m, p) => (p.endsWith('/messages/search') ? page(onlyWa) : json({}, 404)))
    )
    const result = await a.searchMessages('Friday', { chatId: '!wa-1:beeper.local' })
    expect(result.scopeHonored).toBe(true)
    expect(result.messages.map((m) => m.id)).toEqual(['search-wa-1'])
  })

  test('setArchived posts to the archive endpoint with the archived flag', async () => {
    let body: unknown = null
    let path = ''
    const capturing = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input.toString())
      path = url.pathname
      body = init?.body ? JSON.parse(String(init.body)) : null
      return json({})
    }) as unknown as typeof fetch
    await adapter(capturing).setArchived('!wa-1:beeper.local', true)
    expect(path).toContain('/archive')
    expect(body).toMatchObject({ archived: true })
  })

  test('addReaction posts the reaction key to the message reactions endpoint', async () => {
    let body: unknown = null
    let path = ''
    let method = ''
    const capturing = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input.toString())
      path = url.pathname
      method = init?.method ?? 'GET'
      body = init?.body ? JSON.parse(String(init.body)) : null
      return json({ success: true })
    }) as unknown as typeof fetch
    await adapter(capturing).addReaction('!wa-1:beeper.local', 'm-42', '👍')
    expect(method).toBe('POST')
    expect(path).toContain('/messages/m-42/reactions')
    expect(body).toMatchObject({ reactionKey: '👍' })
  })

  test('sendMessage posts and returns the pending id', async () => {
    let sawPost = false
    const a = adapter(
      fakeFetch((m, p) => {
        if (m === 'POST' && p.endsWith('/messages')) {
          sawPost = true
          return json(sendFixture)
        }
        return json({}, 404)
      })
    )
    const result = await a.sendMessage('!wa-1:beeper.local', 'On it.')
    expect(sawPost).toBe(true)
    expect(result.pendingMessageId).toBe('pending-abc123')
  })

  test('sendMessage carries replyToMessageID when replying', async () => {
    let body: Record<string, unknown> | null = null
    const capturing = (async (_input: string | URL | Request, init?: RequestInit) => {
      body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
      return json(sendFixture)
    }) as unknown as typeof fetch
    await adapter(capturing).sendMessage('!wa-1:beeper.local', 'On it.', {
      replyToId: 'msg-original',
    })
    expect(body).toMatchObject({ text: 'On it.', replyToMessageID: 'msg-original' })
  })

  test('sendMessage omits replyToMessageID for a plain send', async () => {
    let body: Record<string, unknown> | null = null
    const capturing = (async (_input: string | URL | Request, init?: RequestInit) => {
      body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
      return json(sendFixture)
    }) as unknown as typeof fetch
    await adapter(capturing).sendMessage('!wa-1:beeper.local', 'Hi.')
    expect(body).not.toHaveProperty('replyToMessageID')
  })

  test('downloadAttachment posts the id and returns the local path', async () => {
    let path = ''
    let body: Record<string, unknown> | null = null
    const capturing = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input.toString())
      path = url.pathname
      body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
      return json({ srcURL: '/cache/beeper/file.png' })
    }) as unknown as typeof fetch
    const result = await adapter(capturing).downloadAttachment('mxc://beeper.local/abc')
    expect(path).toContain('/assets/download')
    expect(body).toMatchObject({ url: 'mxc://beeper.local/abc' })
    expect(result.localPath).toBe('/cache/beeper/file.png')
  })

  test('downloadAttachment throws when the server reports an error', async () => {
    const a = adapter(fakeFetch(() => json({ error: 'not found' })))
    await expect(a.downloadAttachment('mxc://beeper.local/missing')).rejects.toBeTruthy()
  })
})

describe('BeeperAdapter error normalization', () => {
  test('connection refusal → unreachable', async () => {
    const a = adapter((() => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch)
    await expect(a.getInfo()).rejects.toMatchObject({ kind: 'unreachable' })
  })

  test('401 → unauthorized', async () => {
    const a = adapter(fakeFetch(() => json({ code: 'unauthorized', message: 'nope' }, 401)))
    await expect(a.listAccounts()).rejects.toMatchObject({ kind: 'unauthorized' })
  })

  test('429 → rate-limited', async () => {
    const a = adapter(fakeFetch(() => json({ code: 'rate_limited', message: 'slow down' }, 429)))
    await expect(a.listAccounts()).rejects.toMatchObject({ kind: 'rate-limited' })
  })
})
