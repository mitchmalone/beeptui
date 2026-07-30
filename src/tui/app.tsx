import { useState } from 'react'
import { useKeyboard, useRenderer } from '@opentui/react'

/**
 * Slice 0 hello-world shell. This is a static three-pane layout that proves the
 * OpenTUI native core renders on macOS arm64 and that `q` tears the terminal
 * down cleanly. It has no product behaviour yet — the real inbox lands in
 * Slice 3, the conversation view in Slice 4.
 */
export function App() {
  const renderer = useRenderer()
  const [status, setStatus] = useState('ready')

  useKeyboard((key) => {
    if (key.name === 'q') {
      // Restore the terminal before exiting so the shell is left usable.
      renderer.destroy()
      process.exit(0)
    }
    setStatus(`last key: ${key.name}`)
  })

  return (
    <box style={{ flexDirection: 'column', width: '100%', height: '100%' }}>
      <box style={{ flexDirection: 'row', flexGrow: 1 }}>
        <box
          title="Chats"
          border
          style={{ width: 28, flexShrink: 0, flexDirection: 'column', padding: 1 }}
        >
          <text>WhatsApp</text>
          <text>Slack</text>
          <text>Telegram</text>
          <text>Signal</text>
        </box>
        <box title="Conversation" border style={{ flexGrow: 1, padding: 1 }}>
          <text>beeper-tui</text>
          <text>A terminal client for Beeper.</text>
        </box>
        <box title="Details" border style={{ width: 30, flexShrink: 0, padding: 1 }}>
          <text>Slice 0 · scaffold</text>
        </box>
      </box>
      <box style={{ height: 1, paddingLeft: 1, paddingRight: 1, flexDirection: 'row' }}>
        <text style={{ flexGrow: 1 }}>{status}</text>
        <text>q to quit</text>
      </box>
    </box>
  )
}
