import { describe, expect, test } from 'bun:test'
import {
  clearAuth,
  loadAuth,
  saveAuth,
  type SecretStore,
  type StoredAuth,
} from '@/beeper/token-store.ts'

/** In-memory secret backend so persistence is tested without the real keychain. */
function fakeStore(
  initial: Record<string, string> = {}
): SecretStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  const key = (o: { service: string; name: string }) => `${o.service}/${o.name}`
  return {
    data,
    get: async (o) => data.get(key(o)) ?? null,
    set: async (o) => void data.set(key(o), o.value),
    delete: async (o) => data.delete(key(o)),
  }
}

const auth: StoredAuth = {
  clientId: 'client-1',
  tokens: { accessToken: 'AT', refreshToken: 'RT', expiresAt: 1_700_000_000_000 },
}

describe('token store', () => {
  test('save then load round-trips the OAuth session', async () => {
    const store = fakeStore()
    await saveAuth(auth, store)
    expect(await loadAuth(store)).toEqual(auth)
  })

  test('load returns null when nothing is stored', async () => {
    expect(await loadAuth(fakeStore())).toBeNull()
  })

  test('load degrades to null (logged out) on a corrupt entry, never throws', async () => {
    const store = fakeStore({ 'beeptui/oauth-session': 'not json{' })
    expect(await loadAuth(store)).toBeNull()
  })

  test('load rejects a blob missing clientId or accessToken', async () => {
    expect(
      await loadAuth(
        fakeStore({ 'beeptui/oauth-session': JSON.stringify({ tokens: { accessToken: 'x' } }) })
      )
    ).toBeNull()
    expect(
      await loadAuth(fakeStore({ 'beeptui/oauth-session': JSON.stringify({ clientId: 'c' }) }))
    ).toBeNull()
  })

  test('clear removes the stored session (logout)', async () => {
    const store = fakeStore()
    await saveAuth(auth, store)
    await clearAuth(store)
    expect(await loadAuth(store)).toBeNull()
  })

  test('a backend that throws (no keyring) degrades to null / no-op, not a crash', async () => {
    const throwing: SecretStore = {
      get: async () => {
        throw new Error('no Secret Service')
      },
      set: async () => {
        throw new Error('no Secret Service')
      },
      delete: async () => {
        throw new Error('no Secret Service')
      },
    }
    expect(await loadAuth(throwing)).toBeNull()
    await clearAuth(throwing) // must not throw
  })
})
