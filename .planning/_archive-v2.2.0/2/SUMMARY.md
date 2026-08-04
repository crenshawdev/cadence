---
phase: 2
status: complete
completed: 2026-08-03
---

# Phase 2: The parser earns its keep - Summary

The guard's parser is deleted. `lib/shell-tokens.mjs` (840 lines),
`lib/destructive-git.mjs` (367) and both their test files (1,044) are gone -
2,251 lines replaced by `lib/git-segments.mjs`, about thirty. Both rails read
it: a segment counts only when its command word is `git`, and the verb is its
first non-flag word. `git.on_protected: refuse` on `git commit` survives as the
guard's only deny surface.

**Scope changed mid-phase, by user decision on 2026-08-03.** The destructive
rail is NOT built and `git.on_destructive` is removed rather than plumbed. The
first attempt (recorded below) halted after three consecutive blocking
`risk_surface` FAILs, and the decision taken from that evidence was to delete
the surface rather than plan a fourth patch round: the destructive rail was the
parser's only consumer, and specifying it meant modelling git's option grammar
again - the exact thing this requirement exists to remove.

## What shipped

- **The anchored reader** - `cadence-core/bin/lib/git-segments.mjs` (new, 85
  lines including its header), total and linear, with the seven git global
  options that take a separate argument as its only lookaside.
- **The guard rewritten over it** - `cadence-core/bin/git-guard.mjs`. The
  `denyable` and `unplaced` concepts are deleted with nothing replacing them:
  anchoring detection to the command word makes `rg -t sh "git commit"` and
  `command -v git commit` silent up front, so the command-position deny gate
  that existed to narrow a wide reader has nothing left to narrow.
- **The parser deleted** - `lib/shell-tokens.mjs`, `shell-tokens.test.mjs`,
  `lib/destructive-git.mjs`, `destructive-git.test.mjs`.
- **`git.on_destructive` reverted** across the four surfaces `930dda3` added,
  plus its two tests and the 265B of budget its catalog row had taken.
- **The reap as a git-publish subcommand** - `decideReap` in
  `lib/publish-decision.mjs`, `git-publish.mjs reap`, the `self-verify` contract
  row, and `skills/cad-land/SKILL.md` step 5 rewired to call it instead of a
  Bash `git branch -D`. That rewire matters more after the deletion: the guard
  no longer sees a `branch` verb at all.
- **The documentation corrected** - `references/git.md` loses 169 lines of
  grammar and gains a table of what now goes silent; `CHANGELOG.md` gets an
  `## [Unreleased]` section stating the removal and its accepted cost in the
  same subsection; `README.md`, `METHOD.md`, `DESIGN.md` and `INTERNALS.md` stop
  claiming reach this phase removed; TOK-01 reads as superseded on both halves.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 7 | `1fcf51e` | The reap as a git-publish subcommand |
| 1 | - | `fbecea8` | Delete the parser, anchor the guard to the command word |
| 1 | - | `40e72a6` | Revert `git.on_destructive`, the key with no rail to configure |
| 1 | - | `ef41f88` | The guard's documentation stops describing a parser that is gone |
| 1 | - | `9a3f244` | cad-land reaps through the git-publish seam, not a Bash git call |

Range `1fcf51e..9a3f244`, 5 commits. The halted attempt's `776e6a0`, `d4861ae`
and `d7e50a7` are superseded by `fbecea8` (their files are deleted); `930dda3`
is reverted by `40e72a6`.

## Review gates

None. The user directed direct surgery without the per-task gates, on the
grounds that three blocking panels had already been paid against this surface
and a fourth would review a subtraction it had no way to improve. Recorded as a
deliberate deviation from `workflow` defaults, not an omission.

## Deviations

- [deviation] Tasks 4, 5, 6 and 8 as planned do not exist in this shape: the
  plan routed the destructive rail through a new `lib/git-segments.mjs` reader
  AND wired rail 5 behind `git.on_destructive`. Only the reader landed.
- [deviation] `cadence-core/bin/git-segments.test.mjs` is new and not in the
  plan's file list. The plan assumed the reader would be pinned through
  `git-guard.test.mjs` alone; a pure reader with a stated silent corpus wants
  its own table.
- [deviation] `weight-budgets.json` regenerated in `9a3f244` for
  `skills/cad-land/SKILL.md`, which sat at exactly 8978/8978 so the seam
  invocation could not land without it. The prose was trimmed from +429B to
  +101B before the budget moved.

## Goal check

The goal is delivered under its revised scope. The parser is deleted rather than
redirected; both rails read one small anchored reader; the deny surface is
unchanged in reach and still commit-only. What the goal statement promised and
this phase did NOT deliver is the destructive rail, cut deliberately and
recorded as a skip against AC1 in `UAT.md` rather than passed.

