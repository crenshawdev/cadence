---
phase: 4
status: complete
completed: 2026-07-27
---

# Phase 4: renumber & git-guard hardening - Summary

Closed #37, #49 and #50: `renumber` leaves a decimal cursor alone (warning
instead of desyncing it), refuses a destination it cannot legitimately take,
and names the ops that completed when an apply dies partway; one unreadable
`.md` no longer collapses a self-verify or weigh run; and `git-guard` reads a
backslash-continued `git push` as the push it is.

## What shipped

- Decimal-cursor carve-out on `renumber`, on the existing scalar `warn` -
  `cadence-core/bin/planning.mjs`
- Collision pre-flight (`occupied()` + `vacated`) that fails before any write,
  plus an untracked-residue refusal - `cadence-core/bin/planning.mjs`
- `partial-apply` envelope listing completed ops and the failed one -
  `cadence-core/bin/planning.mjs`
- Silent skip of unreadable surfaces in the shared walker -
  `cadence-core/bin/lib/surface-weight.mjs`
- Loud `unreadable-surface` reporting at four sites in
  `cadence-core/bin/self-verify.mjs` (both walkers, the agents tools lint, and
  the post-walk reads)
- Parity-aware continuation join, shared verbatim by
  `cadence-core/bin/git-guard.mjs` and `cadence-core/bin/self-verify.mjs` (D-15)
