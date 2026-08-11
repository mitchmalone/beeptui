import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import type { Account, ChatSummary, MessageSummary, ServerInfo } from '@/beeper/types.ts'
import type { Gateway } from '@/tui/runtime.ts'
import type { MessageHistoryPage, MessageSearchPage } from '@/beeper/client.ts'

/**
 * A synthetic `Gateway` for `beeptui --demo`: the real TUI, fake data, no
 * network or auth. Everything here is invented — no real names, chats, or
 * content (invariant 9). Writes resolve as no-ops so the optimistic UI behaves.
 */

const NETWORKS: Account[] = [
  {
    id: 'acc-wa',
    network: 'WhatsApp',
    bridgeType: 'whatsapp',
    provider: 'local',
    displayName: 'You',
  },
  { id: 'acc-sl', network: 'Slack', bridgeType: 'slackgo', provider: 'cloud', displayName: 'You' },
  {
    id: 'acc-tg',
    network: 'Telegram',
    bridgeType: 'telegram',
    provider: 'cloud',
    displayName: 'You',
  },
  { id: 'acc-sg', network: 'Signal', bridgeType: 'signal', provider: 'local', displayName: 'You' },
]

/** Descending activity times so the inbox order is stable and sensible. */
const T = (h: number, m: number): string =>
  `2026-07-31T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`

/** Monotonic sort key for demo messages (assigned in declaration order). */
let sortSeq = 0

const CHATS: ChatSummary[] = [
  chat('c-ada', 'acc-wa', 'WhatsApp', 'Ada Lovelace', 'single', {
    unreadCount: 2,
    lastActivity: T(14, 42),
    canReact: true,
    canReply: true,
  }),
  chat('c-trail', 'acc-wa', 'WhatsApp', 'trail crew 🏔', 'group', {
    unreadCount: 4,
    lastActivity: T(14, 30),
    canReact: true,
    canReply: true,
  }),
  chat('c-design', 'acc-sl', 'Slack', 'design-team', 'group', {
    unreadCount: 5,
    lastActivity: T(14, 20),
    canReact: true,
    canReply: true,
  }),
  chat('c-standup', 'acc-sl', 'Slack', 'standup-bot', 'group', {
    unreadCount: 1,
    lastActivity: T(13, 5),
    canReact: true,
    canReply: true,
  }),
  chat('c-weekend', 'acc-tg', 'Telegram', 'weekend-plans', 'group', {
    unreadCount: 3,
    lastActivity: T(12, 30),
    canReact: true,
    canReply: true,
  }),
  chat('c-grace', 'acc-wa', 'WhatsApp', 'Grace Hopper', 'single', {
    unreadCount: 0,
    isMuted: true,
    lastActivity: T(11, 15),
    canReact: true,
    canReply: true,
  }),
  chat('c-kat', 'acc-sg', 'Signal', 'Katherine Johnson', 'single', {
    unreadCount: 0,
    lastActivity: T(9, 50),
    canReact: true,
    canReply: true,
  }),
  chat('c-alan', 'acc-tg', 'Telegram', 'Alan Turing', 'single', {
    unreadCount: 0,
    lastActivity: T(8, 30),
    canReact: true,
    canReply: true,
  }),
  chat('c-family', 'acc-wa', 'WhatsApp', 'family group', 'group', {
    unreadCount: 0,
    isArchived: true,
    lastActivity: T(7, 0),
    canReact: true,
    canReply: true,
  }),
]

