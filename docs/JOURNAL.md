# JOURNAL

> Append-only log of non-obvious learnings, gotchas, and the "why" behind things.
> **Newest at the top.** Keep entries short and factual — one entry per discovery.

---

### 2026-07-30 — Slice 1 research: Beeper Desktop API surface

Studied the official [Beeper Desktop API](https://developers.beeper.com/desktop-api) (no live
Beeper needed; docs + SDK source only). Key shapes:

- **There's an official TypeScript SDK, `@beeper/desktop-api`** (npm, v5.0.0), a typed wrapper over
  the local REST API. Docs explicitly say "use our SDKs." Supports **Bun 1.0+** (smoke-verified).
- **Transport:** local REST at `http://127.0.0.1:23373` by default. Beeper Desktop must be running.
- **Auth:** `Authorization: Bearer <token>`. Token is minted in Beeper Desktop → Settings →
  Integrations → Approved connections (`+`). OAuth 2.0 + PKCE (`/.well-known/oauth-authorization-server`)
  exists for remote access — that's Slice 13, not now.
- **SDK client:** `new BeeperDesktop({ accessToken, baseURL, timeout, maxRetries, fetch, logger })`.
  The `fetch` option lets us inject a synthetic fetch → **fixture-based tests need no live Beeper**.
- **Pagination:** cursor-based, both auto (`for await…of page`) and manual (`page.items`,
  `page.hasNextPage()`, `page.getNextPage()`).
- **Errors:** base `APIError` + subclasses — `APIConnectionError` (no connection),
  `AuthenticationError` (401), `PermissionDeniedError` (403), `NotFoundError` (404),
  `RateLimitError` (429), `InternalServerError` (≥500), `BadRequestError` (400),
  `UnprocessableEntityError` (422). These map cleanly onto our `BeeperError` taxonomy.
- **Surface used by the roadmap:** `info.retrieve()` (GET /v1/info — status/doctor + capabilities),
  `accounts.list()`, `chats.list/search`, `messages.list(chatID)/search/send(chatID)`. Live updates
  are a WebSocket at `ws://…/v1/ws` with `chat.upserted`/`message.upserted` domain events (Slice 6);
  reactions/edits/assets exist for Slice 11.

Implication: Slice 1 **wraps the SDK** rather than hand-rolling HTTP + a full Zod schema layer. See
`DECISIONS.md`.

### 2026-07-30 — Slice 0: scaffold & toolchain landed

- **OpenTUI proven first, as planned.** `@opentui/react@0.4.5` renders a three-pane layout on
  macOS arm64 under Bun 1.3.14; `q` exits cleanly (PTY-confirmed code 0). The riskiest dependency
  is retired before any product code. Headless render smoke via `@opentui/react/test-utils`
  `testRender` runs in CI without a TTY.
- **Had to pin TypeScript to the 6 line.** Newest TS is 7.0 (native Go compiler), but
  `typescript-eslint` doesn't support it yet — `bun run lint` hard-fails under TS 7. Pinned
  `typescript@6.0.3` so typecheck and lint share one compiler. Recorded in `DECISIONS.md`;
  quick-reference in `LEARNINGS.md`.
- **TS 7 also removed `tsconfig` `baseUrl`** (surfaced before the pin); the `@/*` path alias now
  uses a relative mapping (`./src/*`), which works on both TS 6 and 7.
- Toolchain wired: ESLint 10 flat config + `typescript-eslint`, Prettier (single quotes, es5
  commas, no semis), Husky v9 (pre-commit lint-staged + gitleaks, commit-msg commitlint, pre-push
  `bun test`), gitleaks secret scanning locally and in CI, and GitHub Actions (typecheck/lint/
  format/test on macOS arm64 + ubuntu, plus a full-history gitleaks job).
- Name locked: package/CLI/config is `beeper-tui` (repo stays `beeptui`).

### 2026-07-30 — Repo scaffolded docs-first

- Docs protocol modeled on the `psyke` repo (STATUS / JOURNAL / DECISIONS / ROADMAP / plans),
  adapted for a solo local-first tool: no Linear tickets, no worktree guard, no staging environment.
- The PRD mandates Bun + OpenTUI, which overrides the global AGENTS.md "npm only" and "Vitest"
  rules — see `DECISIONS.md` 2026-07-30 and the project `AGENTS.md`.
