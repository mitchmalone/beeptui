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
  lastActivity?: string
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
    ...(chat.lastActivity !== undefined ? { lastActivity: chat.lastActivity } : {}),
  }
}

export function mapMessage(message: BeeperDesktop.Message): MessageSummary {
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
  }
}

export function mapSendResult(result: BeeperDesktop.MessageSendResponse): SendResult {
  return {
    chatId: result.chatID,
    pendingMessageId: result.pendingMessageID,
  }
}
