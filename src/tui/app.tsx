import { useMemo, useSyncExternalStore } from 'react'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import {
  selectActiveConversation,
  selectConnectionBanner,
  selectDraft,
  selectInboxRows,
  selectLastFailedSend,
  selectNetworkRail,
  selectReplyContext,
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
import { MessageSearchPalette } from '@/tui/components/MessageSearchPalette.tsx'
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
  /** Send the composed text to a chat (explicit user action, invariant 5).
   *  `replyToId` carries an in-progress reply's target when present. */
  onSend: (chatId: string, text: string, replyToId?: string) => void
  /** Retry a previously failed send. */
  onRetry: (chatId: string, clientId: string, text: string) => void
  /** Run a message search through the adapter (scoped to a chat when given). */
  onSearchMessages: (query: string, scopeChatId: string | null) => void
  /** Archive / unarchive a chat (capability-gated in the runtime). */
  onArchiveChat: (chatId: string) => void
  /** Open the selected message's attachment in the OS viewer. */
  onOpenAttachment: () => void
  /** Save the selected message's attachment to Downloads. */
  onSaveAttachment: () => void
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
  onSearchMessages,
  onArchiveChat,
  onOpenAttachment,
  onSaveAttachment,
}: AppProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  // Memoize the derived views on the specific state slices they depend on, so
  // that typing in the compose box (which only mutates `state.drafts`) doesn't
  // recompute them or re-render the memoized panels below.
  //
  // Each dep list is the exact set of slices its selector reads — deliberately
  // NOT the whole `state`, which changes on every dispatch and would defeat the
  // memo. exhaustive-deps can't see through the selector call, so it's disabled
  // for this block on purpose.
  /* eslint-disable react-hooks/exhaustive-deps */
  const rows = useMemo(
    () => selectInboxRows(state),
    [state.chats, state.chatOrder, state.filter, state.selectedChatId]
  )
  const rail = useMemo(
    () => selectNetworkRail(state),
    [state.chats, state.chatOrder, state.accounts, state.accountOrder, state.filter]
  )
  const banner = useMemo(() => selectConnectionBanner(state), [state.connection])
  const conversation = useMemo(
    () => selectActiveConversation(state),
    [
      state.selectedChatId,
      state.selectedMessageId,
      state.messagesByChat,
      state.conversationOffset,
      state.newMessagesBelow,
      state.chats,
    ]
  )
  /* eslint-enable react-hooks/exhaustive-deps */
  const scopeLabel = rail.find((e) => e.isSelected)?.label ?? 'All'
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

    if (s.overlay === 'messageSearch') {
      const ms = s.messageSearch
      if (key.name === 'escape') {
        store.dispatch({ type: 'messageSearch/closed' })
      } else if (key.name === 'up') {
        store.dispatch({ type: 'messageSearch/selectionMoved', delta: -1 })
      } else if (key.name === 'down') {
        store.dispatch({ type: 'messageSearch/selectionMoved', delta: 1 })
      } else if (key.name === 'return' || key.name === 'enter') {
        // With results in hand, Enter opens the selected hit; otherwise it runs
        // the search (only when there's a query to run).
        if (ms.status === 'done' && ms.results.length > 0) {
          const hit = ms.results[ms.selectedIndex]
          if (hit) onOpenChat(hit.chatId)
          store.dispatch({ type: 'messageSearch/closed' })
        } else if (ms.query.trim().length > 0) {
          onSearchMessages(ms.query, ms.scopeChatId)
        }
      } else if (key.name === 'backspace') {
        store.dispatch({ type: 'messageSearch/queryChanged', query: ms.query.slice(0, -1) })
      } else if (
        !key.ctrl &&
        !key.meta &&
        (key.sequence?.length ?? 0) === 1 &&
        (key.sequence ?? '') >= ' '
      ) {
        store.dispatch({ type: 'messageSearch/queryChanged', query: ms.query + key.sequence })
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
    // Message search scopes to the active chat when one is open, else searches all.
    if (resolveCommand({ name: key.name, shift: key.shift }) === 'search-messages') {
      const scopeChatId = s.focus === 'conversation' ? s.selectedChatId : null
      store.dispatch({ type: 'messageSearch/opened', scopeChatId })
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

    // Rail focus: the leftmost, outermost pane. j/k switch networks; Enter / l /
    // → drill back into the chat list. Esc / h / ← is a no-op (nothing further
    // out). The global [ ] / a / U shortcuts above still apply here too.
    if (s.focus === 'rail') {
      const railEntries = selectNetworkRail(s)
      if (key.name === 'right' || key.sequence === 'l') {
        store.dispatch({ type: 'focus/changed', focus: 'inbox' })
        return
      }
      switch (command) {
        case 'move-down':
          store.dispatch({ type: 'filter/scopeCycled', direction: 1 })
          break
        case 'move-up':
          store.dispatch({ type: 'filter/scopeCycled', direction: -1 })
          break
        case 'top':
          store.dispatch({ type: 'filter/scopeSelected', scope: railEntries[0]?.id ?? 'all' })
          break
        case 'bottom':
          store.dispatch({
            type: 'filter/scopeSelected',
            scope: railEntries[railEntries.length - 1]?.id ?? 'all',
          })
          break
        case 'open':
          store.dispatch({ type: 'focus/changed', focus: 'inbox' })
          break
        default:
          break
      }
      return
    }

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
        case 'archive-chat':
          // Quick-archive the highlighted chat without opening it.
          if (s.selectedChatId !== null) onArchiveChat(s.selectedChatId)
          break
        case 'back':
          // Step out to the network rail (the outermost pane).
          store.dispatch({ type: 'focus/changed', focus: 'rail' })
          break
        default:
          break
      }
      return
    }

    // Message-selection mode (entered with `v`): j/k move the cursor, Esc exits,
    // and r/o/s act on the selected message. Matched on the raw key so the
    // reply/open/save letters don't shadow the global `r`/`s` bindings.
    if (s.selectedMessageId !== null) {
      switch (command) {
        case 'move-up':
          store.dispatch({ type: 'messageSelection/moved', delta: -1 })
          return
        case 'move-down':
          store.dispatch({ type: 'messageSelection/moved', delta: 1 })
          return
        case 'back':
          store.dispatch({ type: 'messageSelection/cleared' })
          return
        default:
          break
      }
      if (key.sequence === 'r') {
        // Reply — capability-gated: a network that reports no reply support gets
        // a named notice, never a dead control (invariant 8).
        if (conv.chat !== null) {
          if (conv.chat.canReply === false) {
            store.dispatch({
              type: 'notice/shown',
              message: `Replies aren't supported on ${conv.chat.network}.`,
            })
          } else {
            store.dispatch({ type: 'reply/started', messageId: s.selectedMessageId })
            store.dispatch({ type: 'focus/changed', focus: 'compose' })
          }
        }
        return
      }
      if (key.sequence === 'o') {
        onOpenAttachment()
        return
      }
      if (key.sequence === 's') {
        onSaveAttachment()
        return
      }
      return // swallow other keys while selecting
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
      case 'select-message':
        store.dispatch({ type: 'messageSelection/started' })
        break
      case 'compose':
        if (conv.chat !== null) store.dispatch({ type: 'focus/changed', focus: 'compose' })
        break
      case 'retry':
        if (conv.chat !== null && failed !== null) {
          onRetry(conv.chat.id, failed.clientId, failed.text)
        }
        break
      case 'archive-chat':
        if (conv.chat !== null) onArchiveChat(conv.chat.id)
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

  const replyContext = selectReplyContext(state)
  const composePane = chatOpen ? (
    <Compose
      key={selectedChatId}
      draft={selectDraft(state, selectedChatId)}
      focused={focus === 'compose'}
      hasFailedSend={failedSend !== null}
      replyContext={replyContext}
      onEdit={(text) => store.dispatch({ type: 'draft/changed', chatId: selectedChatId, text })}
      onSend={(text) => onSend(selectedChatId, text, store.getState().replyTo ?? undefined)}
      onBlur={() => store.dispatch({ type: 'focus/changed', focus: 'conversation' })}
      onCancelReply={() => store.dispatch({ type: 'reply/cancelled' })}
    />
  ) : null

  const overlayPane =
    state.overlay === 'help' ? (
      <HelpOverlay groups={helpGroups()} />
    ) : state.overlay === 'search' ? (
      <SearchPalette query={state.searchQuery} results={searchChats(state.searchQuery, rows)} />
    ) : state.overlay === 'messageSearch' ? (
      <MessageSearchPalette state={state.messageSearch} />
    ) : null

  return (
    <box style={{ flexDirection: 'column', width: '100%', height: '100%' }}>
      {overlayPane ??
        (narrow ? (
          // No rail column when narrow; rail focus still shows the list (which
          // re-filters as you switch networks), scope visible in the status bar.
          focus === 'inbox' || focus === 'rail' ? (
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
              focused={focus === 'rail'}
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
        notice={state.notice}
      />
    </box>
  )
}
