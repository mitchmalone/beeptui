# DECISIONS

> Append-only log of decisions made after the PRD was established (or that refine it). `docs/PRD.md`
> holds the standing product/technical direction; this file records dated changes and reasoning so
> choices aren't relitigated. **Newest at the top.** Lightweight ADR format.

---

### 2026-07-30 · Treat the repo as public from day one

**Decision.** The project may be open-sourced (PRD open question #6). Regardless of when that
decision lands, **every commit must be publishable as-is** — code, docs, plans, journal entries,
test fixtures, snapshots, and commit messages. Concretely:

- Test fixtures and smoke snapshots are **synthetic or fully scrubbed**: invented names, chat
  titles, message bodies, and identifiers. Never commit a captured real API response unscrubbed.
- Validation results (Slices 9/12) are recorded in **redacted form**: network + capability +
  outcome only — no chat names, contact names, message content, or account identifiers.
- `JOURNAL.md` / `LEARNINGS.md` entries describe API shapes and behaviors, never real
  conversation content, contacts, or personal endpoints/hostnames.
- Anything genuinely private (real validation account details, personal notes) lives in `local/`,
  which is gitignored.

**Why.** Git history is permanent: one leaked commit forces a history rewrite or kills
open-sourcing. Enforcing publishability from the first commit costs almost nothing; retrofitting it
costs everything. This also matches the product invariant that the app itself never leaks message
content or tokens — repo and runtime hold the same bar.

**Consequences.** CLAUDE.md gains invariant 9 and the project AGENTS.md a hygiene section; slice
plans referencing fixtures/validation were amended. Reviewing for accidental personal data is part
of every close-out.

### 2026-07-30 · Bun is the runtime, package manager, and test runner (overrides global AGENTS.md)

**Decision.** This project uses **Bun** for everything the global AGENTS.md assigns to npm/Node/
Vitest: dependency management (`bun install`, `bun.lock` committed), script running, the runtime,
and testing (`bun test`).

**Why.** The PRD's technical approach mandates Bun + OpenTUI: OpenTUI's native Zig core and
`@opentui/react` are built and distributed for the Bun runtime, and the PRD names Bun's test runner
for component/reducer tests. Splitting package management (npm) from runtime (Bun) would mean two
lockfile ecosystems and untested install paths for a native-addon dependency. This is exactly the
"specific, justified reason" the global rule allows.

**Consequences.**

- No `package-lock.json`; `bun.lock` is the lockfile. CI installs with `bun install --frozen-lockfile`.
- Tests use `bun:test` (Jest-compatible API), named `*.test.ts(x)` per the global convention.
- Git hooks still use Husky + lint-staged + commitlint per global AGENTS.md — they run fine under
  Bun (`bunx husky`).
- All other global AGENTS.md rules stand: ESM only, strict TS, Prettier config, naming, TDD,
  conventional commits.

### 2026-07-30 · Docs protocol adapted from psyke, simplified for a solo local tool

**Decision.** Adopt psyke's docs system — `STATUS.md` (cursor), `JOURNAL.md` (append-only
learnings), `DECISIONS.md` (this file), `ROADMAP.md` (slices), `plans/` (backlog → active → done,
one plan per slice from `_TEMPLATE.md`) — but drop the parts that only pay off with a team and
deployed environments: Linear tickets, the worktree guard hook, staging branches, and preview
environments. Branches follow the global convention (`feat/…`, `fix/…`).

**Why.** The docs protocol is what makes the repo agent-ready — an agent can orient from STATUS,
pick up a slice plan, and close out without human context transfer. The ceremony psyke layers on top
exists for parallel contributors and cloud infra, which this project doesn't have.

**Consequences.** Plans in `plans/backlog/` are the unit of work handed to agents. Session protocol
lives in `CLAUDE.md`. If parallel agent sessions become the norm, revisit worktree isolation.
