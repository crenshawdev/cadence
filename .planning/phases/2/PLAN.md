---
phase: 2
plan: 1
requirements: [DRF-01, DRF-02, TAG-01]
files:
  - cadence-core/bin/lib/branch-decision.mjs
  - cadence-core/bin/branch-decision.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/lib/git-tags.mjs
  - cadence-core/bin/git-branch.mjs
  - cadence-core/bin/git-branch.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/workflows/audit.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: The ship gate that FAILs correct docs - Plan

## Goal

`/cad-audit` stops reporting a break on a repository that does not have one: the
version comparand reads the milestone the `### Active` section declares rather
than a token markdown wrapping left at the start of a line, the interrupted-close
exemption holds in the rolled-over state `audit.md` declares exempt, and tag
discovery cannot reach an enclosing repository the project never published to.

## Must be true when done

- `activeVersion` answers the milestone, never a predecessor, on both residue
  shapes: a body whose first version token is the milestone with a later
  line-anchored predecessor token riding a wrapped continuation line (the
  `81bdb5d` shape), and a body naming a predecessor in prose before the line that
  declares the milestone.
- `activeVersion` still answers on a body whose only version token sits mid-prose
  with no line anchor, and the four existing fixtures at
  `cadence-core/bin/branch-decision.test.mjs:237-266` pass byte-unchanged.
- `prose-agreement.test.mjs`'s DOC-02 test passes, and its remedy text names
  changing the reader rather than the file: the sentence "Fix the section -
  declare the milestone on its own line above every mention - rather than the
  anchor" occurs nowhere in the tree.
- `audit` against a project whose sole unsettled phase carries requirement rows
  that are all `Deferred` emits no `version_drift`, and the identical project
  with those rows `Pending` still emits one.
- `audit --dir <sub>/.planning`, where `<sub>` is a non-repository project inside
  a repository tagged `v9.9.0` whose `### Active` names `v9.9.0`, emits no
  `version_drift`; the same audit inside a linked worktree of a real tagged
  repository still reads that repository's tags and still emits one.
- DRF-01, DRF-02 and TAG-01 each carry a check with a `WATCHED FAILING AT <sha>`
  header whose sha resolves to a real commit preceding that fix, and each of
  those checks fails when re-run against the tree that sha names.
- `node --test cadence-core/bin/*.test.mjs` and
  `node cadence-core/bin/self-verify.mjs` both exit 0.

## Context

Locked by `phases/2/CONTEXT.md`: D-01 moves the SHARED reader, so
`git-branch.mjs decide`'s refusal changes with it and that change is recorded,
never avoided by an audit-only comparand; D-02 keeps the `loose` fallback,
gated - deletion and a named diagnostic are both rejected; D-03 reverses the
DOC-02 pin's D-07 "the file is what moves" policy; D-04 keys the rolled-over
exemption on requirement rows being `Deferred`, never on a close marker or an
archive probe (D-05); D-06 makes the containment probe `git -C <dir> rev-parse`
toplevel against a derived root, D-07 derives that root PER CALLER, D-08 keeps
the refusal permissive at `[]`; D-11 re-pins `weight-budgets.json` in the same
commit as any workflow prose change.

D-09 and D-10 bound this to the RESIDUE: the line-anchor half of DRF-01 shipped
at `af370e4` and the `blocked` half of DRF-02 at `b3a9346`. Neither is rebuilt.

Out of scope (CONTEXT scope boundary, D-12): the two adjacent no-`-C` git
callsites at `cadence-core/bin/planning.mjs:2317` and `:3540`, recorded there and
neither fixed nor filed; the other six requirements of `v3.5.4`.

## Tasks

### Task 1: Stop a wrapped-continuation line from out-declaring the milestone

- **Files:** cadence-core/bin/lib/branch-decision.mjs (symbols `activeVersion`,
  `DECLARED_VERSION_RE`, `VERSION_RE`), cadence-core/bin/branch-decision.test.mjs
