---
phase: 3
status: complete
completed: 2026-08-13
---

# Phase 3: The lens and the loop back - Summary

Two new commands (`/cad-minimalism-review`, `/cad-suggest`), a `--cadence` arm on
`/cad-capture` that writes to a user-global queue outside every project, and a
lean-first build posture the executor contract reads behind a deferred `Read`.

## What shipped

- Lean-first build posture - `cadence-core/references/lean-build.md` (3,089 B),
  read at `skills/cad-executor-contract/SKILL.md` process step 1 and anchored by
  a PROMOTION row in `cadence-core/bin/lib/deferred-reads.mjs:233`
- Declined-shape routing - the executor contract routes a rejected fuller option
  to `Open items:`, with the five-field digest and the deviation definition
  unchanged
- Two prose cuts, each re-pinned in the same commit - the executor contract's
  duplicated static-analysis carve-out, and `cad-land`'s `git.auto_close`
  re-derivation (both named keeps intact)
- Minimalism pass - `cadence-core/workflows/minimalism-review.md` (8,244 B) plus
  `skills/cad-minimalism-review/SKILL.md` (2,333 B); dispatches the existing
  `cad-reviewer` role, returns a ranked delete-list, applies nothing
- Cadence-directed capture - `skills/cad-capture/SKILL.md` `--cadence` flag
  writing to `CADENCE_GLOBAL_CONFIG`'s dir or `~/.claude/cadence/CAPTURE.md`,
  carrying host project and provoking command, never the host's `.planning/`
- Tuner front door - `cadence-core/workflows/suggest.md` (5,141 B) plus
  `skills/cad-suggest/SKILL.md` (818 B), a read-only relay over
  `planning.mjs trace suggest`; `/cad-milestone` step 8 and `/cad-report`'s
  `done` step repointed at it
- Registration - both commands in `cadence-core/references/COMMANDS.md` and the
  README, skill count re-measured 23 -> 27, 13 `README-*` claim-ledger lines
  re-pinned

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 1a29ce8 | State the lean-first build posture in its own reference |
| 1 | 2 | a87c1ee | State the executor's static-analysis carve-out once |
| 1 | 3 | 1f46da5 | Read the posture at process step 1, anchored by a register row |
| 1 | 4 | f4b720e | Route a declined fuller shape to Open items, not to a deviation |
| 1 | 5 | d2c6544 | State the `git.auto_close` mechanic once, not again in cad-land's guardrails |
| 2 | 1 | 31518d3 | Add the minimalism-review workflow |
| 2 | 2 | 923896b | Ship `/cad-minimalism-review` as a discoverable command |
| 3 | 1 | 4fc06f4 | Add the Cadence-directed arm to `/cad-capture` |
| 4 | 1 | 6c82ec5 | State the suggest presentation rules once, in their own workflow |
| 4 | 2 | da88390 | Ship `/cad-suggest` as a read-only relay over the suggest workflow |
| 4 | 3 | 49414ea | Point the milestone close and the report footnote at `/cad-suggest` |
| 4 | 4 | 6ba3da2 | Register `/cad-minimalism-review` and `/cad-suggest` in the command reference |
| 4 | 5 | fe9b9b9 | List both new commands in the README and correct the skill count |
| 4 | 6 | 58a3d3b | Carry the README shift and the corrected skill count into the claim ledger |

Range: `f98c0c4..58a3d3b`, 14 commits.

## Deviations

- [deviation] (plan 1, task 2, `a87c1ee`) Task 2's `Verify:` required
  `grep -c 'three bounded fix attempts'` to return 1 while its Action said to
  leave `<deviation_rules>`' copy untouched. Measured before the edit, that
  phrase existed ONLY in the step-3 copy being deleted, so the cut alone would
  have taken the grep to 0. Resolved on the Verify's authority by opening the
  surviving Boundaries bullet with "A blocker gets three bounded fix attempts per
  task"; the clauses the Action named as its reason are byte-identical.
- [deviation] (plan 1, task 3, `1f46da5`) PLAN-1's `files:` lease as authored
  could not carry the change. Adding a `DEFERRED_READS` row turns two byte-exact
  pins red - `deferred-reads.test.mjs`' `REGISTER_SOURCE` literal and its length
  assertion, plus a second at `self-verify.test.mjs:1622` - and neither file was
  declared by any phase-3 plan. Raised as a structural checkpoint; the user
  approved extending PLAN-1's lease by exactly those two paths (frontmatter now
  declares seven files). The commit carries only the mechanical pin update, no
  assertion logic changed, and the suite is green at it.

