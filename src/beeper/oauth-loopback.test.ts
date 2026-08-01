import { describe, expect, test } from 'bun:test'
import { openUrl, startLoopback } from '@/beeper/oauth-loopback.ts'

describe('startLoopback', () => {
  test('ignores a callback without the armed state (keeps waiting for the real redirect)', async () => {
    const receiver = await startLoopback('GOOD-STATE')
    try {
      const forged = await fetch(`${receiver.redirectUri}?code=stolen&state=WRONG`)
      expect(forged.status).toBe(400)

      // The one-shot wait must still be pending after the forged request.
      const outcome = await Promise.race([
        receiver.awaitCallback().then(() => 'resolved'),
        Bun.sleep(50).then(() => 'pending'),
      ])
      expect(outcome).toBe('pending')

      const real = await fetch(`${receiver.redirectUri}?code=abc&state=GOOD-STATE`)
      expect(real.status).toBe(200)
      const url = await receiver.awaitCallback()
      expect(new URL(url).searchParams.get('code')).toBe('abc')
    } finally {
      receiver.close()
    }
  })

  test('accepts an OAuth error redirect that carries the armed state (user denied)', async () => {
    const receiver = await startLoopback('S1')
    try {
      const denied = await fetch(`${receiver.redirectUri}?error=access_denied&state=S1`)
      expect(denied.status).toBe(200)
      const url = await receiver.awaitCallback()
      expect(new URL(url).searchParams.get('error')).toBe('access_denied')
    } finally {
      receiver.close()
    }
  })

  test('serves only /callback', async () => {
    const receiver = await startLoopback('S2')
    try {
      const other = await fetch(receiver.redirectUri.replace('/callback', '/anything'))
      expect(other.status).toBe(404)
    } finally {
      receiver.close()
    }
  })
})

describe('openUrl', () => {
  test('refuses non-http(s) schemes so a hostile authorization_endpoint cannot reach an OS handler', async () => {
    await expect(openUrl('file:///etc/passwd')).rejects.toThrow(/http/)
    await expect(openUrl('vscode://malicious')).rejects.toThrow(/http/)
  })
})
