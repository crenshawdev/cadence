PLAN COMPLETE
Plan: .planning/phases/3/PLAN-3.md
Tasks: 1 of 1
| Task | Commit | Note |
|---|---|---|
| 1: Add the Cadence-directed arm to `/cad-capture` | 4fc06f4 | `skills/cad-capture/SKILL.md` gains a `--cadence` flag (named in `argument-hint`, parsed beside the kind and `--phase N` at step 1) and a step 5 that REPLACES steps 2-4: queue = `CAPTURE.md` in the directory part of `CADENCE_GLOBAL_CONFIG` when set, `~/.claude/cadence/` otherwise, never `${CLAUDE_PLUGIN_ROOT}`, created with step 2's three headings when absent; entry = the user's sentence plus `(host: <host>, command: /cad-<name>)`, host resolved `origin` URL -> repo-root basename -> absolute cwd; quote-nothing-else stated as the stand-in for absent redaction machinery; three rails stated (no commit anywhere, no transmission, unresolvable/unwritable global dir says so and STOPS with no `.planning/CAPTURE.md` fallback). Step 4 is now scoped "the project-directed arm only, never under `--cadence`"; the project arm's behaviour is otherwise unchanged. Under `--cadence` the cursor is skipped, since a host phase number means nothing in Cadence's queue. Budget row re-pinned 2345 -> 4839 in the same commit. Verify: self-verify `ok:true, problems:[]`; `weight.mjs` reports the skill at exactly 4839 against its row; `grep -n CADENCE_GLOBAL_CONFIG skills/cad-capture/SKILL.md` -> line 57. Static analysis: `npx tsc -p tsconfig.ci.json` exit 0; `node --test cadence-core/bin/*.test.mjs` 1420/1420 pass. |

Deviations: none

Open items:
- The task's `human-verify` half is not walkable from a dispatch and is routed to
  `/cad-verify 3` as CONTEXT AC4: from inside a host project that is not Cadence,
  run `/cad-capture --cadence` with a one-sentence note, then observe (1) the note
  appended to the global Cadence `CAPTURE.md` (`~/.claude/cadence/CAPTURE.md`, or
  the directory part of `CADENCE_GLOBAL_CONFIG` when set) naming the host project
  and the provoking command, (2) that host's `.planning/CAPTURE.md` unchanged, and
  (3) `git status --short` in the host repo byte-identical before and after.
- First draft of step 5 measured 5,364 B, more than double the surface's old
  2,345; it was cut to 4,839 by dropping rationale asides that did not change
  behaviour (kept: never-plugin-root, never-fall-back, origin-first). The row is
  pinned at the cut value, so the dropped bytes cannot come back silently. Still
  the largest single addition to a resident skill surface in this phase - worth a
  look at `/cad-verify 3` against the phase's own byte posture.
- `cadence-core/references/COMMANDS.md:47` and `README.md:123`'s `/cad-capture`
  rows still describe only the project-directed arm, and no `.planning/DOCS-CLAIMS.md`
  row covers the skill's old "one file" self-description (the description and the
  `<objective>` line were corrected in this commit). The plan puts those two
  surfaces out of scope for this plan ("the CONTEXT scope boundary names those
  surfaces for this phase's two NEW commands only"), so `--cadence` ships
  undiscoverable from `/cad-help` and the README until someone adds the row -
  which is also the substance of the plan-review finding on PLAN-3:45 about the
  flag's discoverability.
- Working tree at commit time also carried unstaged `.planning/config.json` and
  `.planning/phases/3/PLAN-1.md` modifications and an untracked `.orphaned_at`,
  none of them this plan's and none staged; `lease-check` reported
  `staged:2, declared:2`.
