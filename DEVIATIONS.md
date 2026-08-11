# Deviations

Where this project diverges from the jig standard (vendored at `docs/STANDARDS.md`). Every entry
has a justification and, where the divergence should eventually close, a trigger. Deviations are
documented, never silent — an empty file means full compliance.

| Deviation                                                                   | Why                                                                                                                                                             | Reconverge when                                                   |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `bun test` instead of Vitest                                                | The PRD mandates Bun + OpenTUI (native Zig core built for the Bun runtime); Bun's built-in Jest-compatible runner avoids a second test toolchain in a Bun repo. | Vitest gains a concrete capability we need that `bun test` lacks. |
| `docs/PRD.md` outranks `AGENTS.md` on product scope and technical direction | The PRD is the product's source of truth; agent rules are operating procedure. Conflicts are followed PRD-first and flagged.                                    | Never — standing project rule (see `AGENTS.md`).                  |
