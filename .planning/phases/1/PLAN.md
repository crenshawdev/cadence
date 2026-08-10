---
phase: 1
plan: 1
requirements: [CTW-01, CTW-02]
files:
  - cadence-core/bin/lib/deferred-reads.mjs
  - cadence-core/bin/deferred-reads.test.mjs
  - cadence-core/bin/lib/resident-weight.mjs
  - cadence-core/bin/lib/include-consumers.mjs
  - cadence-core/bin/include-consumers.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - .planning/DOCS-CLAIMS.md
  - .planning/ROADMAP.md
---

# Phase 1: The checks that make the cuts safe - Plan

## Goal

A deferral this cycle makes is watched by CI afterwards, and the class of defect
that motivated the cycle - a 5,792 B eager include nothing has ever read - cannot
return silently.

## Must be true when done

- A register row can anchor a deferral whose `Read` sentence lives in a
  `<step name="...">` workflow region, in a heading-scoped workflow walk step, or
  in a contract skill, and `self-verify` reports exactly one
  `deferred-read-unread` when that one sentence is deleted from the fixture.
- A `Read` sentence sitting in a different region of the same file - another
  numbered item inside the same named step, another walk step, another heading -
  never satisfies an anchor it does not belong to.
- Running the include-consumer rule with no waivers over a byte-copy of the live
  `skills/cad-verify/SKILL.md` plus `cadence-core/workflows/verify.md` reports
  exactly one problem naming `cadence-core/templates/UAT.md`; the same rule over
  a byte-copy of `cad-help` reports none.
- `node cadence-core/bin/self-verify.mjs` on the live tree returns `ok:true` with
  `problems:[]`, and its `checked` string names the new check.
- The four existing register rows are byte-identical, `DEFERRED_READS.length` is
  still 4, and `node cadence-core/bin/weight.mjs resident --root .` prints the
  same bytes it printed before the phase.
- The one waived include cannot outlive its `@`-include line: deleting that line
  without deleting the waiver row turns `self-verify` red.

## Context

Locked decisions that bind this plan: D-01..D-04 (anchor grammar), D-05/D-06
(register shape and its degradation), D-07 (contract skills need no new code
path), D-08/D-09/D-10/D-12 (the include-consumer rule's exemption, matching form,
scan set and scope), D-11 (new lib plus the disk half in `self-verify.mjs`, NO
`CONTRACTS` row), D-13/D-14 (fixtures, not live-tree assertions; no new register
rows this phase), D-15 (check 16, appended to `checked`, plus a ledger row).

Out of scope, and no task may do it: deleting `skills/cad-verify/SKILL.md:29`
(phase 2), adding register rows for phase 3's deferrals (phase 3), and any prose
edit at all. No workflow, reference, skill, contract or template gains or loses a
byte, so `weight-budgets.json` is not touched and no budget is re-pinned. Every
new byte in this phase is `.mjs` source, `.mjs` test or the planning ledger.

Patterns to follow: the pure-rule/disk-half split `lib/merge-warnings.mjs`,
`lib/route-relay.mjs` and `lib/config-reach.mjs` use; the lib-test convention of
`cadence-core/bin/debt-markers.test.mjs` (its own `*.test.mjs` beside `bin/`,
node builtins only); the per-entry read guard in `lib/resident-weight.mjs`.

## Tasks

### Task 1: Register rows name their own file, and the rule takes its rows as a parameter

