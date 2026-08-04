# Phase 2: The parser earns its keep - Context

Gathered: 2026-08-02
Feeds: /cad-plan 2

This is a RE-GATHER. The first execution attempt halted after three consecutive
blocking `risk_surface` FAILs (`.planning/phases/2/SUMMARY.md`), and the user
reversed the phase's founding premise: the parser is deleted, not redirected.
The prior CONTEXT.md's D-01, D-04, D-05, D-06 and D-09 are superseded by what
follows.

## Scope boundary

In: TOK-02 under its reversed definition - `cadence-core/bin/lib/shell-tokens.mjs`,
`cadence-core/bin/lib/destructive-git.mjs` and both test files are deleted,
`references/git.md`'s rail-3 evasion grammar and out-of-grammar table go, and
both git-guard rails are rebuilt on ONE small anchored reader. Plus the fallout:
the shipped record that advertised the removed reach (TOK-01 on both halves, and
the four public docs restating it), the accepted-cost statement in `CHANGELOG.md`,
and `/cad-land`'s `git branch -D` reap, whose seam half is already staged.

Out: rails 1, 2 and 4 keep their existing behaviour beyond the reader swap.
Re-catching the wrapper, subshell and continuation shapes the anchored reader
silences is the accepted cost of TOK-02, not a gap to close here. No change to
`git.on_protected`'s enum - `refuse` survives, anchored.

Deferred: None.