The measurement that settled it, kept because it is the reusable part: the old
scan was O(K x N) in memory - 3.1GB at 224KB of input, a V8 abort at 280KB - in
a PreToolUse hook that runs on every Bash call and fails OPEN. A long enough
command line switched the guard off and let the push inside it run unprompted.
The replacement answers the same 336KB input in milliseconds, pinned by a test
above the abort point. A detection widener is safe to get wrong; that is not the
same as cheap to get wrong, and this is the number that separates them.

UAT: 7 passed, 0 failed, 1 skipped (AC1, scope cut). `1027` tests, `tsc` exit 0,
`self-verify` `ok:true`.

---

## The halted first attempt (2026-08-02)

Kept verbatim. It is the evidence the deletion decision was made from, and the
three panels it records are the reason there was no fourth patch round.

Execution halted by user decision after the third consecutive blocking
`risk_surface` FAIL: the destructive rail's four tasks (1, 2, 3 committed;
7 staged) landed, but task 2's approach was falsified by measurement and goes
back to planning rather than into a fourth patch round.

### What shipped

- `gitSubcommands` reports each git invocation's arguments -
  `cadence-core/bin/lib/shell-tokens.mjs`, so a rail can tell
  `git checkout .` from `git checkout main`. **Carries a live blocker** (below).
- The destructive-shape policy, modelling git's option grammar -
  `cadence-core/bin/lib/destructive-git.mjs` (new), four arms:
  `reset-hard`, `clean-force`, `pathspec-overwrite`, `branch-force-delete`.
  **Incomplete** (below).
- `git.on_destructive` across the four surfaces a config key needs -
  `cadence-core/config.schema.json`, `cadence-core/templates/config.json`,
  `cadence-core/references/config-reach.md`, `cadence-core/workflows/config.md`.
- The reap as a git-publish subcommand -
  `cadence-core/bin/lib/publish-decision.mjs`, `cadence-core/bin/git-publish.mjs`,
  `cadence-core/bin/self-verify.mjs`. **STAGED, uncommitted** - it drew no
  surviving finding, but it went into a panel that FAILED, so it was not
  committed.

Not started: tasks 8, 4, 5, 6. Rail 5 never reached `git-guard.mjs`, so
`git.on_destructive` is configurable but reaches no hook - **no destructive
command is guarded on this branch today**.

### Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | `776e6a0` | gitSubcommands reports each invocation's arguments |
| 1 | 1 | `d4861ae` | fix: every invocation reads to the end of its simple command |
| 1 | 2 | `d7e50a7` | the destructive-shape policy, over git's option grammar |
| 1 | 3 | `930dda3` | git.on_destructive across the four surfaces a key needs |

Range `d350311..930dda3`, 4 commits. Task 7 is staged and uncommitted.

### Review gates

Three `risk_surface` fires, all `blocking`, all FAIL. Reviewer set was
`claude-subagent` + `openai` + `gemini` + `deepseek` at tier `balanced`,
mode `adjudicated`.

| Fire | Payload | Reviewers that ran | Verdict |
|---|---|---|---|
| 1 | task 1 staged | 4 of 4 | FAIL - 1 blocker (4-way convergence) |
| 2 | `776e6a0` + task 2 staged | 2 of 4 (`openai` transport, `gemini` HTTP 503) | FAIL - 2 high, 3 medium |
| 3 | `d4861ae`/`d7e50a7`/`930dda3` + task 7 staged | 3 of 4 (`openai` transport) | FAIL - 1 blocker, 4 high |

`openai` was lost to the 10-minute host command ceiling on fires 2 and 3, at
36KB and 80KB payloads. This is the already-filed non-streamed-request class
(CAPTURE `(tooling)` "Stream the provider response"), now measured on a
blocking gate twice in one phase.

### Deviations

- [deviation] `776e6a0`/`d4861ae` - task 1's stated args boundary ("up to the
  end of that simple command or the next git word, whichever comes first") was
  reversed. It was itself the gate-1 blocker: any git-word-shaped ARGUMENT
  (`vendor/git`, `src/git`) truncated the list. Readings now overlap instead of
  dividing the words. The `xargs -I{} git add . git push` row was rewritten to
  `add -> ['.','git','push']` rather than deleted, pinning the trade.
- [deviation] `d7e50a7` - task 2's arms are wider than the plan's literal text:
  the clean arm keys on parsed force/dry-run options rather than "a word
  containing `f` before its first `=`", and the checkout/restore arm no longer
  tests for the literal words `.` or `--`. AC1/AC2 shapes all hold; the plan's
  acceptance criteria were not edited.