const MESSAGES: Record<string, MessageSummary[]> = {
  'c-ada': [
    them(
      'c-ada',
      'acc-wa',
      'Ada Lovelace',
      1,
      'Did you get a chance to look at the analytical engine notes?',
      T(14, 10)
    ),
    me(
      'c-ada',
      'acc-wa',
      2,
      'Reading them now — the note on Bernoulli numbers is wild',
      T(14, 12),
      { isSeen: true }
    ),
    them(
      'c-ada',
      'acc-wa',
      'Ada Lovelace',
      3,
      "It's the first algorithm, if I do say so myself 😄",
      T(14, 40),
      {
        reactions: [{ key: '❤️', count: 2, isEmoji: true }],
      }
    ),
    them('c-ada', 'acc-wa', 'Ada Lovelace', 4, '', T(14, 41), {
      kind: 'IMAGE',
      attachments: [
        {
          kind: 'image',
          id: 'demo-img-diagram',
          fileName: 'engine-diagram.png',
          fileSize: 4096,
          mimeType: 'image/png',
        },
      ],
    }),
    them('c-ada', 'acc-wa', 'Ada Lovelace', 5, 'Coffee tomorrow to talk it through?', T(14, 42)),
  ],
  'c-trail': [
    them(
      'c-trail',
      'acc-wa',
      'Mary Anning',
      20,
      'Saturday recap — the ridge was unreal',
      T(14, 20)
    ),
    them('c-trail', 'acc-wa', 'Mary Anning', 21, '', T(14, 21), {
      kind: 'IMAGE',
      attachments: [
        {
          kind: 'image',
          id: 'demo-img-ridge',
          fileName: 'ridge.png',
          fileSize: 4096,
          mimeType: 'image/png',
        },
      ],
    }),
    them('c-trail', 'acc-wa', 'Edmund Hillary', 22, '', T(14, 22), {
      kind: 'IMAGE',
      attachments: [
        {
          kind: 'image',
          id: 'demo-img-tarn',
          fileName: 'tarn.png',
          fileSize: 4096,
          mimeType: 'image/png',
        },
      ],
    }),
    them('c-trail', 'acc-wa', 'Edmund Hillary', 23, '', T(14, 24), {
      kind: 'IMAGE',
      attachments: [
        {
          kind: 'image',
          id: 'demo-img-scree',
          fileName: 'scree.png',
          fileSize: 4096,
          mimeType: 'image/png',
        },
      ],
    }),
    me('c-trail', 'acc-wa', 24, 'Absolute keeper, that second one', T(14, 28), { isSeen: true }),
    them('c-trail', 'acc-wa', 'Mary Anning', 25, '', T(14, 30), {
      kind: 'IMAGE',
      attachments: [
        {
          kind: 'image',
          id: 'demo-img-summit',
          fileName: 'summit.png',
          fileSize: 4096,
          mimeType: 'image/png',
        },
      ],
    }),
  ],
  'c-design': [
    them('c-design', 'acc-sl', 'priya', 1, 'new mocks are in figma 🎨', T(14, 5)),
    them('c-design', 'acc-sl', 'jordan', 2, 'the empty state looks so much better', T(14, 15), {
      reactions: [
        { key: '👍', count: 3, isEmoji: true },
        { key: '🎉', count: 1, isEmoji: true },
      ],
    }),
    them('c-design', 'acc-sl', 'priya', 3, 'ship it?', T(14, 20)),
  ],
  'c-standup': [
    them('c-standup', 'acc-sl', 'standup-bot', 1, 'Good morning! Time for standup ☀️', T(13, 0)),
    them(
      'c-standup',
      'acc-sl',
      'standup-bot',
      2,
      "<strong>Yesterday's summary:</strong><br><ul><li>Shipped the <b>new inbox rail</b></li><li>Fixed message wrapping</li></ul><br><strong>Today:</strong><br><ol><li>Theme detection</li><li>Demo mode</li></ol>",
      T(13, 5)
    ),
  ],
  'c-weekend': [
    them('c-weekend', 'acc-tg', 'sam', 1, 'hike saturday? weather looks perfect', T(12, 20)),
    them('c-weekend', 'acc-tg', 'riley', 2, "I'm in! trailhead at 8?", T(12, 25)),
    them('c-weekend', 'acc-tg', 'sam', 3, '8 works. bring the good binoculars 🦅', T(12, 30)),
  ],
  'c-grace': [
    them(
      'c-grace',
      'acc-wa',
      'Grace Hopper',
      1,
      'It is easier to ask forgiveness than permission 😉',
      T(11, 10)
    ),
    me('c-grace', 'acc-wa', 2, 'Words to debug by', T(11, 15), { isSeen: true }),
  ],
  'c-kat': [
    me('c-kat', 'acc-sg', 1, 'Numbers checked and re-checked — we are go for launch 🚀', T(9, 50), {
      isSeen: true,
    }),
  ],
  'c-alan': [
    them('c-alan', 'acc-tg', 'Alan Turing', 1, 'Can machines think? Anyway, lunch?', T(8, 30)),
  ],
  'c-family': [
    them(
      'c-family',
      'acc-wa',
      'mum',
      1,
      'Sunday roast at 1pm, bring nothing but yourselves ❤️',
      T(7, 0)
    ),
  ],
}

