import {
  APIConnectionError,
  APIError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from '@beeper/desktop-api'

/**
 * Normalized failure categories the reducer and UI can represent as honest,
 * named states. Every Beeper I/O failure collapses to one of these.
 */
export type BeeperErrorKind =
  | 'unreachable' // Beeper Desktop not running / endpoint refused / timed out
  | 'unauthorized' // missing/invalid token, or the token lacks permission
  | 'unsupported-capability' // the endpoint/account/network can't do this
  | 'rate-limited' // backpressure from the API
  | 'unknown' // anything we can't classify

interface BeeperErrorOptions {
  status?: number | undefined
  retryable?: boolean | undefined
  cause?: unknown
}

const RETRYABLE_BY_DEFAULT: Record<BeeperErrorKind, boolean> = {
  unreachable: true,
  'rate-limited': true,
  unauthorized: false,
  'unsupported-capability': false,
  unknown: false,
}

/**
 * The single error type crossing the adapter boundary. Its `message` is a fixed,
 * kind-derived string — never the raw server body — so error output can't leak
 * message content (CLAUDE.md invariant 6). The original error is retained as
 * `cause` for diagnostics but is never formatted into user-facing output.
 */
export class BeeperError extends Error {
  readonly kind: BeeperErrorKind
  readonly status: number | undefined
  readonly retryable: boolean

  constructor(kind: BeeperErrorKind, message: string, options: BeeperErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'BeeperError'
    this.kind = kind
    this.status = options.status
    this.retryable = options.retryable ?? RETRYABLE_BY_DEFAULT[kind]
  }
}

const MESSAGE_BY_KIND: Record<BeeperErrorKind, string> = {
  unreachable: 'Could not reach the Beeper Desktop API.',
  unauthorized: 'Not authorized by the Beeper Desktop API.',
  'unsupported-capability': 'The requested operation is not supported here.',
  'rate-limited': 'Rate limited by the Beeper Desktop API.',
  unknown: 'An unexpected Beeper API error occurred.',
}

/**
 * Collapse any thrown value — SDK error classes, `BeeperError`, or arbitrary
 * throwables — into a `BeeperError`. Deliberately maps by the SDK's typed error
 * hierarchy rather than string matching.
 */
export function normalizeError(err: unknown): BeeperError {
  if (err instanceof BeeperError) return err

  // Connection-level failures (includes APIConnectionTimeoutError via subclassing).
  if (err instanceof APIConnectionError) {
    return new BeeperError('unreachable', MESSAGE_BY_KIND.unreachable, { cause: err })
  }

  if (err instanceof APIError) {
    const status = typeof err.status === 'number' ? err.status : undefined
    if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
      return new BeeperError('unauthorized', MESSAGE_BY_KIND.unauthorized, { status, cause: err })
    }
    if (err instanceof RateLimitError) {
      return new BeeperError('rate-limited', MESSAGE_BY_KIND['rate-limited'], {
        status,
        cause: err,
      })
    }
    return new BeeperError('unknown', MESSAGE_BY_KIND.unknown, { status, cause: err })
  }

  return new BeeperError('unknown', MESSAGE_BY_KIND.unknown, { cause: err })
}
