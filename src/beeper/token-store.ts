import type { TokenSet } from '@/beeper/oauth.ts'
import { createFileSecretStore, fallbackDir } from '@/beeper/secret-file-store.ts'
import { resolveConfig } from '@/beeper/config.ts'

/**
 * Persistence for the OAuth session. Backed by `Bun.secrets` — Bun's
 * built-in cross-platform OS credential store (macOS Keychain / Linux
 * Secret Service / Windows Credential Manager). In-process, so the secret never
 * touches a command line (invariant 6), and it *is* the platform credential
 * store on every OS (invariant 1) — no config file, no plaintext, no argv.
 *
 * The backend is an injected `SecretStore` so the store logic is unit-tested
 * with an in-memory fake, never touching the real keychain in tests / CI.
 *
 * We persist the dynamically-registered `clientId` alongside the tokens because
 * refresh and revoke both require the same client the tokens were issued to.
 */

const SERVICE = 'beeper-tui'
const AUTH_NAME = 'oauth-session'

/** The stored OAuth session: the registered client + its tokens. */
export interface StoredAuth {
  clientId: string
  tokens: TokenSet
}

/** Minimal secret backend. `Bun.secrets` satisfies this in production. */
export interface SecretStore {
  get(opts: { service: string; name: string }): Promise<string | null>
  set(opts: { service: string; name: string; value: string }): Promise<void>
  delete(opts: { service: string; name: string }): Promise<unknown>
}

/** The real backend: Bun's cross-platform OS credential store. */
export const bunSecrets: SecretStore = {
  get: (opts) => Bun.secrets.get(opts),
  set: (opts) => Bun.secrets.set(opts),
  delete: (opts) => Bun.secrets.delete(opts),
}

let cachedDefault: SecretStore | null = null

/**
 * The store to use when none is injected: `Bun.secrets` (the OS credential
 * store) where a keyring is reachable, else the encrypted-file fallback for
 * headless boxes with no Secret Service. The choice is probed once and cached.
 */
export async function getDefaultStore(): Promise<SecretStore> {
  if (cachedDefault !== null) return cachedDefault
  let keyringWorks = true
  try {
    // A harmless read: succeeds (or returns null) when a keyring is present,
    // throws when there's none to talk to.
    await bunSecrets.get({ service: SERVICE, name: '__probe__' })
  } catch {
    keyringWorks = false
  }
  cachedDefault = keyringWorks
    ? bunSecrets
    : createFileSecretStore(fallbackDir(resolveConfig().configPath))
  return cachedDefault
}

/** Persist the OAuth session (client id + access/refresh/expiry) securely. */
export async function saveAuth(auth: StoredAuth, store?: SecretStore): Promise<void> {
  const s = store ?? (await getDefaultStore())
  await s.set({ service: SERVICE, name: AUTH_NAME, value: JSON.stringify(auth) })
}

/** Load the stored OAuth session, or null when absent / unreadable / malformed
 *  (a corrupt entry degrades to "logged out", never a crash). */
export async function loadAuth(store?: SecretStore): Promise<StoredAuth | null> {
  const s = store ?? (await getDefaultStore())
  let raw: string | null
  try {
    raw = await s.get({ service: SERVICE, name: AUTH_NAME })
  } catch {
    // No keyring available (e.g. headless Linux with no Secret Service) → treat
    // as no stored session rather than crashing; the caller falls back to env/CLI.
    return null
  }
  if (raw === null || raw.length === 0) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof (parsed as { clientId?: unknown }).clientId === 'string' &&
      typeof (parsed as { tokens?: { accessToken?: unknown } }).tokens?.accessToken === 'string'
    ) {
      return parsed as StoredAuth
    }
    return null
  } catch {
    return null
  }
}

/** Remove the stored OAuth session (logout). Best-effort + idempotent. */
export async function clearAuth(store?: SecretStore): Promise<void> {
  const s = store ?? (await getDefaultStore())
  try {
    await s.delete({ service: SERVICE, name: AUTH_NAME })
  } catch {
    // Nothing stored / no keyring — logout is idempotent.
  }
}
