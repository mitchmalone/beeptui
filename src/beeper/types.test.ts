import { describe, expect, test } from 'bun:test'
import { mapAccount, mapChat, mapInfo, mapMessage, mapSendResult } from '@/beeper/types.ts'
import {
  accountsFixture,
  chatsFixture,
  infoFixture,
  messagesFixture,
  sendFixture,
} from '@/beeper/fixtures.ts'

describe('mapInfo', () => {
  test('flattens the SDK info envelope into ServerInfo', () => {
    const info = mapInfo(infoFixture)
    expect(info).toEqual({
      appName: 'Beeper Desktop',
      appVersion: '4.2.900',
      os: 'darwin',
      arch: 'arm64',
      baseUrl: 'http://127.0.0.1:23373',
      port: 23373,
      remoteAccessEnabled: false,
      wsEventsUrl: 'ws://127.0.0.1:23373/v1/ws',
    })
  })
})

describe('mapAccount', () => {
  test('derives network + display name, falling back sensibly', () => {
    const [wa, slack] = accountsFixture.map(mapAccount)
    expect(wa).toEqual({
      id: 'local-whatsapp',
      network: 'WhatsApp',
      bridgeType: 'whatsapp',
      provider: 'local',
      displayName: 'Ada Lovelace',
    })
    // Slack account has no fullName → falls back to username.
    expect(slack?.displayName).toBe('ada')
  })
})

describe('mapChat', () => {
  test('projects the summary fields the inbox needs', () => {
    const [wa, slack] = chatsFixture.map(mapChat)
    expect(wa).toEqual({
      id: '!wa-1:beeper.local',
      accountId: 'local-whatsapp',
      network: 'WhatsApp',
      title: 'Grace Hopper',
      type: 'single',
      unreadCount: 2,
      isArchived: false,
      isMuted: false,
      lastActivity: '2026-07-30T02:00:00.000Z',
    })
    expect(slack?.isMuted).toBe(true)
  })
})

describe('mapMessage', () => {
  test('projects message summary; optional fields omitted when absent', () => {
    const [incoming, outgoing] = messagesFixture.map(mapMessage)
    expect(incoming).toEqual({
      id: 'msg-1',
      chatId: '!wa-1:beeper.local',
      accountId: 'local-whatsapp',
      senderId: 'wa-grace',
      senderName: 'Grace Hopper',
      timestamp: '2026-07-30T01:59:00.000Z',
      sortKey: '0000000001',
      text: 'Ship it.',
      isSender: false,
      isUnread: true,
    })
    expect(outgoing?.isSender).toBe(true)
    // msg-2 has no senderName → key omitted entirely, not set to undefined.
    expect(outgoing && 'senderName' in outgoing).toBe(false)
  })
})

describe('mapSendResult', () => {
  test('exposes the pending message id', () => {
    expect(mapSendResult(sendFixture)).toEqual({
      chatId: '!wa-1:beeper.local',
      pendingMessageId: 'pending-abc123',
    })
  })
})
