---
phase: 2
status: complete
completed: 2026-08-09
---

# Phase 2: Live friction - Summary

UAT gained model-executed provenance (`source` enum + `why_human`) and a verify
walk that runs what it can before asking, `triage-gate.md`'s blocking arm is
bounded at one re-arm with a terminal ask, and `planning.mjs audit` now emits a
verdict-moving `version_drift` signal backed by the repo's own tags.

## What shipped

- UAT provenance - `UAT_SOURCES` enum and `why_human` in `UAT_FIELDS`,
  validated pre-write on `uat record` and carried through `uat merge`
  (`cadence-core/bin/planning.mjs`, `cadence-core/lib/planning-files.mjs`,
  `cadence-core/templates/UAT.md`)
- The two-pass verify walk - a stated human-check bar, pass 1 executes and cites
  with `--source model` into one results table, pass 2 asks only what is left;
  report line splits `{v} auto-verified, {m} model-executed`
  (`cadence-core/workflows/verify.md`)
- The bounded re-arm - ONE re-arm maximum, second fire narrowed to the fix's own
  diff plus the blocker list, surviving blocker goes to a terminal ask and never
  fires again (`cadence-core/references/triage-gate.md`; `execute.md`'s now-false
  "unbounded re-arm" clause reworded)
- The runaway-loop bound the spike licensed - `maxTurns: 400` in the frontmatter
  of all 19 `agents/*.md`, with `new-project.md`'s research step named as the one
  dispatch path that has no frontmatter bound
  (`.planning/spikes/maxturns-cap-behaviour/SPIKE.md` carries the validated verdict)
- The drift signal - `cmdAudit` emits `version_drift: {doc_version, published_as,
  cycle_state}` when a tag carries the docs' Active version while a phase is not
  derived-complete; `readTags` extracted to `cadence-core/lib/git-tags.mjs` and
  shared by `git-branch.mjs` and `planning.mjs`; `activeVersion`/`titleVersion`/
  `tagCarrying` exported from `branch-decision.mjs`
- The gate that reads it - `version_drift` documented in `audit.md` §2, §3 and §4
  as verdict-moving and not additive, with the three non-drift states and the
  manifest-is-not-a-comparand argument stated (`cadence-core/workflows/audit.md`)

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 7fd1b1c | Register model-executed provenance and carry `why_human` into UAT.md |
| 1 | 2 | 4ecf072 | verify.md states the human-check bar and runs everything else |
| 1 | 3 | 3d82fa5 | Spike criteria for maxturns-cap-behaviour, written before the experiment |
| 1 | 3 | 90c4c44 | Close the maxTurns-cap spike with a validated verdict (main session ran the experiment) |
| 1 | 4 | fd46412 | Cap the blocking arm's re-arm where every fire site shares it |
| 1 | 5 | e8b949b | Ship the runaway-loop bound the spike's verdict licensed |
| 1 | 6 | 50dca22 | The audit seam detects an already-published planning-doc version |
| 1 | 7 | 5f16c51 | audit.md states the drift break and makes it verdict-moving |

Range `1304ecd..5f16c51`, 8 commits, all authored `John Crenshaw
<john@jcrenshaw.dev>` and GPG-signed `G` with key `693AB15F91734B0C`.

## Deviations

- [deviation] Task 6 named `compareVersions` and `normalizeTargetVersion` as the
  imports to bring into `planning.mjs`. Only `normalizeTargetVersion` is
  imported: the comparison runs through the exported `tagCarrying`, which already
  applies `compareVersions` on the tag side, so importing it directly would have
  been a dead binding. The instruction's stated purpose - the comparator is
  imported and never minted a second time - holds exactly, and no second
  `SEMVER_RE` exists. (50dca22)
- [deviation] Task 6's own test expectation was wrong on first run, not the seam:
  the no-git-repo case asserted `{traced:1, broken:0}`, and the fixture's open
  cycle legitimately yields a `not-verified` break. Fixed by asserting the true
  envelope plus the break code, and by giving the shared fixture a plan that
  declares its requirement so a `no-plan` break cannot be confused with the
  open-cycle one. Expected 6/6 green, observed 5/6 - recorded rather than
  rationalized. (50dca22)
- [deviation] Task 7's file edits were already present in the working tree,
  unstaged and unverified, when the continuation executor picked the plan up
  (the prior run returned PLAN PARTIAL at 6 of 7). They were treated as a draft:
  every element the Action bullet requires was checked against the file before
  staging. Nothing was missing, so the commit is the inherited draft verbatim
  plus its already-correct budget entry. Recorded because the implementation step
  was inherited rather than performed. (5f16c51)
- [deviation] Git identity, found at task 7's commit step and outside the plan:
  the merged git config resolved `user.name`/`user.email` to the RETIRED
  `VintageTechie <john@vintagetechie.com>` from `file:/home/john/.gitconfig`,
  with no repo-local override. Fixed in the narrowest scope covering this repo:
  `user.name`, `user.email`, `user.signingkey` (693AB15F91734B0C) and
  `commit.gpgsign` pinned in `.git/config` (untracked, rides no commit). The
  global file was left alone - see Open items. (5f16c51)

## Open items

