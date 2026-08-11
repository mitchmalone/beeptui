import { reduce } from '@/state/reducer.ts'
import { initialState, type AppEvent, type AppState } from '@/state/types.ts'

/**
 * A minimal observable store over the pure reducer — no external state library.
 * Components read `getState` (via `useSyncExternalStore`) and `dispatch` events;
 * all transitions still go through `reduce` (CLAUDE.md invariant 4).
 */
export interface Store {
  getState(): AppState
  dispatch(event: AppEvent): void
  subscribe(listener: () => void): () => void
}

export function createStore(initial: AppState = initialState): Store {
  let state = initial
  const listeners = new Set<() => void>()

  return {
    getState: () => state,
    dispatch(event) {
      const next = reduce(state, event)
      if (next === state) return // no-op transitions don't notify
      state = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
