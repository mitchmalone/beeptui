import { BeeperError, normalizeError } from '@/beeper/errors.ts'
import type { Account, ChatSummary, ServerInfo } from '@/beeper/types.ts'
import type { AppEvent } from '@/state/types.ts'

/**
 * The adapter surface the runtime needs. `BeeperAdapter` satisfies it; tests
 * pass a fake so the boot sequence is exercised without a live Beeper.
 */
export interface Gateway {
  getInfo(): Promise<ServerInfo>
  listAccounts(): Promise<Account[]>
  listChats(options?: { limit?: number }): Promise<ChatSummary[]>
}

type Dispatch = (event: AppEvent) => void

/** Map an adapter failure onto a connection state. */
function connectionForError(error: BeeperError): 'unreachable' | 'unauthorized' {
  return error.kind === 'unauthorized' ? 'unauthorized' : 'unreachable'
}

/**
 * Boot: connect, load server info + accounts + chats, and land in a `connected`
 * state — or a visible, named degraded state on failure. Never throws; the UI
 * always has an honest connection state to render (CLAUDE.md invariant 8).
 */
export async function bootstrap(gateway: Gateway, dispatch: Dispatch): Promise<void> {
  dispatch({ type: 'connection/changed', state: 'connecting' })
  try {
    const server = await gateway.getInfo()
    dispatch({ type: 'server/loaded', server })

    const accounts = await gateway.listAccounts()
    dispatch({ type: 'accounts/loaded', accounts })

    const chats = await gateway.listChats()
    dispatch({ type: 'chats/loaded', chats })

    dispatch({ type: 'error/cleared' })
    dispatch({ type: 'connection/changed', state: 'connected' })
  } catch (err) {
    const error = normalizeError(err)
    dispatch({ type: 'connection/changed', state: connectionForError(error) })
    dispatch({ type: 'error/raised', kind: error.kind, message: error.message })
  }
}

/** Re-fetch chats (manual refresh stopgap until live updates land in Slice 6). */
export async function refreshChats(gateway: Gateway, dispatch: Dispatch): Promise<void> {
  try {
    const chats = await gateway.listChats()
    dispatch({ type: 'chats/loaded', chats })
  } catch (err) {
    const error = normalizeError(err)
    dispatch({ type: 'connection/changed', state: connectionForError(error) })
    dispatch({ type: 'error/raised', kind: error.kind, message: error.message })
  }
}
