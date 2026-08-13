PLAN COMPLETE
Plan: .planning/phases/3/PLAN-1.md
Tasks: 5 of 5
| Task | Commit | Note |
|---|---|---|
| 1: State the lean-first build posture in its own reference | 1a29ce8 | New `cadence-core/references/lean-build.md` (3,089 B) with its budget row pinned in the same commit; self-verify `problems:[]`, no `Trivial` bucket. |
| 2: Cut the executor contract's duplicated static-analysis carve-out | a87c1ee | Step-3 restatement replaced by a pointer at `<deviation_rules>`; 10,372 -> 10,267 B, row re-pinned in the same commit. See deviation 1. |
| 3: Read the posture at process step 1, anchored by a register row | 1f46da5 | Read sentence between the `1.` and `2.` lines with "(one consult site - this step)" inline; PROMOTION row added after the `worktree-executor.md` row, which is untouched; 10,267 -> 10,510 B re-pinned. Both byte-exact register pins updated under the extended lease. See deviation 2. |
| 4: Route a declined fuller option to `Open items:` | f4b720e | One sentence attached to the "either part of the task or an open item" clause inside `<deviation_rules>`; deviation definition unchanged, digest still exactly five fields, no new report field; 10,510 -> 10,718 B re-pinned. |
| 5: Cut `cad-land`'s guardrails re-derivation | d2c6544 | First guardrail's `git.auto_close` re-derivation replaced by a pointer at steps 3 and 4(b); `SKIPS the 4a ask` gone (grep 0), both named keeps intact verbatim (grep 1 each), nothing edited near `:104-117`; 12,076 -> 12,041 B re-pinned in the same commit. |

Deviations:
- [deviation] Task 2's Verify requires `grep -c 'three bounded fix attempts'` to
  return 1 while its Action says to leave `<deviation_rules>`' copy untouched.
  Measured before the edit: that phrase existed ONLY in the step-3 copy being
  deleted (1 hit, at `:44`), and the surviving Boundaries bullet read "Three fix
  attempts per task" - so the cut alone would have taken the grep to 0. Resolved
  on the Verify's authority by opening that bullet "A blocker gets three bounded
  fix attempts per task", which moves the phrase into the surviving statement and
  changes nothing else; the clauses the Action named as the reason to leave the
  copy alone ("ONE carve-out ... because moving on there means committing the
  failure") are byte-identical.
- [deviation] Task 3's `files:` lease as authored could not carry the change. The
  plan asserted the register row was reachable from the five declared files; in
  fact adding a `DEFERRED_READS` row turns two byte-exact pins red -
  `cadence-core/bin/deferred-reads.test.mjs`' `REGISTER_SOURCE` literal plus its
  `DEFERRED_READS.length` assertion, and a second length assertion at
  `cadence-core/bin/self-verify.test.mjs:1622`. Raised as a structural
  checkpoint; RESOLVED by extending PLAN-1's `files:` lease by exactly those two
  paths, so the frontmatter now declares seven files. Task 3's commit carries the
  mechanical update - the new row's literal spliced into `REGISTER_SOURCE` at the
  same position and both `11`s bumped to `12` - with no assertion logic changed.
  `lease-check --phase 3 --plan 1` returns `ok:true` (staged 5, declared 7), and
  the full suite is green at task 3's commit: 1420 tests, 0 failures.

Open items:
- The re-pinned budget rows at the end of this plan are
  `skills/cad-executor-contract/SKILL.md` 10,718 (up from 10,372 at HEAD before
  task 1, net +346 B after the step-3 cut) and `skills/cad-land/SKILL.md` 12,041
  (down 35 B). Plans 2-4 of this phase share
  `cadence-core/bin/weight-budgets.json`, so they must re-pin against these
  values rather than the CONTEXT's 2026-08-13 measurements.
- Not built here, for the human: `.planning/ROADMAP.md`'s phase-3 criterion 1
  still says the fuller option is recorded "in its deviation record", the wording
  D-02 and AC2 contradict. `/cad-verify 3` will read that criterion against a
  contract that routes the declined shape to `Open items:` instead.
