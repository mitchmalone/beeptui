import { describe, expect, test } from 'bun:test'
import {
  capabilityUnavailableMessage,
  checkCapability,
  type ChatCapability,
} from '@/state/capabilities.ts'
import type { ChatSummary } from '@/beeper/types.ts'

function chat(over: Partial<ChatSummary> = {}): ChatSummary {
  return {
    id: 'c1',
    accountId: 'acc',
    network: 'Signal',
    title: 'c1',
    type: 'single',
    unreadCount: 0,
    isArchived: false,
    isMuted: false,
    ...over,
  }
}

describe('capability messaging (Slice 12)', () => {
  test('the unavailable message names the capability and its source', () => {
    expect(capabilityUnavailableMessage('reply', 'Signal')).toBe(
      'Replies not available for Signal via Beeper.'
    )
    expect(capabilityUnavailableMessage('archive', 'X')).toBe(
      'Archiving not available for X via Beeper.'
    )
  })

  test('an explicit false blocks the action with the shared notice', () => {
    const result = checkCapability(chat({ canReply: false }), 'reply')
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.notice).toBe('Replies not available for Signal via Beeper.')
  })

  test('true or an absent flag allows the action (attempt-then-degrade)', () => {
    expect(checkCapability(chat({ canReply: true }), 'reply')).toEqual({ allowed: true })
    expect(checkCapability(chat({}), 'reply')).toEqual({ allowed: true }) // unreported → allowed
    expect(checkCapability(chat({}), 'archive')).toEqual({ allowed: true }) // absent flag → allowed
  })

  test('every capability maps to a field and a label (no partial coverage)', () => {
    const caps: ChatCapability[] = ['reply', 'archive']
    for (const cap of caps) {
      // A blocked check must produce a non-empty, source-naming notice.
      const blocked = checkCapability(
        chat(cap === 'reply' ? { canReply: false } : { canArchive: false }),
        cap
      )
      expect(blocked.allowed).toBe(false)
      if (!blocked.allowed) expect(blocked.notice).toContain('via Beeper')
    }
  })
})
