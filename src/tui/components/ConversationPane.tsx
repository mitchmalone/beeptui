export interface ConversationPaneProps {
  /** Title of the selected chat, or null when nothing is selected. */
  chatTitle: string | null
}

/** Center pane placeholder. Message history renders here in Slice 4; for now it
 *  reflects the current selection so navigation is visibly wired. */
export function ConversationPane({ chatTitle }: ConversationPaneProps) {
  return (
    <box title="Conversation" border style={{ flexGrow: 1, flexDirection: 'column', padding: 1 }}>
      {chatTitle === null ? (
        <text>Select a chat with j/k, then ⏎.</text>
      ) : (
        <>
          <text>{chatTitle}</text>
          <text>Messages render here in Slice 4.</text>
        </>
      )}
    </box>
  )
}
