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
import { ConversationPane } from '@/tui/components/ConversationPane.tsx'

/** Below this terminal width we collapse to a single (inbox-only) pane. */
const NARROW_WIDTH = 80

export interface AppProps {
  store: Store
  /** Called on the quit binding — launch restores the terminal and exits. */
  onQuit: () => void
  /** Called on the refresh binding — launch re-fetches chats. */
  onRefresh: () => void
}

/**
 * The three-pane shell. It reads store state through selectors and dispatches
 * navigation events; it never mutates state or calls the adapter (invariant 4).
 * Selection lives in the reducer, so it survives re-renders and data refreshes.
 */
export function App({ store, onQuit, onRefresh }: AppProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const rows = selectInboxRows(state)
  const banner = selectConnectionBanner(state)
  const conversation = selectActiveConversation(state)
  const { width } = useTerminalDimensions()
  const narrow = width < NARROW_WIDTH

  useKeyboard((key) => {
    switch (resolveCommand({ name: key.name, shift: key.shift })) {
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
      case 'refresh':
        onRefresh()
        break
      case 'quit':
        onQuit()
        break
      case 'open':
        // Slice 4 renders the conversation for the current selection.
        break
      default:
        break
    }
  })

  return (
    <box style={{ flexDirection: 'column', width: '100%', height: '100%' }}>
      {narrow ? (
        <InboxPane rows={rows} grow />
      ) : (
        <box style={{ flexDirection: 'row', flexGrow: 1 }}>
          <InboxPane rows={rows} />
          <ConversationPane chatTitle={conversation.chat?.title ?? null} />
        </box>
      )}
      <StatusBar banner={banner} accountCount={state.accountOrder.length} />
    </box>
  )
}
