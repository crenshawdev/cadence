---
phase: 2
plan: 1
requirements:
  - LOD-01
  - LOD-02
  - LOD-03
  - LOD-04
  - LOD-05
files:
  - cadence-core/references/git.md
  - cadence-core/references/git-guard.md
  - cadence-core/references/git-publish.md
  - cadence-core/references/triage-gate.md
  - cadence-core/references/review-triggers.md
  - cadence-core/references/seams.md
  - cadence-core/references/config-reach.md
  - cadence-core/workflows/task.md
  - cadence-core/workflows/phase.md
  - cadence-core/workflows/coverage.md
  - cadence-core/workflows/context.md
  - cadence-core/workflows/milestone.md
  - cadence-core/workflows/verify.md
  - cadence-core/workflows/plan.md
  - cadence-core/workflows/undo.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/new-project.md
  - cadence-core/workflows/config.md
  - cadence-core/workflows/config-review.md
  - cadence-core/workflows/progress.md
  - cadence-core/workflows/debug.md
  - cadence-core/workflows/docs-verify.md
  - cadence-core/workflows/verify-sweep.md
  - skills/cad-land/SKILL.md
  - skills/cad-milestone/SKILL.md
  - skills/cad-pause/SKILL.md
  - skills/cad-phase/SKILL.md
  - skills/cad-undo/SKILL.md
  - cadence-core/bin/git-guard.mjs
  - cadence-core/bin/git-guard.test.mjs
  - cadence-core/bin/git-segments.test.mjs
  - cadence-core/bin/git-branch.mjs
  - cadence-core/bin/git-publish.mjs
  - cadence-core/bin/land-cleanup.mjs
  - cadence-core/bin/land-cleanup.test.mjs
  - cadence-core/bin/lib/git-segments.mjs
  - cadence-core/bin/lib/dispatch-phrasing.mjs
  - cadence-core/bin/weight-budgets.json
  - INTERNALS.md
  - METHOD.md
  - CHANGELOG.md
---

# Phase 2: References load where they are used - Plan

## Goal

A command stops paying, in turn one, for prose that only one of its branches
reads. Every site is judged against the break-even test rather than
blanket-converted: `references/git.md` splits along the rail the reader
actually needs, the triage gate becomes its own small file three workflows
re-read instead of a 15.7KB one, the `conventions.md` parentheticals stop
pointing at a file nobody loads, and each surviving eager `@`-include carries a
stated reason.

## Must be true when done

- A `/cad-phase`, `/cad-pause`, `/cad-undo` or `/cad-milestone` run loads the
  guard rails and nothing else: each `<execution_context>` names
  `references/git-guard.md` and no other reference, and
  `cadence-core/references/git.md` no longer exists in the tree.
- `/cad-land` still holds the commit guard in turn one and reaches the publish
  rails where it acts on them: step 4b reads `references/git-publish.md`
  instead of having carried it since the first token.
- An adjudicated review's triage gate is a structured multi-select the user
  taps - `AskUserQuestion` with `multiSelect: true`, at most four options per
  call, NONE first and the default - and no surface under `cadence-core/`
  still mandates open-ended prose for it.
- The three workflows that re-read the triage gate open a ~2KB reference
  instead of the 15.7KB one, at every one of their five citation sites, and
  `review-triggers.md` § 6 is a pointer rather than a second copy.
- A repo that opted into `git.auto_close` still gets the triage prompt at
  `plan`, `diff` and `phase_diff`: the suppression reads as scoped to
  `pre_ship` inside `/cad-land`'s unattended close, which is the only place
  `land-cleanup.mjs gate` runs.
- Reading a workflow's parallel-work or batch-asks instruction needs no second
  file: `grep -n "conventions.md" cadence-core/workflows/*.md` returns nothing,
  each cited rule reads whole where it applies, and `conventions.md` is
  `@`-included nowhere in the plugin.
- Every eager `@`-include in `skills/` carries a stated keep-or-move reason,
  `/cad-config`'s catalog states in its own text that it is transcribed rather
  than derived, and `weight-budgets.json` equals the measured bytes of every
  surface this phase touched.

## Context

CONTEXT decisions D-01 through D-20 are locked and each has a task below.
Transport by default: bytes move and load later, content is preserved. The
milestone's one deliberate behaviour change lands in task 4 (the adjudicated
arm stops mandating prose). Out of scope: skill and rung-agent descriptions and
putting `references/**` under the budget (both phase 3); deferring `/cad-land`'s
guard include; moving workflow rationale to design-notes.

Two shipped checks bound almost every task. `self-verify.mjs` check 3/3b exits
1 on a `${CLAUDE_PLUGIN_ROOT}` path or a backticked `INTERNALS.md` repo path
that does not resolve, so a file is never deleted before the last citation
moves; check 1b (`inert-config-key`) exits 1 when a schema key is named by no
prose in the walked tree, which is why D-13 forbids trimming a sentence during
the split. `weight-budgets.json` pins each budgeted surface at exactly its
current bytes, so every edit to a workflow or SKILL.md regenerates it in the
same commit (D-20).

## Tasks

### Task 1: The two guard files exist, and the worktree paragraph joins the rule it belongs to

- **Files:** cadence-core/references/git-guard.md,
  cadence-core/references/git-publish.md, cadence-core/references/seams.md
