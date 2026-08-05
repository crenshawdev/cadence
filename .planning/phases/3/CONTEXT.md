# Phase 3: The surfaces that are always on, and the ratchet that watches them - Context

Gathered: 2026-08-05
Feeds: /cad-plan 3

## Scope boundary

In: The `description:` lines of the 29 `cad-*` skills and the 19 rung-agent
files - the bytes that ride the system prompt of every session in every
project - cut to one routing line each; `cadence-core/references/**` and
`cadence-core/templates/**` brought under the weight budget that already
ratchets workflows, skills and agents; and the walker defect that let an
unreadable descendant hide an entire subtree fixed in both copies.

Out: Trimming the CONTENT of any reference or template (they are budgeted at
their current size, not shortened). The `effort:` frontmatter, `tools:`,
`disallowedTools:`, `skills:`, the agent bodies and `lib/rung-agent.mjs` - the
rung map itself is untouched. `references/COMMANDS.md` is not restructured.

Deferred: None.

Plan shape: one plan.

## Durable decisions

- D-01 (the walked set is `**`, not the ROADMAP's narrower spelling): the
  budget covers every file under `cadence-core/references/` and
  `cadence-core/templates/`, matching REQUIREMENTS.md's `**` rather than
  ROADMAP SC3's `references/*.md` + `templates/*`. That brings all 23 files
  under the cap including `references/model-hints.json` (2,635 B) and
  `templates/config.json` (1,554 B). Rejected: the ROADMAP literal, which
  would leave a 2,635 B file inside a named directory capped by nothing - the
  same defect BUD-02 was written against, in miniature; and `*.md` only, which
  is a cleaner rule but drops two files. Accepted cost: a `model-hints.json`
  update now trips a prose ratchet. Evidence: `.planning/REQUIREMENTS.md:28`,
  `.planning/ROADMAP.md:67`, `cadence-core/bin/review-provider.mjs` (the
  `model-hints.json` reader); both directories are flat, no subdirectories.
- D-02 (new entries pin at exact current bytes; no reference prose is
  trimmed): every new budget entry equals its file's byte count as it stands,
  matching all 69 existing entries, so `references/acceptance-criteria.md` is
  budgeted at 22,506 B - larger than the largest budgeted workflow
  (`workflows/config.md` at 18,541 B) - and a capture item is filed against
  it. Rejected: pinning with headroom, which would re-create the
  pre-approved-growth hole in 22 fresh entries at once (a larger version of
  the 2-byte `plan.md` drift phase 1 found); and splitting
  `acceptance-criteria.md` first, which turns a budget phase into a 145 KB
  prose edit. Evidence: `cadence-core/bin/weight-budgets.json` (69/69 exact
  fits, 0 slack, 0 orphans measured), `.planning/REQUIREMENTS.md:28`.
- D-03 (the disambiguating negative clauses survive the trim, compressed):
  `cad-health`'s "Not a traceability audit (that is /cad-audit)",
  `cad-docs-verify`'s "Reports; it does not rewrite docs" and `cad-land`'s
  "Never decides how you publish" stay inside the one line rather than being
  deleted for bytes. Nothing else disambiguates confusable commands at
  selection time: `references/COMMANDS.md` carries its own phrasing but is
  `@`-included only by `skills/cad-help/SKILL.md:15`, so it is not in context
  when a routing choice is made. Rejected: moving the disambiguation into
  COMMANDS.md (turns always-on bytes into on-demand bytes, but leaves the
  routing choice blind) or into each SKILL.md body (pays only when the command
  runs, but grows a weighed surface). If wrong, `/cad-health` gets selected for
  a traceability audit and no check in the repo notices. Evidence:
  `skills/cad-health/SKILL.md:3`, `skills/cad-audit/SKILL.md:3`,
  `skills/cad-docs-verify/SKILL.md:3`, `skills/cad-land/SKILL.md:3`,
  `cadence-core/references/COMMANDS.md:38,49`.
- D-04 (trigger-word survival is recorded, not checked): AC1's "still contains
  its discoverability trigger words" is discharged by a before/after word list
  in the phase record. No new self-verify check is added, because no check
  reads a `description:` line today and adding one would constrain wording
  forever. Rejected: a check asserting each description is one line under a
  byte cap (structural, but a permanent wording constraint), and per-skill
  trigger-word assertions (29 hand-maintained sets that go stale whenever a
  command's scope shifts). Accepted cost: a later drift back to two-sentence
  descriptions is caught by nothing but the byte budget, which permits any
  wording under the cap. Evidence: `grep -n "description"
  cadence-core/bin/self-verify.mjs` returns nothing; the only frontmatter keys
  any check reads are `tools:`, `disallowedTools:`, `skills:`, `name:` and
  `effort:` (`self-verify.mjs:586-725`).
- D-05 (all 19 agent files, with a role noun kept in the six base ones): AC2's
  "routed rung-agent" covers the six unsuffixed `agents/<role>.md` files too,
  since each is itself a rung in the map - `cad-assumptions-analyzer` is the
  `xhigh` rung and its `-high` sibling the lower one. The 13 suffixed lines
  (2,292 B) become one clause; the 6 base lines (1,180 B) become a rung clause
  plus a short role noun, so a `{ok:false}` fallback dispatch - which names the
  base agent explicitly - stays intelligible. Rejected: cutting only the 13
  suffixed files (leaves 1,180 B of role prose AC2 was written to remove), and
  a uniform one clause across all 19 (strips the role noun the fallback needs).
  Evidence: `cadence-core/bin/lib/rung-agent.mjs:34-68` (`RUNG_FILES` names the
  unsuffixed file as a rung for all six roles), `INTERNALS.md:11`,
  `cadence-core/references/seams.md:98-135`.
- D-06 (both walkers are fixed, not just the one AC4 names): `entries()` in
  `lib/surface-weight.mjs` AND `mdFiles` in `self-verify.mjs` carry the same
  defect in two copies. Fixing only the reporting seam would leave the
  ENFORCING seam pointing a maintainer at the wrong path: measured live on a
  mode-000 fixture, self-verify emits exactly
  `{"kind":"unreadable-surface","file":"skills","detail":"EISDIR"}` - naming a
  directory that is perfectly readable, with the errno from a failed
  `readFileSync` rather than the EACCES that actually occurred, and never
  naming `skills/private`. Rejected: fixing `entries()` only and recording
  `mdFiles` as accepted, which AC4's letter permits. Evidence:
  `cadence-core/bin/self-verify.mjs:183-189` (the `yield d; continue;`
  fallback), `.planning/CAPTURE.md` phase-4 item (three converging reviewers).
- D-07 (the walker stops at symlinked directories): the dirent-based recursion
  that fixes `entries()` also stops it following symlinked DIRECTORIES, since
  `isDirectory()` is false for a symlink. That is a behavior change beyond
  AC4's letter and it is taken deliberately: measured, a `skills/a/loop -> ..`
  cycle today yields 41 counted surfaces of one 2-byte file, and stopping
  makes `surface-weight.mjs:47-49`'s existing claim ("a symlink cycle ... is
  silently skipped") true for the first time - it holds only for FILE links
  today, via `isFile()` at `:27-33`. A cycle row joins the existing
  dangling-link row in `weight.test.mjs` so the new behavior is pinned rather
  than incidental. Rejected: keeping the follow and recording the duplication
  as accepted, which leaves the measurement inflatable 40x. Evidence:
  measured with `weight.mjs --root <fixture>`; `weight.test.mjs:57-85` covers
  dangling and cyclic FILE links only.
- D-08 (the closing measurement leads with turn-one totals, not the weighed
  total): the weighed total GREW this cycle - 246,127 B over 69 surfaces at
  `0bf6284` against 259,048 B at the phase-2 close, +12,921 B - because phases
  1 and 2 moved prose INTO weighed workflow and skill files while cutting what
  loads in turn one, and this phase adds ~162 KB more as new coverage. So AC6's
  closing measurement reports per-command turn-one totals against D-19's
  baseline as the headline (the cycle's actual result), with the weighed total
  reported separately and the reference/template entries called out as new
  coverage rather than growth. Rejected: the weighed total as the headline,
  which closes the milestone on a number showing a ~5% regression the cycle's
  real win never appears in; and a two-way already-budgeted/newly-budgeted
  split, which is honest but still leads with the wrong quantity. Evidence:
  both totals measured with `weight.mjs --root` at `0bf6284` and at HEAD;
  `.planning/phases/2/CONTEXT.md:214-223` (D-19).

## Decisions

- D-09 (the baseline is pinned to one measurement convention): the 5,078 B
  figure means the `description:` VALUE as written, including its surrounding
  quotes, plus one newline, summed over the 29 `skills/cad-*/SKILL.md` files -
  reproducible exactly as `grep -h "^description:" skills/cad-*/SKILL.md | sed
  's/^description: //' | wc -c`. Two other conventions give different numbers
  for the same unedited tree (4,991 without quotes; 5,455 for full lines), so
  the convention is stated rather than assumed. Phase 1's `f895731` moved an
  AGENT description only, so its "re-capture the baseline" note applies to the
  19 agent lines, not these 29. Evidence: `.planning/ROADMAP.md:65`,
  `.planning/phases/1/PLAN.md:677`, commit `f895731`.
- D-10 (the six contract skills are not edited): the `cad-*-contract`
  descriptions are already single routing lines totalling 567 B (90-103 B
  each, against `cad-milestone` at 282 B), so the cut lands on the 23
  user-facing skills carrying the remaining 4,511 B. Editing them would churn
  six compliant lines and six budget entries for no measured gain. Evidence:
  `skills/cad-executor-contract/SKILL.md:3` and the same shape in the other
  five contract skills.
- D-11 (budgets regenerate in the same commit as the edit): unchanged from
  phase 1's D-17 and phase 2's D-20, restated because BUD-01's second sentence
  turns on it - all 69 weighed surfaces sit at EXACTLY their budget today with
  no slack and no orphan keys, and `self-verify.mjs:515` checks `bytes >
  budget`, a ceiling, so a shrunk file left unregenerated stays green over
  pre-approved headroom. Evidence: measured 69/69 exact fits against
  `weight-budgets.json` and `weight.mjs`.
- D-12 (the agent rewrite touches `description:` and nothing else): `effort:`,
  `tools:`, `disallowedTools:`, `skills:`, the body template and `RUNG_FILES`
  stay byte-identical, because three blocking checks read exactly those -
  check 7 `agent-carries-behaviour` holds the body against a canonical
  template. Evidence: `cadence-core/bin/self-verify.mjs:642-660`, `:668-675`
  (7b `rung-effort-mismatch`), `:692-725` (7c `verifier-write-grant`).
- D-13 (the narrowing claim is corrected in four places and its test is
  INVERTED, not deleted): `weight.test.mjs:35-44` currently asserts
  `!paths.some(p => p.startsWith('cadence-core/references/'))` under the name
  "D-02 narrowing" - it must assert the opposite rather than disappear, so the
  new coverage is pinned by a row. Three prose sites state the same narrower
  set and move with it: `lib/surface-weight.mjs:8-12`, `weight.mjs:3-8`,
  `METHOD.md:581-583` ("weighs every agent, skill and workflow surface"). A
  fourth, `self-verify.mjs:429-431`, justifies check 10's scope with
  "references/ is outside lib/surface-weight.mjs's weighed walk, so no other
  check reaches it at all" - that justification stops being true.
- D-14 (the self-verify fixtures need no new budget entries): the fixtures
  that write `cadence-core/references/config-reach.md` either supply no
  manifest at all - so check 4 skips entirely (`self-verify.mjs:499`) - or
  assert on a filtered problem KIND rather than on `ok` or a problem count.
  Evidence: `self-verify.test.mjs:41-57` (`reachFixture`), `:164-195`
  (`fullFixture`), and its rows at `:472,484,520,530,539,809,1185`.
- D-15 (the lib stays silent, self-verify stays loud): the `entries()` fix
  preserves the existing split contract - the library returns the readable
  siblings and says nothing about the entry it could not read, while
  `self-verify.mjs:509-519` remains the half that reports it. Making the lib
  throw or report would break `weight.mjs`'s one-JSON-line seam contract and
  turn one unreadable file into two problems plus a non-zero exit from a
  reporting seam. Evidence: `cadence-core/bin/lib/surface-weight.mjs:14-20`,
  `:44-52`.
- D-16 (no stored baseline file): AC6's comparison is recomputed, not trusted -
  `git archive 0bf6284 | tar -x -C <tmp>` then `weight.mjs --root <tmp>`
  reproduces 69 surfaces at 246,127 B, and the same method reproduces
  references + templates at 156,572 B pre-phase-1, which is BUD-02's "156KB"
  figure (the same set measures 162,186 B today, after phase 2 added
  `git-guard.md`, `git-publish.md` and `triage-gate.md` and deleted `git.md`).
  A number transcribed into prose is the stale-transcription defect this repo
  has closed repeatedly. Evidence: `cadence-core/bin/weight.mjs:22-26` takes
  `--root`.

## Acceptance criteria

- [ ] AC1: `grep -h "^description:" skills/cad-*/SKILL.md | sed 's/^description: //' | wc -c`
      returns a number below 5078; all 29 values are a single line each; the
      six `cad-*-contract` descriptions are byte-identical to their current
      text; and the phase record carries a before/after trigger-word list for
      each of the 23 edited skills showing no trigger word dropped.
- [ ] AC2: Each of the 19 `agents/*.md` descriptions is one clause naming its
      rung and that it is routed rather than user-selected, with the six
      unsuffixed files additionally carrying a short role noun; and the phase
      diff shows no change to any `effort:`, `tools:`, `disallowedTools:` or
      `skills:` line, to any agent body, or to
      `cadence-core/bin/lib/rung-agent.mjs`.
- [ ] AC3: `node cadence-core/bin/weight.mjs` lists every file under
      `cadence-core/references/` and `cadence-core/templates/`;
      `weight-budgets.json` carries an entry for each equal to its exact byte
      count; and the budget-equality one-liner prints `budgets exact`
      tree-wide.
- [ ] AC4: On a fixture holding `skills/private/` at mode 000 beside a
      readable `skills/good/SKILL.md`, `node cadence-core/bin/weight.mjs --root
      <fixture>` lists `skills/good/SKILL.md` in `surfaces`; on a fixture
      holding a `skills/a/loop -> ..` symlink cycle it reports one
      `skills/a/SKILL.md` surface rather than 41; and `weight.test.mjs` carries
      a row pinning each.
- [ ] AC5: On that same mode-000 fixture, `node cadence-core/bin/self-verify.mjs`
      names `skills/private` - the path that is actually unreadable - with an
      EACCES-derived detail, rather than naming `skills` with `EISDIR`.
- [ ] AC6: `node --test cadence-core/bin/*.test.mjs` and `node
      cadence-core/bin/self-verify.mjs` both pass, and the phase record carries
      the closing measurement as per-command turn-one totals against D-19's
      baseline, with the weighed total reported separately and the
      reference/template entries called out as new coverage rather than growth.

## Flagged assumptions

- Whether Claude Code lists a skill carrying `user-invocable: false` in the
  session system prompt at all - Unclear; if wrong, the six `cad-*-contract`
  descriptions (567 B of the 5,078 baseline) are agent-preload bytes rather
  than always-on ones, which changes what D-09's baseline is measuring but not
  what D-10 does about it. Nothing in `skills/`, `agents/` or
  `cadence-core/bin` answers it; `self-verify.mjs:617` only knows that
  `disable-model-invocation: true` makes a skill unpreloadable.
- Whether host skill selection degrades when a description drops from two or
  three sentences to one line - Unclear; AC1's whole trigger-word premise is
  about the host's matching behavior, no Cadence code reads a description, and
  the repo cannot falsify it either way. D-03 and D-04 are the hedges.
- Whether every registered agent's description rides the main session prompt
  for PLUGIN-provided agents - Likely; `INTERNALS.md:11` asserts it and BUD-01
  rests on it, but no in-repo artifact can confirm it. If wrong, AC2's cut is
  real but buys nothing in the always-on budget.
- Whether `description:` is required frontmatter for a Claude Code agent or
  skill - Unclear; it bounds the maximum possible cut (a very short line versus
  omitting the key entirely), and no schema in this repo governs those files.
