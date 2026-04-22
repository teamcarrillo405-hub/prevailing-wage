# RED Stub Triage — RETRACTED

**Status:** **Not needed — the premise was wrong.**

## Investigation outcome

On 2026-04-22 I documented this file with a 5-group triage of what I believed were 17 pre-existing failing tests. A direct investigation at commit `7c35af1` proved the premise false.

## The real story

`vitest.config.ts` had no `include` or `exclude` config, so vitest discovered `.test.ts` files from 16 stale agent-worktree scratch dirs under `.claude/worktrees/*` in addition to the real `tests/` tree. Each worktree contains a full repo copy. When vitest ran them in parallel, they fought over port 49192 and produced `EADDRINUSE` failures — which read like genuine test failures when you `grep FAIL`.

After adding `exclude: ['.claude/worktrees/**', ...]` to `vitest.config.ts` (commit `7c35af1`):

| Before exclude | After exclude |
|----------------|---------------|
| 11 test files "failed" | 50 test files pass |
| 17 tests "failed" | 650 tests pass, 0 fail |
| 119 files "skipped" | 7 files skipped |

**The real repo is fully green.**

## What caused this

The same session memory entry (`2026-04-22_10-45-00`) that said "check remaining 17 pre-existing test failures" was genuinely believed at the time — but the count came from greping `FAIL` lines against the unfiltered vitest output. Nobody noticed the worktrees were contributing noise.

## Lesson for future triage

Before trusting a repo-wide test count, either:
1. `grep -v "\.claude/worktrees"` on the vitest output, OR
2. Ensure `vitest.config.ts` has explicit `exclude: ['.claude/worktrees/**', ...]`

With `7c35af1` now committed, #2 is in place permanently. Future sessions see truthful results by default.

## Optional follow-up

The `.claude/worktrees/` directory still holds 381MB of stale scratch dirs from prior agent sessions. They're not tracked by `git` (the branch deletion on feature-branch cleanup would have removed any git-side bookkeeping), so `rm -rf .claude/worktrees/` is safe, but should be a user-authorized hygiene pass — not automatic.
