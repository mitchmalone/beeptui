import { describe, expect, test } from 'bun:test'
import { resolveToken, TOKEN_ENV_VAR } from '@/beeper/keychain.ts'

describe('resolveToken', () => {
  test('prefers the env var', () => {
    const token = resolveToken({
      env: { [TOKEN_ENV_VAR]: 'from-env' },
      readKeychain: () => 'from-keychain',
    })
    expect(token).toBe('from-env')
  })

  test('falls back to the keychain when the env var is absent', () => {
    expect(resolveToken({ env: {}, readKeychain: () => 'from-keychain' })).toBe('from-keychain')
  })

  test('returns undefined when neither source has a token', () => {
    expect(resolveToken({ env: {}, readKeychain: () => undefined })).toBeUndefined()
  })

  test('ignores an empty-string env token and tries the keychain', () => {
    expect(resolveToken({ env: { [TOKEN_ENV_VAR]: '' }, readKeychain: () => 'kc' })).toBe('kc')
  })
})
