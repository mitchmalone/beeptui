import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { App } from '@/tui/app.tsx'

/**
 * Renders the shell headlessly through OpenTUI's test renderer. This is the
 * Slice 0 smoke that proves the native core loads and the reconciler paints on
 * this platform — no TTY required, so it runs in CI.
 */
describe('App shell', () => {
  test('renders the three-pane layout', async () => {
    const { renderOnce, captureCharFrame } = await testRender(<App />, {
      width: 100,
      height: 24,
    })
    await renderOnce()
    const frame = captureCharFrame()

    expect(frame).toContain('beeper-tui')
    expect(frame).toContain('Chats')
    expect(frame).toContain('Conversation')
    expect(frame).toContain('q to quit')
  })
})
