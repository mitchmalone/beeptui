import type BeeperDesktop from '@beeper/desktop-api'
import { validateOAuthEndpoints } from '@/beeper/oauth.ts'

/**
 * Domain models the rest of the app consumes. These are intentionally leaner
 * than the SDK's response types and live here so nothing outside `src/beeper/`
 * imports the SDK (CLAUDE.md invariant 3). The `map*` functions are the single
 * boundary where SDK shapes become domain shapes.
 */

/**
 * OAuth 2.0 endpoints the server advertises via `/v1/info` (RFC 8414-style
 * discovery + RFC 7591 dynamic client registration). The groundwork for the
 * remote-endpoint auth flow: PKCE authorize → token, with dynamic
 * registration. Surfaced now (read-only) so the flow can be built against the
 * server's own advertised endpoints rather than hard-coded URLs.
 */
export interface OAuthEndpoints {
  authorizationEndpoint: string
  tokenEndpoint: string
  registrationEndpoint: string
  introspectionEndpoint: string
  revocationEndpoint: string
  userinfoEndpoint: string
}

export interface ServerInfo {
  appName: string
  appVersion: string
  os: string
  arch: string
  baseUrl: string
  port: number
  remoteAccessEnabled: boolean
  wsEventsUrl: string
  /** OAuth endpoints advertised by the server (remote-auth discovery). */
  oauth: OAuthEndpoints
}

export interface Account {
  id: string
  network: string
  bridgeType: string
  provider: 'cloud' | 'self-hosted' | 'local' | 'platform-sdk'
  displayName: string
}

export interface ChatSummary {
  id: string
  accountId: string
  network: string
  title: string
  type: 'single' | 'group'
  unreadCount: number
  isArchived: boolean
  isMuted: boolean
  /** Whether the platform supports archive/unarchive for this chat. Absent when
   *  the API didn't report the capability (treated as "attempt, then degrade"). */
  canArchive?: boolean
  /** Whether the platform supports replying to a message (capability `reply` >= 1:
   *  partially/fully supported). Absent when the API didn't report it. */
  canReply?: boolean
  /** Whether the platform supports adding reactions (capability `reaction` >= 1).
   *  Absent when the API didn't report it (treated as "attempt, then degrade"). */
  canReact?: boolean
  lastActivity?: string
}

export type AttachmentKind = 'image' | 'video' | 'audio' | 'file'

export interface AttachmentSummary {
  kind: AttachmentKind
  fileName?: string
  /** Attachment identifier (typically an `mxc://` URL) — pass to the download
   *  endpoint to fetch a local file path. Absent when the API didn't report it. */
  id?: string
  /** File size in bytes, when known. */
  fileSize?: number
  /** MIME type, when known (e.g. `image/png`). */
  mimeType?: string
}

/** A reaction on a message, aggregated by key across participants (read-only
 *  display). `count` is how many participants reacted with this key. */
export interface ReactionSummary {
  key: string
  count: number
  isEmoji: boolean
}

export interface MessageSummary {
  id: string
  chatId: string
  accountId: string
  senderId: string
  senderName?: string
  timestamp: string
  sortKey: string
  text?: string
  isSender: boolean
  isUnread: boolean
  /** Present and true when the message was edited after sending. */
  isEdited?: boolean
  /** Id of the message this replies to, if any. */
  replyToId?: string
  /** Attachments on the message (openable/savable via the download endpoint). */
  attachments?: AttachmentSummary[]
  /** Reactions aggregated by key (read-only display). */
  reactions?: ReactionSummary[]
  /** True when a read receipt reports this message as seen (read-only).
   *  Only meaningful on our own sent messages. */
  isSeen?: boolean
}

export interface SendResult {
  chatId: string
  pendingMessageId: string
}

export function mapInfo(info: BeeperDesktop.Info.InfoRetrieveResponse): ServerInfo {
  return {
    appName: info.app.name,
    appVersion: info.app.version,
    os: info.platform.os,
    arch: info.platform.arch,
    baseUrl: info.server.base_url,
    port: info.server.port,
    remoteAccessEnabled: info.server.remote_access,
    wsEventsUrl: info.endpoints.ws_events,
    // Discovery is where the server names the URLs we will send credentials to —
    // validated here so no consumer can use an unvetted endpoint set.
    oauth: validateOAuthEndpoints({
      authorizationEndpoint: info.endpoints.oauth.authorization_endpoint,
      tokenEndpoint: info.endpoints.oauth.token_endpoint,
      registrationEndpoint: info.endpoints.oauth.registration_endpoint,
      introspectionEndpoint: info.endpoints.oauth.introspection_endpoint,
      revocationEndpoint: info.endpoints.oauth.revocation_endpoint,
      userinfoEndpoint: info.endpoints.oauth.userinfo_endpoint,
    }),
  }
}

