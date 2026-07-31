import { useSyncExternalStore } from 'react'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import {
  selectActiveConversation,
  selectConnectionBanner,
  selectDraft,
  selectInboxRows,
  selectLastFailedSend,
  selectNetworkRail,
} from '@/state/selectors.ts'
import { edgeSelection, moveSelection } from '@/tui/navigation.ts'
import { helpGroups, resolveCommand } from '@/tui/keymap.ts'
import { searchChats } from '@/tui/fuzzy.ts'
import type { Store } from '@/tui/store.ts'
import { InboxPane } from '@/tui/components/InboxPane.tsx'
import { NetworkRail } from '@/tui/components/NetworkRail.tsx'
import { StatusBar } from '@/tui/components/StatusBar.tsx'
import { ConversationView } from '@/tui/components/ConversationView.tsx'
import { Compose } from '@/tui/components/Compose.tsx'
import { SearchPalette } from '@/tui/components/SearchPalette.tsx'
import { HelpOverlay } from '@/tui/components/HelpOverlay.tsx'

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
  const rail = selectNetworkRail(state)
  const scopeLabel = rail.find((e) => e.isSelected)?.label ?? 'All'
  const banner = selectConnectionBanner(state)
  const conversation = selectActiveConversation(state)
  const failedSend = selectLastFailedSend(state)
  const { width } = useTerminalDimensions()
  const narrow = width < NARROW_WIDTH
  const focus = state.focus
  const selectedChatId = state.selectedChatId
  const chatOpen = selectedChatId !== null && conversation.chat !== null

  useKeyboard((key) => {
    // Read live state (the closure's `state` can be stale under fast input).
    const s = store.getState()
    const currentRows = selectInboxRows(s)

    // Overlays capture input first.
    if (s.overlay === 'help') {
      if (resolveCommand({ name: key.name, shift: key.shift }) === 'quit') onQuit()
      else store.dispatch({ type: 'overlay/closed' })
      return
    }
    if (s.overlay === 'search') {
      if (key.name === 'escape') {
        store.dispatch({ type: 'overlay/closed' })
      } else if (key.name === 'return' || key.name === 'enter') {
        const top = searchChats(s.searchQuery, currentRows)[0]
        if (top) onOpenChat(top.id)
        store.dispatch({ type: 'overlay/closed' })
      } else if (key.name === 'backspace') {
        store.dispatch({ type: 'search/queryChanged', query: s.searchQuery.slice(0, -1) })
      } else if (
        !key.ctrl &&
        !key.meta &&
        (key.sequence?.length ?? 0) === 1 &&
        (key.sequence ?? '') >= ' '
      ) {
        store.dispatch({ type: 'search/queryChanged', query: s.searchQuery + key.sequence })
      }
      return
    }

    // Compose owns every key while focused (letters must type, not run commands).
    if (s.focus === 'compose') return

    // Openers are matched on the raw character (terminals name '/' and '?'
    // inconsistently), so they work regardless of the reported key name.
    if (key.sequence === '/') {
      store.dispatch({ type: 'overlay/opened', overlay: 'search' })
      return
    }
    if (key.sequence === '?') {
      store.dispatch({ type: 'overlay/opened', overlay: 'help' })
      return
    }

    // Network-rail scope cycling is app-wide; brackets are matched on the raw
    // character (terminals name them inconsistently, like '/' and '?' above).
    if (key.sequence === ']') {
      store.dispatch({ type: 'filter/scopeCycled', direction: 1 })
      return
    }
    if (key.sequence === '[') {
      store.dispatch({ type: 'filter/scopeCycled', direction: -1 })
      return
    }

    const command = resolveCommand({ name: key.name, shift: key.shift })
    // Archived / unread toggles are app-wide filters, handled before focus.
    if (command === 'toggle-archived') {
      store.dispatch({ type: 'filter/archivedToggled' })
      return
    }
    if (command === 'toggle-unread') {
      store.dispatch({ type: 'filter/unreadToggled' })
      return
    }
    if (command === 'quit') {
      onQuit()
      return
    }

    const conv = selectActiveConversation(s)
    const failed = selectLastFailedSend(s)

    if (s.focus === 'inbox') {
      switch (command) {
        case 'move-down':
          store.dispatch({
            type: 'chat/selected',
            chatId: moveSelection(currentRows, s.selectedChatId, 1),
          })
          break
        case 'move-up':
          store.dispatch({
            type: 'chat/selected',
            chatId: moveSelection(currentRows, s.selectedChatId, -1),
          })
          break
        case 'top':
          store.dispatch({ type: 'chat/selected', chatId: edgeSelection(currentRows, 'top') })
          break
        case 'bottom':
          store.dispatch({ type: 'chat/selected', chatId: edgeSelection(currentRows, 'bottom') })
          break
        case 'open':
          if (s.selectedChatId !== null) onOpenChat(s.selectedChatId)
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
        store.dispatch({ type: 'conversation/scrolled', delta: conv.messages.length })
        break
      case 'bottom':
        store.dispatch({ type: 'conversation/scrolled', delta: -conv.messages.length })
        break
      case 'compose':
        if (conv.chat !== null) store.dispatch({ type: 'focus/changed', focus: 'compose' })
        break
      case 'retry':
        if (conv.chat !== null && failed !== null) {
          onRetry(conv.chat.id, failed.clientId, failed.text)
        }
        break
      case 'back':
        store.dispatch({ type: 'focus/changed', focus: 'inbox' })
        break
      case 'load-older':
        if (conv.chat !== null && conv.hasMoreOlder && conv.olderCursor !== null) {
          onLoadOlder(conv.chat.id, conv.olderCursor)
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

  const overlayPane =
    state.overlay === 'help' ? (
      <HelpOverlay groups={helpGroups()} />
    ) : state.overlay === 'search' ? (
      <SearchPalette query={state.searchQuery} results={searchChats(state.searchQuery, rows)} />
    ) : null

  return (
    <box style={{ flexDirection: 'column', width: '100%', height: '100%' }}>
      {overlayPane ??
        (narrow ? (
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
            <NetworkRail
              entries={rail}
              archived={state.filter.archived}
              unreadOnly={state.filter.unreadOnly}
            />
            <InboxPane rows={rows} />
            <box style={{ flexDirection: 'column', flexGrow: 1 }}>
              <ConversationView conversation={conversation} focused={focus === 'conversation'} />
              {composePane}
            </box>
          </box>
        ))}
      <StatusBar
        banner={banner}
        accountCount={state.accountOrder.length}
        scopeLabel={scopeLabel}
        archived={state.filter.archived}
        unreadOnly={state.filter.unreadOnly}
      />
    </box>
  )
}