- **Files:** cadence-core/bin/lib/deferred-reads.mjs, cadence-core/bin/deferred-reads.test.mjs
- **Action:** Add an OPTIONAL `file` field to the register row type: a
  root-relative POSIX path saying where the `Read` sentence must live, defaulting
  to `skills/${row.skill}/SKILL.md` so all four shipped rows stay byte-identical
  (D-05). Do not add, reorder or edit a row - the register stays at four until
  phase 3 (D-14). Change the signature to
  `deferredReadIssues(root, rows = DEFERRED_READS)`, typed in JSDoc the way
  `DEFERRED_READS` is; `self-verify.mjs` keeps calling it with one argument. The
  parameter exists because the acceptance criteria anchor synthetic rows at real
  workflow files while the live register must stay at four rows, and because a
  test that anchors against the shipped rows would be asserting the register
  against itself. Keep `skill` as the target of the `stillEager` and
  `missingSkill` arms - the `@`-include line always lives in the SKILL.md even
  when the `Read` sentence lives in a workflow (D-05). Resolve the anchor text:
  when `file` is absent or equals the default, reuse the SKILL.md text already
  read; otherwise join `root` with the row's `file` and read it under the same
  try/guard, degrading exactly the way the skills level already does (D-06) - if
  the file's PARENT directory does not exist, `continue` with nothing reported (a
  partial fixture carrying no `cadence-core/workflows/` arm is not a break), and
  if that directory exists while the file is absent or unreadable, push a new
  `CODES.missingFile` = `deferred-read-missing-file` naming the row's reference,
  skill and file. Do not reuse `missingSkill` for this: a workflow file is not a
  skill and the existing detail string would misname the fault. Rewrite the
  header's Scope paragraph at `:40-44`: contract skills are IN scope, state that
  `deferredReadIssues` never carried a `user-invocable` filter so no branch
  changed, that the retired rationale priced main-thread residency only and does
  not price subagent context, and that the include-consumer check added in this
  same phase is deliberately the other way round (commands only, D-12), so the
  first contract-side `@`-include is a known uncovered case rather than a
  surprise. Leave the SENTENCE-unit paragraph and the anchors-not-a-count
  paragraph exactly as they are; both reasons still hold. Create
  `cadence-core/bin/deferred-reads.test.mjs` on the `debt-markers.test.mjs`
  pattern (node builtins, `node --test`, importing the lib directly) and put the
  AC3 pair in it: `cpSync` the real `skills/cad-executor-contract/SKILL.md` into
  a temp root, insert ONE `Read` sentence naming
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/seams.md` into step 3 of its
  `<process>`, assert `deferredReadIssues(root, [row])` is `[]` for a row
  anchored at `3`, then delete that one sentence and assert exactly one
  `deferred-read-unread` whose detail names step 3. **That pair alone does not
  prove the phase's contract claim** (review finding 2): step 3 of a `<process>`
  is a region the OLD grammar already labelled, so an implementation could omit
  the plain-tag branch entirely and still pass it. Add a SECOND contract pair on
  the same `cpSync`ed file, anchored at `worktree_mode` with the `Read` sentence
  inserted inside `<worktree_mode>` (an unnamed, unnumbered plain tag) - clean
  with the sentence, exactly one `deferred-read-unread` naming `worktree_mode`
  without it. That block is what D-07 names as the real uncovered spot and what
  ROADMAP phase 3 criterion 3 moves (`cad-executor-contract:151-193`), so it is
  the case that must be tested rather than the one that already worked. Add the
  two `missingFile` arms (parent directory absent reports nothing; parent present
  and file absent reports one).
- **Verify:** `node --test cadence-core/bin/deferred-reads.test.mjs` passes, and
  `node --test cadence-core/bin/self-verify.test.mjs` still passes with its
  check-13 block untouched (it asserts `DEFERRED_READS.length === 4` and the
  `4(a)`/`4(b)` anchors, so a register edit fails it).

### Task 2: regionLabels labels named steps, nested numbered items and plain tag blocks

- **Files:** cadence-core/bin/lib/deferred-reads.mjs, cadence-core/bin/deferred-reads.test.mjs
- **Action:** Replace `regionLabels()`' `inProcess`/`step`/`arm` scalars with a
  STACK of open block frames. The open matcher accepts a whole line that is
  either `<tag>` or `<tag key="value" ...>` - today's `^<([a-z_]+)>\s*$` rejects
  attributes, which is half of why `workflows/execute.md` produces zero labelled
  lines (D-01). A frame's label is: the `name=` attribute value when the tag
  carries one (D-03, so `<step name="execute_parallel">` labels
  `execute_parallel`); `null` for `<process>`, which preserves today's bare `3`,
  `4(a)`, `4(b)` and `2` labels for the four live rows; and the TAG NAME itself
  for every other tag, so a `Read` sentence in `<worktree_mode>` is anchorable at
  `worktree_mode` (D-07 names that as the real uncovered spot, and ROADMAP phase
  3 criterion 3 moves `cad-executor-contract:151-193`, which is that block and
  carries no numbered step). A close line pops the top frame when the tag names
  match and otherwise leaves the stack alone; it must NOT clear the enclosing
  frame - `execute.md:13` opens `<process>`, `:15` opens `<step name="locate">`
  and `:47` closes the step, and today that close switches `<process>` off for
  the rest of the file (D-01). Reset the current numbered item and lettered arm
  on every open AND every close, keeping the existing "a new block always ends
  the previous block's step numbering" property. Keep the two item markers as
  they are: column-0 `^(\d+)\.\s` sets the item, indented `^\s+\*\*\(([a-z])\)`
  sets the arm. Compose the label as: no frame label and no item gives `null`; no
  frame label with an item gives today's bare `<item>` / `<item>(<arm>)`; a frame
  label with no item gives the frame label; a frame label with an item gives
  `<frame>(<item>)`, and an arm appends `(<letter>)` to whatever the label
  already is (`execute_parallel(6)`, `execute_parallel(6)(a)`). One boundary the
  "no frame label with an item" arm must NOT swallow: with an EMPTY frame stack
  and no heading path, a numbered item yields `null`, exactly as today, and a
  bare `<item>` label is emitted only inside a frame whose own label is `null`
  (in practice `<process>`). Without that clause a column-0 `1.` sitting outside
  every block and before any `##` would newly label bare `1`, and a bare number
  outside `<process>` can collide with a live anchor - `cad-land` rows anchor at
  `3` and `4(a)`, `cad-plan-review` at `2`. No live skill has such a list today
  (every numbered item in both anchored skills is inside `<process>`), so this is
  latent rather than immediate, and it stays latent only if the clause is
  written. Never emit a bare
  `"1"`..`"6"` for a numbered item inside a named step: `execute.md:343-402` puts
  `1.`-`6.` at column 0 inside `execute_parallel` and `verify.md` and
  `new-project.md` carry 15 more such lines, so bare numbers would let two
  regions in one file both label `"3"` and an anchor would be satisfied by a
  `Read` in an unrelated bullet - the file-wide-quota defect this register
  already shipped once, in a new spelling (D-03). Matching stays EXACT, never
  prefix: an anchor `execute_parallel` is not satisfied by a sentence inside
  `execute_parallel(6)`, the same way `4` and `4(a)` are distinct today. Rewrite
  the `regionLabels` doc comment accordingly: the protection is label EXACTNESS,
  not null-ness, now that `<guardrails>` labels `guardrails` instead of `null` -
  relocating an arm's `Read` into it still fails, because `guardrails` is not
  `4(b)`. Only the preamble before the first block, heading or step stays
  regionless. Add to `deferred-reads.test.mjs`: the AC1 pair on a `cpSync` of the
  real `cadence-core/workflows/execute.md` plus the real
  `skills/cad-execute/SKILL.md`, with one `Read` sentence inserted in the
  `execute_parallel` step body and a row whose `file` is
  `cadence-core/workflows/execute.md` and whose anchor is `execute_parallel` -
  clean, then exactly one `deferred-read-unread` naming `execute_parallel` when
  that sentence alone is deleted; the AC4 falsifier on the same fixture, anchor
  `execute_parallel(6)` with the `Read` sentence sitting in item 1, asserting it
  is still unread and the detail names `execute_parallel(6)`; and a `<step name=`
  region with NO `<process>` wrapper, on a `cpSync` of the real
  `cadence-core/workflows/verify-deep.md` anchored at `merge` (D-04, that file
  carries three `<step name=` tags and no wrapper).
  Finally, SNAPSHOT the four live rows' labels directly (review finding 7). The
  existing "relocated ELSEWHERE", "wrong STEP" and "deleting the ARM" tests only
  establish that SOME qualifying `Read` is still found, not that each old anchor
  still denotes the same region - and this rewrite changes plain tags from
  transparent to labelled frames and resets item/arm state on every open AND
  close, so a `Read` after a nested close could start denoting a different region
  while `self-verify` stays green because another sentence accidentally satisfies
  the old anchor. Add a test that, for each of the four shipped rows, computes
  `regionLabels()` over the row's real file and asserts the label at the line of
  its known `Read` sentence equals the row's anchor exactly (`3`, `4(a)`,
  `4(b)`, `2`). That is a direct assertion of preservation rather than an
  inference from absence.
