/**
 * Token resolution. The access token lives in the platform credential store
 * (macOS Keychain), never in a config file, log, or shell argument (CLAUDE.md
 * invariant 6). Reading via `security … -w` is argv-safe: only the service and
 * account names are passed as arguments; the token comes back on stdout.
 *
 * The secure *write* path is intentionally not implemented here — `security
 * add-generic-password` takes the secret as a CLI argument, which the invariant
 * forbids. Storing a token belongs with the auth/login flow (a later slice) and
 * must use an argv-free mechanism. For now, tokens are read from the Keychain
 * (added out-of-band) or the env var.
 */

export const KEYCHAIN_SERVICE = 'beeptui'
export const KEYCHAIN_ACCOUNT = 'access-token'
export const TOKEN_ENV_VAR = 'BEEPER_ACCESS_TOKEN'

export interface TokenSource {
  env?: Record<string, string | undefined>
  /** Reads the token from the OS keychain, or undefined if absent. Injectable. */
  readKeychain?: () => string | undefined
}

/**
 * Read the token from the macOS Keychain. Argv carries only the non-secret
 * service/account names; the token is returned on stdout and never logged.
 * Returns undefined if the entry is missing or `security` is unavailable.
 */
export function readKeychainToken(): string | undefined {
  try {
    const result = Bun.spawnSync([
      'security',
      'find-generic-password',
      '-s',
      KEYCHAIN_SERVICE,
      '-a',
      KEYCHAIN_ACCOUNT,
      '-w',
    ])
    if (result.exitCode !== 0) return undefined
    const token = result.stdout.toString().trim()
    return token.length > 0 ? token : undefined
  } catch {
    return undefined
  }
}

/**
 * Resolve the access token. Precedence: `BEEPER_ACCESS_TOKEN` env (handy for
 * development and matching the SDK's own default) > Keychain. Returns undefined
 * when no token is configured — callers surface that as an honest auth state.
 */
export function resolveToken(source: TokenSource = {}): string | undefined {
  const env = source.env ?? process.env
  const readKeychain = source.readKeychain ?? readKeychainToken

  const fromEnv = env[TOKEN_ENV_VAR]
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv

  return readKeychain()
}
