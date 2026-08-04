import { describe, expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { Compose, type ComposeProps } from '@/tui/components/Compose.tsx'

const noop = () => {}

function props(over: Partial<ComposeProps> = {}): ComposeProps {
  return {
    draft: '',
    focused: false,
    hasFailedSend: false,
    onEdit: noop,
    onSend: noop,
    onBlur: noop,
    ...over,
  }
}

describe('Compose', () => {
  test('shows a placeholder when empty and unfocused', async () => {
    const { renderOnce, captureCharFrame } = await testRender(<Compose {...props()} />, {
      width: 60,
      height: 6,
    })
    await renderOnce()
    expect(captureCharFrame()).toContain('Press Tab to write')
  })

  test('renders the draft text', async () => {
    const { renderOnce, captureCharFrame } = await testRender(
      <Compose {...props({ draft: 'hello there' })} />,
      { width: 60, height: 6 }
    )
    await renderOnce()
    expect(captureCharFrame()).toContain('hello there')
  })

  test('shows the failed-send retry hint', async () => {
    const { renderOnce, captureCharFrame } = await testRender(
      <Compose {...props({ draft: 'x', hasFailedSend: true })} />,
      { width: 60, height: 6 }
    )
    await renderOnce()
    // The hint spells out leaving compose first — while focused, R just types.
    expect(captureCharFrame()).toContain('Esc, then R to retry')
  })

  test('shows the reply context header when replying', async () => {
    const { renderOnce, captureCharFrame } = await testRender(
      <Compose {...props({ replyContext: { sender: 'Grace', snippet: 'Ship it.' } })} />,
      { width: 60, height: 6 }
    )
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain('Replying to Grace')
    expect(frame).toContain('Ship it.')
  })

  test('blurring while replying cancels the reply', async () => {
    let cancelled = false
    const { renderOnce, mockInput } = await testRender(
      <Compose
        {...props({
          focused: true,
          replyContext: { sender: 'Grace', snippet: 'Ship it.' },
          onCancelReply: () => (cancelled = true),
        })}
      />,
      { width: 60, height: 6 }
    )
    await renderOnce()
    await mockInput.pressKey('TAB') // Esc/Tab both blur; both must cancel the reply
    expect(cancelled).toBe(true)
  })

  test('typing when focused edits and Enter sends the text', async () => {
    let edited = ''
    let sent = ''
    const { renderOnce, mockInput } = await testRender(
      <Compose
        {...props({ focused: true, onEdit: (t) => (edited = t), onSend: (t) => (sent = t) })}
      />,
      { width: 60, height: 6 }
    )
    await renderOnce()
    await mockInput.pressKeys(['h', 'i'])
    expect(edited).toBe('hi')
    await mockInput.pressKey('RETURN')
    expect(sent).toBe('hi')
  })
})

describe('reply mode', () => {
  test('the title says a reply is in progress, not that this is a fresh message', async () => {
    const { renderOnce, captureCharFrame } = await testRender(
      <Compose
        draft=""
        focused
        replyContext={{ sender: 'Grace', snippet: 'the analytical engine notes' }}
        onChange={() => {}}
        onSend={() => {}}
        onBlur={() => {}}
      />,
      { width: 60, height: 8 }
    )
    await renderOnce()
    const frame = captureCharFrame()
    expect(frame).toContain('Replying in thread ●')
    expect(frame).not.toContain('Compose ●')
    expect(frame).toContain('Replying to Grace')
  })
})
