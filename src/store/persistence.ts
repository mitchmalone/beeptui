import type { Store } from '@/state/store.ts'
import type { AppState } from '@/state/types.ts'
import type { UiStore } from '@/store/store.ts'

export interface PersistenceHandle {
  /** Persist any pending changes immediately (cancels the debounce timer). */
  flush(): void
  /** Stop persisting and unsubscribe (flushes once first). */
  detach(): void
}

export interface AttachOptions {
  /** Debounce window for write-through, ms. */
  debounceMs?: number
}

const DEFAULT_DEBOUNCE_MS = 400

/** The persisted scroll anchor: the message id at the top of the visible window,
 *  or null when pinned to the newest message. Persisted but not yet restored on
 *  hydrate — restoring requires paging history to the anchored message, a
 *  tracked follow-up (`TODO.md`); reopening currently lands on the newest page. */
function scrollAnchorId(state: AppState): string | null {
  const id = state.selectedChatId
  if (id === null || state.conversationOffset === 0) return null
  const items = state.messagesByChat[id]?.items ?? []
  return items[items.length - 1 - state.conversationOffset]?.id ?? null
}

/**
 * Bridge the UI store to the app store: hydrate persisted UI state at boot, then
 * write-through (debounced) as it changes. Drafts survive restart, the inbox
 * paints from the metadata cache before the first live fetch, and the last
 * selected chat is restored when it still exists ("where safe").
 *
 * Never sends or mutates anything authoritative — it only persists/restores UI
 * state through the reducer's own events (invariant 4).
 */
export function attachPersistence(
  ui: UiStore,
  app: Store,
  options: AttachOptions = {}
): PersistenceHandle {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS

  // ── Hydrate (before the live bootstrap runs) ──────────────────────────────
  const cachedChats = ui.getCachedChats()
  if (cachedChats.length > 0) app.dispatch({ type: 'chats/loaded', chats: cachedChats })
  for (const [chatId, text] of Object.entries(ui.getDrafts())) {
    app.dispatch({ type: 'draft/changed', chatId, text })
  }
  const view = ui.getViewState()
  if (view.lastSelectedChatId !== null && app.getState().chats[view.lastSelectedChatId]) {
    app.dispatch({ type: 'chat/selected', chatId: view.lastSelectedChatId })
  }

  // ── Persist (write-through) ───────────────────────────────────────────────
  // Deliberately a full rewrite of drafts + view state + chat cache on each
  // (debounced) run: at UI-store scale that is cheaper than diffing, and it
  // keeps the persisted picture impossible to drift from state.
  function persist(): void {
    const state = app.getState()

    // Drafts: upsert present, delete any that are gone (e.g. cleared on send).
    const persisted = ui.getDrafts()
    for (const [chatId, text] of Object.entries(state.drafts)) ui.setDraft(chatId, text)
    for (const chatId of Object.keys(persisted)) {
      if (!(chatId in state.drafts)) ui.setDraft(chatId, '')
    }

    ui.setViewState({
      lastSelectedChatId: state.selectedChatId,
      scrollAnchorMessageId: scrollAnchorId(state),
    })

    if (state.chatOrder.length > 0) {
      const chats = state.chatOrder.map((id) => state.chats[id]).filter((c) => c !== undefined)
      ui.putCachedChats(chats)
    }
  }

  let timer: ReturnType<typeof setTimeout> | null = null
  function schedule(): void {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      persist()
    }, debounceMs)
  }
  function flush(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    persist()
  }

  const unsubscribe = app.subscribe(schedule)

  return {
    flush,
    detach() {
      unsubscribe()
      flush()
    },
  }
}
