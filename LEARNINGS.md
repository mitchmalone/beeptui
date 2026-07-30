# Learnings

> Hard-won project-specific knowledge: blockers, workarounds, dependency quirks, non-obvious setup.
> Concise, grouped by topic, pruned when obsolete. Never duplicate global AGENTS.md rules here.
> The narrative "why" behind events lives in `docs/JOURNAL.md`; this file is the quick-reference.

## Dependencies

- **Toolchain is pinned to the TypeScript 6 line, not TS 7.** TypeScript 7.0 is the native (Go)
  compiler rewrite; `typescript-eslint` does not support it yet (tracking:
  typescript-eslint#10940). Running TS 7 makes `bun run lint` hard-fail with "typescript-eslint
  does not support TS 7.0". We pin `typescript@6.0.3` so typecheck and lint share one compatible
  compiler. Revisit when typescript-eslint ships TS 7 support. See `docs/DECISIONS.md`.
- All `@opentui/*` packages are exact-pinned at `0.4.5` and share that version; upgrade them
  together (`@opentui/keymap` peer-depends on the exact matching `@opentui/react`).

## OpenTUI / rendering

- **Verified: `@opentui/react@0.4.5` renders on macOS arm64 under Bun 1.3.14.** The native core
  paints a three-pane layout, and `q` (via `renderer.destroy()` + `process.exit(0)`) restores the
  terminal and exits cleanly (PTY-confirmed exit code 0).
- **Bootstrap pattern:** `await createCliRenderer()` → `createRoot(renderer).render(<App />)`.
  There is no top-level `render()` helper. Use the `useRenderer()` and `useKeyboard()` hooks inside
  components; `KeyEvent.name` holds the key.
- **JSX config:** `tsconfig` uses `"jsx": "react-jsx"` + `"jsxImportSource": "@opentui/react"`.
  Intrinsic elements (`box`, `text`, `scrollbox`, …) come from OpenTUI's JSX namespace.
- **Running an OpenTUI `.tsx` file from _outside_ the project tree fails** with
  `Cannot find module 'react/jsx-dev-runtime'` — Bun resolves `@opentui/react` from its global
  cache, where React (a peer dep) isn't reachable. Keep scripts that import the app inside the
  project so React resolves from local `node_modules`.

## Testing

- **Headless render tests work via `@opentui/react/test-utils`.** `testRender(<App />, { width,
height })` returns `{ renderOnce, captureCharFrame, … }`; assert on the captured char frame. No
  TTY needed, so it runs in CI — this is the Slice 0 render smoke.
- Do not unit-test the quit path: the handler calls `process.exit(0)`, which would kill the test
  runner. Verify clean exit with a PTY smoke instead.
- **Fake tokens in fixtures must not _look_ like secrets.** A synthetic `beeper_sk_…` test token
  tripped gitleaks' `generic-api-key` rule and blocked the commit. Use low-entropy, obviously-fake
  placeholders (e.g. `example-placeholder-token-value`); redaction/auth tests key off the `Bearer`
  prefix and key names, not token format, so content doesn't matter.
- Inject the SDK's `fetch` option to drive adapter tests from synthetic responses — the pagination
  wire shape is `{ items, hasMore, oldestCursor, newestCursor }`; `accounts.list` returns a bare
  array. `doctor`/`status` are exercised end-to-end by spawning the CLI against a closed port.

## Tooling / CI

- **`gitleaks` is a required local tool** (`brew install gitleaks`). The pre-commit hook hard-fails
  if it's missing rather than skipping the secret scan (invariant 9). CI installs the pinned
  binary and scans full history.
- Husky v9 hooks are the bare command (no boilerplate); `bunx husky` sets `core.hooksPath=.husky/_`.
- **Prettier reformats Markdown prose.** A wrapped line starting with `+`/`-` gets turned into a
  list item — keep continuation lines from starting with those characters in committed docs.
