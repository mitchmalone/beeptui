import { describe, expect, test } from 'bun:test'
import { networkColor, networkMarker } from '@/tui/components/InboxPane.tsx'

describe('networkMarker', () => {
  test('maps known networks to a two-ish-letter marker', () => {
    expect(networkMarker('WhatsApp')).toBe('WA')
    expect(networkMarker('Discord')).toBe('DC')
    expect(networkMarker('Facebook')).toBe('FB')
  })

  test('falls back to the first two letters, uppercased, for unknown networks', () => {
    expect(networkMarker('Matrix')).toBe('MA')
  })
})

describe('networkColor', () => {
  test('gives known networks a distinct hex colour', () => {
    expect(networkColor('WhatsApp')).toMatch(/^#[0-9a-f]{6}$/)
    expect(networkColor('WhatsApp')).not.toBe(networkColor('Slack'))
  })

  test('aliases share a colour (Facebook / Messenger, X / Twitter)', () => {
    expect(networkColor('Messenger')).toBe(networkColor('Facebook'))
    expect(networkColor('Twitter')).toBe(networkColor('X'))
  })

  test('falls back to a neutral grey for unknown networks', () => {
    expect(networkColor('Matrix')).toBe('#94a3b8')
    expect(networkColor('WhatsApp')).not.toBe('#94a3b8')
  })
})
