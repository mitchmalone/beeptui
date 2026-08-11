import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createCliRenderer } from '@opentui/core'
import { ImagePreviewCache } from '@/tui/image-preview-cache.ts'
import { createRoot } from '@opentui/react'
import { createElement } from 'react'
import { BeeperAdapter, resolveActiveToken, resolveConfig } from '@/beeper/index.ts'
import { App } from '@/tui/app.tsx'
import { buildThemeRegistry } from '@/tui/theme/resolve.ts'
import { systemThemeForMode } from '@/tui/theme/theme.ts'
import { createDemoGateway } from '@/tui/demo.ts'
import { demoScenario, runDemoScenario } from '@/tui/demo-scenarios.ts'
import type { Gateway } from '@/tui/runtime.ts'
import { createStore } from '@/state/store.ts'
import { initialState } from '@/state/types.ts'
import { selectTotalUnread } from '@/state/selectors.ts'
import { createStatusWriter } from '@/tui/terminal-status.ts'
import { attachPersistence, openUiStore } from '@/store/index.ts'
import { startWatch, type WatchHandle } from '@/beeper/watch.ts'
import {
  applyWatchEvent,
  bootstrap,
  loadOlderMessages,
  archiveChat,
  sendReaction,
  openAttachment,
  openChat,
  refreshChats,
  resyncAfterReconnect,
  retrySend,
  runMessageSearch,
  saveAttachment,
  submitSend,
  watchStatusToConnection,
} from '@/tui/runtime.ts'
import { openFile, runNotifier, saveToDownloads } from '@/tui/os-open.ts'
import { buildNotifyArgs, shouldNotify } from '@/tui/notify.ts'
import { applyKeymapOverrides, KEYMAP } from '@/tui/keymap.ts'

/**
 * Boot the TUI: build the adapter from config + credential store, create the
 * store, mount the app, then kick off the async connect sequence. The app
 * renders a `connecting` state immediately and updates as data arrives — or
 * shows a named degraded state if Beeper is unreachable. Loaded lazily so the
 * `status`/`doctor` CLI never pulls in the native renderer.
 */
