import { BeeperError, normalizeError } from '@/beeper/errors.ts'

const REDACTED = '[redacted]'

// Keys whose values are always secret and must never be serialized verbatim.
const SECRET_KEYS = /^(access[_-]?token|token|authorization|api[_-]?key|password|secret)$/i

// Bearer tokens in free text, e.g. "Authorization: Bearer <token>".
const BEARER = /\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/g

/**
 * Scrub secrets from anything bound for a log or error surface. Accepts a string
 * or a structured context object; object values under secret-looking keys are
 * masked wholesale, and bearer tokens in strings are masked in place.
 *
 * This is a safety net, not the primary defense — the adapter avoids putting
 * secrets into messages at all (CLAUDE.md invariant 6). Redaction is not a
 * log-level; it always runs.
 */
export function redactSecrets(input: string | Record<string, unknown>): string {
  if (typeof input === 'string') return input.replace(BEARER, `$1 ${REDACTED}`)

  const parts: string[] = []
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEYS.test(key)) {
      parts.push(`${key}=${REDACTED}`)
    } else if (typeof value === 'string') {
      parts.push(`${key}=${value.replace(BEARER, `$1 ${REDACTED}`)}`)
    } else {
      parts.push(`${key}=${String(value)}`)
    }
  }
  return parts.join(' ')
}

/**
 * A single, safe line describing a failure: its normalized kind and HTTP status
 * only. Never includes the SDK cause body, token, or any message content.
 */
export function formatError(err: unknown): string {
  const normalized: BeeperError = normalizeError(err)
  const status = normalized.status === undefined ? '' : ` (status ${normalized.status})`
  return `beeper:${normalized.kind}${status} — ${normalized.message}`
}
