/**
 * Application state — pure event reducer, normalized entities, selectors. No
 * I/O (no adapter runtime, no OpenTUI). UI dispatches events and renders
 * selector output; every state change flows through the reducer (CLAUDE.md
 * invariant 4).
 */
export { reduce } from '@/state/reducer.ts'
export {
  initialState,
  MAX_MESSAGES_PER_CHAT,
  type AppState,
  type AppEvent,
  type ConnectionState,
  type MessageEntity,
  type MessageDeliveryStatus,
  type ChatMessages,
  type MessagePage,
} from '@/state/types.ts'
export {
  selectInboxRows,
  selectActiveConversation,
  selectConnectionBanner,
  selectDraft,
  type InboxRow,
  type ActiveConversation,
  type ConnectionBanner,
} from '@/state/selectors.ts'
