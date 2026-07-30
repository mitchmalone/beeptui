/**
 * Local SQLite store (`bun:sqlite`) for non-authoritative UI state only:
 * drafts, chat metadata cache, and last-view state. Never message bodies,
 * tokens, or credentials (CLAUDE.md invariant 1). This is the only module that
 * opens SQLite; everything else goes through the typed `UiStore` interface.
 */
export {
  openUiStore,
  defaultDbPath,
  type UiStore,
  type ViewState,
  type OpenOptions,
} from '@/store/store.ts'
export { attachPersistence, type PersistenceHandle } from '@/store/persistence.ts'
