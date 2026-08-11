import { describe, expect, test } from 'bun:test'
import { detectCapabilities } from '@/beeper/capabilities.ts'
import { mapInfo } from '@/beeper/types.ts'
import { infoFixture } from '@/beeper/fixtures.ts'

describe('detectCapabilities', () => {
  test('reports live updates when a ws endpoint is advertised', () => {
    const caps = detectCapabilities(mapInfo(infoFixture))
    expect(caps.liveUpdates).toBe(true)
    expect(caps.remoteAccess).toBe(false)
  })

  test('reports no live updates when the ws endpoint is empty', () => {
    const info = { ...mapInfo(infoFixture), wsEventsUrl: '' }
    expect(detectCapabilities(info).liveUpdates).toBe(false)
  })
})