function chat(
  id: string,
  accountId: string,
  network: string,
  title: string,
  type: 'single' | 'group',
  over: Partial<ChatSummary> = {}
): ChatSummary {
  return {
    id,
    accountId,
    network,
    title,
    type,
    unreadCount: 0,
    isArchived: false,
    isMuted: false,
    ...over,
  }
}

function baseMsg(
  chatId: string,
  accountId: string,
  n: number,
  text: string,
  timestamp: string
): MessageSummary {
  return {
    id: `${chatId}-m${n}`,
    chatId,
    accountId,
    senderId: 'demo',
    timestamp,
    sortKey: String(++sortSeq).padStart(6, '0'),
    text,
    isSender: false,
    isUnread: false,
  }
}
/** A generated test-card PNG: gradient + diagonal stripes + white border,
 *  varied per attachment id so a photo-heavy chat shows distinct thumbnails.
 *  Entirely synthetic (invariant 9). */
function demoPng(id: string): Uint8Array {
  let seed = 0
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) % 997
  const width = 320
  const height = 200
  const stripeW = 24 + (seed % 5) * 8
  const channelShift = seed % 3 // rotates which channels carry the gradients
  const png = new PNG({ width, height })
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const border = x < 4 || y < 4 || x >= width - 4 || y >= height - 4
      const stripe = (x + y) % stripeW < stripeW / 2
      const g = [Math.round((x / width) * 255), stripe ? 190 : 70, Math.round((y / height) * 255)]
      png.data[i] = border ? 255 : (g[channelShift] ?? 0)
      png.data[i + 1] = border ? 255 : (g[(channelShift + 1) % 3] ?? 0)
      png.data[i + 2] = border ? 255 : (g[(channelShift + 2) % 3] ?? 0)
      png.data[i + 3] = 255
    }
  }
  return new Uint8Array(PNG.sync.write(png))
}

function them(
  chatId: string,
  accountId: string,
  senderName: string,
  n: number,
  text: string,
  timestamp: string,
  over: Partial<MessageSummary> = {}
): MessageSummary {
  return { ...baseMsg(chatId, accountId, n, text, timestamp), senderName, ...over }
}
function me(
  chatId: string,
  accountId: string,
  n: number,
  text: string,
  timestamp: string,
  over: Partial<MessageSummary> = {}
): MessageSummary {
  return {
    ...baseMsg(chatId, accountId, n, text, timestamp),
    senderName: 'You',
    isSender: true,
    ...over,
  }
}

