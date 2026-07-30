import { useSyncExternalStore } from 'react'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import {
  selectActiveConversation,
  selectConnectionBanner,
  selectInboxRows,
} from '@/state/selectors.ts'
import { edgeSelection, moveSelection } from '@/tui/navigation.ts'
import { resolveCommand } from '@/tui/keymap.ts'
import type { Store } from '@/tui/store.ts'
import { InboxPane } from '@/tui/components/InboxPane.tsx'
import { StatusBar } from '@/tui/components/StatusBar.tsx'
import { ConversationView } from '@/tui/components/ConversationView.tsx'

/** Below this terminal width we collapse to a single pane. */
const NARROW_WIDTH = 80

export interface AppProps {
  store: Store
  onQuit: () => void
  onRefresh: () => void
  /** Open a chat (select + focus + load its messages). */
  onOpenChat: (chatId: string) => void
  /** Page older history for a chat using its stored cursor. */
  onLoadOlder: (chatId: string, cursor: string) => void
}

/**
 * The shell. Reads store state through selectors and dispatches navigation /
 * focus events; never mutates state or calls the adapter (invariant 4). The
 * keymap is focus-aware: the inbox drives chat selection, the conversation pane
 * drives scrolling and history paging.
 */
export function App({ store, onQuit, onRefresh, onOpenChat, onLoadOlder }: AppProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const rows = selectInboxRows(state)
  const banner = selectConnectionBanner(state)
  const conversation = selectActiveConversation(state)
  const { width } = useTerminalDimensions()
  const narrow = width < NARROW_WIDTH
  const inboxFocused = state.focus === 'inbox'

  useKeyboard((key) => {
    const command = resolveCommand({ name: key.name, shift: key.shift })
    if (command === 'quit') {
      onQuit()
      return
    }

    if (inboxFocused) {
      switch (command) {
        case 'move-down':
          store.dispatch({
            type: 'chat/selected',
            chatId: moveSelection(rows, state.selectedChatId, 1),
          })
          break
        case 'move-up':
          store.dispatch({
            type: 'chat/selected',
            chatId: moveSelection(rows, state.selectedChatId, -1),
          })
          break
        case 'top':
          store.dispatch({ type: 'chat/selected', chatId: edgeSelection(rows, 'top') })
          break
        case 'bottom':
          store.dispatch({ type: 'chat/selected', chatId: edgeSelection(rows, 'bottom') })
          break
        case 'open':
          if (state.selectedChatId !== null) onOpenChat(state.selectedChatId)
          break
        case 'refresh':
          onRefresh()
          break
        default:
          break
      }
      return
    }

    // Conversation focus: scroll, page older, and return to the inbox.
    switch (command) {
      case 'move-up':
        store.dispatch({ type: 'conversation/scrolled', delta: 1 })
        break
      case 'move-down':
        store.dispatch({ type: 'conversation/scrolled', delta: -1 })
        break
      case 'top':
        store.dispatch({ type: 'conversation/scrolled', delta: conversation.messages.length })
        break
      case 'bottom':
        store.dispatch({ type: 'conversation/scrolled', delta: -conversation.messages.length })
        break
      case 'back':
        store.dispatch({ type: 'focus/changed', focus: 'inbox' })
        break
      case 'load-older':
        if (
          conversation.chat !== null &&
          conversation.hasMoreOlder &&
          conversation.olderCursor !== null
        ) {
          onLoadOlder(conversation.chat.id, conversation.olderCursor)
        }
        break
      default:
        break
    }
  })

  return (
    <box style={{ flexDirection: 'column', width: '100%', height: '100%' }}>
      {narrow ? (
        inboxFocused ? (
          <InboxPane rows={rows} grow />
        ) : (
          <ConversationView conversation={conversation} focused />
        )
      ) : (
        <box style={{ flexDirection: 'row', flexGrow: 1 }}>
          <InboxPane rows={rows} />
          <ConversationView conversation={conversation} focused={!inboxFocused} />
        </box>
      )}
      <StatusBar banner={banner} accountCount={state.accountOrder.length} />
    </box>
  )
}
