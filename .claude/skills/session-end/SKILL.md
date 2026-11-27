---
name: session-end
description: End a working session in this project. Drafts the close-out, shows it for confirmation, then updates the Notion backlog, posts the handoff to the Board and removes local/session/. Run when the work is approved or the session is stopping for any reason.
---

# End a session

The next session starts from what this one leaves on the Board and in Notion. Nothing in `local/session/` survives, so anything worth keeping has to be written out here. Show the user the whole close-out before any of it is written.

## 1. Gather

- `local/session/session.json` and `plan.md`: what this session claimed and set out to do.
- `git status`, `git log` for this session's commits, and open PRs: what actually landed, and what is uncommitted.
- Uncommitted work is not lost by this command, but the next session will not find it unless the handoff says where it is. Commit it to the branch, or name the branch, file or stash under **Half-done**.

## 2. Draft the close-out

**Backlog changes**, one line per item this session touched:

| Outcome                                | Status        |
| -------------------------------------- | ------------- |
| PR open, waiting on the user           | `In Review`   |
| Merged with the user's approval        | `Done`        |
| Not finished, will be picked up again  | `Ready`       |
| Stuck on a person or something outside | `Blocked`     |
| Still being worked by a live session   | `In Progress` |

Leave an item `In Progress` only if a session will carry straight on with it. A stale `In Progress` locks the item against every later session.

**New items:** anything discovered and not yet raised. Agent-raised work is `Triage`; a step only the user can take is `Blocked`; open its body with the blocker kind (`decision`, `external` or `access`), then who has to act and why. Owner is the project's droid (empty when it has none), a read-only rollup: never set it.

**Learnings:** any that were not posted as they happened.

**The handoff**, written to `local/session/close.md` with exactly these three headings:

```markdown
**Changed:** what landed this session: commits, PRs, decisions recorded.
**Half-done:** what is in flight and where it lives: branch, file, stash.
**Next:** the single next step, concrete enough to start cold.
```

Pick its state:

| State     | Means                                                   |
| --------- | ------------------------------------------------------- |
| `active`  | Work continues; nothing is waiting on anyone            |
| `paused`  | Stopped part-way; an agent can resume                   |
| `waiting` | Everything buildable is done; a person has to act       |
| `review`  | A PR is open for the user                               |
| `done`    | The item is finished and nothing follows directly on it |

Add `--pr <number>` when a PR is open. Add `--blocked decision|external|access` when the work is stuck: one value, the closest, with every blocker listed in the text.

**Public repos only** (`docs/LEARNINGS.md` exists): if a learning from this session is one an outside contributor would need, draft the entry for `docs/LEARNINGS.md` under its topic. Contributors cannot read the Board. Most learnings do not qualify. Do not edit the file yet.

## 3. Show it

Show the user the backlog changes, the new items, the learnings, any `docs/LEARNINGS.md` entry and the handoff text. Wait for confirmation. Apply any corrections to the draft before writing.

## 4. Write

If there is a `docs/LEARNINGS.md` entry, add it and commit it to the branch first. Then Notion and learnings, and the handoff last:

```bash
node scripts/session.mjs set <item-id> --status "<status>" [--pr <url>]
node scripts/session.mjs raise "<title>" [--status Blocked] [--file <detail.md>]
node scripts/session.mjs learn "<headline>" [--topic <word>] [--file <fix.md>]
node scripts/session.mjs close --file local/session/close.md --state <state> [--pr <n>] [--blocked <kind>]
```

`close` posts the handoff and then removes `local/session/`. It runs last because it destroys the reference the other commands were drafted from.

`close` also lists any claimed item it is leaving `In Progress`, with the command to release each. If it names one you did not mean to keep, run that command with the status it stands at: `node scripts/session.mjs set <item-id> --status <Ready|Blocked|In Review> --force`. `local/session/` is gone, so `set` no longer sees the claim; these were this session's own claims, so `--force` is right.

If any command fails, stop. Do not run `close`, and do not delete `local/session/` by hand. Tell the user exactly what was written and what was not. Every write that succeeded is recorded in `local/session/session.json`, so the next `/session-start` can finish the job without repeating any. Running the same `learn` or `close` again is safe: the Board posts identical text once.

## 5. Confirm

Tell the user what was written: the items and their new statuses, the handoff's state, and that `local/session/` is gone.