- **Verify:** `node --test cadence-core/bin/deferred-reads.test.mjs` passes
  including both falsifiers and the four-row label snapshot, and `node --test
  cadence-core/bin/self-verify.test.mjs` passes unchanged.

### Task 3: Heading-scoped labels for workflows that carry no tags

- **Files:** cadence-core/bin/lib/deferred-reads.mjs, cadence-core/bin/deferred-reads.test.mjs
- **Action:** Add the third marker family (D-02). When the block stack is EMPTY,
  a line matching `^(#{2,6})\s+(.+?)\s*$` sets the current heading path: a level-2
  heading replaces the path, a deeper level extends or truncates it to that
  level. An `#` H1 is IGNORED - `config.md:1` is the document title and including
  it would prefix every label in the file with `cad-config workflow/`. Take the
  heading text VERBATIM after the marker, trimmed, with no normalization, so
  `## Interactive menu (no args)` plus `### The walk` plus item 2 labels
  `Interactive menu (no args)/The walk/2`. Do not strip parentheticals or
  leading ordinals: a normalization rule nobody can predict by reading the file
  is worse than a long label, and CONTEXT already flags the label form's
  ergonomics as unproven until phase 3 writes the first real row (a one-row
  change if it reads badly, not a grammar change). Compose: the path alone is a
  label, a numbered item appends `/<n>`, an arm appends `(<letter>)`. A heading
  INSIDE an open block is ignored for labelling - block frames win, so a workflow
  mixing `<process>` with headings keeps its step labels and no file gets two
  competing label families at one line. Without this, `config.md` (zero
  `<process>`, zero `<step name=`, and the same style in `debug.md` and
  `phase.md`) has no anchorable region at all, and phase 3's largest single move,
  `config.md:71-133` at 8,052 B, would ship unwatchable - the precise dependency
  phase 3 declares on this phase. Add the AC2 pair to
  `deferred-reads.test.mjs`: `cpSync` the real `cadence-core/workflows/config.md`
  and `skills/cad-config/SKILL.md`, insert one `Read` sentence into the
  Interactive-menu walk's step 2, anchor a row at
  `Interactive menu (no args)/The walk/2` with `file` naming that workflow, and
  assert clean, then exactly one `deferred-read-unread` naming that label when
  the sentence is deleted. Add the cross-region falsifier: the same sentence
  moved into walk step 1, and again under `## Direct set`, leaves the anchor
  unsatisfied.
