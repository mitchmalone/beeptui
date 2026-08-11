import { describe, expect, test } from 'bun:test'
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from '@beeper/desktop-api'
import { BeeperError, normalizeError } from '@/beeper/errors.ts'

// Build an SDK APIError subclass instance the way the SDK does (status, error, message, headers).
function apiError<T extends new (...a: never[]) => unknown>(
  Ctor: T,
  status: number
): InstanceType<T> {
  // The concrete subclasses take (status, error, message, headers) via APIError's constructor.
  return new (
    Ctor as unknown as new (
      s: number,
      e: unknown,
      m: string | undefined,
      h: Headers | undefined
    ) => InstanceType<T>
  )(status, { code: 'x', message: 'boom' }, 'boom', new Headers())
}

describe('normalizeError', () => {
  test('connection failures → unreachable (retryable)', () => {
    const e = normalizeError(new APIConnectionError({ message: 'nope' }))
    expect(e).toBeInstanceOf(BeeperError)
    expect(e.kind).toBe('unreachable')
    expect(e.retryable).toBe(true)
  })

  test('timeouts → unreachable', () => {
    expect(normalizeError(new APIConnectionTimeoutError()).kind).toBe('unreachable')
  })

  test('401 and 403 → unauthorized (not retryable)', () => {
    expect(normalizeError(apiError(AuthenticationError, 401)).kind).toBe('unauthorized')
    const denied = normalizeError(apiError(PermissionDeniedError, 403))
    expect(denied.kind).toBe('unauthorized')
    expect(denied.retryable).toBe(false)
  })

  test('429 → rate-limited (retryable) and keeps the status', () => {
    const e = normalizeError(apiError(RateLimitError, 429))
    expect(e.kind).toBe('rate-limited')
    expect(e.retryable).toBe(true)
    expect(e.status).toBe(429)
  })

  test('other HTTP errors → unknown', () => {
    expect(normalizeError(apiError(BadRequestError, 400)).kind).toBe('unknown')
    expect(normalizeError(apiError(NotFoundError, 404)).kind).toBe('unknown')
    expect(normalizeError(apiError(InternalServerError, 500)).kind).toBe('unknown')
  })

  test('non-SDK throwables → unknown, and an existing BeeperError passes through', () => {
    expect(normalizeError(new Error('random')).kind).toBe('unknown')
    const already = new BeeperError('unreachable', 'x')
    expect(normalizeError(already)).toBe(already)
  })

  test('never leaks the raw server error body into the message', () => {
    const e = normalizeError(apiError(AuthenticationError, 401))
    expect(e.message).not.toContain('boom')
  })
})
