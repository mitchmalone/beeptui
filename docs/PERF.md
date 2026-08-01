# Performance

> How the app performs against the PRD's timing success criteria, and where the
> headroom is. Numbers are reproducible from `bun test src/state/perf.test.ts`
> (regression tripwires) — re-run and update the table if the reducer/selectors
> change materially.

## PRD budgets

- **Inbox usable within 3 s of launch** (after cache warm-up).
- **A new inbound message rendered within 2 s** of Beeper receiving it.

Both budgets are **end-to-end and I/O-dominated**: the wall-clock is almost
entirely Beeper Desktop responding + the network + the terminal drawing. The
code we own — the event reducer and the selectors — must therefore cost a _tiny_
fraction of each budget so it never becomes the bottleneck.

## Measured — state throughput (`src/state/perf.test.ts`)

Measured on macOS arm64, Bun 1.3.14 (median of repeated runs; representative):

| Operation                                        | Scale       | Time     | Share of budget |
| ------------------------------------------------ | ----------- | -------- | --------------- |
| Seed the store (`accounts` + `chats/loaded`)     | 5000 chats  | ~1.6 ms  | ~0.05 % of 3 s  |
| `selectInboxRows` (unmemoized, full filter+sort) | 5000 chats  | ~0.2 ms  | negligible      |
| Apply a live `message/received`                  | per event   | ~8 µs    | negligible      |
| Apply a burst of live messages                   | 2000 events | ~16 ms   | ~0.8 % of 2 s   |
| `selectActiveConversation` after the burst       | busy chat   | <0.01 ms | negligible      |

**Conclusion:** state application and selection are three-to-four orders of
magnitude inside the PRD budgets. The launch and message-render times are
governed by Beeper + I/O, not by our reducer or selectors — there is no
state-side performance work required for v1, and bounded-memory capping
(`MAX_MESSAGES_PER_CHAT`) keeps that true as histories grow (see
`src/state/scale.test.ts`).

The benchmark doubles as a **regression tripwire**: its assertions are ~10× the
measured values, so an accidental O(n²) or per-event allocation blow-up fails
the suite rather than silently eroding the budget.

## Not yet measured — render loop

Render-loop profiling (OpenTUI draw time per frame under a busy channel) needs
the **live native renderer** and a real terminal; it can't be measured from a
headless unit test. Mitigations already in place:

- Compose typing no longer re-renders the whole tree — panes are `memo`-ised on
  their exact state slices (STATUS, Slice 10).
- The conversation view renders only a computed, bottom-pinned **window** over
  the loaded messages, not the whole history.

A live render-profiling pass (e.g. instrument `createCliRenderer` frame timing
during a synthetic burst) remains optional polish —
`docs/plans/backlog/PLAN-v1-polish-backlog.md`.