- **Action:** Create `cadence-core/references/git-guard.md` carrying, verbatim
  from `cadence-core/references/git.md`, the `## 1. Protected-branch guard`
  section (`:5-77`, i.e. everything except the `:78-89` worktree paragraph the
  last bullet of this task moves), `## 2. Atomic conventional commits`
  (`:91-96`), `### What the guard sees` (`:124-149`, promoted to a `##`
  heading), and `## 4. Risk surfaces` (`:183-188`). Title it `# Git rails: the
  guard` with a one-line lead saying rail 3 (never auto-push, and what the
  guard consequently does NOT see) lives in `references/git-publish.md`.
  `What the guard sees` travels here rather than following its physical nesting
  under rail 3 because it opens on "Both rails read one function" and documents
  rail 1's commit guard as much as rail 3's push guard (D-01); place it after
  rail 2 with a one-clause lead saying it governs the commit rail here and the
  push rail in `references/git-publish.md`. Keep the rail NUMBERS exactly as
  they are - `## 1.`, `## 2.`, `## 4.`, with no `## 3.` in this file. Do not
  renumber 4 to 3: sixteen prose and code citations name rails by number and
  task 3 repoints them by FILE, so a renumber would silently redirect every one
  of them. Create `cadence-core/references/git-publish.md` from `## 3. Never
  auto-push` (`:97-123`) and `### What the guard does NOT see (rail 3)`
  (`:150-182`), keeping the `## 3.` number, titled `# Git rails: publishing`,
  opening with one line pointing back to `references/git-guard.md` for rails 1,
  2 and 4 and for the `What the guard sees` grammar whose complement this
  file's silences are. Copy sentences; do not paraphrase, condense or drop one
  (D-13): `git.protected_branches`, `git.on_protected`, `git.base_branch`,
  `git.integration_branch`, `git.auto_branch`, `git.auto_close`,
  `git.on_land_cleanup` and `planning.commit_docs` each have their sole or
  near-sole prose reader in this file, and a trimmed sentence comes back from
  self-verify as `inert-config-key` rather than as a lost sentence. Do NOT
  delete `cadence-core/references/git.md` here - task 3 deletes it in the
  commit that moves the last citation, so the tree never holds a citation to a
  file that does not exist. Then move `git.md:78-89` (the `worktree.baseRef`
  fork-point paragraph) into `references/seams.md` § spawn-agent **Worktree
  isolation** (D-02): MERGE, do not append - `seams.md:57-64` already states
  that Cadence issues no `git worktree add` and pins no fork point per
  dispatch, and `:65-73` already explains `fresh` and `head`. Carry over only
  what seams.md does not already hold, which is the `git.base_branch`
  distinction: it stays the landing and guard base, distinct from the
  integration branch, which is what work merges back down to rather than a
  claimed worktree fork point. Drop the paragraph's `references/git.md`
  cross-citation with it, and drop no other sentence without re-running
  self-verify to prove no key went inert.
- **Verify:** `wc -c cadence-core/references/git-guard.md
  cadence-core/references/git-publish.md` shows roughly 6,000 and 4,450 bytes;
  `grep -c '^## ' cadence-core/references/git-guard.md` returns 4 (title lead
  aside: headings 1, 2, What the guard sees, 4) and `grep -c '^## 3\.'
  cadence-core/references/git-guard.md` returns 0; `grep -c '^## 3\.'
  cadence-core/references/git-publish.md` returns 1; `grep -n
  'git.base_branch' cadence-core/references/seams.md` shows the merged
  sentence; `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`.

### Task 2: The eager map - four skills take the guard only, cad-land reads publish where it publishes

