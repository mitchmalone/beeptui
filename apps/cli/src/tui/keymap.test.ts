import { describe, expect, test } from 'bun:test'
import {
  applyKeymapOverrides,
  helpGroups,
  KEYMAP,
  resolveCommand,
  resolveKey,
} from '@/tui/keymap.ts'

describe('resolveCommand', () => {
  test('resolves against the base keymap by default', () => {
    expect(resolveCommand({ name: 'j' })).toBe('move-down')
    expect(resolveCommand({ name: 'g', shift: true })).toBe('bottom') // shift+g
    expect(resolveCommand({ name: 'nope' })).toBeNull()
  })
})

describe('applyKeymapOverrides', () => {
  test('replaces a command’s keys and regenerates its help display', () => {
    const effective = applyKeymapOverrides({ quit: ['x'] })
    // The rebound key now resolves; the old one no longer does.
    expect(resolveCommand({ name: 'x' }, effective)).toBe('quit')
    expect(resolveCommand({ name: 'q' }, effective)).toBeNull()
    // Other bindings are untouched.
    expect(resolveCommand({ name: 'j' }, effective)).toBe('move-down')
    // Help display reflects the override.
    const binding = effective.find((b) => b.command === 'quit')
    expect(binding?.display).toBe('x')
  })

  test('regenerates a friendly display for named/shifted keys', () => {
    const effective = applyKeymapOverrides({ 'move-down': ['down', 'shift+j'] })
    expect(effective.find((b) => b.command === 'move-down')?.display).toBe('↓ / J')
  })

  test('throws on an unknown command (config typo surfaces, not silently ignored)', () => {
    expect(() => applyKeymapOverrides({ 'mve-down': ['x'] })).toThrow(/Unknown keymap command/)
  })

  test('throws on an empty key list', () => {
    expect(() => applyKeymapOverrides({ quit: [] })).toThrow(/non-empty/)
  })

  test('the base keymap is unchanged (override returns a new array)', () => {
    const before = KEYMAP.find((b) => b.command === 'quit')?.keys
    applyKeymapOverrides({ quit: ['x'] })
    expect(KEYMAP.find((b) => b.command === 'quit')?.keys).toEqual(before ?? [])
  })
})

describe('resolveKey (raw-character fallback + direction)', () => {
  test('punctuation resolves by the typed character even when the key name differs', () => {
    // '?' arrives as shift+'/' in many terminals — the raw sequence must still hit.
    expect(resolveKey({ name: '/', shift: true, sequence: '?' })?.command).toBe('help')
    expect(resolveKey({ name: 'slash', sequence: '/' })?.command).toBe('search')
  })

  test('network-cycle reports which key matched so the caller knows the direction', () => {
    expect(resolveKey({ name: ']', sequence: ']' })).toEqual({
      command: 'network-cycle',
      keyIndex: 0,
    })
    expect(resolveKey({ name: '[', sequence: '[' })).toEqual({
      command: 'network-cycle',
      keyIndex: 1,
    })
  })

  test('search/help/network-cycle rebinds are honoured, not silently ignored', () => {
    const effective = applyKeymapOverrides({
      search: ['f'],
      help: ['shift+h'],
      'network-cycle': ['n', 'p'],
    })
    expect(resolveKey({ name: 'f', sequence: 'f' }, effective)?.command).toBe('search')
    expect(resolveKey({ name: 'h', shift: true, sequence: 'H' }, effective)?.command).toBe('help')
    expect(resolveKey({ name: 'n', sequence: 'n' }, effective)).toEqual({
      command: 'network-cycle',
      keyIndex: 0,
    })
    // The old keys no longer fire the commands.
    expect(resolveKey({ name: '/', sequence: '/' }, effective)?.command).toBeUndefined()
  })
})

describe('helpGroups', () => {
  test('reflects the effective keymap (rebinds show their configured keys)', () => {
    const effective = applyKeymapOverrides({ quit: ['x'] })
    const groups = helpGroups(effective)
    const quit = groups.flatMap((g) => g.bindings).find((b) => b.description === 'Quit')
    expect(quit?.display).toBe('x')
  })
})