- **Verify:** `node --test cadence-core/bin/deferred-reads.test.mjs` passes with
  the config.md pass/fail pair and both wrong-region falsifiers; `node --test
  cadence-core/bin/self-verify.test.mjs` still passes.

### Task 4: resident-weight exports the eager set it already builds

- **Files:** cadence-core/bin/lib/resident-weight.mjs
- **Action:** Extract the per-command eager assembly at `:249-263` into an
  exported `commandEagerSets(root)` and have `residentWeight` consume it, so the
  new check reuses the eager/reachable split rather than re-walking the tree
  (D-11, CTW-02). It returns one entry per USER-INVOCABLE command - the same
  `user-invocable: false` filter `residentWeight` applies at `:254-257`, which
  keeps contract skills accounted under `roles` (D-12) - carrying: the command
  directory name; the root-relative `skills/<name>/SKILL.md`; `includes`, the raw
  relative paths captured off the `@${CLAUDE_PLUGIN_ROOT}/...` lines by
  `INCLUDE_RE`, in line order, duplicates preserved; and `surfaces`, the
  `readSurface` results (`key`, `surface`, `bytes`, `text`) for the SKILL.md
  first and then each include that resolved, nulls dropped. **State in the JSDoc
  which field is the ROOT-RELATIVE POSIX path** (review finding 6): Task 5's
  self-citation exclusion drops "the surface whose root-relative path is the
  include's own", and if the field it compares turns out to be a realpath or a
  dedupe key that comparison silently never matches, so a self-citing included
  reference names itself and passes - the exact vacuity D-10 exists to prevent,
  with every listed fixture still green because they only test self-naming via
  the `@` line. Name `surface` as that field explicitly, and if `key` is not
  root-relative say so in the same sentence so the two are never confused at the
  callsite. Expose the raw
  include paths as well as the resolved surfaces because the consumer check must
  judge an include line whose target is ABSENT from the root it is given - a
  fixture that copies only a SKILL.md and its workflow - where the weighing side
  correctly drops it as zero bytes. `residentWeight` then adds `surfaces` to its
  `surfaceSet` in the order given and sorts `commands` afterwards exactly as
  today, so the realpath dedupe, the byte totals and the ordering are unchanged.
  Its returned envelope must not gain, lose or rename one field:
  `docs/EVIDENCE.md:36,75,97,108` prints that envelope verbatim as evidence
  (D-11). Add a header paragraph naming the helper as the shared eager-set
  builder and stating the include-paths rationale above.