const SERVER: ServerInfo = {
  appName: 'Beeper Demo',
  appVersion: '0.0.0-demo',
  os: 'demo',
  arch: 'demo',
  baseUrl: 'http://demo.invalid',
  port: 0,
  remoteAccessEnabled: false,
  wsEventsUrl: 'ws://demo.invalid/events',
  oauth: {
    authorizationEndpoint: 'https://demo.invalid/authorize',
    tokenEndpoint: 'https://demo.invalid/token',
    registrationEndpoint: 'https://demo.invalid/register',
    introspectionEndpoint: 'https://demo.invalid/introspect',
    revocationEndpoint: 'https://demo.invalid/revoke',
    userinfoEndpoint: 'https://demo.invalid/userinfo',
  },
}

/** The chat the demo opens on first paint (a rich, unread conversation). */
export const DEMO_FIRST_CHAT_ID = 'c-ada'
export const DEMO_PHOTO_CHAT_ID = 'c-trail'

/** A chat's fixture messages, fresh — scenario cycles dispatch these as an
 *  `initial` load to reset the conversation at the top of each loop. */
export function demoInitialMessages(chatId: string): MessageSummary[] {
  return (MESSAGES[chatId] ?? []).map((m) => ({ ...m }))
}

/**
 * The scripted beats the demo scenarios replay (`demo-scenarios.ts`). Built
 * once, with fixed timestamps and stable ids, so every loop and every
 * re-recorded tape is identical. The reaction bump reuses the original
 * message (same id + sortKey) so the upsert changes reactions, not order.
 */
export const DEMO_BEATS = {
  adaLive1: them(
    'c-ada',
    'acc-wa',
    'Ada Lovelace',
    90,
    'Also — found the coffee place. Jessamine St, 10am?',
    T(14, 45),
    { isUnread: true }
  ),
  adaLive2: them('c-ada', 'acc-wa', 'Ada Lovelace', 91, 'They do a mean cortado ☕', T(14, 46), {
    isUnread: true,
  }),
  adaReply: them(
    'c-ada',
    'acc-wa',
    'Ada Lovelace',
    92,
    'Wild is underselling it — she predicted software',
    T(14, 47),
    { replyToId: 'c-ada-m2', isUnread: true }
  ),
  adaReactionBump: {
    ...(MESSAGES['c-ada']?.[2] as MessageSummary),
    reactions: [
      { key: '❤️', count: 3, isEmoji: true },
      { key: '🚀', count: 1, isEmoji: true },
    ],
  },
  trailImage: them('c-trail', 'acc-wa', 'Mary Anning', 93, '', T(14, 48), {
    kind: 'IMAGE',
    isUnread: true,
    attachments: [
      {
        kind: 'image',
        id: 'demo-img-cairn',
        fileName: 'cairn.png',
        fileSize: 4096,
        mimeType: 'image/png',
      },
    ],
  }),
}

/** Build a fresh synthetic gateway. No shared mutable state between calls. */
export function createDemoGateway(): Gateway {
  return {
    getInfo: async () => SERVER,
    listAccounts: async () => NETWORKS,
    listChats: async () => CHATS,
    listMessages: async (chatId): Promise<MessageHistoryPage> => ({
      messages: MESSAGES[chatId] ?? [],
      hasMore: false,
      cursor: null,
    }),
    getChat: async (chatId) => CHATS.find((c) => c.id === chatId) ?? CHATS[0]!,
    sendMessage: async (chatId) => ({ chatId, pendingMessageId: `demo-pending-${chatId}` }),
    searchMessages: async (query): Promise<MessageSearchPage> => {
      const q = query.toLowerCase()
      const messages = Object.values(MESSAGES)
        .flat()
        .filter((m) => (m.text ?? '').toLowerCase().includes(q))
      return { messages, scopeHonored: true, capped: false }
    },
    setArchived: async () => {},
    addReaction: async () => {},
    downloadAttachment: async (id) => {
      // Serve a synthetic PNG so `--demo` exercises the real inline-image
      // pipeline (download → decode → scale → paint) with invented pixels.
      const localPath = join(tmpdir(), `beeptui-demo-${id}.png`)
      await Bun.write(localPath, demoPng(id))
      return { localPath }
    },
  }
}