- **Files:** skills/cad-phase/SKILL.md, skills/cad-pause/SKILL.md,
  skills/cad-undo/SKILL.md, skills/cad-milestone/SKILL.md,
  skills/cad-land/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** In `skills/cad-phase/SKILL.md:24`, `skills/cad-pause/SKILL.md:21`,
  `skills/cad-undo/SKILL.md:24` and `skills/cad-milestone/SKILL.md:27`, change
  the `@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git.md` line to
  `.../references/git-guard.md`. Add `git-publish.md` to none of them (D-03):
  `/cad-milestone` reads `git.auto_close` and chains into `/cad-land`, but
  `cadence-core/workflows/milestone.md:66-67` already restates the rail-3
  policy inline ("do NOT push it - publishing the tag is /cad-land's
  decision"), so guard-only loses no rule. In `skills/cad-land/SKILL.md:21`
  make the same swap - the guard stays eager because steps 1, 2 and the triage
  commits all use rails 1-2 - and at step 4b insert, as its own bullet before
  the "Publish the branch (GitHub arm)" bullet, an instruction to Read
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/git-publish.md` first: the
  publish rails and the `git.auto_close` policy apply from here on and this
  skill no longer preloads them. Write the cost honestly in that bullet's own
  wording, because task 9's break-even rule is a two-clause AND and this read
  satisfies the second clause plainly (only the publishing arms reach it) while
  the first needs stating: step 4a ends the turn on the publish-mechanism ask,
  so the Read is the first tool call of the turn that begins with the user's
  answer - it adds one tool round-trip INSIDE a turn `/cad-land` was already
  taking, not a new turn, and only on the arms that publish. That is the trade
  D-03 accepts: ~3 KB off turn one of every `/cad-land` run against one extra
  round-trip on the publish path alone. Do not claim the read is free. Repoint cad-land's four bare citations with
  the `references/` prefix so none can read as the executable of the same name
  (D-12): `:34` "(git.md's fallback)" and `:41` "(git.md)" become
  `references/git-guard.md`, `:54` "(references/git.md)" becomes
  `references/git-guard.md`, and `:91` "(git.md rail 3 never auto-pushes)"
  becomes `references/git-publish.md` rail 3. In `skills/cad-pause/SKILL.md:28`
  change "references/git.md" to "references/git-guard.md"; leave its
  `conventions.md` include alone, task 7 drops it. Regenerate every changed
  SKILL.md's entry in `cadence-core/bin/weight-budgets.json` in this same
  commit (D-20) - each of these files sits exactly at its budget today, so an
  addition overruns and a deletion leaves phase 3 pre-approved headroom.
- **Verify:** `grep -rn "references/git.md" skills/` returns nothing;
  `grep -c "git-publish" skills/cad-phase/SKILL.md
  skills/cad-pause/SKILL.md skills/cad-undo/SKILL.md
  skills/cad-milestone/SKILL.md` returns 0 for all four while
  `grep -c "git-publish.md" skills/cad-land/SKILL.md` returns at least 1;
  `node cadence-core/bin/self-verify.mjs` prints `"problems":[]` (its check 3
  is what proves the five include paths resolve); and the budget-equality
  one-liner `node -e 'const{execFileSync}=require("child_process"),fs=require("fs");const
  w=JSON.parse(execFileSync("node",["cadence-core/bin/weight.mjs"],{encoding:"utf8"})).surfaces;const
  b=JSON.parse(fs.readFileSync("cadence-core/bin/weight-budgets.json","utf8")).budgets;const
  bad=w.filter(s=>b[s.surface]!==s.bytes);console.log(bad.length?JSON.stringify(bad):"budgets
  exact")'` names no file this task edited.

### Task 3: Every rail citation names the file that now holds it, and git.md is deleted

- **Files:** cadence-core/workflows/task.md, cadence-core/workflows/phase.md,
  cadence-core/workflows/coverage.md, cadence-core/workflows/context.md,
  cadence-core/workflows/milestone.md, cadence-core/workflows/verify.md,
  cadence-core/workflows/plan.md, cadence-core/workflows/undo.md,
  cadence-core/workflows/execute.md, cadence-core/workflows/new-project.md,
  cadence-core/references/seams.md, cadence-core/references/config-reach.md,
  INTERNALS.md, METHOD.md, cadence-core/bin/git-guard.mjs,
  cadence-core/bin/git-guard.test.mjs, cadence-core/bin/git-segments.test.mjs,
  cadence-core/bin/git-branch.mjs, cadence-core/bin/git-publish.mjs,
  cadence-core/bin/land-cleanup.mjs, cadence-core/bin/lib/git-segments.mjs,
  cadence-core/bin/lib/dispatch-phrasing.mjs, cadence-core/references/git.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Repoint every remaining `git.md` citation to the file that now
  holds its rail, then `git rm cadence-core/references/git.md` in this same
  commit. To `references/git-guard.md`: `task.md:3` (the "git.md rail-1 guard"
  phrase), `task.md:23` (the `${CLAUDE_PLUGIN_ROOT}` Read path), `task.md:48`
  (rail 2), `phase.md:66`, `coverage.md:73`, `context.md:326` (rail 1),
  `milestone.md:124`, `verify.md:205`, `plan.md:265` (rail 1), `undo.md:28`
  (rail 1), `execute.md:50` (the `${CLAUDE_PLUGIN_ROOT}` path),
  `new-project.md:134` and `:337`, `seams.md:34` (the no-default
  protected-branch decision, rail 1), `config-reach.md:145` (the
  `planning.commit_docs` row - rail 2 is its reader), `METHOD.md:508` (the
  section is the protected-branch guard), `git-branch.mjs:4` (advises rail 1)
  and `land-cleanup.mjs:16` (the base-order comment). To
  `references/git-publish.md`: `INTERNALS.md:37` (the list of what the anchored
  reader misses - this one is ENFORCED, self-verify check 3b exits 1
  `missing-internals-path` on a backticked repo path that does not resolve, so
  deleting git.md without this edit fails CI), `METHOD.md:523` (rail 3's
  what-it-misses list), `git-guard.mjs:13`, `:69` and `:141` (all three are
  rail-3 push comments; `:141` is the user-facing ask string - no test asserts
  its text, but keep the rest of the sentence byte-identical),
  `git-guard.test.mjs:205`, `git-segments.test.mjs:7-8`, and
  `lib/git-segments.mjs:7`, `:22-23` and `:61`. Two sites are not a rename.
  `METHOD.md:608`'s table row reads "Branch guard and publish seam" and must
  now name BOTH files. `lib/dispatch-phrasing.mjs:79` cites "references/git.md
  and references/seams.md" as the two homes of the "Cadence issues no `git
  worktree add` ... pins no fork point per dispatch" false-positive sentence;
  task 1 moved that sentence wholly into seams.md, so this comment now cites
  `references/seams.md` alone. Also repair `git-publish.mjs:147`, which cites
  "rail 5" - a rail v2.2.0 deleted, so no file holds it: reword to name the
  Bash `git push` guard (`references/git-publish.md` rail 3) it actually means.
  Add the `references/` prefix or the `.md` extension to every citation you
  touch (D-12) so `git-guard`/`git-publish` never reads as
  `cadence-core/bin/git-guard.mjs` or `git-publish.mjs`. Leave `CHANGELOG.md`'s
  three `references/git.md` mentions (`:134`, `:166`, `:738`) untouched - they
  are dated entries describing the tree at a shipped release, which is why AC1's
  grep scope names `cadence-core/`, `skills/`, `agents/`, `INTERNALS.md` and
  `METHOD.md` and not the changelog. Regenerate `weight-budgets.json` for every
  budgeted surface this commit changed (the ten workflows).
- **Verify:** `grep -rn "references/git.md" cadence-core/ skills/ agents/
  INTERNALS.md METHOD.md` returns nothing and `ls
  cadence-core/references/git.md` fails; the BARE form is a separate search,
  since a surviving `git.md rail-1 guard` phrase points at a deleted file while
  the prefixed grep above reports clean - `grep -rn "[^-/]git\.md"
  cadence-core/ skills/ agents/ INTERNALS.md METHOD.md` returns nothing too
  (CHANGELOG.md is outside this scope by AC1 and stays untouched);
  `grep -rn "rail 5" cadence-core/`
  returns nothing; `node cadence-core/bin/self-verify.mjs` prints
  `"problems":[]`; `node --test cadence-core/bin/*.test.mjs` passes; task 2's
  budget-equality one-liner names no file.

### Task 4: The triage gate is its own reference, with a tapped multi-select and a scoped carve-out

- **Files:** cadence-core/references/triage-gate.md,
  cadence-core/references/seams.md
- **Action:** Create `cadence-core/references/triage-gate.md` holding the WHOLE
  of `review-triggers.md:172-196` - all three `### 6. Consequence (gate)` arms
  plus the closing `cad-verify` paragraph (D-04): `plan.md` branches across all
  three arms at one call site and `verify.md`'s gateless fire depends on the
  closing paragraph, so all four consumers must resolve their branch in exactly
  one file. Open it with one line restating the gate vocabulary - the gate is
  one of `off | advisory | blocking | adjudicated`, resolved from the routing
  bundle at `references/review-triggers.md` step 1 - as ~120 B of deliberate
  duplication rather than a pointer back, so this file stands alone (D-15).
  Rewrite the adjudicated arm's ask (D-05, closing the 2026-07-30 CAPTURE
  entry): the survivors are still a NUMBERED list, one line per survivor
  carrying severity, `file:line` and claim - a numbered list, not a table,
  because this file falls inside self-verify check 10's dispatch-phrasing scope
  and a table row is still evaluable as an imperative instruction (D-16) - and
  the ask is `AskUserQuestion` with `multiSelect: true`. Get the arithmetic
  right, because `conventions.md:47`'s `ceil(N/4)` counts a different unit:
  there N is QUESTIONS and four is the questions-per-call cap, while here the
  survivors are OPTIONS inside one question and NONE occupies one of the four
  option slots. So N survivors become `ceil(N/3)` multi-select questions - at
  most three survivors per question, NONE first in every one of them - and
  those questions batch up to four per `AskUserQuestion` call, which is where
  `conventions.md`'s rule does apply. State both numbers explicitly so neither
  is re-derived from the other. NONE stays the first option
  and the default; the turn still ends on the question; nothing is applied,
  committed, published or re-planned against a survivor the user did not name.
  Define the one answer shape the multi-select makes reachable and the prose
  form did not: if a question comes back with NONE selected TOGETHER with one
  or more survivors, the answer is contradictory and is not resolved by
  guessing which half the user meant - re-present that single question alone
  and take the second answer as final. Only that question re-asks; the rest of
  the batch stands.
  Delete the "open-ended prose, not `AskUserQuestion` (a subset of N items is
  not 2-4 exclusive options)" mandate outright - that binding is the sole
  stated reason the prose form existed and task 4 corrects it in seams.md in
  the same pass. Restate the `git.auto_close` carve-out as SCOPED (D-06,
  closing the open [high] at `.planning/CAPTURE.md:180`): at the `pre_ship`
  trigger, inside `/cad-land`'s unattended close only, the gate does not prompt
  - triage is NONE by construction and `land-cleanup.mjs gate`'s blocker/high
  halt is the only consequence. Say why the scope is load-bearing rather than
  stylistic: no other trigger and no other command reads that key, and
  `land-cleanup.mjs gate` does not run outside `/cad-land`, so suppressing the
  ask at `plan`, `diff` or `phase_diff` discards grounded survivors with
  nothing left to halt on them. Do not open a sentence in this file with a
  bare-form dispatch verb (dispatch, issue, fire, spawn, launch, send) inside a
  block that claims concurrency, and do not describe the batched calls as
  "parallel" or "concurrent" - self-verify check 10 runs on
  `cadence-core/references/` and would file `unbatched-dispatch`. Leave
  `review-triggers.md` untouched in this commit; task 5 converts its § 6 to a
  pointer when the consumers move, so the tree never cites a section that has
  become a stub. Then widen `references/seams.md:13`'s ask-user binding: a
  structured choice is the `AskUserQuestion` tool at up to four options per
  question, with `multiSelect: true` when more than one may be picked; a set
  larger than the option cap splits across questions (minus any always-present
  option such as NONE, which consumes a slot), and the questions batch up to
  four per call - the "2-4 mutually exclusive
  options" limit goes, since it is the stale binding that forced the prose
  fallback. Keep the two caps named as two caps: options per question, and
  questions per call. Collapsing them is what produced the wrong batch size. Leave the Recommended-option convention and the two deliberate
  no-default decisions below it exactly as they are.