export async function launch(
  options: { demo?: boolean; demoScenario?: string } = {}
): Promise<void> {
  const demo = options.demo ?? false
  const scenario = demo ? demoScenario(options.demoScenario) : null
  const { endpoint, notify, keymap: keymapOverrides, theme, configPath } = resolveConfig()
  // Resolve the active theme: built-ins plus any user themes in the config dir's
  // `themes/` folder. A missing folder is fine (built-ins only); a malformed
  // theme file throws with a clear message rather than being silently ignored.
  const themesDir = join(dirname(configPath), 'themes')
  const themeRegistry = buildThemeRegistry({
    listThemeFiles: () => {
      try {
        return readdirSync(themesDir)
      } catch {
        return []
      }
    },
    readThemeFile: (file) => {
      try {
        return readFileSync(join(themesDir, file), 'utf8')
      } catch {
        return undefined
      }
    },
  })
  // Demo mode (`--demo`): the real TUI against a synthetic gateway — no auth, no
  // network. Everything else (theme, keymap, render) is identical.
  let token: string | undefined
  let gateway: Gateway
  if (demo) {
    gateway = createDemoGateway()
  } else {
    // Resolve the token: an explicit env/legacy token wins; otherwise a stored
    // OAuth session (from `beeptui login`), refreshed if expired. Needs the
    // endpoint's OAuth metadata, so it reads `/v1/info` via a pre-auth adapter.
    const preAuth = new BeeperAdapter({ endpoint })
    token = await resolveActiveToken({
      getInfo: () => preAuth.getInfo(),
      http: { fetch, nowMs: Date.now() },
    })
    gateway = new BeeperAdapter({ endpoint, accessToken: token })
  }
  // A bad rebind (unknown command / empty keys) is fatal with a clear message —
  // better than silently ignoring the user's config.
  const keymap = keymapOverrides === null ? KEYMAP : applyKeymapOverrides(keymapOverrides)
  const store = createStore(
    theme === null
      ? initialState
      : {
          ...initialState,
          ...(theme.density !== undefined ? { density: theme.density } : {}),
          ...(theme.name !== undefined ? { themeName: theme.name } : {}),
        }
  )

  // Hydrate persisted UI state (drafts, cached inbox, last-view) before the live
  // bootstrap runs, and write it through as it changes. Skipped in demo mode so
  // the synthetic data never overwrites the user's real cached inbox/drafts.
  const persistence = demo ? null : attachPersistence(openUiStore(), store)

  // Surface the unread count in the terminal / tmux window name. Skipped in demo
  // so the demo's fake counts don't touch the user's window title.
  const statusWriter = demo ? null : createStatusWriter()
  if (statusWriter !== null) {
    store.subscribe(() => statusWriter.update(selectTotalUnread(store.getState())))
    statusWriter.update(selectTotalUnread(store.getState()))
  }

  // Inline image thumbnails: downloads ride the same adapter as o/s.
  const previewCache = new ImagePreviewCache({
    download: (id) => gateway.downloadAttachment(id),
  })

  const renderer = await createCliRenderer()
  // Resolve the `system` theme against the terminal's light/dark mode (OpenTUI
  // owns the OSC query). Done before the first render so the initial paint is
  // already correct; a timeout/failure keeps the dark fallback. Runtime cycling
  // to `system` then uses the detected variant too (same registry Map).
  try {
    const mode = await renderer.waitForThemeMode(200)
    themeRegistry.set('system', systemThemeForMode(mode))
  } catch {
    themeRegistry.set('system', systemThemeForMode(null))
  }
  let watch: WatchHandle | null = null
  const onQuit = () => {
    persistence?.flush() // save the last debounce window before exiting
    statusWriter?.restore() // hand the tmux window name back before exiting
    watch?.close()
    renderer.destroy()
    process.exit(0)
  }
  const onRefresh = () => {
    void refreshChats(gateway, store.dispatch)
  }
  const onOpenChat = (chatId: string) => {
    void openChat(gateway, store.dispatch, chatId)
  }
  const onLoadOlder = (chatId: string, cursor: string) => {
    void loadOlderMessages(gateway, store.dispatch, chatId, cursor)
  }
  const onSend = (chatId: string, text: string, replyToId?: string) => {
    void submitSend(gateway, store.dispatch, {
      chatId,
      clientId: crypto.randomUUID(),
      text,
      timestamp: new Date().toISOString(),
      ...(replyToId !== undefined ? { replyToId } : {}),
    })
  }
  const onRetry = (chatId: string, clientId: string, text: string) => {
    void retrySend(gateway, store.dispatch, {
      chatId,
      clientId,
      text,
      timestamp: new Date().toISOString(),
    })
  }
  const onSearchMessages = (query: string, scopeChatId: string | null) => {
    void runMessageSearch(gateway, store.dispatch, store.getState, query, scopeChatId)
  }
  const onArchiveChat = (chatId: string) => {
    void archiveChat(gateway, store.dispatch, store.getState, chatId)
  }
  const onOpenAttachment = () => {
    void openAttachment(gateway, store.dispatch, store.getState, openFile)
  }
  const onSaveAttachment = () => {
    void saveAttachment(gateway, store.dispatch, store.getState, saveToDownloads)
  }
  const onReact = (chatId: string, messageId: string, reactionKey: string) => {
    void sendReaction(gateway, store.dispatch, store.getState, chatId, messageId, reactionKey)
  }

  createRoot(renderer).render(
    createElement(App, {
      store,
      previewCache,
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
      keymap,
      themeRegistry,
      ...(theme !== null ? { networkColors: theme.networkColors } : {}),
    })
  )

  // Fire-and-forget: bootstrap dispatches into the store, which re-renders the app.
  void bootstrap(gateway, store.dispatch).then(() => {
    // Demo mode opens the scenario's chat on first paint so the center pane
    // isn't empty in screenshots, then loops the scripted cycle — events flow
    // through the reducer exactly like watch events. (No watch socket runs in
    // demo — token is undefined.)
    if (scenario !== null) {
      void openChat(gateway, store.dispatch, scenario.openChatId).then(() => {
        runDemoScenario(scenario, store.dispatch)
      })
    }
  })

  // Live updates: subscribe to the watch socket. On each (re)connect after the
  // first, resync to close the gap. No token → no watch (reads/writes 401 anyway).
  if (token !== undefined) {
    let connectedBefore = false
    watch = startWatch({
      endpoint,
      accessToken: token,
      onEvent: (event) => {
        void applyWatchEvent(gateway, store.dispatch, event)
        // Notification hook: fire the configured command for inbound messages in
        // chats you're not currently reading. Redacted payload only (invariant 6).
        if (notify !== null && event.kind === 'messages') {
          const state = store.getState()
          for (const message of event.messages) {
            if (!shouldNotify(message, state.selectedChatId)) continue
            const network = state.chats[message.chatId]?.network ?? 'a chat'
            runNotifier(buildNotifyArgs(notify, network))
          }
        }
      },
      onStatus: (status) => {
        const connection = watchStatusToConnection(status)
        if (connection !== null) store.dispatch({ type: 'connection/changed', state: connection })
        if (status === 'connected') {
          if (connectedBefore) {
            void resyncAfterReconnect(gateway, store.dispatch, store.getState().selectedChatId)
          }
          connectedBefore = true
        }
      },
    })
  }
}