- Single-pass alternating quote strip in `cadence-core/bin/git-guard.mjs`
- 16 net-new tests; suite 320 -> 336

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | c15bda3 | decimal cursor carved out of the renumber shift, with a warn (#37) |
| 1 | 2 | 17df9b1 | colliding renumber destination refused before any write (#49.2) |
| 1 | 3 | e8ad033 | ops that completed reported when an apply fails partway (#49.2) |
| 1 | 4 | d62dd9b | cad-phase told a failed apply leaves a half-renumbered tree; budget bumped |
| 2 | 1 | f178ab8 | unreadable/dangling symlinks skipped in the surface walker (#49.1) |
| 2 | 2 | d9eeb82 | unreadable surfaces reported instead of collapsing self-verify (#49.1) |
| 2 | - | 3419c68 | `entries()` opts typing tightened so tsc --checkJs passes (deviation) |
| 2 | 3 | 6586d47 | self-verify continuation join widened to CRLF (#50, D-15) |
| 3 | 1 | defe733 | backslash continuations joined before git-guard's quote-strip (#50) |
| 3 | 2 | 1580ea0 | wrapped push/commit rails pinned, plus the shapes that must stay silent |
| - | review | fb37a18 | git-guard: parity-aware join + single-pass quote strip (2 regressions) |
| - | review | a96d831 | self-verify: post-walk reads guarded (INTERNALS.md, weight-budgets.json) |
| - | review | 28be6a0 | partial-apply hint no longer prescribes a data-destroying re-run |
| - | review | 6094083 | D-15 one-idiom join restored; hint no longer over-claims |
| - | review | a519a63 | remove refused when git rm cannot actually free the phase dir |

## Deviations

- [deviation] Both PLAN-2 and PLAN-3 recorded a deliberate departure from D-15:
  the join's trailing class is `[ \t]*`, not the `\s*` the decision names,
  because `\s` matches `\n` and would swallow the newline ending a continued
  command - measured as a NEW push-rail bypass. D-15's two substantive
  requirements (the `\r?` CRLF arm, and one idiom across both seams) are
  honored. Landed in `defe733` and `6586d47`.
- [deviation] `3419c68` - Task 1's `entries()` helper, typed `@param {object}
  opts`, widened `readdirSync`'s return to `string[] | Buffer[]` and broke
  `tsc`. Caught at the final CI gate after Task 1 had committed, so the fix
  landed as its own commit rather than an amend.
- [deviation] All three worktrees were branched from a stale point (PLAN-2's
  was 31 commits behind and contained neither `CONTEXT.md` nor its own
  `PLAN-2.md`). Each executor merged `cadence/v1.3.1` in before starting,
  cleanly. Environment gap, not a plan defect - see Open items.
- [deviation] Five review-driven fixes landed after the merge (fb37a18,
  a96d831, 28be6a0, 6094083, a519a63). Three closed regressions the phase
  itself introduced; one closed a defect the first fix introduced; one closed
  a data-corruption path the new pre-flight was assumed to cover. Detail in
  the goal check.

## Open items

- The parallel path's worktrees do not fork from current HEAD. `execute.md`
  assumes `cadence/phase-<N>-plan-<k>` branched from the phase's start; the
  host's worktree isolation produced branches from an older merge point. Both
  executors noticed and merged forward, but one that did not would have
  planned against a missing plan file.
- `weight.mjs` under-reports an entire subtree when one descendant is
  unreadable: `entries()` returns `[]` for the whole recursive `readdirSync`,
  so a sibling `skills/good/SKILL.md` silently vanishes with `ok:true`. The
  module header promises "one unreadable file just means one fewer surface".
  self-verify still goes red, so CI does not pass silently.
- `self-verify`'s `yield d` fallback reports `{file:'skills',detail:'EISDIR'}`
  when a CHILD is EACCES - naming a readable directory with the wrong errno,
  and never linting the readable siblings, so real drift in that subtree is
  reported nowhere.
- `readlinkSync` in the unreadable-surface detail emits an absolute symlink
  target into stdout and CI logs, contradicting the comment two lines above it.
- Six pre-existing `git-guard` rail-3 holes, all silent both before and after
  this phase: `git -C "my repo" push`, `git add -A & git push`,
  `$(git push)`, `(git push)`, `echo \" ; git push`, `bash -c "git push"`.
  Deliberately not fixed here (D-16 scopes this phase to the backslash case);
  they need a quote-state tokenizer, not more regex patches.
- A half-applied renumber is still not DETECTED, only described. The hint now
  warns against re-running, but nothing refuses a re-run on a tree whose
  directories and ROADMAP disagree.
- `ops` (shown at the dry-run gate) lists moves before the rm, while the apply
  runs the rm first. The comment now says so and `completed` is the authority,
  but an operator replaying the printed order by hand would still nest a
  directory.

## Goal check

The phase delivers its three slices, but only after the review gates caught
that two of them had made things worse than they found them. `renumber` now
leaves a decimal cursor at `2.1` while moving `total` (c15bda3), refuses a
colliding destination before any write (17df9b1), and emits
`{reason:'partial-apply', completed:[...], failed:{...}}` instead of a bare
`internal` (e8ad033) - each with a test confirmed failing on pre-fix code.
`self-verify` reports `{kind:'unreadable-surface'}` and finishes its lint
where it used to collapse, and `weight.mjs` skips the same entry silently
(f178ab8, d9eeb82), the split D-05 specifies.

The git-guard slice did NOT deliver its goal as merged. Compared against a
`c4ab89f` checkout, `git add -A \\`+newline+`git push origin main` and
`awk -F'"' '{print $2}' f.txt \`+newline+`; git push origin main` both
prompted before the phase and went SILENT after it - two real pushes losing
their prompt on the rail the slice existed to harden. Backslash parity and
single-pass quote precedence fixed both (fb37a18), and each now carries a test
that fails on the merged code. Separately, `chmod 000 INTERNALS.md` still
produced `{"ok":false,"reason":"internal"}` with `problems` absent after the
#49.1 work, falsifying PLAN-2's own acceptance criterion until a96d831
guarded the post-walk reads.

Two defects were introduced by the fixes themselves and caught by the
merged-phase review: fixing only git-guard's parity split the two seams D-15
requires to share one idiom (6094083), and the new partial-apply hint told the
caller to "re-run", which destroys work - verified live, a re-run returned
`ok:true` having deleted phase 2's PLAN.md (28be6a0). The last blocker was one
no per-plan review could have seen: `git rm -r -q` exits 0 while leaving
untracked files, so the collision pre-flight's assumption that the rm frees
`phases/<at>` is false, and a real repo with one untracked `NOTES.md` produced
`ok:true` with `phases/1/2/PLAN.md` nested and a ROADMAP naming a phase whose
directory had no plan (a519a63).

Final state: 336/336 tests, `self-verify` `problems:[]`, `tsc` exit 0. What
this phase should be read as proving is narrower than "the three issues are
closed": the issues are closed, and the mechanism that caught the collateral
damage was adversarial review of the merged whole, not the per-plan reviews,
each of which passed its own slice clean.