export function mapAccount(account: BeeperDesktop.Account): Account {
  return {
    id: account.accountID,
    network: account.network ?? account.bridge.type,
    bridgeType: account.bridge.type,
    provider: account.bridge.provider,
    displayName: account.user.fullName ?? account.user.username ?? account.accountID,
  }
}

export function mapChat(chat: BeeperDesktop.Chat): ChatSummary {
  return {
    id: chat.id,
    accountId: chat.accountID,
    network: chat.network,
    title: chat.title,
    type: chat.type,
    unreadCount: chat.unreadCount,
    isArchived: chat.isArchived ?? false,
    isMuted: chat.isMuted ?? false,
    // `exactOptionalPropertyTypes` — omit the key entirely rather than set undefined.
    ...(chat.capabilities?.archive !== undefined ? { canArchive: chat.capabilities.archive } : {}),
    // reply capability is a -2..2 scale (-2 rejected … 2 fully supported); treat
    // >= 1 (partially/fully) as supported. Omit when the platform didn't report it.
    ...(chat.capabilities?.reply !== undefined ? { canReply: chat.capabilities.reply >= 1 } : {}),
    // reaction capability shares the -2..2 scale; >= 1 means we can add reactions.
    ...(chat.capabilities?.reaction !== undefined
      ? { canReact: chat.capabilities.reaction >= 1 }
      : {}),
    ...(chat.lastActivity !== undefined ? { lastActivity: chat.lastActivity } : {}),
  }
}

const ATTACHMENT_KIND: Record<string, AttachmentKind> = {
  img: 'image',
  video: 'video',
  audio: 'audio',
}

function mapAttachments(
  attachments: BeeperDesktop.Message['attachments']
): AttachmentSummary[] | undefined {
  if (attachments === undefined || attachments.length === 0) return undefined
  return attachments.map((a) => ({
    kind: ATTACHMENT_KIND[a.type] ?? 'file',
    ...(a.fileName !== undefined ? { fileName: a.fileName } : {}),
    ...(a.id !== undefined ? { id: a.id } : {}),
    ...(a.fileSize !== undefined ? { fileSize: a.fileSize } : {}),
    ...(a.mimeType !== undefined ? { mimeType: a.mimeType } : {}),
  }))
}

function mapReactions(
  reactions: BeeperDesktop.Message['reactions']
): ReactionSummary[] | undefined {
  if (reactions === undefined || reactions.length === 0) return undefined
  // Aggregate by key across participants → one entry per distinct reaction.
  const byKey = new Map<string, ReactionSummary>()
  for (const r of reactions) {
    const existing = byKey.get(r.reactionKey)
    if (existing) existing.count += 1
    else byKey.set(r.reactionKey, { key: r.reactionKey, count: 1, isEmoji: r.emoji ?? false })
  }
  return [...byKey.values()]
}

/** Collapse the `seen` read-receipt shape (boolean | timestamp string | per-user
 *  map) into a single "was this read" boolean. Any truthy signal counts. */
function mapSeen(seen: BeeperDesktop.Message['seen']): boolean {
  if (seen === undefined) return false
  if (typeof seen === 'boolean') return seen
  if (typeof seen === 'string') return seen.length > 0
  return Object.values(seen).some((v) => v === true || (typeof v === 'string' && v.length > 0))
}

export function mapMessage(message: BeeperDesktop.Message): MessageSummary {
  const attachments = mapAttachments(message.attachments)
  const reactions = mapReactions(message.reactions)
  return {
    id: message.id,
    chatId: message.chatID,
    accountId: message.accountID,
    senderId: message.senderID,
    timestamp: message.timestamp,
    sortKey: message.sortKey,
    isSender: message.isSender ?? false,
    isUnread: message.isUnread ?? false,
    ...(message.senderName !== undefined ? { senderName: message.senderName } : {}),
    ...(message.text !== undefined ? { text: message.text } : {}),
    ...(message.editedTimestamp !== undefined ? { isEdited: true } : {}),
    ...(message.linkedMessageID !== undefined ? { replyToId: message.linkedMessageID } : {}),
    ...(attachments !== undefined ? { attachments } : {}),
    ...(reactions !== undefined ? { reactions } : {}),
    ...(mapSeen(message.seen) ? { isSeen: true } : {}),
  }
}

export function mapSendResult(result: BeeperDesktop.MessageSendResponse): SendResult {
  return {
    chatId: result.chatID,
    pendingMessageId: result.pendingMessageID,
  }
}
