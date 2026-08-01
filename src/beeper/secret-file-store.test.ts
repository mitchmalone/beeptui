import { describe, expect, test } from 'bun:test'
import { createFileSecretStore, type FileIO } from '@/beeper/secret-file-store.ts'

function memIO(): FileIO & { files: Map<string, string> } {
  const files = new Map<string, string>()
  return {
    files,
    read: async (p) => files.get(p) ?? null,
    write: async (p, d) => void files.set(p, d),
    ensureDir: async () => {},
  }
}

const entry = { service: 'beeper-tui', name: 'oauth-session' }

describe('encrypted file secret store (Slice 13 headless fallback)', () => {
  test('set then get round-trips the value', async () => {
    const io = memIO()
    const store = createFileSecretStore('/cfg', io)
    await store.set({ ...entry, value: 'secret-token-blob' })
    expect(await store.get(entry)).toBe('secret-token-blob')
  })

  test('the value is encrypted at rest, never written in plaintext', async () => {
    const io = memIO()
    await createFileSecretStore('/cfg', io).set({ ...entry, value: 'PLAINTEXT-SECRET' })
    const onDisk = [...io.files.values()].join('\n')
    expect(onDisk).not.toContain('PLAINTEXT-SECRET') // AES-GCM ciphertext only
    expect(io.files.has('/cfg/secret.key')).toBe(true) // key persisted separately
  })

  test('a second store over the same files decrypts (key persists in the keyfile)', async () => {
    const io = memIO()
    await createFileSecretStore('/cfg', io).set({ ...entry, value: 'v1' })
    // Fresh instance, same backing files → must read the same key + decrypt.
    expect(await createFileSecretStore('/cfg', io).get(entry)).toBe('v1')
  })

  test('get returns null for a missing entry; delete removes it', async () => {
    const io = memIO()
    const store = createFileSecretStore('/cfg', io)
    expect(await store.get(entry)).toBeNull()
    await store.set({ ...entry, value: 'x' })
    await store.delete(entry)
    expect(await store.get(entry)).toBeNull()
  })

  test('a corrupt data file degrades to empty (logged out), never throws', async () => {
    const io = memIO()
    io.files.set('/cfg/secrets.enc', 'not-valid-ciphertext')
    expect(await createFileSecretStore('/cfg', io).get(entry)).toBeNull()
  })

  test('multiple keys coexist in the one encrypted file', async () => {
    const io = memIO()
    const store = createFileSecretStore('/cfg', io)
    await store.set({ service: 'beeper-tui', name: 'a', value: 'AAA' })
    await store.set({ service: 'beeper-tui', name: 'b', value: 'BBB' })
    expect(await store.get({ service: 'beeper-tui', name: 'a' })).toBe('AAA')
    expect(await store.get({ service: 'beeper-tui', name: 'b' })).toBe('BBB')
  })
})
