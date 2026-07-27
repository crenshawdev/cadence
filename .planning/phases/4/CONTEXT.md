# Phase 4: renumber & git-guard hardening - Context

Gathered: 2026-07-27
Feeds: /cad-plan 4

## Scope boundary

In: The last three filed bugs of the v1.3.1 tech-debt cycle, across four
surfaces. #37 - `renumber` applies the decimal carve-out to the STATE cursor
(today `planning.mjs:697` shifts a `2.1` cursor to a nonexistent `1.1` with no
warn, while the ROADMAP tokens and the phase directories both skip it).
#49.1 - one dangling or unreadable `.md` symlink under `agents/`, `skills/`,
`cadence-core/workflows/` or `cadence-core/references/` no longer collapses a
whole self-verify/weigh run into one opaque `{ok:false,reason:"internal"}`.
#49.2 - `renumber` apply reports which moves completed when it fails partway,
and refuses a colliding destination before any write. #50 - `git-guard` joins
backslash line-continuations before subcommand parsing, so a wrapped
`git \`+newline+`push` reaches the push rail as the push it is. Each fix
carries a failing-capable regression test (FIX-01). One consequential edit
rides along: any prose surface touched must bump its `weight-budgets.json`
entry in the same change (D-14).
Out: A true transaction for `renumber` apply (D-03 - the remove path destroys
`phases/<at>` before any move, so a rollback cannot restore it). Rewriting
`weighAll`'s return shape (D-05 - `weight.mjs` emits it verbatim). A
`warnings[]` channel on `planning.mjs` (D-02 - phase-3 D-14 stands). Reopening
the dir-move ceiling from #36, already shipped in this tree (D-09). Relaxing
`git-guard`'s conservative silence for any shell shape other than the backslash
continuation (D-16) - backtick substitution, heredocs and the rest stay
deliberately unrecognized. The known v1.2.0 by-design holdouts (git-guard's
config fail-open, `deepMerge` scalar) are not this phase. No new features.
Deferred: None
Plan shape: multiple plans, same phase. Natural split is renumber (#37 + #49.2)
/ surface-walk resilience (#49.1) / git-guard (#50), but #50's CRLF widening
(D-15) touches `self-verify.mjs:205`, which the #49.1 plan also owns - the
plans must assign that file to exactly ONE owner or the parallel-safety overlap
check rejects them.

## Durable decisions

- D-01 (cursor carve-out shape, #37): the cursor fix mirrors the token and
  directory carve-outs exactly - a non-integer `cursor.phase` is left UNTOUCHED
  while `total` still moves by `delta`. The asymmetry is deliberate and reads as
  a bug without the reason: the roadmap genuinely gained or lost a phase, so the
  total is still true, while the decimal phase's own number was never shifted
  anywhere else and the caller re-places it by hand (the same contract
  `decimal_phases` already reports). Evidence:
  `cadence-core/bin/planning.mjs:696-700,711-713`,
  `cadence-core/bin/lib/planning-files.mjs:493-510`. Reproduced live: cursor
  `2.1` + `renumber remove --n 1` rewrites STATE to `Phase: 1.1 of 3` while
  ROADMAP keeps `Phase 2.1` and `phases/2.1/` stays put, envelope
  `{"ok":true,...,"decimal_phases":[2.1],"total":3}` with no `warn`.
- D-02 (the warn rides the existing scalar key, #37): the decimal-desync warning
  uses `planning.mjs`'s existing scalar `warn`, NOT a new key and NOT a
  `warnings[]` array - phase-3 D-14 stands, and `config-merge`'s array-shaped
  channel is not copied here. The two warn causes are mutually exclusive
  (`cursor.phase === at` requires an integer `at`), so one scalar holds both, and
  `workflows/phase.md:33-34,50-52` already tells the model to surface "any
  `warn`" on both ops - no prose edit, no budget bump. Chosen over a distinct
  `cursor_warn` key (lets a caller tell the causes apart programmatically, at the
  cost of a doc edit to a file at exactly 3224/3224 bytes) and over reversing
  D-14 to introduce `warnings[]` now. Evidence:
  `cadence-core/bin/planning.mjs:694,698-700,723-730`,
  `cadence-core/workflows/phase.md:33-34,50-52`,
  `.planning/phases/3/CONTEXT.md:171-176`.
- D-03 (partial REPORT, not a transaction, #49.2): apply gains a partial-state
  report naming the moves that completed - it does NOT become transactional. The
  tempting "add rollback" reading is wrong: `remove` runs `git rm -r -q` on
  `phases/<at>` (with an `rmSync` fallback) BEFORE any move, because
  `phases/at+1 -> phases/at` would otherwise land on a still-present directory,
  so the destroyed phase cannot be restored. A rollback that cannot undo the
  first step advertises a guarantee the code lacks, which is worse than today's
  generic `internal` because the caller stops checking the tree by hand. Chosen
  over staging the removed directory into a temp path (real transaction, real
  machinery, in a no-new-features cycle) and over refusing the apply on a dirty
  worktree so `git checkout -- .` is the documented undo (cheapest, but adds a
  precondition that blocks a legitimate mid-work renumber). Evidence:
  `cadence-core/bin/planning.mjs:733-742,622-625`.
- D-04 (the collision arm does not throw, #49.2): a pre-flight
  destination-exists check is part of this fix, failing before any write. The
  filed "collision" arm is not a throw at all - `git mv <dir> <existing dir>`
  NESTS the source inside the destination and exits 0, verified live
  (`phases/3` + `phases/4` present -> `git mv phases/3 phases/4` succeeds,
  yielding `phases/4/3/PLAN.md`). A rollback-or-report fix keyed on failure would
  therefore never fire for it, and a stray out-of-roadmap `phases/K` silently
  swallows a real phase directory on the next insert. `existingDir`
  (`planning.mjs:653-660`) guards only the SOURCE of each move. Follows phase-2
  D-04's fail-before-any-write precedent. Evidence:
  `cadence-core/bin/planning.mjs:653-660,739`,
  `.planning/phases/2/CONTEXT.md:63-70`.
- D-05 (skip severity splits by consumer, #49.1): an unreadable surface is SILENT
  in the shared lib and LOUD in self-verify - `weighAll` skips the entry and
  `weight.mjs` still exits `ok:true` with it simply absent, while
  `self-verify.mjs` pushes an `unreadable-surface` problem and exits `ok:false`
  naming the file. This reconciles two prior decisions that pull opposite ways:
  phase-1 D-01 ("absence stays silent") and `surface-weight.mjs:20-23` ("an
  absent directory is empty data, never a throw") against phase-1 D-03 ("a
  dropped check must break the build, not scroll past"). Chosen over silent
  everywhere (re-opens a narrow #44 - a shipped prose surface drops out of budget
  enforcement while CI stays green) and over loud everywhere via a
  `{surfaces, unreadable}` return (cleaner data model, but changes the envelope
  `weight.mjs:26` emits verbatim and `weight.test.mjs:24-33` asserts). Evidence:
  `.planning/phases/1/CONTEXT.md:25-33,41-47`,
  `cadence-core/bin/lib/surface-weight.mjs:20-23`,
  `cadence-core/bin/self-verify.mjs:173-180,280-282`.
- D-06 (the guard is broader than ENOENT, #49.1): the walkers use a try/catch (or
  equivalent broad guard), NOT `statSync(f, { throwIfNoEntry: false })` alone.
  The narrow option covers the filed dangling case only: a symlink cycle
  (`a.md -> b.md -> a.md`) still throws `ELOOP`, verified live, and
  `throwIfNoEntry` suppresses `ENOENT` and nothing else on every Node version -
  so the narrow form would let the suite report the class as fixed while one
  opaque `internal` remains reachable. `readFileSync`
  (`surface-weight.mjs:79`, `self-verify.mjs:183`) is a second throw site for
  anything that passes the stat but cannot be read. Evidence:
  `cadence-core/bin/lib/surface-weight.mjs:31,40,49,79`,
  `cadence-core/bin/self-verify.mjs:183`.
- D-07 (the commit rail widens too, #50): joining continuations in
  `gitSubcommands` necessarily makes a wrapped `git \`+newline+`commit` on a
  protected branch start prompting as well, and that is accepted rather than
  gated to the push path. Scoping the join to push detection would leave the two
  rails disagreeing about what a wrapped command IS - the precise inconsistency
  the issue frames the fix as closing. Evidence:
  `cadence-core/bin/git-guard.mjs:111-114`.
- D-08 (join BEFORE the quote-strip, #50): the continuation join runs on the raw
  command, ahead of the existing quote-stripping - order is load-bearing, not
  incidental. The double-quote pattern `"(?:[^"\\]|\\.)*"` cannot match a quoted
  string containing a backslash-newline (`\\.` does not match a newline), so
  joining afterward can splice quoted text into a command word and manufacture a
  `git push` the user never wrote - prompting on an `echo`. Joining first
  collapses the quoted multi-line string so the strip removes it whole.
  Evidence: `cadence-core/bin/git-guard.mjs:70-76`.

