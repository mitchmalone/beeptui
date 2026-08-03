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

## Measured — render loop (`src/tui/profile.ts`)

Render-loop profiling needs the **live native renderer** and a TTY, so it's a
harness (`bun run src/tui/profile.ts`), not a unit test — but the maths is tested
(`src/tui/frame-profiler.ts`). It seeds a 3000-chat inbox, renders the real App,
replays a 300-message burst on the open conversation, and measures inter-frame
times via the renderer's frame callback.

Representative run (indicative — re-run in your own terminal for its numbers):

| Metric               | Value    |
| -------------------- | -------- |
| p50 inter-frame time | ~17.8 ms |
| p95                  | ~18.6 ms |
| p99                  | ~19.1 ms |
| max (single frame)   | ~475 ms  |
| mean FPS             | ~49      |

**Read:** steady state is ~18 ms/frame (~56 fps) — essentially the render
cadence, i.e. the loop keeps up with a sustained inbound burst without falling
behind. The lone ~475 ms `max` is a warm-up/GC outlier (p99 is 19 ms), not a
recurring hitch; mean FPS is dragged down only by that single sample. Existing
mitigations that keep this flat:

- Compose typing no longer re-renders the whole tree — panes are `memo`-ised on
  their exact state slices (STATUS, Slice 10).
- The conversation view renders only a computed, bottom-pinned **window** over
  the loaded messages, not the whole history.

## Inline image preview — feasibility (spike, 2026-08-02)

Spiked whether images can render _inside_ the TUI (the open question behind the
media-preview item). **Feasible** — OpenTUI has first-class paths, so it's not a
fight-the-framebuffer hack:

- `OptimizedBuffer.drawSuperSampleBuffer(x, y, rgbaPtr, …)` blits an RGBA pixel
  buffer as supersampled cells — works in **any** terminal (unicode half/quadrant
  blocks), no protocol needed. `drawGrayscaleBufferSupersampled` too.
- OpenTUI also detects native protocols: `renderer.capabilities.kitty_graphics`
  and `.sixel` — so a higher-fidelity path is available where the terminal
  supports it (our `src/tui/media-preview.ts` already builds those escapes).

**The one real cost:** both paths need decoded **RGBA pixels**, and image
decoding (PNG/JPEG → raw) is _not_ in the Bun/stdlib surface — it needs a
decode dependency (or the native-protocol path, which takes encoded bytes but
only renders on kitty/iTerm2/WezTerm). So the remaining work is a **dependency +
integration** decision, not an unknown. Tracked in
`docs/plans/backlog/PLAN-v1-polish-backlog.md`.
