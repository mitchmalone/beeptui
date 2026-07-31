import type BeeperDesktop from '@beeper/desktop-api'

/**
 * Domain models the rest of the app consumes. These are intentionally leaner
 * than the SDK's response types and live here so nothing outside `src/beeper/`
 * imports the SDK (CLAUDE.md invariant 3). The `map*` functions are the single
 * boundary where SDK shapes become domain shapes.
 */

export interface ServerInfo {
  appName: string
  appVersion: string
  os: string
  arch: string
  baseUrl: string
  port: number
  remoteAccessEnabled: boolean
  wsEventsUrl: string
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
  /** Attachment placeholders (open/download is Slice 11). */
  attachments?: AttachmentSummary[]
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

export function mapMessage(message: BeeperDesktop.Message): MessageSummary {
  const attachments = mapAttachments(message.attachments)
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
  }
}

export function mapSendResult(result: BeeperDesktop.MessageSendResponse): SendResult {
  return {
    chatId: result.chatID,
    pendingMessageId: result.pendingMessageID,
  }
}