- **Verify:** `grep -c "multiSelect" cadence-core/references/triage-gate.md`
  returns at least 1; `grep -n "ceil(N/3)"
  cadence-core/references/triage-gate.md` shows the survivors-per-question rule
  while `grep -n "ceil(N/4)" cadence-core/references/triage-gate.md` returns
  nothing (the wrong unit must not survive anywhere in this file);
  `grep -in "contradictory" cadence-core/references/triage-gate.md` shows the
  NONE-plus-survivors re-ask rule;
  `grep -rn "open-ended prose" cadence-core/references/triage-gate.md` returns
  nothing; `grep -n "pre_ship" cadence-core/references/triage-gate.md` shows
  the carve-out sentence naming `/cad-land`; `grep -n "mutually exclusive"
  cadence-core/references/seams.md` returns nothing; `node
  cadence-core/bin/self-verify.mjs` prints `"problems":[]` (proving the new
  reference clears the dispatch-phrasing check).

### Task 5: The five re-read sites, cad-land and the two seam comments name the new file; § 6 becomes a pointer

- **Files:** cadence-core/workflows/execute.md, cadence-core/workflows/plan.md,
  cadence-core/workflows/verify.md, cadence-core/references/review-triggers.md,
  skills/cad-land/SKILL.md, cadence-core/bin/land-cleanup.mjs,
  cadence-core/bin/land-cleanup.test.mjs,
  cadence-core/bin/weight-budgets.json