- [deviation] `d7e50a7` - `git checkout <path>` with no `--` deliberately stays
  SILENT (recorded in the module header and in an `EXCLUSION` test row): the
  word is byte-identical to a branch name and only the repo disambiguates, so
  firing means prompting on every `git checkout feature/x`. `git restore <path>`
  fires (restore's operands are always pathspecs).
- [deviation] `d7e50a7` - `git branch -M` added as a named silent row: it does
  overwrite a ref, and it is outside TOK-02's four arms. Recorded, not fixed.
- [deviation] `930dda3` - also touched `cadence-core/bin/self-verify.test.mjs`,
  not in the plan's file list: its fixture enumerates every schema key, so a new
  key made the fixture report `inert-config-key`.
- [deviation] task 7 (staged) - `readProtectedBranches` extracted from
  `publish()` so `reap` shares it; behaviour-identical for `publish`.

### Open items

**Live blocker in committed code.** `d4861ae`'s overlapping args reading is
O(K x N) in memory. Measured on `'git clean -fd '.repeat(n)`:
28KB -> 17ms/113MB, 112KB -> 197ms/867MB, 224KB -> 850ms/3115MB (383,992,002
arg entries). This runs in a PreToolUse hook on every Bash call. The reviewer
measured a V8 OOM (SIGABRT, no stdout) at 280KB, which would let a `git push` in
the same command run unprompted. Fixing this without reintroducing the gate-1
truncation is the first thing the re-plan must answer.

**Confirmed silent destruction, still open in `destructive-git.mjs`.** Each
verified live against git 2.55 in a throwaway repo, and each returns `null` from
`destructiveInvocation` at `930dda3`:

- `git checkout -f -b x` (and `-fb x`, `-b x -f`, `-f -B main`, `--force -B main`,
  `-f --orphan o`) - the `-b`/`-B`/`--orphan` test short-circuits before the force
  check. Live: uncommitted edit discarded AND a staged-only file deleted.
- `git switch -f main`, `git switch --discard-changes main` - `switch` has no
  entry in the SPELLINGS table at all. Live: uncommitted edit discarded.
- `git clean -f -n --no-dry-run` (and `-fn --no-dry-run`) - git is last-one-wins,
  the arm treats dry-run as order-independent. Live: "Removing untracked.txt".

**Pre-existing, not introduced by this phase** (carried from three panels):

- `git push /srv/git main` returns `subs:["push","main"]` - a phantom second
  subcommand, byte-identical at `d350311`. Now pinned by a test row.
- `gitSubcommands` is not total over every hostile object: `String(text ?? '')`
  throws on `Object.create(null)` or a `Symbol.toPrimitive` that throws.
  Unreachable through the hook, which parses its input from JSON.
- Quadratic subcommand scan on `'git -C '.repeat(n)` (825ms at 140KB), distinct
  from the memory blocker above and present at `d350311`.

**Killed on adjudication, recorded so it is not re-raised.** `gemini` reported
a path-traversal blocker: `reap --branch feature/../main` deleting `main`.
False - live git rejects it at `check-ref-format`, `rev-parse --verify` exits 1,
and `git branch -D -- feature/../main` errors "branch 'feature/../main' not
found". `refs/heads/main` as an operand is refused the same way.

### Goal check

The phase does not deliver its goal, and stopped on purpose rather than
appearing to. Two of the four success criteria are provably unmet on this
branch. SC1 asks that `git.on_destructive` FIRE on the named shapes: the config
key exists across all four surfaces (`930dda3`) and the policy module decides
correctly for 19 of the shapes I ran, but task 4 never landed, so nothing in
`cadence-core/bin/git-guard.mjs` calls `destructiveInvocation` - the key is
configurable and reaches no hook, and no destructive command is guarded here
today. SC3 asks that `references/git.md`'s rail-3 evasion grammar and
out-of-grammar table be gone with the cost stated in `CHANGELOG.md`: task 5
never started, so both are still present verbatim and the CHANGELOG has no
entry. SC4 (annotating TOK-01 as superseded) is task 6, also not started. SC2
- ask, never hard-block - is the one that holds as far as it was built: the
schema enum is `ask | off` with no `refuse` arm.

What the three review gates established is more useful than the partial build.
Task 2's premise, "a small flag-aware parser", was falsified by measurement, not
by opinion: after the module was rewritten to model git's option grammar with
per-subcommand tables transcribed from `git <sub> -h`, a third adversarial pass
still found three families of silent, unrecoverable destruction (`checkout -f -b`,
`switch -f`, `clean --no-dry-run`), each of which I reproduced live. In the same
round the fix for gate 2's blocker introduced gate 3's blocker - the O(K x N)
memory growth above - so the patch loop was trading defect classes rather than
converging. That is the evidence the re-plan should start from, and it lands
squarely on the open decision already sitting in `.planning/CAPTURE.md:13` from
the v1.4.0 close: rip `lib/shell-tokens.mjs` out and go back to a small regex
that asks, versus keep it and stop investing. That decision was deferred then
because TOK-01 was already shipped; this phase has now paid three blocking
panels to reach the same question with numbers attached.
