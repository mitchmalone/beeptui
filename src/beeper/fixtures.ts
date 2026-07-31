import type BeeperDesktop from '@beeper/desktop-api'

/**
 * Synthetic API fixtures — invented names, ids, and content only. Never derived
 * from a real Beeper account (AGENTS.md publishable-repo hygiene). Used by both
 * the mapper unit tests and the fixture-injected adapter tests.
 */

export const infoFixture: BeeperDesktop.Info.InfoRetrieveResponse = {
  app: { bundle_id: 'com.example.beeper', name: 'Beeper Desktop', version: '4.2.900' },
  endpoints: {
    mcp: 'http://127.0.0.1:23373/v0/mcp',
    oauth: {
      authorization_endpoint: 'http://127.0.0.1:23373/oauth/authorize',
      introspection_endpoint: 'http://127.0.0.1:23373/oauth/introspect',
      registration_endpoint: 'http://127.0.0.1:23373/oauth/register',
      revocation_endpoint: 'http://127.0.0.1:23373/oauth/revoke',
      token_endpoint: 'http://127.0.0.1:23373/oauth/token',
      userinfo_endpoint: 'http://127.0.0.1:23373/oauth/userinfo',
    },
    spec: 'http://127.0.0.1:23373/v1/openapi.json',
    ws_events: 'ws://127.0.0.1:23373/v1/ws',
  },
  platform: { arch: 'arm64', os: 'darwin', release: '27.0.0' },
  server: {
    base_url: 'http://127.0.0.1:23373',
    hostname: '127.0.0.1',
    mcp_enabled: true,
    port: 23373,
    remote_access: false,
    status: 'ok',
  },
}

export const accountsFixture: BeeperDesktop.Account[] = [
  {
    accountID: 'local-whatsapp',
    network: 'WhatsApp',
    bridge: { id: 'local-whatsapp', provider: 'local', type: 'whatsapp' },
    user: { id: 'wa-self', fullName: 'Ada Lovelace', isSelf: true },
  },
  {
    accountID: 'slackgo.ACME-ada',
    network: 'Slack',
    bridge: { id: 'slackgo', provider: 'cloud', type: 'slackgo' },
    user: { id: 'slack-self', username: 'ada', isSelf: true },
  },
]

export const chatsFixture: BeeperDesktop.Chat[] = [
  {
    id: '!wa-1:beeper.local',
    accountID: 'local-whatsapp',
    network: 'WhatsApp',
    participants: { hasMore: false, items: [], total: 2 },
    title: 'Grace Hopper',
    type: 'single',
    unreadCount: 2,
    isArchived: false,
    isMuted: false,
    lastActivity: '2026-07-30T02:00:00.000Z',
  },
  {
    id: '!slack-1:beeper.local',
    accountID: 'slackgo.ACME-ada',
    network: 'Slack',
    participants: { hasMore: false, items: [], total: 12 },
    title: '#engineering',
    type: 'group',
    unreadCount: 0,
    isArchived: false,
    isMuted: true,
    lastActivity: '2026-07-30T01:30:00.000Z',
  },
]

export const messagesFixture: BeeperDesktop.Message[] = [
  {
    id: 'msg-1',
    accountID: 'local-whatsapp',
    chatID: '!wa-1:beeper.local',
    senderID: 'wa-grace',
    senderName: 'Grace Hopper',
    sortKey: '0000000001',
    timestamp: '2026-07-30T01:59:00.000Z',
    text: 'Ship it.',
    isSender: false,
    isUnread: true,
    type: 'TEXT',
    editedTimestamp: '2026-07-30T01:59:30.000Z',
    linkedMessageID: 'msg-0',
    attachments: [{ type: 'img', fileName: 'diagram.png' }],
  },
  {
    id: 'msg-2',
    accountID: 'local-whatsapp',
    chatID: '!wa-1:beeper.local',
    senderID: 'wa-self',
    sortKey: '0000000002',
    timestamp: '2026-07-30T02:00:00.000Z',
    text: 'On it.',
    isSender: true,
    isUnread: false,
    type: 'TEXT',
  },
]

export const sendFixture: BeeperDesktop.MessageSendResponse = {
  chatID: '!wa-1:beeper.local',
  pendingMessageID: 'pending-abc123',
}

/** Search hits spanning two chats — used to exercise scope-honoring detection
 *  (a server that ignores a chat scope returns the out-of-scope hit too). */
export const searchFixture: BeeperDesktop.Message[] = [
  {
    id: 'search-wa-1',
    accountID: 'local-whatsapp',
    chatID: '!wa-1:beeper.local',
    senderID: 'wa-grace',
    senderName: 'Grace Hopper',
    sortKey: '0000000010',
    timestamp: '2026-07-30T03:00:00.000Z',
    text: 'Are we still on for Friday?',
    isSender: false,
    isUnread: false,
    type: 'TEXT',
  },
  {
    id: 'search-slack-1',
    accountID: 'slackgo.ACME-ada',
    chatID: '!slack-1:beeper.local',
    senderID: 'slack-bob',
    senderName: 'Bob',
    sortKey: '0000000011',
    timestamp: '2026-07-30T03:05:00.000Z',
    text: 'Friday deploy is green.',
    isSender: false,
    isUnread: false,
    type: 'TEXT',
  },
]
