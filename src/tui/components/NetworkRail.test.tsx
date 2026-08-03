import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { NetworkRail, type NetworkRailProps } from '@/tui/components/NetworkRail.tsx'
import type { NetworkRailEntry } from '@/state/selectors.ts'

function entry(id: string, over: Partial<NetworkRailEntry> = {}): NetworkRailEntry {
  return {
    id,
    label: id,
    network: null,
    unreadCount: 0,
    isSelected: false,
    isCursor: false,
    kind: 'scope',
    ...over,
  }
}

function archivedEntry(over: Partial<NetworkRailEntry> = {}): NetworkRailEntry {
  return entry('archived', { label: 'Archived', kind: 'archived', active: false, ...over })
}

async function frameOf(over: Partial<NetworkRailProps> = {}): Promise<string> {
  const props: NetworkRailProps = {
    entries: [
      entry('all', { label: 'All', isSelected: true, isCursor: true }),
      entry('wa', { label: 'WhatsApp', network: 'WhatsApp' }),
      entry('fb', { label: 'Facebook', network: 'Facebook' }),
      archivedEntry(),
    ],
    unreadOnly: false,
    ...over,
  }
  const { renderOnce, captureCharFrame } = await testRender(<NetworkRail {...props} />, {
    width: 12,
    height: 12,
  })
  await renderOnce()
  return captureCharFrame()
}

describe('NetworkRail', () => {
  test('renders All, a marker per network, and the Archived toggle', async () => {
    const frame = await frameOf()
    expect(frame).toContain('All')
    expect(frame).toContain('WA') // WhatsApp marker
    expect(frame).toContain('FB') // Facebook marker
    expect(frame).toContain('Arc') // Archived toggle
  })

  test('marks the rail cursor with a caret', async () => {
    expect(await frameOf()).toContain('›All')
  })

  test('shows an unread dot on networks with unread', async () => {
    const frame = await frameOf({
      entries: [
        entry('all', { label: 'All' }),
        entry('wa', { network: 'WhatsApp', unreadCount: 3 }),
      ],
    })
    expect(frame).toContain('•')
  })

  test('the Archived toggle shows an on/off glyph', async () => {
    expect(await frameOf({ entries: [archivedEntry({ active: true })] })).toContain('Arc●')
    expect(await frameOf({ entries: [archivedEntry({ active: false })] })).toContain('Arc○')
  })

  test('the caret can rest on Archived (cursor decoupled from the active scope)', async () => {
    const frame = await frameOf({
      entries: [
        entry('all', { label: 'All', isSelected: true }), // active scope, no cursor
        archivedEntry({ isCursor: true }), // cursor here
      ],
    })
    expect(frame).toContain('›Arc')
  })

  test('footer names the unread-only view when active', async () => {
    expect(await frameOf({ unreadOnly: true })).toContain('unr')
    expect(await frameOf()).not.toContain('unr')
  })

  test('shows the focus indicator in the title only when focused', async () => {
    expect(await frameOf({ focused: true })).toContain('Net●')
    expect(await frameOf({ focused: false })).not.toContain('●')
  })
})
