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
      oauth: {
        authorizationEndpoint: 'http://127.0.0.1:23373/oauth/authorize',
        tokenEndpoint: 'http://127.0.0.1:23373/oauth/token',
        registrationEndpoint: 'http://127.0.0.1:23373/oauth/register',
        introspectionEndpoint: 'http://127.0.0.1:23373/oauth/introspect',
        revocationEndpoint: 'http://127.0.0.1:23373/oauth/revoke',
        userinfoEndpoint: 'http://127.0.0.1:23373/oauth/userinfo',
      },
    })
  })

  test('rejects discovery that advertises a cleartext non-loopback OAuth endpoint', () => {
    const hostile = structuredClone(infoFixture)
    hostile.endpoints.oauth.token_endpoint = 'http://attacker.example/collect'
    expect(() => mapInfo(hostile)).toThrow(/https/i)
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

  test('surfaces the archive capability when reported, omits it when absent', () => {
    const [wa, slack] = chatsFixture.map(mapChat)
    expect(slack?.canArchive).toBe(false) // capabilities.archive: false
    expect(wa && 'canArchive' in wa).toBe(false) // no capabilities → key omitted
  })

  test('surfaces the reply capability (>= 1 supported) when reported, omits it when absent', () => {
    const [wa, slack] = chatsFixture.map(mapChat)
    expect(slack?.canReply).toBe(true) // capabilities.reply: 2 → supported
    expect(wa && 'canReply' in wa).toBe(false) // no capabilities → key omitted
  })

  test('maps a non-supporting reply capability (< 1) to canReply false', () => {
    const [rejected, dropped] = [
      mapChat({ ...chatsFixture[1]!, capabilities: { reply: 0 } }),
      mapChat({ ...chatsFixture[1]!, capabilities: { reply: -2 } }),
    ]
    expect(rejected.canReply).toBe(false)
    expect(dropped.canReply).toBe(false)
  })

  test('surfaces the reaction capability (>= 1 supported), omits it when absent', () => {
    const supported = mapChat({ ...chatsFixture[1]!, capabilities: { reaction: 2 } })
    const rejected = mapChat({ ...chatsFixture[1]!, capabilities: { reaction: 0 } })
    const [wa] = chatsFixture.map(mapChat)
    expect(supported.canReact).toBe(true)
    expect(rejected.canReact).toBe(false)
    expect(wa && 'canReact' in wa).toBe(false) // no capabilities → key omitted
  })
})

describe('mapMessage', () => {
  test('projects message summary; optional fields omitted when absent', () => {
    const [incoming, outgoing] = messagesFixture.map(mapMessage)
    expect(incoming).toMatchObject({
      id: 'msg-1',
      chatId: '!wa-1:beeper.local',
      senderName: 'Grace Hopper',
      text: 'Ship it.',
      isSender: false,
    })
    expect(outgoing?.isSender).toBe(true)
    // msg-2 has no senderName → key omitted entirely, not set to undefined.
    expect(outgoing && 'senderName' in outgoing).toBe(false)
  })

  test('maps edit, reply, and attachment metadata; omits when absent', () => {
    const [withMeta, plain] = messagesFixture.map(mapMessage)
    expect(withMeta).toMatchObject({
      isEdited: true,
      replyToId: 'msg-0',
      attachments: [
        {
          kind: 'image',
          fileName: 'diagram.png',
          id: 'mxc://beeper.local/diagram',
          fileSize: 20480,
          mimeType: 'image/png',
        },
      ],
    })
    // Plain message carries none of the optional keys.
    expect(plain && 'isEdited' in plain).toBe(false)
    expect(plain && 'replyToId' in plain).toBe(false)
    expect(plain && 'attachments' in plain).toBe(false)
    expect(plain && 'reactions' in plain).toBe(false)
  })

  test('aggregates reactions by key with counts; omits when absent', () => {
    const [withMeta, plain] = messagesFixture.map(mapMessage)
    expect(withMeta?.reactions).toEqual([
      { key: '👍', count: 2, isEmoji: true },
      { key: '🎉', count: 1, isEmoji: true },
    ])
    expect(plain && 'reactions' in plain).toBe(false)
  })

  test('collapses the seen read-receipt shape (bool / string / per-user map) to isSeen', () => {
    const base = messagesFixture[1]! // plain outgoing message
    expect(mapMessage({ ...base, seen: true }).isSeen).toBe(true)
    expect(mapMessage({ ...base, seen: '2026-07-30T02:00:05Z' }).isSeen).toBe(true)
    expect(mapMessage({ ...base, seen: { u1: true, u2: false } }).isSeen).toBe(true)
    expect(mapMessage({ ...base, seen: false }).isSeen).toBeUndefined() // omitted when unseen
    expect('isSeen' in mapMessage(base)).toBe(false) // absent → omitted
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
