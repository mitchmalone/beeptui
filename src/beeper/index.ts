/**
 * Beeper API adapter — the only module that talks to Beeper (CLAUDE.md
 * invariant 3). Wraps the official `@beeper/desktop-api` SDK; owns auth,
 * pagination, capability detection, and error normalization.
 */
export {
  BeeperAdapter,
  type BeeperAdapterOptions,
  type MessageHistoryPage,
} from '@/beeper/client.ts'
export { BeeperError, normalizeError, type BeeperErrorKind } from '@/beeper/errors.ts'
export { formatError, redactSecrets } from '@/beeper/redact.ts'
export { resolveConfig, DEFAULT_ENDPOINT, type ResolvedConfig } from '@/beeper/config.ts'
export {
  resolveToken,
  readKeychainToken,
  TOKEN_ENV_VAR,
  KEYCHAIN_SERVICE,
  KEYCHAIN_ACCOUNT,
} from '@/beeper/keychain.ts'
export { detectCapabilities, type Capabilities } from '@/beeper/capabilities.ts'
export { login, logout, resolveActiveToken } from '@/beeper/auth-session.ts'
export { clearAuth } from '@/beeper/token-store.ts'
export { startLoopback, openUrl } from '@/beeper/oauth-loopback.ts'
export type {
  Account,
  ChatSummary,
  MessageSummary,
  SendResult,
  ServerInfo,
} from '@/beeper/types.ts'
