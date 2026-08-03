import { describe, expect, test } from 'bun:test'
import { SYSTEM_DARK, SYSTEM_LIGHT, systemThemeForMode } from '@/tui/theme/theme.ts'

describe('systemThemeForMode', () => {
  test('light mode → the light variant', () => {
    expect(systemThemeForMode('light')).toBe(SYSTEM_LIGHT)
  })

  test('dark mode → the dark variant', () => {
    expect(systemThemeForMode('dark')).toBe(SYSTEM_DARK)
  })

  test('unknown mode (detection unavailable) falls back to dark', () => {
    expect(systemThemeForMode(null)).toBe(SYSTEM_DARK)
  })

  test('both variants keep the name "system" so selection/cycling still resolves', () => {
    expect(SYSTEM_LIGHT.name).toBe('system')
    expect(SYSTEM_DARK.name).toBe('system')
  })
})
