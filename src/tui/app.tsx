import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import {
  selectActiveConversation,
  selectConnectionBanner,
  selectDraft,
  selectInboxRows,
  selectLastFailedSend,
  selectNetworkRail,
  selectReplyContext,
  selectSelectedMessage,
} from '@/state/selectors.ts'
import { checkCapability } from '@/state/capabilities.ts'
import { NARROW_WIDTH, conversationCapacity } from '@/state/conversation-scroll.ts'
import { CONVERSATION_ACTIONS, QUICK_REACTIONS, SETTINGS_ITEMS } from '@/state/reactions.ts'
import { RAIL_ARCHIVED_ID, RAIL_SETTINGS_ID } from '@/state/types.ts'
import { edgeSelection, moveSelection } from '@/tui/navigation.ts'
import { helpGroups, KEYMAP, resolveCommand, resolveKey, type Binding } from '@/tui/keymap.ts'
import { searchChats } from '@/tui/fuzzy.ts'
import type { Store } from '@/state/store.ts'
import { InboxPane, type NetworkColors } from '@/tui/components/InboxPane.tsx'
import { NetworkRail } from '@/tui/components/NetworkRail.tsx'
import { SettingsMenu } from '@/tui/components/SettingsMenu.tsx'
import { ThemePicker } from '@/tui/components/ThemePicker.tsx'
import { StatusBar } from '@/tui/components/StatusBar.tsx'
import { ConversationView, type ConversationMenu } from '@/tui/components/ConversationView.tsx'
import type { ImagePreviewCache } from '@/tui/image-preview-cache.ts'
import { Compose } from '@/tui/components/Compose.tsx'
import { SearchPalette } from '@/tui/components/SearchPalette.tsx'
import { MessageSearchPalette } from '@/tui/components/MessageSearchPalette.tsx'
import { HelpOverlay } from '@/tui/components/HelpOverlay.tsx'
import { ThemeProvider } from '@/tui/theme/context.tsx'
import { BUILTIN_THEMES, type Theme } from '@/tui/theme/theme.ts'
import { resolveTheme } from '@/tui/theme/resolve.ts'

/** Built-ins-only theme registry — the default when launch doesn't supply the
 *  folder-loaded one (e.g. in tests). */
