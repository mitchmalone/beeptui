import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { NetworkRail, type NetworkRailProps } from '@/tui/components/NetworkRail.tsx'
import type { NetworkRailEntry } from '@/state/selectors.ts'

function entry(id: string, over: Partial<NetworkRailEntry> = {}): NetworkRailEntry {
  return { id, label: id, network: null, unreadCount: 0, isSelected: false, ...over }
}

async function frameOf(over: Partial<NetworkRailProps> = {}): Promise<string> {
  const props: NetworkRailProps = {
    entries: [
      entry('all', { label: 'All', isSelected: true }),
      entry('wa', { label: 'WhatsApp', network: 'WhatsApp' }),
      entry('fb', { label: 'Facebook', network: 'Facebook' }),
    ],
    archived: false,
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
  test('renders All plus a marker per network', async () => {
    const frame = await frameOf()
    expect(frame).toContain('All')
    expect(frame).toContain('WA') // WhatsApp marker
    expect(frame).toContain('FB') // Facebook marker
  })

  test('marks the selected scope with a caret', async () => {
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

  test('footer names the archived and unread-only views when active', async () => {
    expect(await frameOf({ archived: true })).toContain('arc')
    expect(await frameOf({ unreadOnly: true })).toContain('unr')
    const plain = await frameOf()
    expect(plain).not.toContain('arc')
    expect(plain).not.toContain('unr')
  })
})
