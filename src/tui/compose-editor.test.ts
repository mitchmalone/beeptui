import { describe, expect, test } from 'bun:test'
import { applyComposeKey } from '@/tui/compose-editor.ts'

describe('applyComposeKey', () => {
  test('inserts a printable character at the cursor', () => {
    expect(applyComposeKey('hi', 2, { name: 'a', sequence: 'a' })).toEqual({
      type: 'edit',
      text: 'hia',
      cursor: 3,
    })
    expect(applyComposeKey('ac', 1, { name: 'b', sequence: 'b' })).toEqual({
      type: 'edit',
      text: 'abc',
      cursor: 2,
    })
  })

  test('space inserts a space', () => {
    expect(applyComposeKey('a', 1, { name: 'space' })).toEqual({
      type: 'edit',
      text: 'a ',
      cursor: 2,
    })
  })

  test('Enter sends; Shift+Enter inserts a newline', () => {
    expect(applyComposeKey('hi', 2, { name: 'return' })).toEqual({ type: 'send' })
    expect(applyComposeKey('hi', 2, { name: 'return', shift: true })).toEqual({
      type: 'edit',
      text: 'hi\n',
      cursor: 3,
    })
  })

  test('Esc and Tab blur the editor', () => {
    expect(applyComposeKey('x', 1, { name: 'escape' })).toEqual({ type: 'blur' })
    expect(applyComposeKey('x', 1, { name: 'tab' })).toEqual({ type: 'blur' })
  })

  test('backspace deletes before the cursor; no-op at start', () => {
    expect(applyComposeKey('abc', 2, { name: 'backspace' })).toEqual({
      type: 'edit',
      text: 'ac',
      cursor: 1,
    })
    expect(applyComposeKey('abc', 0, { name: 'backspace' })).toEqual({ type: 'none' })
  })

  test('arrows / home / end move the cursor within bounds', () => {
    expect(applyComposeKey('abc', 1, { name: 'left' })).toMatchObject({ cursor: 0 })
    expect(applyComposeKey('abc', 0, { name: 'left' })).toMatchObject({ cursor: 0 })
    expect(applyComposeKey('abc', 2, { name: 'right' })).toMatchObject({ cursor: 3 })
    expect(applyComposeKey('abc', 3, { name: 'right' })).toMatchObject({ cursor: 3 })
    expect(applyComposeKey('abc', 1, { name: 'home' })).toMatchObject({ cursor: 0 })
    expect(applyComposeKey('abc', 1, { name: 'end' })).toMatchObject({ cursor: 3 })
  })

  test('ctrl/meta combos and unknown keys are ignored', () => {
    expect(applyComposeKey('x', 1, { name: 'c', sequence: 'c', ctrl: true })).toEqual({
      type: 'none',
    })
    expect(applyComposeKey('x', 1, { name: 'f5' })).toEqual({ type: 'none' })
  })
})