- **Action:** `activeVersion` currently returns the FIRST line matching
  `DECLARED_VERSION_RE` anywhere in the `### Active` body, and computes its
  `loose` fallback only over the lines above that match. Both halves are the
  residue. Make the two scans run over the WHOLE body - the first version token
  anywhere, and the line-anchored candidates - and admit a line-anchored token as
  the declaration only when it either equals the body's first version token
  (D-02's agreement test) or opens a sentence rather than continuing one. A
  line-anchored candidate whose preceding body line is non-blank and does not
  close a sentence is a markdown wrap, not a declaration: at `81bdb5d` the only
  line-anchored token in the whole section was `v3.0.0`, left at a line start
  because the sentence "`### Validated` above stops at `v2.6.0`; `v2.7.0`," wrapped
  there, and the milestone `v3.2.0` sat forty lines above it in prose. When no
  candidate is admitted, the `loose` first-token-anywhere answer stands, so a
  section that only ever mentions its version mid-sentence still answers (D-02
  keeps the fallback; deleting it goes silent on
  `cadence-core/templates/PROJECT.md`, whose `### Active` is a requirement bullet
  list naming no version at all, and the ROADMAP fallback cannot cover it -
  `.planning/ROADMAP.md`'s title carries no version, so `titleVersion` is null on
  this repository). Treat trailing markdown furniture (a closing backtick,
  asterisk, underscore, paren, bracket or quote) as transparent when testing
  whether the previous line closed its sentence, since this tree's prose ends
  sentences inside code spans. `DECLARED_VERSION_RE` and `VERSION_RE` keep their
  current shapes - the anchor is the `af370e4` fix for reading a MENTION as the
  milestone, and this task narrows WHICH anchored lines count, never the token
  grammar. Record in the header comment that this reader is shared, so
  `git-branch.mjs decide`'s integration-branch naming and its already-published
  refusal move with it (D-01), and that a disagreeing anchored reading reports
  nothing rather than the wrong version (D-02). Add fixtures beside the existing
  `activeVersion` block: the `81bdb5d` wrapped-continuation shape, a body naming a
  predecessor in prose above the line that declares the milestone, and a body
  whose ONLY token sits on a continuation line (it must still answer, not go
  null). Carry a `WATCHED FAILING AT <sha>` header on the new block naming the
  branch tip before this task's commit, in the form the tree already uses at
  `cadence-core/bin/trace-suggest.test.mjs:726` - the observed failing output
  pasted under it. The four fixtures at lines 237-266 are edited in no way: the
  first of them ("the line-anchored declaration wins over a predecessor named
  first") is the case D-02's agreement test alone would turn null, and the
  sentence-opening admission is what keeps it green.
- **Verify:** `node --test cadence-core/bin/branch-decision.test.mjs` exits 0
  with the four pre-existing `activeVersion` fixtures unmodified in the diff;
  `node --test cadence-core/bin/*.test.mjs` exits 0; and re-running the new
  fixture block against the tree its `WATCHED FAILING AT` header names exits
  non-zero.

### Task 2: Rewrite the DOC-02 pin's remedy to name the reader, not the file

- **Files:** cadence-core/bin/prose-agreement.test.mjs (test "PROJECT.md's
  `### Active` declares its milestone as the section's first version token")
- **Action:** That test asserts the two-scan agreement property and then tells
  the reader to fix the FILE, stating in its comment that "activeVersion() and
  DECLARED_VERSION_RE are NOT changed and get no fallback (D-07)" and that
  "the file is what moves when this goes red". Task 1 moved the property into the
  reader, so both sentences now contradict the shipped code. Rewrite the comment
  and the assertion's failure message so they state what task 1 did and what a
  red run now means for this repository's own `PROJECT.md`, and cite the
  reversal as phase 2 D-03. The literal sentence "Fix the section - declare the
  milestone on its own line above every mention - rather than the anchor" must
  not survive anywhere in the tree. The test's mechanics - the body bound at the
  next level-1..3 heading, the locally spelled token grammar, the `activeVersion`
  comparison - are not restructured: this task changes prose, and D-03 scopes it
  to the pin's comment and failure message.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` exits 0,
  and `grep -rn "Fix the section - declare the milestone" .` returns no lines.

### Task 3: Bound tag discovery to the caller's own project root

- **Files:** cadence-core/bin/lib/git-tags.mjs (symbol `readTags`),
  cadence-core/bin/git-branch.mjs (`decide`, the `readTags` call feeding
  `publishedVersions`), cadence-core/bin/planning.mjs (`cmdAudit`, the `readTags`
  call feeding `tagCarrying`), cadence-core/bin/git-branch.test.mjs,
  cadence-core/bin/planning.test.mjs
- **Action:** `readTags` runs `git -C <dir> tag --list`, and `git -C` discovers
  the repository UPWARD, so a project that is not itself a repository inherits an
  enclosing repository's tags - and `cmdAudit` asks the question from
  `.planning`, which never holds `.git` (`cadence-core/workflows/audit.md:19`
  invokes the seam with no `--dir`, and `dir` defaults to `.planning`). Give
  `readTags` a second argument carrying the project root the answer must belong
  to, and answer `[]` when it does not: probe `git -C <dir> rev-parse
  --show-toplevel`, and accept the tag list only when that toplevel IS the root
  or sits inside it, comparing resolved absolute paths segment-wise so `/a/bc` is
  not read as inside `/a/b`. D-06 pins this shape - a structured comparison, not
  a diagnostic string - and it is what keeps a linked worktree working:
  `--show-toplevel` in a worktree returns the worktree root itself, which is the
  root the caller derived, so the shared tag still reads. Derive that root PER
  CALLER (D-07), because the two callers pass different directories:
  `git-branch.mjs decide` already receives the PROJECT root and joins `.planning`
  itself, while `cmdAudit`'s `dir` IS the planning root, so its project root is
  that directory's parent, resolved before comparison (`dirname('.planning')` is
  `.`). Keep every failure permissive at `[]` with no new named reason (D-08):
  "no tags", "not a repository" and "the repository is not this project's"
  deliberately collapse, as the module header already states, and phase 1's D-05
  keeps a read-only operation permissive. State in the header comment that the
  upward discovery `dir` used to rely on is now bounded and why. Cover both
  callers: in `git-branch.test.mjs`, a non-repository project inside a tagged
  umbrella repository no longer takes the already-published `ask` arm; in
  `planning.test.mjs`, the same shape emits no `version_drift` where it did
  before, and an audit run from a LINKED WORKTREE of a real tagged repository
  still emits one (that fixture is what proves the bound did not simply disable
  the reader - this repository runs executors in worktrees, `cd5aed6`). Carry a
  `WATCHED FAILING AT <sha>` header on the TAG-01 fixture block naming the branch
  tip before this task's commit. Do not touch the two no-`-C` `rev-parse
  --show-toplevel` callsites at `planning.mjs:2317` and `:3540`: D-12 records
  them here and this phase does not carry them.
- **Verify:** `node --test cadence-core/bin/*.test.mjs` exits 0; a scratch tree
  where a tagged umbrella repository contains a non-repository project whose
  `### Active` names that tag returns no `version_drift` key from `node
  cadence-core/bin/planning.mjs audit --dir <sub>/.planning`, while the same
  audit inside a linked worktree of a tagged repository still returns one; and
  the TAG-01 fixture block fails when re-run against the tree its `WATCHED
  FAILING AT` header names.

### Task 4: Exempt the sanctioned rolled-over phase from the drift signal

- **Files:** cadence-core/bin/planning.mjs (`cmdAudit`, the `settled` predicate
  and the `cycleOpen` derivation beside the `version_drift` block),
  cadence-core/bin/planning.test.mjs
- **Action:** `cycleOpen` is true when any derived phase is not `settled`, and
  `settled` reads only phase artifacts - `status === 'complete'` or a checklist
  whose every item is `pass`, `blocked`, or `skipped` with a reason. A close is
  sanctioned to carry rolled-over work (`cadence-core/workflows/milestone.md:121-122`
  names the state), and such a phase is byte-identical on disk to one still being
  worked, so no artifact and no archive probe can tell them apart (D-05). Key the
  exemption on the REQUIREMENT ROWS instead (D-04): a phase also stops holding
  the cycle open when the Traceability rows naming it are all `Deferred`. Read
  those rows from the `rows` array `cmdAudit` already built with
  `parseRequirements`, matching a row's phase number against the derived phase's
  - no second read of `REQUIREMENTS.md`. A phase with NO rows at all is NOT
  exempt (planner's choice, recorded here): an empty set satisfies "every row is
  Deferred" vacuously, and an unplanned or unseeded phase is the ordinary
  mid-cycle state issue #87 fires on, so the exemption requires at least one row
  and every one of them `Deferred`. A rolled-over phase whose rows are still
  `Pending` keeps the gate armed, which is D-04's other half. Extend the comment
  block above `settled` to state this arm and why the requirement rows are the
  only surface that carries the answer; that comment is the design record the
  next reader gets. Add two fixtures to the `version_drift` block in
  `planning.test.mjs`, built on the existing `taggedTree`/`cycleSpec` helpers: a
  tagged tree whose sole unsettled phase carries an all-`Deferred` row set emits
  no `version_drift`, and the identical tree with those rows `Pending` still
  emits one. Carry a `WATCHED FAILING AT <sha>` header on that pair naming the
  branch tip before this task's commit. The `blocked` arm and its two fixtures at
  `planning.test.mjs:2552-2586` are untouched - D-10 records that half as already
  shipped at `b3a9346`.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` exits 0 with both
  new fixtures present, the all-`Deferred` tree returning no `version_drift` key
  and the `Pending` tree returning `{doc_version, published_as, cycle_state}`;
  `node --test cadence-core/bin/*.test.mjs` exits 0; and the new pair fails when
  re-run against the tree its `WATCHED FAILING AT` header names.

### Task 5: State the rolled-over exemption where the audit's reader looks

- **Files:** cadence-core/workflows/audit.md (the `version_drift` bullet in the
  signal list), cadence-core/bin/weight-budgets.json (the
  `cadence-core/workflows/audit.md` entry)
- **Action:** The `version_drift` bullet offers two exits - open the next version,
  or "complete the close so no phase is left open" - and the second is not
  reachable for a phase deliberately rolled over, which is the state the workflow
  otherwise treats as sanctioned. Add the third fact the seam now implements: a
  phase whose requirement rows are all `Deferred` no longer holds the cycle open,
  so rolling work forward is an exit as well as completing the close. Keep it to
  that bullet and keep it short - this file is budgeted, its prose is
  dispatch-resident, and the surrounding exits are one sentence each. Re-pin
  `cadence-core/workflows/audit.md` in `weight-budgets.json` to the file's new
  exact byte count in this same commit (D-11): the budget check is blocking in
  both directions, so an edit that SHRINKS the file fails self-verify exactly as
  one that grows it. `milestone.md` and `verify.md` are not edited, so their pins
  do not move.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 and reports no
  budget problem for `cadence-core/workflows/audit.md`; the pinned number equals
  `wc -c < cadence-core/workflows/audit.md`; and the bullet names the
  all-`Deferred` exit.

## Notes

**Plan shape deviation from CONTEXT.** The CONTEXT directive asks for multiple
plans - DRF-01 plus TAG-01 in one, DRF-02 in another. The file-independence test
refuses it: TAG-01's second caller is `cmdAudit`'s `readTags` call at
`cadence-core/bin/planning.mjs:1299` and DRF-02's fix is the `settled` predicate
at `:1300-1318`, adjacent lines in the same function, and both slices add
fixtures to `cadence-core/bin/planning.test.mjs`. Two plans declaring those files
would either overlap a lease or leave TAG-01 unbounded at the caller D-07 names
as the live one. Five tasks fit one plan under the ceiling of 8, so the phase is
delivered as a single PLAN.md.

**D-02 was amended, not reinterpreted.** The `plan` gate confirmed D-02's original
wording unsatisfiable: applied as the ONLY admission test it turns the fixture at
`branch-decision.test.mjs:237-246` null (anchored `v2.6.0`, first token `v2.5.0`)
while AC2 pins that fixture to pass unchanged, and AC1 requires the milestone to
ANSWER on a disagreement rather than report nothing. CONTEXT's D-02 was amended
2026-08-18 to the rule task 1 implements - accept the anchored token on agreement
OR on a line that OPENS a sentence rather than continuing a wrapped one, a
rejected anchor contributing nothing so the earlier correct mention answers. Task
1 is therefore executing a locked decision, not diverging from one.

**AC5 was amended to match D-08.** AC5 asked for a `version_drift` envelope
"reporting no published version" for the umbrella case, which contradicts D-08's
permissive `[]` and the pin at `planning.test.mjs:2600-2612`. AC5 now reads "emits
NO `version_drift`", which is what task 3's verification already asserts.

**Ledger drift, not a task.** `.planning/DOCS-CLAIMS.md` rows AUDIT-25 and
AUDIT-39 cite `audit.md` lines 105-113, which task 5 shifts. That ledger is a
dated sweep record rather than a live claim surface, no acceptance criterion
covers it, and re-numbering it here would be scope invention - raised for the
human rather than planned.