Plan shape: multiple plans, same phase - the removal and the new reader
(AC1-AC4), the record-honesty pass (AC5 plus AC3's CHANGELOG half), and the reap
prose switchover (AC6) are separable bodies of work sharing one goal.

## Durable decisions

- D-01 (rip scope): BOTH `cadence-core/bin/lib/shell-tokens.mjs` and
  `cadence-core/bin/lib/destructive-git.mjs` are deleted with their test files,
  along with `references/git.md`'s rail-3 evasion grammar and out-of-grammar
  table. This REVERSES the prior CONTEXT's D-01 ("the quote-state lexer SURVIVES
  and is what gets redirected"). Rejected: redirecting the lexer, which three
  blocking review panels falsified by measurement rather than by opinion - after
  `destructive-git.mjs` was rewritten to model git's option grammar in 367 lines
  with per-subcommand tables transcribed from `git <sub> -h`, a third adversarial
  pass still found three families of silent unrecoverable destruction
  (`git checkout -f -b x`, `git switch -f main`, `git clean -f -n --no-dry-run`),
  each reproduced live against git 2.55; and the fix for gate 2's blocker
  introduced gate 3's blocker, so the loop was trading defect classes rather than
  converging. Evidence: `.planning/phases/2/SUMMARY.md:92-111,144-157`,
  `.planning/CAPTURE.md` (v1.4.0 close, "OPEN DECISION"),
  `cadence-core/bin/git-guard.mjs:32` (the sole non-test importer),
  `cadence-core/bin/lib/destructive-git.mjs:23-45`.
- D-02 (one anchored reader): both rails read from ONE small reader that splits
  the command on `[;|&\n]`, counts a segment only when it BEGINS with `git`, and
  takes the verb as that segment's first non-flag word. It over-fires within
  that shape rather than modelling git's option grammar - being wrong in the
  firing direction costs a prompt, being wrong in the silent direction costs
  uncommitted work. Rejected: a raw whole-string `git`...`push` match, which
  loses no push shape and newly catches three the tokenizer left silent
  (`git &>/dev/null push`, `git {push,fetch} origin main`, `!(git push)`) but
  prompts on roughly ten false classes this repo runs constantly - every
  `rg -n "git push"` / `grep -r "git push"`, `git stash push -m wip`,
  `git log --grep push`, and `git commit -m "fix the push rail"`. Evidence:
  `cadence-core/bin/git-guard.test.mjs:119-203` (the silent-and-correctly-so
  corpus), `:243-352` (the asking corpus), `cadence-core/references/git.md:279-292`.
- D-03 (accepted cost, stated not omitted): the anchored reader silences
  `bash -c "git push"` / `sh -c`, `$(git push)`, backticked `git push`, the
  line-continuation shape (`git \` newline `push`), `git -C "<path with space>"
  push`, and the `env -S` family - substantially the six rail-3 push holes
  TOK-01 closed in v1.4.0. These are NAMED in `CHANGELOG.md` in the same
  subsection as the removal, not omitted and not buried. The rail's own
  adversary is the model issuing the command, not an attacker, and
  `references/git.md` already concedes it is "a detection widener, not a
  security boundary". Rejected: leaving the cost implicit, which is what SC3
  exists to prevent. Evidence: `.planning/CAPTURE.md` (phase 4, the six holes),
  `cadence-core/references/git.md:279-292`, `CHANGELOG.md:432-441`.
- D-04 (`refuse` survives, anchored): `git.on_protected: refuse` is the guard's
  ONLY hard block, and no reader over a raw string can tell `git commit -m x`
  from `grep git commit`. It fires only when a segment BEGINS with `git`; every
  other match asks. Its REACH is unchanged by this phase and stays
  commit-only - the push rail hardcodes `decide('ask', ...)` and returns before
  any deny is computed (`git-guard.mjs:165-169`), so no `git push` spelling has
  ever denied and none starts to here. The enum is unchanged, so the cycle stays a minor bump.
  Rejected: retiring `refuse` from the enum, which is a schema break on a
  shipped key and would likely force v3.0.0; and leaving `refuse` unanchored,
  which re-hard-blocks `command -v git commit` - the exact false deny three
  review rounds spent themselves closing. Evidence:
  `cadence-core/bin/git-guard.mjs:105,128,171`,
  `cadence-core/bin/git-guard.test.mjs:390-409,411-433,435-453`,
  `cadence-core/references/git.md:212-242`, `CHANGELOG.md:449-464`.
- D-05 (destructive firing set): narrow verb+flag shapes - `reset --hard`,
  `clean` with a force flag, `checkout`/`restore` with a `.` or `--` pathspec,
  `branch -D`, `checkout -f`, and `switch -f`/`--discard-changes`.
  `git checkout -b <branch>` and `git checkout <base>` stay SILENT because
  Cadence's own workflows run them at every cycle start and every release close.
  `git checkout -- path/to/file` DOES prompt even though
  `skills/cad-executor-contract/SKILL.md:127` sanctions it - it is a discard, and
  a prompt is the correct cost. Rejected: firing on the verb alone, which
  guarantees coverage but makes `git.auto_close`'s "no per-step prompts" purpose
  string false at every release. Evidence: `cadence-core/references/git.md:54`,
  `skills/cad-land/SKILL.md:123,130`,
  `skills/cad-executor-contract/SKILL.md:127`,
  `cadence-core/config.schema.json` (`git.auto_close.purpose`).
- D-06 (supersede, never revert): the four commits on this branch STAY and are
  superseded by the deletion; nothing is reverted or reset. `930dda3` carries
  three things this phase still wants - `git.on_destructive` across its four
  surfaces, `weight-budgets.json` regenerated to 18433 for
  `cadence-core/workflows/config.md`, and a fix to a PRE-EXISTING defect in
  `cadence-core/references/config-reach.md:131` (the `git.protected_branches`
  "Honoured by" cell omitted `bin/git-publish.mjs`). `776e6a0`/`d4861ae` edit
  only files this phase deletes, so a revert is a no-op with conflict risk.
  Rejected: `/cad-undo 2`, which cannot run here - its dirty guard STOPS on the
  staged task-7 work, its manifest lists all four commits so it over-reverts,
  and a committed revert flips the ROADMAP box and traceability rows back, which
  is not what a re-plan of the same phase wants. Evidence:
  `cadence-core/workflows/undo.md:8-17,43-55`,
  `.planning/phases/2/SUMMARY.md:36-45`.
- D-07 (TOK-01 retires on BOTH halves): the supersession annotation must
  separate them. The six push shapes keep prompting only for the anchored forms;
  the command-position deny gate does NOT survive at all, and the "tested as a
  table" grammar claim goes with the deleted test file. A single "superseded"
  note - what the prior CONTEXT's AC5 planned for - leaves the shipped record
  advertising a false-deny protection the code no longer has, which is the exact
  prose/code drift `self-verify.mjs` exists to end. Rejected: annotating only
  the Shipped row and leaving the CHANGELOG entries as shipped. Evidence:
  `.planning/REQUIREMENTS.md:84`, `CHANGELOG.md:432-441,442-448,449-464`,
  `cadence-core/bin/self-verify.mjs:3-9`.

## Decisions

- D-08 (no refusal value on the destructive key): `git.on_destructive` stays
  `ask | off`, and the `off` arm emits NOTHING rather than
  `permissionDecision: "allow"` - an emitted `allow` would auto-approve the
  command and bypass the user's own Claude Code permission settings. Carried
  unchanged from the prior CONTEXT's D-02 and already shipped at `930dda3`.
  Evidence: `cadence-core/config.schema.json:43`,
  `cadence-core/bin/git-guard.mjs:122`, `cadence-core/templates/config.json:16`.
- D-09 (rail 5, and it is now forced): the destructive rail is rail 5 and rails
  1-4 keep their numbers. This was a choice in the prior CONTEXT; two shipped
  surfaces now CITE rail 5 by number (`config.schema.json:43`'s purpose string,
  and the staged `git-publish.mjs` reap comment), so renumbering would leave
  them pointing at a rail that does not exist. Sixteen further prose citations
  name rails 1-4 by number and nothing machine-checks them. Evidence:
  `cadence-core/references/git.md:3`, `cadence-core/config.schema.json:43`,
  `cadence-core/bin/git-guard.mjs:13,64,138,161,166,185`,
  `cadence-core/bin/git-branch.mjs:4,6`, `skills/cad-land/SKILL.md:89`.
- D-10 (task 7 lands first): the staged reap-seam work is committed BEFORE
  anything touches the guard. It is independent of the parser (five files, none
  in the guard path, full suite green at 1315/1315 with it staged), and every
  other path in this phase either trips a dirty guard on it or risks losing it.
  Evidence: `git diff --cached --stat`, `cadence-core/workflows/undo.md:14-17`.
- D-11 (AC6 is half-delivered): task 7 shipped only the SEAM. The staged diff
  contains no `.md` file, so `skills/cad-land/SKILL.md:130` still runs
  `git branch -D <decision.branch>` as Bash prose and `:123` still runs
  `git checkout <base>`. The seam exists (`git-publish.mjs reap --branch <name>`)
  and nothing calls it. Evidence: the staged diff,
  `skills/cad-land/SKILL.md:123,130`.
- D-12 (budget reality): 69 of 71 measured surfaces sit at EXACTLY zero
  headroom, and `skills/cad-land/SKILL.md` (8978/8978) is a second budgeted
  surface this phase touches through D-11's prose move - so
  `weight-budgets.json` regenerates for it too, not only for the config catalog
  row. `cadence-core/workflows/config.md` already reads 18433 and needs no
  further action; shrinking a surface is never a failure, as self-verify reports
  only `bytes > budget`. `references/git.md` is unmeasured, so removing the
  rail-3 grammar frees no budget anywhere. Evidence:
  `cadence-core/bin/lib/surface-weight.mjs:8-13`,
  `cadence-core/bin/weight-budgets.json`,
  `cadence-core/bin/self-verify.mjs:501-506`.
- D-13 (CHANGELOG shape, and its phase-3 interaction): the accepted-cost
  statement lands in a NEW `## [Unreleased]` section - `CHANGELOG.md:7` opens
  straight into `## [2.0.0]`. Note the release seam INSERTS below Unreleased and
  does not promote its content; promotion is phase 3's own SC2, and phases 2 and
  3 are the cycle's declared parallel pair. If phase 3 does not land first, this
  phase's cost statement sits above the dated heading it was meant to be inside.
  Evidence: `CHANGELOG.md:7`,
  `cadence-core/bin/lib/release-decision.mjs:106-122`,
  `.planning/ROADMAP.md:18-21,100-102`.
- D-14 (the prose-reading-test decision dissolves): the prior CONTEXT's D-12
  required rewriting the tests that assert specific sentences still exist in the
  prose being removed. Those assertions live inside
  `cadence-core/bin/shell-tokens.test.mjs`, which is deleted whole, so the git.md
  deletion has no test reading it afterwards. No other file under
  `cadence-core/bin/` reads `references/git.md`. Evidence:
  `cadence-core/bin/shell-tokens.test.mjs:634,636-646,661-662`.
- D-15 (INTERNALS is a one-line edit, not a blocker): the prior CONTEXT treated
  `INTERNALS.md:35` as a reason a full rip-out was infeasible. It backticks both
  deleted paths and self-verify check 3b `existsSync`-tests every backticked
  token, so leaving it produces two `missing-internals-path` problems and flips
  the run to `ok:false` - a one-line prose edit, not a design constraint.
  `INTERNALS.md:33` also restates the tokenizer's reach but is not
  machine-checked. Evidence: `INTERNALS.md:33,35`,
  `cadence-core/bin/self-verify.mjs:459-465,821`.
- D-16 (public docs fold in): the four docs restating TOK-01's rail-3 reach are
  corrected in THIS phase, not deferred - `README.md:23` names `bash -c "git
  push"`, a backtick, a subshell and an `&` as shapes the guard notices, and
  this phase silences all but the `&`. Carried from the prior CONTEXT's D-15.
  Evidence: `README.md:23`, `INTERNALS.md:33-35`, `DESIGN.md:541-548`,
  `METHOD.md:508`.
- D-17 (test cost is known and accepted): the deletion removes 280 currently
  passing tests (179 in `shell-tokens.test.mjs`, 101 in `destructive-git.test.mjs`)
  and forces rewriting a large fraction of `git-guard.test.mjs`'s 41 - every
  block asserting SILENCE on text containing a literal git word, plus the whole
  deny-gate family and the three tests keyed on the `/could not parse/` reason
  string. The replacement suite must re-pin the silent corpus against the new
  reader rather than inherit it. Evidence: measured at branch HEAD;
  `cadence-core/bin/git-guard.test.mjs:119-203,354-365,390-453,471-507`.

## Acceptance criteria

- [ ] AC1: With `git.on_destructive` at its default `ask`, the guard asks on
      each of `git reset --hard`, `git clean -fd`, `git clean -xdf`,
      `git checkout .`, `git checkout -- src/`, `git restore .`,
      `git branch -D x`, `git checkout -f -b y`, `git switch -f main` and
      `git clean -f --no-dry-run` - one test per shape, each proven to fail
      before the new reader lands.
- [ ] AC2: The guard emits NO decision for `git checkout -b feat`,
      `git checkout main`, `git restore --staged .`, `git branch -d x`,
      `git clean -n`, `git stash push -m wip`, `rg -n "git push" .` and
      `git commit -m "fix the push rail"`.
- [ ] AC3: `cadence-core/bin/lib/shell-tokens.mjs`,
      `cadence-core/bin/lib/destructive-git.mjs` and both their test files are
      absent from the tree and nothing under `cadence-core/` imports or names
      them; `references/git.md`'s "What the guard sees" grammar and
      "Out of grammar (rail 3)" table are gone with rails 1-4 keeping their
      numbers and the destructive rail documented as rail 5; and
      `CHANGELOG.md`'s `## [Unreleased]` section names the shapes that go silent
      (`bash -c`/`sh -c`, `$(...)`, backticks, line-continuation,
      `git -C "<path with space>" push`, `env -S`) in the same subsection as the
      removal.
- [ ] AC4: With `git.on_protected: refuse` on a protected branch,
      `git commit -m x` returns `permissionDecision: "deny"` - the guard's only
      deny surface, unchanged in REACH by this phase - while
      `command -v git commit`, `rg "git commit" .`, `echo "git commit"` and
      `git push origin main` each return no deny.
- [ ] AC5: TOK-01's Shipped row and its CHANGELOG entries read as superseded on
      BOTH halves - the six push-hole closures and the command-position deny
      gate - and `README.md:23`, `INTERNALS.md:33-35`, `DESIGN.md:541-548` and
      `METHOD.md:508` no longer claim guard reach this phase removed.
- [ ] AC6: `/cad-land`'s branch reap runs through `git-publish.mjs reap` as a
      subprocess argv delete - no Bash `git branch -D` remains in cad-land's
      prose - and `land-cleanup.mjs` still runs no live git.
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` and
      `npx tsc -p tsconfig.ci.json` both exit 0, and
      `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no budget
      overrun, with `weight-budgets.json` regenerated in the same commit as any
      budgeted-surface edit.

## Flagged assumptions

- This phase will fire a blocking `risk_surface` panel again and no shipped
  pre-filter drop covers a parser deletion - the trigger's detection list names
  both "destructive ops" and "untrusted-input parsing", and its gate is
  `blocking` at every stakes level. Likely; the halted attempt paid three of
  these, losing `openai` to the 10-minute host ceiling twice at 36KB and 80KB
  payloads. Sequencing the deletion as its own commit ahead of the new reader,
  so a panel sees a subtraction rather than a subtraction plus a new reader, is
  a plan-level choice left to /cad-plan.
- TOK-02's "closes #25" claim was DROPPED from the requirement in this pass.
  Forgejo issue #25's text is unread and no local copy exists; `PROJECT.md:105-107`
  asserts #25 "needs exactly the flag-aware parsing a rip-out deletes". Unclear;
  if that is right, #25 needs a comment rather than a close, and the decision is
  outside what the codebase can settle.
- Claude Code's PreToolUse `permissionDecision: "allow"` semantics are asserted
  by `git-guard.mjs:119` but nothing here tests the harness side. Likely; if
  `allow` does not in fact bypass user permission settings, D-08's reasoning is
  weaker than stated though its conclusion is unchanged.
- Whether a regex-shaped reader can cover the three still-open destruction
  families at all (`checkout -f -b`, `switch -f`, `clean --no-dry-run`) is a
  question about git's own parser, not about this codebase. Likely coverable
  under D-05's flag shapes; if not, they must be named as knowingly-silent in
  AC3's cost statement rather than left unstated.
- The version stays a MINOR (v2.2.0) on the strength of D-04 keeping the
  `git.on_protected` enum intact. Likely; if narrowing `refuse` counts as a
  breaking behaviour change for a user running it, the cycle is a major, and
  REL-03's missing downgrade guard (phase 3) makes that mistake silent.