- `/home/john/.gitconfig` still sets the retired `VintageTechie
  <john@vintagetechie.com>` identity, so every repo without a local override
  inherits it. This repo is now pinned; no other repo is. Outside this phase's
  file lease, so reported rather than done.
- Task 2's live-walk check is human-verify and needs the plugin reinstalled from
  this branch (`/cad-verify` resolves the prose through `${CLAUDE_PLUGIN_ROOT}`):
  build a scratch phase with 9 read-only-command items + 1 destructive item, run
  `/cad-verify <N>`, expect the turn to end asking about exactly 1 item with a
  9-row results table above it and `grep -c "^source: model"
  .planning/phases/<N>/UAT.md` -> `9`.
- AC6 is proved at the seam and in the workflow prose, but the phase's own
  `/cad-audit` gate cannot be observed end-to-end from this branch until the
  plugin is reinstalled (D-17) - `skills/cad-audit/SKILL.md` also resolves
  through `${CLAUDE_PLUGIN_ROOT}`. Shares the reinstall with the item above.
- `detect-commands --root /data/code/cadence` returns `lint: null, typecheck:
  null` (no package.json at repo root); static analysis for this phase was the
  project's own `npx tsc -p tsconfig.ci.json`, run per task and clean.

### From the `diff` review (advisory gate, `cad-reviewer-xhigh` over `1304ecd..HEAD`)

Eleven findings, none blocking at this gate. The four `high` ones each carry a
reproduced fixture and are the substantive ones to settle at verify:

- `version_drift`'s comparand is `activeVersion()`, a first-version-token scan
  over the free prose of `PROJECT.md ### Active`. An Active section naming the
  predecessor before the current milestone reports the predecessor and hard-FAILs
  the gate on correct docs. This repo's `PROJECT.md:103-104` is one clause
  reorder from that state. (`planning.mjs:998`)
- The interrupted-close exemption is `derivePhases(...).every(complete)`, but
  `milestone.md:82-83` sanctions closing with rolled-over work, and a UAT holding
  a `blocked` item can never derive complete (`planning-files.mjs:1097`). Drift
  then fires in the state `audit.md:159-161` declares exempt, with a remedy
  `verify.md:158` says is impossible. (`planning.mjs:1007`)
- `verify.md:151` treats `why_human` as proof an item is human-only, but
  `cad-verifier-contract/SKILL.md:184-186` writes it for every UNCERTAIN truth
  too. Model-executable checks therefore route to the one-at-a-time ask - the
  exact defect FRI-01 targets. (`verify.md:151`)
- The one-round cap lives only in `triage-gate.md`, which the `risk_surface`
  fire sites never read: `task.md` and `debug.md` never mention the file,
  `execute.md:286` restates the blocking arm inline with no cap, and every
  "RE-READ triage-gate.md" instruction is scoped to the `adjudicated` arm. The
  bound does not reach the one trigger that is blocking at every stakes level.
  (`triage-gate.md:14`)

Also raised, lower severity: `readTags` discovers upward so a non-repo project
inherits an enclosing repo's tags (`planning.mjs:1004`); the ROADMAP title is
only read when Active names no version, so a stale title stays invisible
(`planning.mjs:999`); `if (source !== 'user')` can write a provenance but never
clear one, so a user re-record inherits `source: model` (`planning.mjs:598`);
the `UAT_SOURCES` enum is enforced on `uat record` but not on the `uat init` /
`uat refresh` payload face (`planning.mjs:514`); the narrowed re-arm has no
"could not be evaluated" arm, so a `maxTurns`-truncated reviewer reads as
"nothing survived" (`triage-gate.md:23`); two `land-cleanup` comments cite
`triage-gate.md:34`, now stale by 21 inserted lines (`land-cleanup.mjs:103`);
and `maxTurns: 400` has a consumer-side truncation arm only for the executor
family (`agents/cad-reviewer.md:8`).

## Goal check

The three legs of the goal are each shipped and each verified at the seam, but
only two of them are verified where the user actually meets them. Leg 3 is the
strongest: `cmdAudit` emits `version_drift` from real tags with 6 tests on a
tagged scratch repo including the #87 `v2.4.0` pin, the full suite is 1367 pass
0 fail, and `audit.md` carries it in §2, §3 and §4 (`grep -n version_drift
cadence-core/workflows/audit.md` -> lines 39, 104, 121, 144), so the gate both
computes and acts on it. Leg 2's bound is real in `triage-gate.md` (fd46412) and
the `maxTurns: 400` frontmatter is on all 19 agents (`grep -c "^maxTurns:"` -> 1
each, e8b949b), but the review's fourth finding is the honest gap: the capping
text sits in a file the `risk_surface` fire sites do not load, so the trigger
that is blocking at every stakes level is the one the cap may not reach. Leg 1's
mechanical half is done (4 tests, `templates/UAT.md` and `verify.md`
regenerated), yet its actual claim - that the walk stops interrogating the user
with commands the model can run - is unproven from this branch: the walk resolves
through `${CLAUDE_PLUGIN_ROOT}`, so it needs the reinstall named in Open items,
and the review's third finding argues the bar's predicate (`why_human`) is
broader than the one `verify.md` assumes, which would send model-executable items
to the ask anyway. Nothing here is missing from the commits; what is missing is
end-to-end observation of legs 1 and 2 and a decision on the four high findings,
all of which belong to `/cad-verify 2`.
