import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { rgbToHex } from '@opentui/core'
import type { CapturedFrame } from '@opentui/core'
import { InboxPane, networkColor, networkMarker } from '@/tui/components/InboxPane.tsx'
import type { InboxRow } from '@/state/selectors.ts'
import { ThemeProvider } from '@/tui/theme/context.tsx'
import { DRACULA_THEME } from '@/tui/theme/theme.ts'

async function inboxFrame(focused: boolean): Promise<string> {
  const { renderOnce, captureCharFrame } = await testRender(
    <InboxPane rows={[]} focused={focused} />,
    { width: 32, height: 8 }
  )
  await renderOnce()
  return captureCharFrame()
}

const row: InboxRow = {
  id: 'c1',
  title: 'Ada',
  network: 'WhatsApp',
  unreadCount: 0,
  hasUnread: false,
  isMuted: false,
  isArchived: false,
  isSelected: true,
}

/** Background hex of the first span whose text contains `needle`. */
function bgOfSpanWith(frame: CapturedFrame, needle: string): string | null {
  for (const line of frame.lines) {
    for (const span of line.spans) {
      if (span.text.includes(needle)) return rgbToHex(span.bg).toLowerCase().slice(0, 7)
    }
  }
  return null
}

describe('InboxPane', () => {
  test('shows the focus indicator in the title only when focused', async () => {
    expect(await inboxFrame(true)).toContain('Chats ●')
    expect(await inboxFrame(false)).not.toContain('●')
  })

  test('the selected row paints with the active theme selection colour', async () => {
    const { renderOnce, captureSpans } = await testRender(
      <ThemeProvider theme={DRACULA_THEME}>
        <InboxPane rows={[row]} />
      </ThemeProvider>,
      { width: 32, height: 6 }
    )
    await renderOnce()
    // The selected row's title cells carry the theme's selection background —
    // proving tokens reach real paint, not just the context value.
    expect(bgOfSpanWith(captureSpans(), 'Ada')).toBe(DRACULA_THEME.selectionBg.toLowerCase())
  })
})

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

  test('config overrides win over the defaults; unlisted networks keep theirs (theming)', () => {
    const overrides = { WhatsApp: '#000000', Matrix: '#abcdef' }
    expect(networkColor('WhatsApp', overrides)).toBe('#000000') // overridden
    expect(networkColor('Matrix', overrides)).toBe('#abcdef') // override for a previously-unknown one
    expect(networkColor('Slack', overrides)).toBe(networkColor('Slack')) // untouched default
  })
})