- **Action:** Repoint all five citation sites (D-14) to
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md`, keeping each
  site's existing "since this workflow does not preload it" clause:
  `execute.md:167-169` (the `diff` arm), `plan.md:230-232` (the `plan` review
  step) and `verify.md:197-199` (the gateless fix-list fire) each currently
  say RE-READ `review-triggers.md` § 6 Consequence. The two further sites on
  execute.md's PARALLEL path - `:235` and `:246`, which name
  "references/review-triggers.md § 6 Consequence, NONE the default" with no
  read instruction at all - get the new file too, and each gains the same read
  instruction: otherwise a `diff` or `phase_diff` survivor is acted on against
  a section heading that no longer exists. In `skills/cad-land/SKILL.md:50-53`,
  the triage sub-step says review-triggers.md "is preloaded above, so read it
  there" - that stops being true, so point it at
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md` and instruct a
  Read at that step. cad-land KEEPS `review-triggers.md` eager: its every run
  fires `pre_ship`, so the file is consulted on every path and LOD-05's
  "a reference consulted on every path stays eager" applies; the triage file is
  the branch-only half and moves. Then convert `review-triggers.md` § 6 to a
  pointer: keep the `### 6. Consequence (gate)` heading and replace its body
  with one or two lines naming `references/triage-gate.md` as the file that
  holds all three arms and the `cad-verify` fix-list rule, so a reader arriving
  at step 6 is not left guessing. Update the two stale citations that pin the
  carve-out (AC4): `cadence-core/bin/land-cleanup.mjs:100-101` and
  `cadence-core/bin/land-cleanup.test.mjs:140` both cite
  `references/review-triggers.md:146`, a line number that was already stale -
  each must now name `references/triage-gate.md` and the line the carve-out
  sentence actually sits on, read off `grep -n` rather than estimated. Do not
  change what either seam DOES: `gate()` still reads the MERGED `git.auto_close`
  deliberately, and the comment explaining why the suppression and the halt are
  a matched pair stays. Regenerate `weight-budgets.json` for the three
  workflows and cad-land in this commit.
- **Verify:** `grep -rn "review-triggers.md" cadence-core/workflows/execute.md
  cadence-core/workflows/plan.md cadence-core/workflows/verify.md` shows only
  fire-site citations and no `§ 6` reference; `grep -c "triage-gate.md"
  cadence-core/workflows/execute.md` returns 3 and the same grep returns 1 each
  for `plan.md` and `verify.md`; `grep -n "triage-gate"
  cadence-core/bin/land-cleanup.mjs cadence-core/bin/land-cleanup.test.mjs`
  shows a file:line citation in each, and that line in
  `cadence-core/references/triage-gate.md` is the carve-out sentence; `node
  --test cadence-core/bin/*.test.mjs` passes; `node
  cadence-core/bin/self-verify.mjs` prints `"problems":[]`; task 2's
  budget-equality one-liner names no file.

### Task 6: The Parallel-work rule reads where it is used, in all thirteen workflows

