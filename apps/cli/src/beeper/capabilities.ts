import type { ServerInfo } from '@/beeper/types.ts'

/**
 * Endpoint-level capabilities detected from `/v1/info`. Anything version- or
 * network-dependent is gated on what the API actually reports, with an explicit
 * fallback, rather than assumed (CLAUDE.md: capability detection over
 * assumption). Per-chat/per-network capabilities (edits, reactions, receipts)
 * are reported separately by later slices from the chat payload.
 */
export interface Capabilities {
  /** The server advertises a WebSocket events endpoint (live updates). */
  liveUpdates: boolean
  /** Remote access is enabled on this instance (remote endpoints). */
  remoteAccess: boolean
}

export function detectCapabilities(info: ServerInfo): Capabilities {
  return {
    liveUpdates: info.wsEventsUrl.trim().length > 0,
    remoteAccess: info.remoteAccessEnabled,
  }
}
