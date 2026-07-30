import { describe, expect, test } from 'bun:test'
import { createStore } from '@/tui/store.ts'
import { edgeSelection, moveSelection } from '@/tui/navigation.ts'
import { KEYMAP, keyToken, resolveCommand } from '@/tui/keymap.ts'
import type { InboxRow } from '@/state/selectors.ts'

const rows: InboxRow[] = ['a', 'b', 'c'].map((id) => ({
  id,
  title: id,
  network: 'WhatsApp',
  unreadCount: 0,
  hasUnread: false,
  isMuted: false,
  isArchived: false,
  isSelected: false,
}))

describe('store', () => {
  test('dispatch runs the reducer and notifies subscribers', () => {
    const store = createStore()
    let notifications = 0
    store.subscribe(() => notifications++)
    store.dispatch({ type: 'connection/changed', state: 'connected' })
    expect(store.getState().connection).toBe('connected')
    expect(notifications).toBe(1)
  })

  test('unsubscribe stops notifications', () => {
    const store = createStore()
    let count = 0
    const off = store.subscribe(() => count++)
    off()
    store.dispatch({ type: 'connection/changed', state: 'connected' })
    expect(count).toBe(0)
  })
})

describe('navigation', () => {
  test('moveSelection clamps at both ends and starts at first when unset', () => {
    expect(moveSelection(rows, null, 1)).toBe('a')
    expect(moveSelection(rows, 'a', 1)).toBe('b')
    expect(moveSelection(rows, 'a', -1)).toBe('a') // clamp top
    expect(moveSelection(rows, 'c', 1)).toBe('c') // clamp bottom
    expect(moveSelection([], 'a', 1)).toBeNull()
  })

  test('edgeSelection jumps to first/last', () => {
    expect(edgeSelection(rows, 'top')).toBe('a')
    expect(edgeSelection(rows, 'bottom')).toBe('c')
    expect(edgeSelection([], 'top')).toBeNull()
  })
})

describe('keymap', () => {
  test('keyToken distinguishes shifted letters only', () => {
    expect(keyToken({ name: 'g' })).toBe('g')
    expect(keyToken({ name: 'g', shift: true })).toBe('shift+g')
    expect(keyToken({ name: 'Down', shift: true })).toBe('down')
  })

  test('resolveCommand maps keys to commands', () => {
    expect(resolveCommand({ name: 'j' })).toBe('move-down')
    expect(resolveCommand({ name: 'down' })).toBe('move-down')
    expect(resolveCommand({ name: 'g', shift: true })).toBe('bottom')
    expect(resolveCommand({ name: 'g' })).toBe('top')
    expect(resolveCommand({ name: 'q' })).toBe('quit')
    expect(resolveCommand({ name: 'x' })).toBeNull()
  })

  test('every binding has a display + description (help-overlay ready)', () => {
    for (const b of KEYMAP) {
      expect(b.display.length).toBeGreaterThan(0)
      expect(b.description.length).toBeGreaterThan(0)
      expect(b.keys.length).toBeGreaterThan(0)
    }
  })
})