- **Files:** cadence-core/workflows/coverage.md,
  cadence-core/workflows/config-review.md,
  cadence-core/workflows/progress.md, cadence-core/workflows/plan.md,
  cadence-core/workflows/debug.md, cadence-core/workflows/context.md,
  cadence-core/workflows/docs-verify.md, cadence-core/workflows/milestone.md,
  cadence-core/workflows/verify.md, cadence-core/workflows/phase.md,
  cadence-core/workflows/execute.md, cadence-core/workflows/verify-sweep.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Delete the bare `conventions.md` parenthetical at each of the
  thirteen § Parallel work citation sites - `coverage.md:24`,
  `config-review.md:21`, `progress.md:45`, `plan.md:55`, `plan.md:91`,
  `debug.md:36`, `context.md:76`, `docs-verify.md:27`, `milestone.md:8`,
  `verify.md:66`, `phase.md:49`, `execute.md:30`, `verify-sweep.md:22` - and
  leave the rule reading whole at each site (D-08, none becomes an include).
  Inlining here means the site's own prose carries BOTH halves of the rule, so
  no reader needs `conventions.md` to act: the independent, known-path,
  read-only calls go out as parallel tool calls in ONE message, and only a call
  that consumes a prior call's output is serialized. Most sites already state
  the first half in their own words ("Batch the independent reads in one
  message", "in ONE message ... not one provider at a time"); at those, add the
  serialize-only clause if it is absent and delete the citation. Do not paste
  the 611-byte `conventions.md` paragraph thirteen times - that would add ~8KB
  to workflows in a byte-cutting cycle and is not what the decision asks for;
  one clause carrying both halves is the whole operative rule, and the
  paragraph's examples are rationale the site does not need. Keep every
  co-cited reference: `config-review.md:21`'s parenthetical also names
  "seams.md concurrent dispatch" and that half stays. Watch self-verify check
  10 while editing these thirteen: an added sentence must not open with a
  bare-form dispatch verb inside a block claiming concurrency unless it also
  says "in one message", and the serialize-only clause should be phrased
  around "serialize" rather than around "dispatch", which is not in the check's
  verb set. Regenerate `weight-budgets.json` for all twelve edited workflows in
  this commit.
- **Verify:** `grep -n "conventions.md" cadence-core/workflows/coverage.md
  cadence-core/workflows/config-review.md cadence-core/workflows/progress.md
  cadence-core/workflows/plan.md cadence-core/workflows/debug.md
  cadence-core/workflows/docs-verify.md cadence-core/workflows/milestone.md
  cadence-core/workflows/verify.md cadence-core/workflows/phase.md
  cadence-core/workflows/execute.md cadence-core/workflows/verify-sweep.md`
  returns nothing; `context.md` is the thirteenth edit site and cannot join
  that list, because its `:139` and `:178` batch-asks citations are task 7's
  and still stand here - check it scoped instead, `grep -n "Parallel work"
  cadence-core/workflows/context.md` returns nothing while `grep -c
  "conventions.md" cadence-core/workflows/context.md` returns exactly 2;
  `grep -c "one message" cadence-core/workflows/plan.md`
  returns at least 2; `grep -n "seams.md concurrent dispatch"
  cadence-core/workflows/config-review.md` still matches; `node
  cadence-core/bin/self-verify.mjs` prints `"problems":[]`; task 2's
  budget-equality one-liner names no file.

### Task 7: The batch-asks and lazy-create rules read at their sites, and cad-pause stops paying 5,115 B for 266

- **Files:** cadence-core/workflows/context.md,
  cadence-core/workflows/new-project.md, skills/cad-pause/SKILL.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Inline the two remaining rules at their four sites and delete the
  citations. Batch-asks (`conventions.md:47-49`, 266 B) at `context.md:139`,
  `context.md:178` and `new-project.md:195`: each already states the batching
  in its own words, so what must read whole is the full rule - independent
  questions over an independent set batch into `ceil(N/4)` AskUserQuestion
  calls, up to four questions per call, and only a question whose wording
  depends on an earlier answer stays sequential. Add the missing second clause
  where it is absent, then drop the parenthetical. § Paths' lazy-create rule
  (`conventions.md:22-25`, 305 B) at `new-project.md:279`: state it at the site
  - the phase directory is `.planning/phases/<N>/` with the bare phase integer
  from ROADMAP.md (no zero-padding, no slug suffix), created lazily by the
  first skill that needs it and matched to an existing directory's name if one
  is present - then drop the citation. Then drop
  `skills/cad-pause/SKILL.md:22`'s `@`-include of `conventions.md`, the only
  one in the plugin: it pays 5,115 B for a single 266 B citation on a skill
  whose whole job is a WIP commit plus a cursor write, cutting 4,849 B from
  every `/cad-pause` run and leaving `conventions.md` eager nowhere. Inline the
  same batch-asks rule at `skills/cad-pause/SKILL.md:43` and drop that
  citation too - dropping the include while leaving the parenthetical would
  recreate, inside the skill, exactly the phantom this requirement closes.
  `conventions.md` itself is not edited and not deleted: it stays the on-demand
  reference its own opening paragraph says it is, and the skills that still
  cite it by path (`cad-capture`, `cad-health`, `cad-land`, `cad-plan-review`)
  are outside this requirement's stated scope. Regenerate
  `weight-budgets.json` for `context.md`, `new-project.md` and
  `skills/cad-pause/SKILL.md`.
- **Verify:** `grep -rn "conventions.md" cadence-core/workflows/` returns
  nothing at all (this closes AC5 across all seventeen sites);
  `grep -rn "conventions.md" skills/cad-pause/SKILL.md` returns nothing;
  `grep -rn '^@\$\{CLAUDE_PLUGIN_ROOT\}.*conventions.md' skills/` returns
  nothing; `grep -c "ceil(N/4)" cadence-core/workflows/context.md` returns 2;
  `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`; task 2's
  budget-equality one-liner names no file.

### Task 8: The /cad-config catalog is decided on the record and says so in its own text

- **Files:** cadence-core/workflows/config.md, CHANGELOG.md,
  cadence-core/bin/weight-budgets.json
- **Action:** State the decision where the catalog lives and record the
  evidence where bytes are free. In `config.md`'s `### Catalog` preamble
  (currently "Source of truth is `cadence-core/config.schema.json`... this
  table is the menu's presentation layer"), add one sentence: the table is
  deliberately TRANSCRIBED, not derived from `config.mjs keys`, because the
  schema carries no per-value explanation field while this menu requires each
  option to carry its Explanation as the option `description`
  (`config.md:41-42`), so deriving would drop required copy rather than save
  bytes (D-09). Keep the addition to one or two lines - all 18,265 B of
  `config.md` load on every `/cad-config` run regardless of route (D-18), so
  this file's own prose is the most expensive place in the plugin to record an
  argument. Record the full grounds in `CHANGELOG.md` under `## [Unreleased]`,
  in the existing `### Changed` section, as one bullet: the run-count
  measurement (parsing every slash-command invocation across the local
  transcript corpus yields 5 `/cad-config` runs in total, none carrying
  `--review` or a `<key>=<value>` token, so by `config.md:16-22`'s Route rule
  all five reached the interactive menu - non-menu runs are zero of five, for
  scale `cad-verify` 46, `cad-plan` 44, `cad-execute` 39), the byte arithmetic
  (`config.mjs keys` emits 20,769 B on one JSON line against a 6,827 B catalog
  table, and the schema's field union carries no per-value explanation), and
  the flagged limit that n=5 is thin enough that the smallness is itself the
  finding, which is why the decision rests primarily on the arithmetic - that
  half is independent of run mix, so a wider window showing non-menu runs
  dominating still refuses the derivation. Write no AI-attribution line
  anywhere in this or any other artifact. Regenerate `weight-budgets.json`
  for `config.md`.
- **Verify:** `grep -n "transcribed" cadence-core/workflows/config.md` shows
  the statement in the Catalog section and `grep -c "derived"
  cadence-core/workflows/config.md` shows the sentence resolves the
  derived-vs-transcribed question rather than leaving both readings open;
  `grep -n "20,769\|5 /cad-config runs\|five reached the interactive menu"
  CHANGELOG.md` shows the measurement and the arithmetic under
  `## [Unreleased]`; `node cadence-core/bin/self-verify.mjs` prints
  `"problems":[]`; task 2's budget-equality one-liner names no file.

### Task 9: The break-even rule covers a deferred read, and every eager include carries its reason

- **Files:** cadence-core/references/seams.md, CHANGELOG.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Extend the break-even rule at `references/seams.md:207-219`
  (**File round-trip (when the extra turn pays)**) by ONE sentence so it covers
  any deferred read, not only a subagent round-trip (D-10): every noun in the
  shipped rule is a round-trip noun - parent, child, artifact, read-back - so
  an eager-vs-lazy `@`-include is only covered by analogy today. The added
  sentence maps the same two-clause test onto a deferred read: deferring a
  reference pays when the read folds into a turn the command was taking anyway
  AND the reference is reached on only some branches, so an eager include whose
  file is consulted on EVERY path is already at break-even and stays eager.
  Say what "folds into" admits, since the phase's own only deferral turns on
  it: an extra tool round-trip inside a turn the command was already taking
  counts as folded; a read that forces a turn the command would not otherwise
  have taken does not.
  ~200 B, additive, in a byte-cutting cycle: the trade is accepted so the
  mapping is written once rather than restated at every judgment. Then record
  every keep-or-move call with its reason in `CHANGELOG.md` under
  `## [Unreleased]`, one bullet listing all twenty `@`-include lines in
  `skills/` against the measured turn-one baselines (D-19): the twelve
  workflow includes stay eager because a skill's own workflow is its entire
  body and is consulted on every path; `cad-help`'s `COMMANDS.md` and
  `cad-verify`'s `templates/UAT.md` stay for the same reason; `cad-land` and
  `cad-plan-review` keep `review-triggers.md` eager because
  `cad-plan-review`'s whole body is one `fire('plan')` and `cad-land` fires
  `pre_ship` on every run (D-07 - recorded as an explicit KEEP rather than
  passed over, because a future reader optimizing eager totals would move it);
  the four guard-only skills and `cad-land` moved from `git.md` to
  `git-guard.md` with the publish half deferred to the step that acts on it
  (D-03); `cad-pause`'s `conventions.md` include is gone (D-08); and the two
  new reference files deliberately get NO budget entry, since
  `lib/surface-weight.mjs` walks only `agents/*.md`, `skills/**/SKILL.md` and
  `cadence-core/workflows/*.md` and `references/` comes under budget in phase 3
  (D-20). Note in the same bullet the one assumption worth a reader's eye:
  D-03 holds only while `/cad-land` reaches rails 1-2 on every run, so a
  `/cad-land` path that commits nothing would make its guard include a
  LOD-05 candidate in its own right. Finally make the manifest exact: run
  `node cadence-core/bin/weight.mjs` and set every surface's
  `weight-budgets.json` entry to its measured bytes. That includes
  `skills/cad-plan-review/SKILL.md`, which this phase does not edit and which
  carries 36 B of pre-existing stale headroom (budget 2484, actual 2448) - fix
  it here with the reason named in the commit message rather than leaving
  phase 3's BUD-01 to measure against a budget no file ever had. Confirm the
  ratchet held across the phase: every earlier commit that edited a budgeted
  surface carries its own `weight-budgets.json` change. A miss is NOT repaired
  quietly inside this commit - record it as a deviation and repair it in its
  own `fix(budget):` commit naming the commit it repairs, so the gap and its
  repair are both legible in `git log`.
- **Verify:** `grep -n "deferred read" cadence-core/references/seams.md` shows
  the added sentence inside the File round-trip block; `grep -c "eager"
  CHANGELOG.md` shows the judgment bullet under `## [Unreleased]`; task 2's
  budget-equality one-liner prints `budgets exact` for the WHOLE tree; `node
  --test cadence-core/bin/*.test.mjs` passes; `node
  cadence-core/bin/self-verify.mjs` prints `"problems":[]`; `npx tsc -p
  tsconfig.ci.json` exits 0; and the per-commit ratchet is checked by
  REPLAY, not by `git log --stat`, which only proves the manifest changed and
  would pass a commit that edited two budgeted surfaces and regenerated one -
  for each commit C in `<PHASE_START>..HEAD`, `git stash -u` clean, `git
  checkout C`, run task 2's budget-equality one-liner restricted to the
  surfaces C touched (`git show --stat --name-only C`), and require it to name
  no file; every commit passes, with the single permitted exception of a
  `fix(budget):` repair commit naming the commit it repairs. Return to the
  branch head afterward and confirm `git status` is clean.

## Notes

**Plan review (`plan` trigger, adjudicated): all five survivors applied.** The
cross-model reviewer raised five findings; all were grounded, the user took all
five, and each is folded into the task above rather than left as a note.
(1) Task 4's batching used `ceil(N/4)`, borrowed from `conventions.md:47` where
N counts QUESTIONS - here the survivors are OPTIONS and NONE holds one of the
four slots, so it is `ceil(N/3)` questions batched four per call, and the
NONE-plus-survivors answer now re-asks instead of guessing. (2) Task 9's
break-even rule is a two-clause AND that task 2's deferred `git-publish.md`
read appeared to fail; both sides now state that an extra round-trip inside a
turn already being taken counts as folded, and task 2 names the cost instead of
implying the read is free. (3) Task 6 edited `context.md` but omitted it from
its own verify grep - it cannot join the blanket list (its `:139`/`:178`
batch-asks citations are task 7's), so it is checked scoped. (4) Task 3's sweep
greps only `references/git.md` while five citations in the tree are bare
`git.md`; the bare form is now its own search. (5) Task 9's `git log --stat`
ratchet check proves the manifest changed, not that each commit's edited
surfaces matched it - replaced with a per-commit replay.

**Plan shape: ONE PLAN.md, deviating from CONTEXT's directive.** CONTEXT asks
for three plans split along the requirement seams (LOD-01 / LOD-02 /
LOD-03+04+05), each independently executable. The file-independence test
refuses that split, and file independence is the hard constraint, so the
deviation is recorded here rather than taken silently. The three slices share
files in four places, each of which would look independent in frontmatter and
merge-conflict in practice: `cadence-core/references/seams.md` is edited by all
three (the worktree paragraph in LOD-01, the ask-user binding in LOD-02, the
break-even sentence in LOD-05); `cadence-core/workflows/execute.md`,
`plan.md` and `verify.md` each carry both a LOD-01 rail citation and a LOD-02
triage citation, and `execute.md`, `plan.md`, `verify.md`, `milestone.md`,
`context.md`, `coverage.md`, `phase.md` and `new-project.md` also carry LOD-03
parentheticals; `skills/cad-land/SKILL.md` carries LOD-01's include swap and
LOD-02's triage read, and `skills/cad-pause/SKILL.md` carries LOD-01's include
swap and LOD-03's include drop; and `cadence-core/bin/weight-budgets.json` is
regenerated by every slice under D-20, which `planning.mjs plan-overlap` would
report as an overlap and which sends `/cad-execute` back to the sequential path
regardless.

**`land.md` does not exist.** CONTEXT AC2 asks that "`land.md` reads
`git-publish.md` at the step that acts on the publish rails". `/cad-land` has
no workflow file - its whole process lives in `skills/cad-land/SKILL.md`
(`cadence-core/workflows/` holds no `land.md`), so task 2 puts that read at
step 4b of the SKILL.md. Same step, same rails, the only file that exists.

**The 17 parentheticals split 13/3/1, not 14/2/1.** D-08 counts 14 § Parallel
work citations, 2 batch-asks and 1 lazy-create. The tree carries 13 Parallel
work (task 6's list), 3 batch-asks (`context.md:139`, `context.md:178`,
`new-project.md:195`) and 1 lazy-create (`new-project.md:279`). The total of 17
and the decision itself are unchanged - `new-project.md:195` sits in the
batch-asks group rather than the Parallel-work one - so no task changes shape;
the count is recorded so a verifier reading D-08 against the tree does not read
the difference as a missed site.

**"Inlined at its use site" is the rule, not the paragraph.** AC5 asks that
each cited rule "reads in full" at every former citation site. Tasks 6 and 7
deliver that as the complete operative rule in the site's own prose - both
halves, so nothing sends a reader to `conventions.md` - and deliberately not as
thirteen verbatim copies of the 611 B § Parallel work paragraph, which would
add roughly 8KB to `cadence-core/workflows/` in a cycle whose entire purpose is
to remove bytes from turn one. The judgment is recorded here because it is the
one place this plan reads a locked decision for its intent rather than its
letter.

**Pre-existing budget drift, folded into task 9.** `skills/cad-plan-review/SKILL.md`
measures 2,448 B against a 2,484 B budget today - 36 B of headroom no file ever
occupied, from before this phase. Phase 1's D-17 pins each edited surface at
exactly its budget, so this entry is stale rather than deliberate; task 9
corrects it with the reason in the commit message, since leaving it would give
phase 3's BUD-01 baseline 36 B of slack it did not earn.

**Recalled prior art, and where it lands.** Two CAPTURE entries bear directly
on task 4 and are cited in it: the 2026-07-30 decision that § 6's
"open-ended prose, not `AskUserQuestion`" line is what turns every adjudicated
review into a wall of findings, taken after four walls of text in one session
(`.planning/CAPTURE.md`, this phase's CONTEXT D-05); and the open [high] at
`.planning/CAPTURE.md:180` recording that the `git.auto_close` carve-out sits
in the generic adjudicated arm, so a repo opting into the unattended land close
suppresses the triage prompt at EVERY adjudicated gate while `land-cleanup.mjs
gate` runs only inside `/cad-land`, silently discarding grounded plan-review
survivors. Task 4 closes the second one by scoping the carve-out as it moves.

**No human-verify item.** Every task's proof is a command available in this
environment (`node`, `npx tsc`, `grep`, `git`); nothing here needs a service,
a live endpoint or a tool the executor cannot run.