- **Verify:** Before editing, run `node cadence-core/bin/weight.mjs resident
  --root . > /tmp/resident-before.json`; after editing, run it again into
  `/tmp/resident-after.json` and `diff` the two - no difference. `node --test
  cadence-core/bin/weight.test.mjs` passes.

### Task 5: The include-consumer rule, with its one stated waiver

- **Files:** cadence-core/bin/lib/include-consumers.mjs, cadence-core/bin/include-consumers.test.mjs
- **Action:** New pure rule lib on the `lib/merge-warnings.mjs` shape - no emit,
  no exit, no Date, no randomness, node builtins only, every read guarded.
  Export `CODES` frozen as `{neverNamed: 'include-never-named', staleWaiver:
  'include-waiver-stale', expiredWaiver: 'include-waiver-expired'}`, a frozen
  `WAIVED` register, and `includeConsumerIssues(root, waived = WAIVED)`. For each
  entry from
  `commandEagerSets(root)`, take each include path matching
  `cadence-core/<branch>/<file>` where branch is `references`, `templates` or
  `workflows`; anything else is skipped (check 3 already owns path existence and
  no live include has another shape). A `workflows/` include is EXEMPT: the
  workflow IS the command's process, and measured over the live tree
  `workflows/<name>.md` is named nowhere in its own command's eager text for 15
  of 16 commands, so an unexempted check lands red on 19 correct includes (D-08).
  Position-based exemption is not available because `resident-weight.mjs:183-186`
  sorts by surface. For each remaining include, build the scan text by joining
  that command's surface texts EXCLUDING the surface whose root-relative path is
  the include's own, then dropping every line that starts with
  `@${CLAUDE_PLUGIN_ROOT}/`. Both exclusions are load-bearing: `CITE_RE` at
  `resident-weight.mjs:77` matches the include line itself and yields
  `templates/UAT.md` from it, so leaving those lines in makes every include name
  itself and the check `ok:true` forever with the CI hole reported closed (D-10);
  and `cadence-core/references/config-reach.md` names its own path in its own
  body, so a surface that cites itself would otherwise vacuously pass. The scan
  set is EAGER-ONLY, and the lib header must say so: CTW-02's wording is
  "reachable prose", but one-hop cited references are deliberately excluded,
  because a citation is not the including command's own instruction - the
  question the check asks is whether the command itself ever tells anyone to use
  the surface it paid to load. The cost is a false positive for a command whose
  include is named only in a cited-but-not-eager reference; no live command is in
  that shape (Task 6's verify asserts the live tree files zero `neverNamed`), and
  if one appears the fix is a waiver row with its reason, not a widened scan.
  This is a narrower claim than D-10, which refuses to DERIVE the scan set from
  `reachableFiles` because every eager file is added to it unconditionally; that
  is about the set being vacuous, this is about which hop counts. Test the
  scan text for the `<branch>/<file>` form as a word-boundary-anchored literal,
  never the basename - `workflows/verify.md:3,177,182,211,324,341,352,364` all
  say bare `UAT.md` for the runtime artifact `.planning/phases/<N>/UAT.md`, so
  basename matching would stop the check firing on the one instance it must catch
  (D-09) - and one literal covers the `${CLAUDE_PLUGIN_ROOT}/cadence-core/`, the
  `cadence-core/` and the bare citation forms at once, since all three end in the
  same suffix. An include no scan text names, and that no waiver row covers, is
  one `neverNamed` issue filed against `skills/<command>/SKILL.md`, its detail
  naming the include path and saying no eager surface of that command names it.
  `WAIVED` carries exactly ONE row, `{skill: 'cad-verify', surface:
  'templates/UAT.md', removeInPhase: 2}`, and the header must state plainly why
  it exists: AC5
  requires the rule to report this include on a byte-copy of the live bytes while
  AC7 requires `problems:[]` on the live tree, and those are the same bytes, so
  the row is the bridge that keeps CI green until phase 2 deletes the include
  (CTW-03, ROADMAP phase 2 criterion 1). The header states it as a PHASE-2 BRIDGE
  with a scheduled removal, in those words, and names the commit that removes it:
  the register is not a general-purpose escape hatch and must not grow a second
  row. The risk being managed is that a phase whose purpose is closing CI holes
  ships the mechanism that reopens them, so the size of the register is itself
  asserted (`WAIVED.length === 1` in this lib's test and again through the CLI in
  Task 6) - appending a row instead of fixing an include is a red build, not a
  code-review judgement call. The row is not a defence of the include
  and cannot become one, and it is bounded in BOTH directions (review finding 4).
  Downward: the waiver arm reports `staleWaiver` against a waived row whose skill
  EXISTS in this root and no longer carries that `@`-include line, so phase 2's
  deletion turns self-verify red until the row goes with it. Upward: `removeInPhase`
  is an executable deadline, not a comment - the rule reports `expiredWaiver`
  when `.planning/ROADMAP.md` shows that phase checked off (`- [x] **Phase <n>:`)
  while the row still exists. Without the upward bound, a phase 2 that slips or
  is dropped leaves the exact defect this phase says cannot return silently
  suppressed indefinitely with CI green, since `staleWaiver` only ever fires on a
  deletion that by then has not happened. A waiver row whose skill is absent from
  the root reports nothing, and an unreadable or absent ROADMAP reports no
  `expiredWaiver` - the same partial-fixture degradation
  `lib/deferred-reads.mjs:186-208` uses, so a fixture root carrying no `.planning/`
  arm is not a break. Write
  `cadence-core/bin/include-consumers.test.mjs` on the lib-test convention:
  AC5's first half, a root holding `cpSync` byte-copies of the real
  `skills/cad-verify/SKILL.md` and `cadence-core/workflows/verify.md` and nothing
  else, where `includeConsumerIssues(root, [])` returns exactly one issue whose
  detail names `cadence-core/templates/UAT.md` and whose file is
  `skills/cad-verify/SKILL.md`, and where the shipped `WAIVED` returns none;
  AC5's second half, a byte-copy of `skills/cad-help/SKILL.md` returning zero
  under both, because its objective names `references/COMMANDS.md` in prose;
  AC6, a synthetic skill whose only mention of its included reference is the
  `@`-include line, reporting one problem; a `workflows/` include with no mention
  anywhere reporting none; a stale-waiver fixture where the include line has been
  removed reporting one `include-waiver-stale`; an EXPIRED-waiver fixture whose
  `.planning/ROADMAP.md` carries `- [x] **Phase 2:` while the include line is
  still present, reporting one `include-waiver-expired`, plus its negative (the
  same root with phase 2 unchecked reports none, and a root with no `.planning/`
  reports none); a self-citing fixture whose INCLUDED file names its own
  `<branch>/<file>` path in its own body and nowhere else, reporting one
  `neverNamed` - this is what proves the root-relative exclusion actually matches
  rather than silently never matching (review finding 6); and `WAIVED.length === 1`
  with the array and its row frozen.
- **Verify:** `node --test cadence-core/bin/include-consumers.test.mjs` passes,
  including the byte-copy fixture reporting exactly one unnamed include under an
  empty waiver list and zero under the shipped one.

### Task 6: Register the check as check 16 in self-verify

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** Import `includeConsumerIssues` beside the other rule libs at
  `:100-110`, add a `16. include consumers` entry to the header list at `:11-89`
  (which currently ends at 15) saying what it checks and why - an `@`-include
  claims a consumer and this checks the claim, the same species as check 3 (paths
  exist) and check 6 (agent `skills:` resolve), and the opposite direction from
  check 13's "named but no longer included" - and push its issues in `run()`
  after check 15, then append `include-consumers` to the flat `checked` string at
  `:1166` (D-15). Add NO `CONTRACTS` row: check 14 is TOP-LEVEL only and
  deliberately non-recursive because `lib/*.mjs` are modules prose never invokes
  (`self-verify.mjs:1095-1098`), five rule libs are already imported exactly this
  way, and inventing a top-level script to justify a row would force
  `weight.mjs`'s `resident` envelope to grow a field that `docs/EVIDENCE.md`
  prints verbatim (D-11). ROADMAP phase 1 criterion 5 asks for that row and is
  wrong on the point. Add two tests to `self-verify.test.mjs` beside the existing
  check-13 wiring test: one asserting `checked` matches `/include-consumers/` and
  that a fixture root carrying a skill whose non-workflow include nothing names
  produces an `include-never-named` problem through the CLI, and one asserting
  the live `REPO` run carries zero `include-never-named`, zero
  `include-waiver-stale` and zero `include-waiver-expired` problems. The second
  test also asserts `WAIVED.length === 1` through this CLI path, so the
  register's size is guarded from the self-verify side and not only from its own
  lib test - growing the waiver register is a red build rather than a reviewer's
  judgement call.

  Two more CLI-level tests, because the phase's headline claims are currently
  proved only against the pure rules:

  - **Check 13 through the CLI on a workflow-anchored row** (review finding 1).
    AC1-AC4 as planned call `deferredReadIssues(root, [row])` directly, while
    `self-verify` keeps calling it with the default four rows - so the disk half
    could load the wrong register, drop a row carrying a non-default `file`, or
    fail to surface the issue at all, and every AC fixture would still be green.
    Give the check-13 disk half a test seam that lets a fixture supply rows (the
    same shape Task 1 gave the lib), and assert through the CLI that a synthetic
    row anchored at a `<step name="...">` region of a copied workflow file
    reports exactly one `deferred-read-unread` when its `Read` sentence is
    deleted, and none while it stands.
  - **`include-waiver-stale` at the integration boundary** (review finding 5).
    Task 5 tests the bridge invariant in the lib only, so a wiring regression
    that forwards `include-never-named` while filtering or remapping the stale
    arm would pass everything listed. Add a `self-verify` fixture that removes
    the waived `@`-include line while KEEPING the `WAIVED` row, and assert the
    CLI reports `include-waiver-stale`. This is the assertion behind the plan's
    "the one waived include cannot outlive its `@`-include line" must-be-true.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with
  `"problems":[]` and `include-consumers` inside `checked`; `node --test
  cadence-core/bin/self-verify.test.mjs` passes.

### Task 7: Ledger row for the new check, and the whole-phase live-tree proof

- **Files:** .planning/DOCS-CLAIMS.md, .planning/ROADMAP.md
- **Action:** First, write the phase-2 coupling somewhere phase 2 will actually
  read it. The `WAIVED` row and `skills/cad-verify/SKILL.md:29` must die in the
  SAME commit, and today that pairing exists only in this plan's own Notes, in a
  sentence addressed to a future author - phase 2's ROADMAP criterion 1 says only
  that the include is deleted. Extend ROADMAP phase 2 criterion 1 with: "the
  one-row `WAIVED` register in `cadence-core/bin/lib/include-consumers.mjs` is
  deleted in the same commit; leaving it turns `self-verify` red with
  `include-waiver-stale`", and add the same pairing to phase 2's **Depends on:**
  line. The failure mode is loud rather than silent, but a loud failure in a
  phase that did not know it was coming is still a phase interrupted. Then add
  the new check's claim to the ledger so the next docs sweep
  tracks it from the start rather than reporting drift after the merge (D-15).
  Append a `## Claims added after run 1` section AFTER the `## Claims` table,
  with a two-sentence preamble saying that run 1's positional ids and its
  509/18/20 = 547 counts describe run 1's table only, that rows here are claims
  the next sweep must re-verify on the same `doc` plus claim-text join rule, and
  that they are kept out of the run-1 table precisely so that count stays a true
  record of what was swept. One row, in the existing six-column shape:
  id `SELFVERIFY-01`, doc `cadence-core/bin/self-verify.mjs`, the line range of
  the new header entry, the claim that check 16 fails an `@`-included
  `references/*` or `templates/*` surface that no eager prose of the including
  command names while `cadence-core/workflows/*` includes are exempt, verdict
  `accurate`, resolution `accurate`. Do not edit the run-1 table, its counts or
  any existing row.
- **Verify:** Every command below must FAIL on its own defect, not merely print
  one (review finding 8 - the previous form used a bare `git diff`, which exits 0
  whether or not it prints changes, so the byte-identity claim could not be
  enforced by anything but a human reading output).
  1. `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with `"problems":[]`.
  2. `node --test cadence-core/bin/*.test.mjs` reports 0 fail.
  3. `git stash list >/dev/null; git diff --exit-code -- cadence-core/bin/lib/deferred-reads.mjs -- ':!*'` is not usable directly (the file legitimately changes in Tasks 1-3), so the byte-identity claim is asserted IN TEST instead: `deferred-reads.test.mjs` reads its own source, extracts the text between `export const DEFERRED_READS` and its closing `]);`, and compares it to a checked-in expected string. `node --test cadence-core/bin/deferred-reads.test.mjs` then fails on any edited, reordered or added row, where `DEFERRED_READS.length === 4` alone would not.
  4. `grep -q 'include-consumers.mjs' .planning/ROADMAP.md` exits 0 - the phase-2 coupling landed.
  5. `grep -q 'SELFVERIFY-01' .planning/DOCS-CLAIMS.md` exits 0 - the ledger row landed.
  6. `grep -c '^| ' .planning/DOCS-CLAIMS.md` counted before and after this task returns the same number for the run-1 `## Claims` table region - the new row is outside it and no existing row moved.

## Notes

Three deviations and discretionary calls, recorded rather than taken silently:

1. **AC5 and AC7 are mutually exclusive as written, and Task 5's one-row waiver
   is how this plan resolves it.** AC5 requires the check to report
   `cadence-core/templates/UAT.md` on a fixture that is a byte-copy of the live
   `skills/cad-verify/SKILL.md` and `cadence-core/workflows/verify.md`; AC7
   requires `problems:[]` on the live tree, which contains those same bytes.
   Measured: `templates/UAT.md` in the `<branch>/<file>` form appears nowhere in
   the plugin's prose except that one `@`-include line (it appears only in
   `CHANGELOG.md:475`, `weight-budgets.json:45` and two `bin/*.mjs` comments,
   none of which is prose the check may read), so no deterministic function of
   the live bytes can satisfy both. Deleting the include would satisfy both and
   belongs to phase 2 (D-13, CONTEXT "Out"). The waiver keeps D-13's durable
   requirement - fixture proof, CI never red - and the `staleWaiver` arm makes
   the row expire mechanically at phase 2's deletion instead of by memory. Phase
   2's context must carry this: deleting `skills/cad-verify/SKILL.md:29` and
   deleting the `WAIVED` row are one commit.
2. **Plain tag blocks get their tag name as a region label** (Task 2). D-07 names
   a `Read` sentence in `<worktree_mode>` as the real uncovered spot and says
   this phase's grammar reaches it, and that block carries no numbered step and
   no `name=` attribute, so nothing but a tag-name label reaches it. ROADMAP
   phase 3 criterion 3 moves exactly `cad-executor-contract:151-193`, which is
   that block. The cost is that `<guardrails>` stops being `null` and becomes
   `guardrails`; the relocation attack the existing test pins still fails,
   because the protection is label exactness rather than null-ness.
3. **Two smaller calls left to the planner's discretion:** heading labels take
   the heading text verbatim rather than normalized (Task 3), and a row whose
   `file` is absent gets its own `deferred-read-missing-file` code rather than
   reusing `deferred-read-missing-skill`, whose detail string would misname a
   workflow file as a skill (Task 1).

Plan shape follows the CONTEXT directive: one plan. Every task but 4, 5 and 7
touches `cadence-core/bin/lib/deferred-reads.mjs` or `self-verify.mjs`, and tasks
5 and 6 share the new check across the lib/disk split, so no independent slice
exists.

Recalled prior art applied: `weight.test.mjs:165,198,214` assert only the
internal self-consistency of one envelope, both sides derived from the same Map,
so Task 4's Verify compares the envelope against its own pre-edit bytes on disk
rather than adding another self-consistent assertion.
