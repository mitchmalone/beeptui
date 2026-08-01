## Summary

<!-- What does this change and why? -->

## Test plan

- [ ] `bun run typecheck` / `bun run lint` clean
- [ ] `bun test` green; new behavior has tests written test-first
- [ ] No Beeper I/O outside `src/beeper/`; no state mutation outside the reducer

## Privacy check

- [ ] No real conversation content, contact names, account ids, tokens, or captured API
      responses anywhere in this PR (fixtures are synthetic; screenshots/logs redacted)
