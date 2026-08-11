import { describe, expect, test } from 'bun:test'
import { BeeperError } from '@/beeper/errors.ts'
import { formatError, redactSecrets } from '@/beeper/redact.ts'

// A deliberately fake, low-entropy placeholder — redaction keys off the `Bearer`
// prefix and secret key names, not the token's format, so this exercises the
// same paths without tripping secret scanners on a synthetic value.
const TOKEN = 'example-placeholder-token-value'
const BODY = 'the secret contents of a private message'

describe('formatError', () => {
  test('renders kind + status, never the underlying cause body', () => {
    const err = new BeeperError('unauthorized', 'Not authorized by the Beeper Desktop API.', {
      status: 401,
      cause: new Error(`token=${TOKEN} body="${BODY}"`),
    })
    const line = formatError(err)
    expect(line).toContain('unauthorized')
    expect(line).toContain('401')
    expect(line).not.toContain(TOKEN)
    expect(line).not.toContain(BODY)
  })

  test('normalizes non-BeeperError input and still redacts', () => {
    const line = formatError(new Error(`leak ${TOKEN}`))
    expect(line).toContain('unknown')
    expect(line).not.toContain(TOKEN)
  })
})

describe('redactSecrets', () => {
  test('masks bearer tokens in free text', () => {
    const out = redactSecrets(`Authorization: Bearer ${TOKEN}`)
    expect(out).not.toContain(TOKEN)
    expect(out).toContain('Bearer')
    expect(out).toContain('[redacted]')
  })

  test('masks token-like secret values in structured context', () => {
    const out = redactSecrets({ accessToken: TOKEN, endpoint: 'http://127.0.0.1:23373' })
    expect(out).not.toContain(TOKEN)
    expect(out).toContain('127.0.0.1')
  })
})
