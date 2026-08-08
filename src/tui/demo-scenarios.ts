import type { AppEvent } from '@/state/types.ts'
import {
  DEMO_BEATS,
  DEMO_FIRST_CHAT_ID,
  DEMO_PHOTO_CHAT_ID,
  demoInitialMessages,
} from '@/tui/demo.ts'

/**
 * Looping `--demo` scenarios: each is a timed cycle of ordinary `AppEvent`s
 * replayed through the reducer, exactly the way real watch events arrive
 * (invariant 4). A cycle opens by resetting the affected chats to their
 * fixtures (`messages/loaded`, page `initial`), then plays its beats; at the
 * period it starts again — so a screen recording of any one cycle loops
 * cleanly, and a live showcase runs forever.
 *
 * Everything is fixture data with fixed timestamps and stable ids
 * (`DEMO_BEATS`): re-records are deterministic, and replaying the same id
 * upserts rather than duplicates.
 */

export interface DemoStep {
  /** Milliseconds after cycle start. */
  at: number
  event: AppEvent
}

export interface DemoScenario {
  name: 'full' | 'live' | 'replies' | 'images'
  /** One line for `--help` and the unknown-scenario error. */
  summary: string
  /** Chat to open on launch, so a feature demo starts on the right screen. */
  openChatId: string
  cycle: DemoStep[]
  periodMs: number
}

function reset(chatId: string, at: number): DemoStep {
  return {
    at,
    event: {
      type: 'messages/loaded',
      chatId,
      page: 'initial',
      messages: demoInitialMessages(chatId),
      hasMoreOlder: false,
    },
  }
}

function beat(at: number, message: (typeof DEMO_BEATS)[keyof typeof DEMO_BEATS]): DemoStep {
  return { at, event: { type: 'message/received', message: { ...message } } }
}

export const DEMO_SCENARIOS: Record<DemoScenario['name'], DemoScenario> = {
  full: {
    name: 'full',
    summary: 'everything — arrivals, a reply, reactions, an image (the primary demo)',
    openChatId: DEMO_FIRST_CHAT_ID,
    periodMs: 20_000,
    cycle: [
      reset(DEMO_FIRST_CHAT_ID, 0),
      reset(DEMO_PHOTO_CHAT_ID, 1),
      beat(3_000, DEMO_BEATS.adaLive1),
      beat(7_000, DEMO_BEATS.adaReply),
      beat(11_000, DEMO_BEATS.adaReactionBump),
      beat(15_000, DEMO_BEATS.trailImage),
    ],
  },
  live: {
    name: 'live',
    summary: 'messages arriving while you read',
    openChatId: DEMO_FIRST_CHAT_ID,
    periodMs: 12_000,
    cycle: [
      reset(DEMO_FIRST_CHAT_ID, 0),
      beat(3_000, DEMO_BEATS.adaLive1),
      beat(6_500, DEMO_BEATS.adaLive2),
    ],
  },
  replies: {
    name: 'replies',
    summary: 'a threaded reply landing, then reactions changing',
    openChatId: DEMO_FIRST_CHAT_ID,
    periodMs: 12_000,
    cycle: [
      reset(DEMO_FIRST_CHAT_ID, 0),
      beat(2_500, DEMO_BEATS.adaReply),
      beat(6_000, DEMO_BEATS.adaReactionBump),
    ],
  },
  images: {
    name: 'images',
    summary: 'a photo-heavy chat; a new image arrives and renders inline',
    openChatId: DEMO_PHOTO_CHAT_ID,
    periodMs: 10_000,
    cycle: [reset(DEMO_PHOTO_CHAT_ID, 0), beat(2_500, DEMO_BEATS.trailImage)],
  },
}

/** Resolve a `--demo [scenario]` argument; unknown names throw the valid list
 *  so the CLI can exit honestly (invariant 8). */
export function demoScenario(name: string | undefined): DemoScenario {
  const scenario = DEMO_SCENARIOS[(name ?? 'full') as DemoScenario['name']]
  if (scenario === undefined) {
    const known = Object.values(DEMO_SCENARIOS)
      .map((s) => `  ${s.name.padEnd(8)} ${s.summary}`)
      .join('\n')
    throw new Error(`Unknown demo scenario '${name}'. Valid scenarios:\n${known}`)
  }
  return scenario
}

/** The timer surface the driver uses — injectable so tests run on a fake. */
export interface DemoClock {
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

const realClock: DemoClock = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as Parameters<typeof clearTimeout>[0]),
}

/** Play the scenario's cycle on the given clock, forever; returns stop. */
export function runDemoScenario(
  scenario: DemoScenario,
  dispatch: (event: AppEvent) => void,
  clock: DemoClock = realClock
): () => void {
  let stopped = false
  let handles: unknown[] = []

  const scheduleCycle = (): void => {
    if (stopped) return
    handles = scenario.cycle.map((step) => clock.setTimeout(() => dispatch(step.event), step.at))
    handles.push(clock.setTimeout(scheduleCycle, scenario.periodMs))
  }
  scheduleCycle()

  return () => {
    stopped = true
    for (const handle of handles) clock.clearTimeout(handle)
    handles = []
  }
}