## Decisions

- D-09 (#36 is already shipped, #37): `maxN` already filters to integer phases,
  so #37 is a cursor-only edit - the issue's "pairs naturally with #36" note is
  satisfied, not outstanding. Evidence: `cadence-core/bin/planning.mjs:636-639`,
  `cadence-core/bin/planning.test.mjs:1030-1043`, `CHANGELOG.md:48`; issue #36
  is CLOSED on the tracker.
- D-10 (warn only when the shift would have applied, #37): the decimal warn fires
  only when `cursor.phase >= shiftFrom` - the branch that would otherwise have
  moved it - not on every decimal cursor. Under `remove --n 3` with cursor `2.1`,
  `shiftFrom` is above the cursor and today's code already leaves it alone; a
  warn there is noise about an operation that changed nothing. Accepted cost:
  removing the integer parent of a decimal leaves the cursor semantically
  orphaned with only `decimal_phases` hinting at it. Evidence:
  `cadence-core/bin/planning.mjs:650-651,697`.
- D-11 (the partial envelope bypasses the dispatch catch, #49.2): the report is
  emitted from a try/catch inside `cmdRenumber` with an additive key naming the
  completed moves. The dispatch-level catch (`planning.mjs:797-799`) flattens
  everything to `internal`, and `fail()` carries only `reason`/`detail`/`hint`,
  so a completed-moves list needs a direct `emit` rather than a widened `fail`.
  Evidence: `cadence-core/bin/planning.mjs:48-49,797-799`,
  `cadence-core/bin/lib/seam-io.mjs:25-28`.
- D-12 (no new flag, #49.2): `renumber insert`/`remove` gain no flag, so
  `self-verify.mjs`'s CONTRACTS table is unchanged. A `--force`/`--no-rollback`
  flag would need its CONTRACTS entry AND a prose edit to a zero-headroom
  surface. Evidence: `cadence-core/bin/self-verify.mjs:53-54`.
- D-13 (both walkers plus the third stat site, #49.1): the guard lands in the
  shared `surfaces()` generator, in `self-verify.mjs`'s own independent
  `mdFiles()` walker, AND at the agents tools-declaration lint's `statSync` -
  three sites, though the issue names only the first two. The third is the same
  shape, runs after the budget check, and walks the same `agents/` directory the
  filed repro targets, so omitting it means the exact filed repro still sinks the
  run one check later while the regression test passes. Evidence:
  `cadence-core/bin/lib/surface-weight.mjs:25-52`,
  `cadence-core/bin/self-verify.mjs:105-119,294-298,269`.
- D-14 (a touched prose surface bumps its budget in the same change): both
  candidate surfaces sit at exactly zero headroom - `workflows/phase.md` at
  3224/3224 and `skills/cad-phase/SKILL.md` at 1205/1205 - and `self-verify.mjs`
  fails `budget-overrun` on any excess, so a docs-only edit without the bump
  breaks CI. Phase-3 D-13 is the precedent. `git-guard.mjs` has no budget entry
  and `cadence-core/references/git.md` is outside the measured set, so #50's
  prose is free. Evidence: `cadence-core/bin/weight-budgets.json`,
  `cadence-core/bin/self-verify.mjs:274-278`,
  `cadence-core/bin/lib/surface-weight.mjs:10-13`.
- D-15 (CRLF widened in both seams, #50): the join regex is `/\\\r?\n\s*/g` in
  `git-guard.mjs` AND in `self-verify.mjs:205`, which is LF-only today. Nothing
  in this repo records whether a PreToolUse payload can arrive CRLF, so widening
  closes the rail without having to answer the question, and keeps the two seams
  one idiom rather than two spellings. Evidence:
  `cadence-core/bin/self-verify.mjs:204-205`,
  `cadence-core/bin/git-guard.mjs:75`.
- D-16 (scope stays the backslash case, #50): no other shell shape becomes
  recognized - backtick substitution, heredocs and the rest remain
  conservative-silent per the file's stated design. Evidence:
  `cadence-core/bin/git-guard.mjs:60-66`.
- D-17 (#37's tests are net-new): no existing test asserts the broken cursor
  shift, so phase-1 D-05's rewrite-don't-supplement rule has nothing to bite on
  here - both decimal renumber tests build cursor-less fixtures, and the only
  cursor-bearing helper always sets an integer. `makeTree` writes the cursor
  verbatim, so a decimal `phase: 2.1` fixture is expressible today. Evidence:
  `cadence-core/bin/planning.test.mjs:117-121,959-966,1183-1207`.
- D-18 (symlink fixtures are tmpdir-only, #49.1): the dangling-symlink and
  symlink-cycle fixtures are built with `symlinkSync` in a tmpdir; nothing
  symlinked is committed to the repo tree. `self-verify.test.mjs` and
  `weight.test.mjs` both assert against the real `REPO` root, so a committed
  dangling symlink would turn "the repo itself passes self-verification" red on
  every branch. Evidence: `cadence-core/bin/self-verify.test.mjs:84-88`,
  `cadence-core/bin/weight.test.mjs:24-48`, `.github/workflows/test.yml`.

## Acceptance criteria

- [ ] `planning.mjs renumber remove --n 1` (and `insert --at 2`) on a tree whose
      STATE cursor reads `Phase: 2.1 of 4` leaves the cursor's phase at `2.1`,
      updates the total to `3`, and returns a `warn` telling the caller to
      re-point it; ROADMAP and `phases/2.1/` are unchanged. With the same cursor
      and `remove --n 3`, no `warn` is emitted and the cursor is untouched. An
      integer cursor at or above the shift point still shifts as before.
- [ ] `renumber insert --at 3` on a tree that already contains an out-of-roadmap
      `phases/4/` exits `ok:false` naming the colliding destination, with no
      directory moved and no file rewritten (no `phases/4/3/` exists; ROADMAP is
      byte-identical).
- [ ] A `renumber` apply whose directory moves fail partway (read-only `phases/`
      parent) exits `ok:false` whose envelope lists the moves that completed,
      rather than a bare `reason:"internal"` with no detail.
- [ ] `self-verify.mjs --root <fixture>` on a fixture containing a dangling
      `agents/dangling.md` symlink runs the full lint and exits `ok:false` with a
      problem naming that unreadable surface - not `{ok:false,reason:"internal"}`
      with every other result lost; a symlink cycle (`a.md -> b.md -> a.md`)
      behaves identically. `weight.mjs` on the same fixture exits `ok:true` with
      that entry simply absent from `surfaces` and the envelope's shape unchanged.
- [ ] `git-guard.mjs` fed a payload whose command is `git \`+newline+`  push
      origin main` produces the same ask as the unwrapped `git push origin main`;
      the same holds with `\r\n` line endings, and a wrapped
      `git \`+newline+`commit` on a protected branch also asks. A command whose
      only `git push` text sits inside a quoted multi-line string still produces
      no prompt.
- [ ] Each of #37, #49, #50 has at least one test that fails on the pre-fix code
      and passes after it, and all three CI gates pass:
      `node --test cadence-core/bin/*.test.mjs`,
      `node cadence-core/bin/self-verify.mjs`, `npx tsc -p tsconfig.ci.json`.

## Flagged assumptions

- The `ELOOP`/`EACCES` behavior behind D-06 and `readdirSync(..., {recursive:true})`'s
  symlink-traversal semantics were confirmed on Node 26 only - the machine has no
  other version installed, while CI runs the Node 22/24 matrix - Likely; if wrong:
  a guard shaped for Node 26's error surface leaves a throw path open on 22 or 24
  and CI is where it surfaces. `throwIfNoEntry`'s ENOENT-only scope is stable
  across every supported version, so only the cycle/permission arms carry this
  risk.
- D-15 widens the CRLF join without evidence that a CRLF payload is reachable -
  Likely; if wrong: two seams carry a regex arm nothing exercises, and the
  `\r\n` acceptance check passes vacuously. The harness's payload normalization
  is not recorded anywhere in this repo, so the question cannot be settled from
  the codebase.
- Whether D-05's `unreadable-surface` problem should also name the symlink's
  target (versus the link path alone) is left to the planner - Unclear; if wrong:
  an operator sees which file is unreadable but not what it pointed at, costing
  one `ls -l` on a rare failure.
