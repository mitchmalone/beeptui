import { useSyncExternalStore } from 'react'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import {
  selectActiveConversation,
  selectConnectionBanner,
  selectDraft,
  selectInboxRows,
  selectLastFailedSend,
} from '@/state/selectors.ts'
import { edgeSelection, moveSelection } from '@/tui/navigation.ts'
import { resolveCommand } from '@/tui/keymap.ts'
import type { Store } from '@/tui/store.ts'
import { InboxPane } from '@/tui/components/InboxPane.tsx'
import { StatusBar } from '@/tui/components/StatusBar.tsx'
import { ConversationView } from '@/tui/components/ConversationView.tsx'
import { Compose } from '@/tui/components/Compose.tsx'

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
  /** Send the composed text to a chat (explicit user action, invariant 5). */
  onSend: (chatId: string, text: string) => void
  /** Retry a previously failed send. */
  onRetry: (chatId: string, clientId: string, text: string) => void
}

/**
 * The shell. Reads store state through selectors and dispatches navigation /
 * focus events; never mutates state or calls the adapter (invariant 4). The
 * keymap is focus-aware: inbox drives selection, conversation drives scrolling /
 * paging, and compose captures every key for text entry.
 */
export function App({
  store,
  onQuit,
  onRefresh,
  onOpenChat,
  onLoadOlder,
  onSend,
  onRetry,
}: AppProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const rows = selectInboxRows(state)
  const banner = selectConnectionBanner(state)
  const conversation = selectActiveConversation(state)
  const failedSend = selectLastFailedSend(state)
  const { width } = useTerminalDimensions()
  const narrow = width < NARROW_WIDTH
  const focus = state.focus
  const selectedChatId = state.selectedChatId
  const chatOpen = selectedChatId !== null && conversation.chat !== null

  useKeyboard((key) => {
    // Compose owns every key while focused (letters must type, not run commands).
    if (focus === 'compose') return

    const command = resolveCommand({ name: key.name, shift: key.shift })
    if (command === 'quit') {
      onQuit()
      return
    }

    if (focus === 'inbox') {
      switch (command) {
        case 'move-down':
          store.dispatch({ type: 'chat/selected', chatId: moveSelection(rows, selectedChatId, 1) })
          break
        case 'move-up':
          store.dispatch({ type: 'chat/selected', chatId: moveSelection(rows, selectedChatId, -1) })
          break
        case 'top':
          store.dispatch({ type: 'chat/selected', chatId: edgeSelection(rows, 'top') })
          break
        case 'bottom':
          store.dispatch({ type: 'chat/selected', chatId: edgeSelection(rows, 'bottom') })
          break
        case 'open':
          if (selectedChatId !== null) onOpenChat(selectedChatId)
          break
        case 'refresh':
          onRefresh()
          break
        default:
          break
      }
      return
    }

    // Conversation focus: scroll, page older, compose, retry, and back.
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
      case 'compose':
        if (chatOpen) store.dispatch({ type: 'focus/changed', focus: 'compose' })
        break
      case 'retry':
        if (conversation.chat !== null && failedSend !== null) {
          onRetry(conversation.chat.id, failedSend.clientId, failedSend.text)
        }
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

  const composePane = chatOpen ? (
    <Compose
      key={selectedChatId}
      draft={selectDraft(state, selectedChatId)}
      focused={focus === 'compose'}
      hasFailedSend={failedSend !== null}
      onEdit={(text) => store.dispatch({ type: 'draft/changed', chatId: selectedChatId, text })}
      onSend={(text) => onSend(selectedChatId, text)}
      onBlur={() => store.dispatch({ type: 'focus/changed', focus: 'conversation' })}
    />
  ) : null

  return (
    <box style={{ flexDirection: 'column', width: '100%', height: '100%' }}>
      {narrow ? (
        focus === 'inbox' ? (
          <InboxPane rows={rows} grow />
        ) : (
          <box style={{ flexDirection: 'column', flexGrow: 1 }}>
            <ConversationView conversation={conversation} focused={focus === 'conversation'} />
            {composePane}
          </box>
        )
      ) : (
        <box style={{ flexDirection: 'row', flexGrow: 1 }}>
          <InboxPane rows={rows} />
          <box style={{ flexDirection: 'column', flexGrow: 1 }}>
            <ConversationView conversation={conversation} focused={focus === 'conversation'} />
            {composePane}
          </box>
        </box>
      )}
      <StatusBar banner={banner} accountCount={state.accountOrder.length} />
    </box>
  )
}
