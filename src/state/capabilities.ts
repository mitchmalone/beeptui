import type { ChatSummary } from '@/beeper/types.ts'

/**
 * One place for "this network can't do that, and here's why" — so every
 * capability-gated action degrades with the *same* honest, source-naming
 * message instead of ad-hoc strings scattered through the UI (PRD
 * acceptance scenario 6). Pure: no I/O, driven only by the adapter's per-chat
 * capability flags on `ChatSummary`.
 */

/** Per-chat actions whose availability Beeper reports as a capability. */
export type ChatCapability = 'reply' | 'archive'

/** Human label for each capability, as it reads in the notice. */
const CAPABILITY_LABEL: Record<ChatCapability, string> = {
  reply: 'Replies',
  archive: 'Archiving',
}

/** The `ChatSummary` flag that carries each capability's support state. */
const CAPABILITY_FIELD: Record<ChatCapability, 'canReply' | 'canArchive'> = {
  reply: 'canReply',
  archive: 'canArchive',
}

/**
 * The single unavailable-capability message. Names the capability *and* its
 * source ("via Beeper") so the user knows it's a network/provider limit, not a
 * bug in this client (PRD scenario 6). Verb-agnostic phrasing keeps one template
 * working for every capability regardless of grammatical number.
 */
export function capabilityUnavailableMessage(capability: ChatCapability, network: string): string {
  return `${CAPABILITY_LABEL[capability]} not available for ${network} via Beeper.`
}

export type CapabilityCheck = { allowed: true } | { allowed: false; notice: string }

/**
 * Whether a chat supports an action. An explicit `false` from the adapter blocks
 * it with the shared notice; `true` or an *absent* flag allows it
 * (attempt-then-degrade) — matching how archive and reply already behave, so an
 * unreported capability never becomes a dead control on a guess.
 */
export function checkCapability(chat: ChatSummary, capability: ChatCapability): CapabilityCheck {
  if (chat[CAPABILITY_FIELD[capability]] === false) {
    return { allowed: false, notice: capabilityUnavailableMessage(capability, chat.network) }
  }
  return { allowed: true }
}