## Open items

- ROADMAP phase-3 criterion 1 still says the fuller option is recorded "in its
  deviation record", the wording D-02 and AC2 contradict. `/cad-verify 3` reads
  that criterion against a contract that routes the declined shape to
  `Open items:` instead. Already flagged at `CONTEXT.md:363`.
- Three human-verify halves are not walkable from a dispatch and route to
  `/cad-verify 3`: AC3 (`/cad-minimalism-review` returns a ranked delete-list
  and leaves `git status --short` byte-identical), AC4 (`/cad-capture --cadence`
  from a non-Cadence host project appends to the global queue and leaves the
  host repo untouched), AC6 (`/cad-suggest` presents trace figures and its
  `/cad-config` key, writes no config, and refuses a thin trace in one line).
- `--cadence` ships undiscoverable: `COMMANDS.md:47` and `README.md:123`'s
  `/cad-capture` rows still describe only the project-directed arm, and no
  `DOCS-CLAIMS.md` row covers it. The CONTEXT scope boundary named the
  registration surfaces for this phase's two NEW commands only.
- `README.md:97` still describes the retune as `trace suggest` inside the
  `/cad-milestone` paragraph rather than naming `/cad-suggest`. A prose claim
  with no `DOCS-CLAIMS.md` row over it; task 5's scope was the command lists
  plus the skill count.
- `cadence-core/bin/trace.test.mjs`'s `BRACKETING` map is per-FILE and carries
  no row for `minimalism-review.md`, so nothing asserts that workflow keeps its
  dispatch bracket. The census test still validates the bracket's family, event,
  `--role` and `--read` globally. Adding the row was outside plan 2's lease.
- Byte posture, for `/cad-verify 3`: `/cad-capture`'s resident surface went
  2,345 -> 4,839 B, the phase's largest single addition to a resident skill, and
  `workflows/suggest.md` landed at 5,141 B against `workflows/report.md`'s 3,794
  for a comparable thin relay. Both were cut from larger first drafts (5,364 and
  5,899) and pinned at the cut value, so the dropped bytes cannot return
  silently.
- Plan 4's task-4 Action placed `/cad-suggest` "under `## Support` beside
  `/cad-report`", but `/cad-report`'s COMMANDS.md row lives in the Build spine
  cluster, so both cannot hold. D-16's cluster registration was taken as binding
  and the row sits in Support after `/cad-spike`; in the README, where both
  bullets are in the Support list, `/cad-suggest` is directly beneath
  `/cad-report`.

## Goal check

The 14 commits deliver the phase goal. Over-building is named at both points the
goal asks for: at build time by `references/lean-build.md` (3,089 B) reached
through a deferred `Read` at `skills/cad-executor-contract/SKILL.md` process
step 1, anchored by the register row at
`cadence-core/bin/lib/deferred-reads.mjs:233` so `self-verify` fails if the read
is dropped; and at review time by `/cad-minimalism-review`, whose
`allowed-tools` block contains no `Write` and no `Edit`
(`grep -cE 'Write|Edit' skills/cad-minimalism-review/SKILL.md` -> 0), which is
what makes "applies nothing" structural rather than a promise. The loop back
exists as `/cad-capture --cadence` (`4fc06f4`) writing to
`~/.claude/cadence/CAPTURE.md` or `CADENCE_GLOBAL_CONFIG`'s directory, never
`${CLAUDE_PLUGIN_ROOT}` and with no `.planning/` fallback. The tuner has its
front door: `/cad-suggest` is registered at `COMMANDS.md:53` and is likewise
`Write`/`Edit`-free (`grep -cE 'Write|Edit' skills/cad-suggest/SKILL.md` -> 0).
CTW-06's re-pins landed in-commit as required (`a87c1ee`, `d2c6544`). The suite
is green at HEAD (1420 tests, 0 failures) and `self-verify` returns
`problems:[]` across all 20 checks. Two gaps are honest rather than hidden.
First, every "applies nothing" and "lands in the right queue" claim above rests
on a tool grant and a code path, not on an observed run - the three human-verify
halves in Open items are exactly that evidence, and they are `/cad-verify 3`'s
to collect. Second, `--cadence` is real but unreachable by anyone reading the
docs, because the phase's registration scope covered only the two new commands;
criterion 3 is satisfied in behaviour and not in discoverability.
