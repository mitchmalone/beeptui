import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { createElement } from 'react'
import { BeeperAdapter, resolveConfig, resolveToken } from '@/beeper/index.ts'
import { App } from '@/tui/app.tsx'
import { createStore } from '@/tui/store.ts'
import { bootstrap, loadOlderMessages, openChat, refreshChats } from '@/tui/runtime.ts'

/**
 * Boot the TUI: build the adapter from config + credential store, create the
 * store, mount the app, then kick off the async connect sequence. The app
 * renders a `connecting` state immediately and updates as data arrives — or
 * shows a named degraded state if Beeper is unreachable. Loaded lazily so the
 * `status`/`doctor` CLI never pulls in the native renderer.
 */
export async function launch(): Promise<void> {
  const { endpoint } = resolveConfig()
  const token = resolveToken()
  const adapter = new BeeperAdapter({ endpoint, accessToken: token })
  const store = createStore()

  const renderer = await createCliRenderer()
  const onQuit = () => {
    renderer.destroy()
    process.exit(0)
  }
  const onRefresh = () => {
    void refreshChats(adapter, store.dispatch)
  }
  const onOpenChat = (chatId: string) => {
    void openChat(adapter, store.dispatch, chatId)
  }
  const onLoadOlder = (chatId: string, cursor: string) => {
    void loadOlderMessages(adapter, store.dispatch, chatId, cursor)
  }

  createRoot(renderer).render(
    createElement(App, { store, onQuit, onRefresh, onOpenChat, onLoadOlder })
  )

  // Fire-and-forget: bootstrap dispatches into the store, which re-renders the app.
  void bootstrap(adapter, store.dispatch)
}
