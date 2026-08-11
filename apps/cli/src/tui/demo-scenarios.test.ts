import { describe, expect, test } from 'bun:test'
import type { AppEvent } from '@/state/types.ts'
import {
  DEMO_SCENARIOS,
  demoScenario,
  runDemoScenario,
  type DemoClock,
} from '@/tui/demo-scenarios.ts'

/** A manual clock: timers fire when `advance` crosses their deadline. */
function fakeClock(): DemoClock & { advance(ms: number): void; pending(): number } {
  let now = 0
  let seq = 0
  const timers = new Map<number, { due: number; fn: () => void }>()
  return {
    setTimeout(fn: () => void, ms: number): number {
      seq += 1
      timers.set(seq, { due: now + ms, fn })
      return seq
    },
    clearTimeout(handle: unknown): void {
      timers.delete(handle as number)
    },
    advance(ms: number): void {
      const target = now + ms
      // Fire in due order, moving `now` with each firing so timers created by
      // a callback are scheduled relative to when it ran (like real timers).
      for (;;) {
        const next = [...timers.entries()]
          .filter(([, t]) => t.due <= target)
          .sort((a, b) => a[1].due - b[1].due)[0]
        if (next === undefined) break
        const [id, t] = next
        timers.delete(id)
        now = t.due
        t.fn()
      }
      now = target
    },
    pending(): number {
      return timers.size
    },
  }
}

describe('scenario data', () => {
  test('every scenario has a strictly increasing cycle inside its period', () => {
    for (const scenario of Object.values(DEMO_SCENARIOS)) {
      let last = -1
      for (const step of scenario.cycle) {
        expect(step.at).toBeGreaterThan(last)
        expect(step.at).toBeLessThan(scenario.periodMs)
        last = step.at
      }
      expect(scenario.cycle.length).toBeGreaterThan(0)
    }
  })

  test('scripted events carry fixture timestamps, never wall clock', () => {
    for (const scenario of Object.values(DEMO_SCENARIOS)) {
      for (const step of scenario.cycle) {
        if (step.event.type === 'message/received') {
          expect(step.event.message.timestamp).toMatch(/^2026-07-31T/)
        }
      }
    }
  })

  test('demoScenario resolves names and rejects unknowns with the valid list', () => {
    expect(demoScenario(undefined).name).toBe('full')
    expect(demoScenario('images').name).toBe('images')
    expect(() => demoScenario('nope')).toThrow(/full.*live.*replies.*images|images.*live/s)
  })
})

describe('runDemoScenario', () => {
  test('dispatches each step at its offset and loops the cycle', () => {
    const clock = fakeClock()
    const seen: string[] = []
    const dispatch = (event: AppEvent) => {
      seen.push(event.type === 'message/received' ? event.message.id : event.type)
    }
    const stop = runDemoScenario(demoScenario('live'), dispatch, clock)
    const scenario = demoScenario('live')
    const first = scenario.cycle.length
    clock.advance(scenario.periodMs - 1)
    expect(seen.length).toBe(first)
    clock.advance(scenario.periodMs) // through the second cycle
    expect(seen.length).toBe(first * 2)
    expect(seen.slice(0, first)).toEqual(seen.slice(first, first * 2))
    stop()
  })

  test('stop cancels everything outstanding', () => {
    const clock = fakeClock()
    let count = 0
    const stop = runDemoScenario(
      demoScenario('replies'),
      () => {
        count += 1
      },
      clock
    )
    stop()
    clock.advance(60_000)
    expect(count).toBe(0)
    expect(clock.pending()).toBe(0)
  })
})
