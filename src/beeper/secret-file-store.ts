import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { SecretStore } from '@/beeper/token-store.ts'

/**
 * Encrypted-file fallback for the token store (Slice 13). Used only where
 * `Bun.secrets` has no OS keyring to talk to — headless Linux / minimal
 * containers with no Secret Service daemon. Everywhere else uses the platform
 * credential store directly.
 *
 * Secrets are AES-256-GCM encrypted (Web Crypto, stdlib) into a `0600` file; the
 * key lives in a sibling `0600` keyfile, generated on first use. This is weaker
 * than an OS keychain — an attacker with read access to the user's home dir can
 * read both files — but that's the same exposure the token would have on such a
 * box anyway, and it keeps the secret out of logs, argv, and the JSON config
 * (invariant 6). No plaintext token ever hits disk.
 */

/** Filesystem seam so the store is unit-testable with an in-memory fake. */
export interface FileIO {
  read(path: string): Promise<string | null>
  write(path: string, data: string): Promise<void>
  ensureDir(path: string): Promise<void>
}

/** Real, `0600`-permissioned filesystem backend. */
export const nodeFileIO: FileIO = {
  read: async (path) => {
    try {
      return await readFile(path, 'utf8')
    } catch {
      return null
    }
  },
  write: async (path, data) => {
    await writeFile(path, data, { mode: 0o600 })
    await chmod(path, 0o600) // re-assert in case the file pre-existed
  },
  ensureDir: async (path) => {
    await mkdir(path, { recursive: true, mode: 0o700 })
  },
}

function b64encode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function b64decode(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Copy a byte array into a fresh, plain-`ArrayBuffer`-backed view (satisfies
 *  the Web Crypto `BufferSource` type under strict TS). */
function bytes(src: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(src.length))
  out.set(src)
  return out
}

/**
 * A `SecretStore` backed by an AES-256-GCM encrypted file at `dir/secrets.enc`,
 * keyed by `dir/secret.key`. `io` is injected (real fs by default) so the
 * encrypt/decrypt round-trip is tested against an in-memory backend.
 */
export function createFileSecretStore(dir: string, io: FileIO = nodeFileIO): SecretStore {
  const keyPath = join(dir, 'secret.key')
  const dataPath = join(dir, 'secrets.enc')

  async function getKey(): Promise<CryptoKey> {
    await io.ensureDir(dir)
    let raw = await io.read(keyPath)
    if (raw === null) {
      raw = b64encode(crypto.getRandomValues(new Uint8Array(32)))
      await io.write(keyPath, raw)
    }
    return crypto.subtle.importKey('raw', b64decode(raw), 'AES-GCM', false, ['encrypt', 'decrypt'])
  }

  async function loadMap(): Promise<Record<string, string>> {
    const raw = await io.read(dataPath)
    if (raw === null || raw.length === 0) return {}
    try {
      const [ivB64, ctB64] = raw.split('.')
      if (ivB64 === undefined || ctB64 === undefined) return {}
      const key = await getKey()
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64decode(ivB64) },
        key,
        b64decode(ctB64)
      )
      const parsed: unknown = JSON.parse(new TextDecoder().decode(plain))
      return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
    } catch {
      // Corrupt / undecryptable file → treat as empty (logged out) rather than crash.
      return {}
    }
  }

  async function persist(map: Record<string, string>): Promise<void> {
    const key = await getKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      bytes(new TextEncoder().encode(JSON.stringify(map)))
    )
    await io.ensureDir(dir)
    await io.write(dataPath, `${b64encode(iv)}.${b64encode(new Uint8Array(ct))}`)
  }

  const entryKey = (o: { service: string; name: string }) => `${o.service}/${o.name}`

  return {
    get: async (o) => (await loadMap())[entryKey(o)] ?? null,
    set: async (o) => {
      const map = await loadMap()
      map[entryKey(o)] = o.value
      await persist(map)
    },
    delete: async (o) => {
      const map = await loadMap()
      delete map[entryKey(o)]
      await persist(map)
    },
  }
}

/** The config directory that holds the fallback files (parent of config.json). */
export function fallbackDir(configPath: string): string {
  return dirname(configPath)
}
