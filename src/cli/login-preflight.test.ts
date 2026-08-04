import { describe, expect, test } from 'bun:test'
import { loginPreflight } from '@/cli/login-preflight.ts'

describe('loginPreflight', () => {
  test('allows the browser flow when the endpoint offers remote access', () => {
    expect(loginPreflight({ endpointKind: 'remote', remoteAccessEnabled: true })).toEqual({
      ok: true,
    })
  })

  test('refuses when remote access is off, whatever the endpoint', () => {
    expect(loginPreflight({ endpointKind: 'local', remoteAccessEnabled: false }).ok).toBe(false)
    expect(loginPreflight({ endpointKind: 'remote', remoteAccessEnabled: false }).ok).toBe(false)
  })

  test('points a local endpoint at the token path it is already using', () => {
    const result = loginPreflight({ endpointKind: 'local', remoteAccessEnabled: false })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a refusal')
    expect(result.reason).toBe('remote-access-off')
    // The whole point of the refusal is telling the user what to do instead.
    expect(result.message).toContain('beeptui')
    expect(result.message).toMatch(/token/i)
  })

  test('tells a remote endpoint to turn remote access on', () => {
    const result = loginPreflight({ endpointKind: 'remote', remoteAccessEnabled: false })
    if (result.ok) throw new Error('expected a refusal')
    expect(result.message).toMatch(/remote access/i)
  })

  test('never leaks the endpoint or a token into the message (invariant 6)', () => {
    for (const kind of ['local', 'remote'] as const) {
      const result = loginPreflight({ endpointKind: kind, remoteAccessEnabled: false })
      if (result.ok) throw new Error('expected a refusal')
      expect(result.message).not.toMatch(/http/i)
    }
  })

  test('a local endpoint with remote access on is allowed through', () => {
    // Deliberate: `remote_access` is the signal that the OAuth endpoints are
    // real. Refusing on locality alone would block a legitimate pairing flow we
    // have no evidence is broken.
    expect(loginPreflight({ endpointKind: 'local', remoteAccessEnabled: true })).toEqual({
      ok: true,
    })
  })
})
