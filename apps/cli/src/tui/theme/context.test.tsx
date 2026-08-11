import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { ThemeProvider, useTheme } from '@/tui/theme/context.tsx'
import { DRACULA_THEME } from '@/tui/theme/theme.ts'

function Probe() {
  const theme = useTheme()
  return <text>{`theme=${theme.name} sel=${theme.selectionBg}`}</text>
}

describe('ThemeProvider / useTheme', () => {
  test('defaults to the built-in default when there is no provider', async () => {
    const { renderOnce, captureCharFrame } = await testRender(<Probe />, { width: 40, height: 3 })
    await renderOnce()
    expect(captureCharFrame()).toContain('theme=default')
  })

  test('provides the given theme to consumers', async () => {
    const { renderOnce, captureCharFrame } = await testRender(
      <ThemeProvider theme={DRACULA_THEME}>
        <Probe />
      </ThemeProvider>,
      { width: 40, height: 3 }
    )
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain('theme=dracula')
    expect(frame).toContain(`sel=${DRACULA_THEME.selectionBg}`)
  })
})