const BUILTIN_REGISTRY = new Map<string, Theme>(Object.entries(BUILTIN_THEMES))

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
  /** Add a reaction to a message (explicit user pick, capability-gated). */
  onReact: (chatId: string, messageId: string, reactionKey: string) => void
  /** Effective keymap (base + user config overrides). Defaults to the base. */
  keymap?: readonly Binding[]
  /** Per-network colour overrides from `config.theme.networkColors`. */
  networkColors?: NetworkColors | undefined
  /** name→Theme registry (built-ins + user themes). `t` cycles through its keys.
   *  Defaults to built-ins only. */
  themeRegistry?: Map<string, Theme>
  /** Inline image thumbnail pipeline; null keeps text placeholders. */
  previewCache?: ImagePreviewCache | null
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
  onReact,
  keymap = KEYMAP,
  networkColors,
  themeRegistry = BUILTIN_REGISTRY,
  previewCache = null,
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
    // `railCursor` belongs here: every entry carries `isCursor`, so leaving it
    // out froze the rail's caret — the cursor moved in state and the rail kept
    // drawing the old one until an unrelated change happened to invalidate the
    // memo.
    [
      state.chats,
      state.chatOrder,
      state.accounts,
      state.accountOrder,
      state.filter,
      state.railCursor,
    ]
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
  // Status-bar key hint from the effective keymap, so rebinds show their keys.
  // Context-aware: only advertise keys that actually fire right now. Compose
  // captures every key for text entry, and an open overlay captures input for
  // itself — so the global net/arch/quit shortcuts don't run in either, and
  // showing them there would be a lie (invariant 8: no misleading controls).
  const keyHint = useMemo(() => {
    const display = (command: string) => keymap.find((b) => b.command === command)?.display ?? ''
    if (state.focus === 'compose') return '⏎ send · Esc back'
    if (state.overlay !== 'none') return 'Esc close'
    return `${display('network-cycle')} net · ${display('toggle-archived')} arch · ${display('quit')} quit`
  }, [keymap, state.focus, state.overlay])
  const scopeLabel = rail.find((e) => e.isSelected)?.label ?? 'All'
  const failedSend = selectLastFailedSend(state)
  // Resolve the selected theme name (cycled with `t`) to its tokens; the provider
  // below hands them to every component via `useTheme()`.
  const theme = resolveTheme(state.themeName, themeRegistry)
  // Registry order drives both the `t` cycle and the theme flyout's list.
  const themeNames = useMemo(() => [...themeRegistry.keys()], [themeRegistry])
  const { width, height } = useTerminalDimensions()
  const narrow = width < NARROW_WIDTH
  const focus = state.focus
  const selectedChatId = state.selectedChatId
  const chatOpen = selectedChatId !== null && conversation.chat !== null

  // Tell the reducer the conversation viewport's size, so it can keep the
  // selection cursor on screen as ↑/↓ move it. Width matters as much as height:
  // it decides where messages wrap and therefore how many rows each occupies.
  // Re-dispatched only when a dimension actually changes (guarded in the
  // reducer too).
  const viewportRows = conversationCapacity(height, state.density)
  useEffect(() => {
    store.dispatch({ type: 'viewport/measured', rows: viewportRows, cols: width })
  }, [store, viewportRows, width])

  // The message cursor asked for older history by reaching the top. The reducer
  // records that intent and never fetches (invariant 4); this turns it into the
  // call, once, and `messages/loaded` clears the marker.
  const pendingOlder = state.olderPagePending
  const pendingCursor =
    pendingOlder === null ? null : (state.messagesByChat[pendingOlder]?.olderCursor ?? null)
  useEffect(() => {
    if (pendingOlder !== null && pendingCursor !== null) onLoadOlder(pendingOlder, pendingCursor)
  }, [onLoadOlder, pendingOlder, pendingCursor])

  useKeyboard((key) => {
    // Read live state (the closure's `state` can be stale under fast input).
    const s = store.getState()
    const currentRows = selectInboxRows(s)

    /** Begin a reply on `messageId`. Shared by `r` and the action menu so the
     *  capability gate cannot drift between the two entry points: a network
     *  that reports no reply support gets a named notice, never a dead control
     *  (invariant 8). */
    const startReply = (messageId: string) => {
      const chat = selectActiveConversation(s).chat
      if (chat === null) return
      const capability = checkCapability(chat, 'reply')
      if (!capability.allowed) {
        store.dispatch({ type: 'notice/shown', message: capability.notice })
        return
      }
      store.dispatch({ type: 'reply/started', messageId })
      store.dispatch({ type: 'focus/changed', focus: 'compose' })
    }

    // Overlays capture input first.
    if (s.overlay === 'help') {
      if (resolveCommand({ name: key.name, shift: key.shift }, keymap) === 'quit') onQuit()
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

    // The conversation action menu (ENTER "dropdown"): ↑/↓ move, ⏎ chooses the
    // action, Esc closes back to the conversation.
    if (s.overlay === 'settingsMenu') {
      if (key.name === 'escape') {
        store.dispatch({ type: 'overlay/closed' })
      } else if (key.name === 'up') {
        store.dispatch({ type: 'settingsMenu/moved', delta: -1 })
      } else if (key.name === 'down') {
        store.dispatch({ type: 'settingsMenu/moved', delta: 1 })
      } else if (key.name === 'return' || key.name === 'enter') {
        if (SETTINGS_ITEMS[s.settingsCursor]?.id === 'theme') {
          store.dispatch({ type: 'overlay/opened', overlay: 'themePicker' })
        }
      }
      return
    }

    if (s.overlay === 'themePicker') {
      // Esc steps back to Settings rather than closing out entirely — this is
      // the one place with two levels, and jumping straight out would lose the
      // user's place.
      if (key.name === 'escape') {
        store.dispatch({ type: 'overlay/opened', overlay: 'settingsMenu' })
      } else if (key.name === 'up') {
        store.dispatch({ type: 'themePicker/moved', delta: -1, count: themeNames.length })
      } else if (key.name === 'down') {
        store.dispatch({ type: 'themePicker/moved', delta: 1, count: themeNames.length })
      } else if (key.name === 'return' || key.name === 'enter') {
        const name = themeNames[s.themeCursor]
        if (name !== undefined) store.dispatch({ type: 'theme/selected', name })
        store.dispatch({ type: 'overlay/closed' })
      }
      return
    }

    if (s.overlay === 'conversationActions') {
      if (key.name === 'escape') {
        store.dispatch({ type: 'overlay/closed' })
      } else if (key.name === 'up') {
        store.dispatch({ type: 'actionMenu/moved', delta: -1 })
      } else if (key.name === 'down') {
        store.dispatch({ type: 'actionMenu/moved', delta: 1 })
      } else if (key.name === 'return' || key.name === 'enter') {
        const action = CONVERSATION_ACTIONS[s.actionCursor]
        if (action?.id === 'react') {
          store.dispatch({ type: 'overlay/opened', overlay: 'emojiPicker' })
        } else if (action?.id === 'reply' && s.selectedMessageId !== null) {
          store.dispatch({ type: 'overlay/closed' })
          startReply(s.selectedMessageId)
        } else if (action?.id === 'open') {
          store.dispatch({ type: 'overlay/closed' })
          onOpenAttachment()
        }
      }
      return
    }

    // The limited emoji picker: ←/→ move, ⏎ reacts, Esc steps back to the menu.
    if (s.overlay === 'emojiPicker') {
      if (key.name === 'escape') {
        store.dispatch({ type: 'overlay/opened', overlay: 'conversationActions' })
      } else if (key.name === 'left') {
        store.dispatch({ type: 'emojiPicker/moved', delta: -1 })
      } else if (key.name === 'right') {
        store.dispatch({ type: 'emojiPicker/moved', delta: 1 })
      } else if (key.name === 'return' || key.name === 'enter') {
        const emoji = QUICK_REACTIONS[s.emojiCursor]
        const target = selectSelectedMessage(s)
        if (emoji !== undefined && target !== null && s.selectedChatId !== null) {
          onReact(s.selectedChatId, target.id, emoji)
        }
        store.dispatch({ type: 'overlay/closed' })
      }
      return
    }

    // Compose owns every key while focused (letters must type, not run commands).
    if (s.focus === 'compose') return

    // Everything else resolves through the keymap (token first, then the raw
    // character — see `resolveKey`) so config rebinds are honoured everywhere.
    const match = resolveKey({ name: key.name, shift: key.shift, sequence: key.sequence }, keymap)
    const command = match?.command ?? null

    if (command === 'search') {
      store.dispatch({ type: 'overlay/opened', overlay: 'search' })
      return
    }
    if (command === 'help') {
      store.dispatch({ type: 'overlay/opened', overlay: 'help' })
      return
    }
    // Message search scopes to the active chat when one is open, else searches all.
    if (command === 'search-messages') {
      const scopeChatId = s.focus === 'conversation' ? s.selectedChatId : null
      store.dispatch({ type: 'messageSearch/opened', scopeChatId })
      return
    }

    // Network-rail scope cycling is app-wide. The matched key picks the
    // direction: the binding's first key cycles forward, any other backward.
    if (command === 'network-cycle' && match !== null) {
      store.dispatch({ type: 'filter/scopeCycled', direction: match.keyIndex === 0 ? 1 : -1 })
      return
    }

    // Archived / unread toggles are app-wide filters, handled before focus.
    if (command === 'toggle-archived') {
      store.dispatch({ type: 'filter/archivedToggled' })
      return
    }
    if (command === 'toggle-unread') {
      store.dispatch({ type: 'filter/unreadToggled' })
      return
    }
    if (command === 'toggle-density') {
      store.dispatch({ type: 'density/toggled' })
      return
    }
    if (command === 'cycle-theme') {
      // Advance to the next registered theme (wrapping), and name it in the
      // status bar so the switch is legible.
      const names = themeNames
      const index = names.indexOf(s.themeName)
      const next = names[(index + 1) % names.length] ?? names[0]
      if (next !== undefined) {
        store.dispatch({ type: 'theme/selected', name: next })
        store.dispatch({ type: 'notice/shown', message: `Theme: ${next}` })
      }
      return
    }
    if (command === 'quit') {
      onQuit()
      return
    }

    const conv = selectActiveConversation(s)
    const failed = selectLastFailedSend(s)

    // Rail focus: the leftmost, outermost pane. j/k move the cursor over the
    // scopes plus the Archived toggle; Enter / l / → toggles Archived when the
    // cursor is on it, otherwise drills into the chat list. g/G jump to the first
    // and last *scope*. The global [ ] / a / U shortcuts above still apply.
    if (s.focus === 'rail') {
      const scopes = selectNetworkRail(s).filter((e) => e.kind === 'scope')
      const onArchived = s.railCursor === RAIL_ARCHIVED_ID
      if (command === 'open' || key.name === 'right' || key.sequence === 'l') {
        if (s.railCursor === RAIL_SETTINGS_ID) {
          store.dispatch({ type: 'overlay/opened', overlay: 'settingsMenu' })
        } else if (onArchived) store.dispatch({ type: 'filter/archivedToggled' })
        else store.dispatch({ type: 'focus/changed', focus: 'inbox' })
        return
      }
      switch (command) {
        case 'move-down':
          store.dispatch({ type: 'rail/cursorMoved', direction: 1 })
          break
        case 'move-up':
          store.dispatch({ type: 'rail/cursorMoved', direction: -1 })
          break
        case 'top':
          store.dispatch({ type: 'filter/scopeSelected', scope: scopes[0]?.id ?? 'all' })
          break
        case 'bottom':
          store.dispatch({
            type: 'filter/scopeSelected',
            scope: scopes[scopes.length - 1]?.id ?? 'all',
          })
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

    // Conversation focus. A message cursor is always active here (auto-selected
    // on entry — see the reducer's focus/changed), so ↑/↓ move the indicator,
    // ⏎ opens the action menu, and Esc leaves to the inbox. r/o/s act on the
    // selected message; they're raw-matched so `r`/`s` don't run the global
    // refresh/search bindings while a message is selected.
    if (s.selectedMessageId !== null) {
      if (key.sequence === 'r') {
        startReply(s.selectedMessageId)
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
    }

    switch (command) {
      case 'move-up':
        store.dispatch({ type: 'messageSelection/moved', delta: -1 })
        break
      case 'move-down':
        store.dispatch({ type: 'messageSelection/moved', delta: 1 })
        break
      case 'top':
        store.dispatch({ type: 'messageSelection/moved', delta: -conv.messages.length })
        break
      case 'bottom':
        store.dispatch({ type: 'messageSelection/moved', delta: conv.messages.length })
        break
      case 'select-message':
        // `v` re-anchors the cursor at the newest message (selection is otherwise
        // always on in the conversation).
        store.dispatch({ type: 'messageSelection/started' })
        break
      case 'open':
        // ⏎ opens the action menu on the selected message (the "dropdown").
        if (conv.chat !== null && s.selectedMessageId !== null) {
          store.dispatch({ type: 'overlay/opened', overlay: 'conversationActions' })
        }
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
        // Leave the conversation: drop the cursor and step out to the inbox.
        store.dispatch({ type: 'messageSelection/cleared' })
        store.dispatch({ type: 'focus/changed', focus: 'inbox' })
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

  const settingsFlyout =
    state.overlay === 'settingsMenu' ? (
      <SettingsMenu cursor={state.settingsCursor} />
    ) : state.overlay === 'themePicker' ? (
      <ThemePicker names={themeNames} cursor={state.themeCursor} active={state.themeName} />
    ) : null

  const overlayPane =
    state.overlay === 'help' ? (
      <HelpOverlay groups={helpGroups(keymap)} />
    ) : state.overlay === 'search' ? (
      <SearchPalette query={state.searchQuery} results={searchChats(state.searchQuery, rows)} />
    ) : state.overlay === 'messageSearch' ? (
      <MessageSearchPalette state={state.messageSearch} />
    ) : null

  // The action menu / emoji picker are NOT full-screen overlays — they float
  // over the conversation, anchored on the message cursor, so the panes stay
  // mounted (no full-screen redraw). ConversationView positions them.
  const conversationMenu: ConversationMenu =
    state.overlay === 'conversationActions'
      ? { kind: 'actions', actionCursor: state.actionCursor }
      : state.overlay === 'emojiPicker'
        ? { kind: 'emoji', emojiCursor: state.emojiCursor }
        : null

  return (
    <ThemeProvider theme={theme}>
      <box style={{ flexDirection: 'column', width: '100%', height: '100%', position: 'relative' }}>
        {overlayPane ??
          (narrow ? (
            // No rail column when narrow; rail focus still shows the list (which
            // re-filters as you switch networks), scope visible in the status bar.
            focus === 'inbox' || focus === 'rail' ? (
              <InboxPane
                rows={rows}
                grow
                focused={focus === 'inbox' || focus === 'rail'}
                networkColors={networkColors}
                density={state.density}
              />
            ) : (
              <box style={{ flexDirection: 'column', flexGrow: 1 }}>
                <ConversationView
                  conversation={conversation}
                  focused={focus === 'conversation'}
                  menu={conversationMenu}
                  networkColors={networkColors}
                  density={state.density}
                  loadingOlder={pendingOlder !== null}
                  replyToId={state.replyTo}
                  previewCache={previewCache}
                />
                {composePane}
              </box>
            )
          ) : (
            <box style={{ flexDirection: 'row', flexGrow: 1 }}>
              <NetworkRail
                entries={rail}
                unreadOnly={state.filter.unreadOnly}
                focused={focus === 'rail'}
                networkColors={networkColors}
              />
              <InboxPane
                rows={rows}
                focused={focus === 'inbox'}
                networkColors={networkColors}
                density={state.density}
              />
              <box style={{ flexDirection: 'column', flexGrow: 1 }}>
                <ConversationView
                  conversation={conversation}
                  focused={focus === 'conversation'}
                  menu={conversationMenu}
                  networkColors={networkColors}
                  density={state.density}
                  loadingOlder={pendingOlder !== null}
                  replyToId={state.replyTo}
                  previewCache={previewCache}
                />
                {composePane}
              </box>
            </box>
          ))}
        {/* Anchored on the root, not on the rail: at 8 columns the rail clips
            its own absolute children and the menu renders as a stub. Sits just
            above the status bar, by the rail's Settings entry. */}
        {settingsFlyout !== null ? (
          <box style={{ position: 'absolute', bottom: 1, left: 1, zIndex: 30 }}>
            {settingsFlyout}
          </box>
        ) : null}
        <StatusBar
          banner={banner}
          accountCount={state.accountOrder.length}
          scopeLabel={scopeLabel}
          archived={state.filter.archived}
          unreadOnly={state.filter.unreadOnly}
          notice={state.notice}
          keyHint={keyHint}
        />
      </box>
    </ThemeProvider>
  )
}
