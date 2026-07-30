import { describe, expect, test } from 'bun:test'
import { BeeperAdapter } from '@/beeper/client.ts'
import {
  accountsFixture,
  chatsFixture,
  infoFixture,
  messagesFixture,
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
    expect(sentQuery).toContain('direction=older')
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
