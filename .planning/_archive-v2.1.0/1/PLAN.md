---
phase: 1
plan: 1
requirements:
  - COV-01
files:
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/planning-files.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/references/acceptance-criteria.md
  - cadence-core/workflows/audit.md
  - cadence-core/workflows/verify.md
  - cadence-core/workflows/verify-deep.md
  - cadence-core/templates/UAT.md
---

# Phase 1: The gate that proved nothing - Plan

## Goal

The coverage gate stops being able to pass a phase it did not check. A
checklist carrying items but none of the acceptance-criteria fields is REPORTED
as a verdict-moving break instead of exempted, the gate states the plugin
version it ran as, and the verifier's findings envelope survives the dispatch
that produced it.

## Must be true when done

- `criteria-coverage` on a tree carrying phase 6's shipped checklist (17 items,
  0 `criterion`, 0 `origin`, no `fields_version`) beside a CONTEXT declaring
  AC1-AC9 returns a `fieldless-checklist` break naming `phases/6/UAT.md`, does
  not list phase 6 in `legacy`, and counts those 9 criteria - so `/cad-audit`
  FAILs where it used to pass.
- A genuinely pre-field checklist (no marker, no links, beside a CONTEXT that
  declares no `AC<N>` ids) is still exempt, and each exemption states its reason
  instead of appearing as a bare phase number; a phase-3-shaped file (marker
  present, 7 `criterion`, 0 `origin`) is not exempt.
- Every `criteria-coverage` run states the plugin version and the UAT fields
  version it ran as, and a run pinned with `CADENCE_PLUGIN_MANIFEST` states the
  pinned manifest's version rather than the repo's.
- After a `uat merge`, `.planning/phases/<N>/FINDINGS.json` sits beside UAT.md
  holding the five counters plus the entries the merge discarded, is untouched
  by any later `uat record`, and is named in the files `/cad-verify` commits.
- A user routed to repair a dropped link can do it: `uat record --phase <N>
  --item <k> --result <status> --criterion AC3` writes the link, a value failing
  `^AC\d+$` is refused by name with the file byte-unchanged, and the flag exists
  in the seam contract table so prose may name it.
- Every shipped surface that states the coverage rule states the rule the seam
  now implements, including the four that state today's rule and the one
  (`workflows/verify.md:84-86`) that is already false.
- `node --test cadence-core/bin/*.test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs` are all green on the edited tree, with
  no `budget-overrun` on any surface this phase touches.

## Context

Locked decisions bind this plan: D-01 (legacy gains a fifth term - the phase's
CONTEXT declares no `AC<N>` ids), D-02 (ONE `fieldless-checklist` break per
phase, verdict-moving, `untraced` suppressed, criteria restored to `counts`),
D-03/D-04 (both versions reported, manifest read relative to the script with a
`CADENCE_PLUGIN_MANIFEST` override), D-05/D-06/D-09 (a seam-written
`phases/<N>/FINDINGS.json` holding the five counters plus the discarded
entries), D-08 (`uat record --criterion`), D-10 (the artifact is committed),
D-11/D-12 (inlined fixture constants; both near-duplicate legacy tests move),
D-13 (four prose surfaces move together), D-14 (CONTRACTS entry per new flag),
D-15 (the red baseline is repaired here).

Out of scope: any change to `classifyAcceptanceCriteria`'s grammar - this phase
changes what `criteria-coverage` DOES with the classification. The two deferred
CAPTURE items in this subsystem (the near-miss `## Acceptance criteria` heading
returning `criteria: null`, and the non-fence-aware criteria walk) stay open.
The `uat merge` counting gap where a `human_checks` entry matching an existing
item lands in neither `skipped` nor `rejected` stays open too, deliberately -
`FINDINGS.json` mirrors the counters, it does not change them.

## Tasks

### Task 1: Repair the red baseline - freeze the phases-1-4 criteria fixture

- **Files:** cadence-core/bin/planning-files.test.mjs
- **Action:** The suite is red at HEAD: the test at `:1177-1185` reads
  `.planning/phases/{1,2,3,4}/CONTEXT.md`, which the v2.0.0 milestone prune
  deleted (measured: 1051 tests, 1 failure, `ENOENT .../phases/2/CONTEXT.md`;
  phase 1 now exists again with different content, so the read is silently
  reading the wrong file even where it succeeds). Replace the filesystem read
  with an inlined module-level constant array holding the four `##
  Acceptance criteria` sections VERBATIM as they shipped, each recovered with
  `git show v2.0.0:.planning/phases/<N>/CONTEXT.md` and copied from the
  `## Acceptance criteria` heading through the following `## Flagged
  assumptions` heading so the section bound is still exercised. Keep the
  assertion unchanged - ids `AC1`-`AC7` and `issues: []` for each of the four -
  and keep the SINGLE existing `test()` that iterates the four constants - do
  not split it into one `test()` per phase, which would move the suite total off
  1051. Rewrite
  the comment above it to say what the constants are (frozen copies of this
  repo's own four v2.0.0 phases, the fixture no synthetic row replaces), how to
  recover them (`git show v2.0.0:.planning/phases/<N>/CONTEXT.md`), and why they
  are inlined rather than read: the milestone prune deletes the live
  directories, and D-11 rejects both a committed fixtures path and a `git show`
  shell-out that would add a git dependency to a suite that has none. Do not
  abbreviate or reflow the criterion prose - the wrapped continuations,
  backticks and embedded colons are what the grammar was written against. Leave
  the `readFileSync` import in place; `:387` and `:393` still use it.
- **Verify:** `node --test cadence-core/bin/*.test.mjs` exits 0 with 0 fail and
  `planning-files.test.mjs` among the passing files, and `grep -rn
  '\.\./\.\./\.planning/phases' cadence-core/bin/*.test.mjs` returns nothing.
  (Scope the grep to the RELATIVE-URL read, not the bare string: `planning.test.
  mjs:1798` and `route.test.mjs:77` both name `.planning/phases/...` in comments
  this phase has no reason to touch, so a bare-string grep can never go green.)

### Task 2: The seam - legacy gains its fifth term; a fieldless checklist becomes a named break

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/lib/planning-files.mjs
- **Action:** In `cmdCriteriaCoverage` (planning.mjs:844-892), keep the existing
  four-term test as a local `fieldless` boolean (`items.length` and
  `uat.fm.fields_version === undefined` and no item carrying `criterion` and
  none carrying `origin`) and split it on `criteria.length`, which is already in
  scope. When `fieldless` and the phase declared NO criteria, push
  `{phase: p.n, reason: <the LEGACY_REASON constant>}` onto `legacy` and
  `continue` - the exemption keeps its current effect but stops being a bare
  phase number (D-04: a modern seam reporting green over an old file is the skew
  the report has to be readable for). When `fieldless` and the phase DID declare
  criteria, push exactly ONE break, `{phase: p.n, break: 'fieldless-checklist',
  file: 'phases/<n>/UAT.md'}` (path relative to the planning dir, the same shape
  `audit` uses for `plan`), add `criteria.length` to both `nCriteria` and
  `nUncovered`, emit NO `untraced` entries and NO per-criterion `uncovered`
  breaks for that phase, and `continue`. Nine breaks plus seventeen `untraced`
  entries are symptoms of one missing marker (D-02), and `breaks` is the only
  key that moves a verdict, so an additive-only report would leave the gate
  exactly as permeable as it is today. This break fires REGARDLESS of the
  roadmap checkbox, deliberately unlike `uncovered` and `missing-uat`: `uat
  init` writes `fields_version` before it looks at a single item, so a fieldless
  checklist is not a state a phase passes through in flight and finishing the
  work does not repair it - say that in the comment. Add `LEGACY_REASON` as a
  module constant beside `ORIGIN_EXEMPT`, one deterministic sentence naming all
  three conditions (no `fields_version` marker, no `criterion`/`origin` field on
  any item, and no `AC<N>` ids declared in CONTEXT). Rewrite the D-16 comment
  block at `:846-858` to state the five-term rule and D-01's evidence - the
  AC-id grammar (`5a3327a`) and `fields_version` (`fd31c04`) both shipped after
  `v1.5.0`, so a CONTEXT carrying AC ids cannot predate the fields and a
  fieldless checklist beside one is a dropped link, not an old file - and keep
  the paragraph explaining why the marker replaced the two-field premise (the
  phase-3 counterexample from CAPTURE.md phase 5). Update the subcommand summary
  at `:26-29` and the asymmetry comment at `:775-779` for the new break code and
  the new `legacy` entry shape. TWO corrections the fifth term forces, both
  raised at the plan review and both grounded:
  (a) An UNREADABLE declaration is not an absent one. `classifyAcceptanceCriteria`
  returns `criteria: null` for a near-miss heading (`## Acceptance Criteria`,
  `## Acceptance criteria:`, `### Acceptance criteria`) while reporting
  `criteria-heading-near-miss` in its `issues` (`lib/planning-files.mjs:804-810`),
  and `:820` coerces that null to `[]` - so a capital-C typo beside a fieldless
  17-item checklist would take the legacy arm and emit a reason string asserting
  the phase declared no ids, which is false. Gate the legacy arm on the ABSENCE
  of a `criteria-heading-near-miss` issue as well: with one present, the phase
  declared something this seam could not read, so it takes the
  `fieldless-checklist` break arm instead. This is not the deferred near-miss
  CAPTURE item (that one is the grammar itself, still out of scope) - it is
  refusing to let this phase's new exemption term inherit it.
  (b) `lib/planning-files.mjs:911-917`'s comment on `UAT_FIELDS_VERSION` says
  "Absence of this marker is the only thing that can mean legacy now", which
  task 2 makes false - absence is necessary and no longer sufficient. Rewrite
  that sentence for the five-term rule; it is the defining comment on the
  single-sourced constant, and it is the twin of the planning.mjs comment above.
  Tests are task 3's - this task deliberately
  leaves the suite red on the three rows written against the four-term rule.
- **Verify:** `node cadence-core/bin/planning.mjs criteria-coverage --dir
  .planning` exits 0 with no `breaks` key (this repo's phase 1 is unchecked and
  has no UAT.md); `grep -n "LEGACY_REASON\|fieldless-checklist"
  cadence-core/bin/planning.mjs` shows the constant and the break code; and
  `node --test cadence-core/bin/planning.test.mjs` now fails on exactly the
  three legacy rows task 3 retargets (`:1783-1793`, `:1823-1833`, `:1952-1968`)
  and no others - a failure anywhere else means the split arm changed a case it
  should not have.

### Task 3: The fieldless fixtures and the rows that pin every arm

- **Files:** cadence-core/bin/planning.test.mjs
- **Action:** Add `P6_CRITERIA` (the 9
  ids from `git show v2.0.0:.planning/phases/6/CONTEXT.md`, one line of
  abbreviated text each, per the `P1_CRITERIA` precedent) and `P6_ITEMS` (the 17
  item names from `git show v2.0.0:.planning/phases/6/UAT.md`, carrying neither
  `criterion` nor `origin`) with a comment naming both recovery commands, then:
  add the AC1 row asserting the single `fieldless-checklist` break naming
  `phases/6/UAT.md`, `legacy` undefined, `untraced` undefined, `phases`
  `[{phase: 6, criteria: 9, items: 17}]` and `counts` `{criteria: 9, covered: 0,
  uncovered: 9, untraced: 0, phases: 1}`; retarget `:1783-1793` to the same
  fieldless-with-declared-ids expectation on the P1 constants; retarget
  `:1823-1833` to the true-legacy case using `contextText` with bare `- [ ]`
  bullets and no ids (asserting the `{phase, reason}` entry, no breaks,
  `counts.criteria: 0`, and the additive `criterion-unidded` `context_issues`);
  add a row for a CONTEXT with no `## Acceptance criteria` heading at all beside
  a fieldless checklist, which is the same legacy arm and the largest real
  population; add a row for the phase-3 shape (`fieldsVersion: true`, 7
  `criterion`, 0 `origin`) asserting not legacy, no breaks, 7 covered; add a row
  for an UNCHECKED box with a fieldless checklist and declared ids, asserting
  the break still fires; and update the mixed-tree identity test at
  `:1952-1968` so phase 2 becomes a true-legacy phase (a CONTEXT declaring no
  ids) and one further phase is fieldless-with-ids, with
  `counts.criteria === counts.covered + counts.uncovered` still asserted.
  Add one further row for task 2(a): a CONTEXT whose criteria sit under
  `## Acceptance Criteria` (capital C) beside a fieldless checklist asserts the
  `fieldless-checklist` break, `legacy` undefined, and the
  `criteria-heading-near-miss` entry in `context_issues` - the arm that would
  otherwise hand a typo the exemption this phase removes.
  Give each new row a distinct `test()` title naming its arm, so a row that was
  never written is visible as an absent title rather than as a green suite.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` exits 0 with 0
  fail, and its output names all six new arms: the phase-6 fieldless break, the
  true-legacy reason entry, the no-heading legacy case, the phase-3 shape (not
  legacy), the unchecked-box case where the break still fires, and the
  near-miss-heading case that is a break rather than an exemption.

### Task 4: `criteria-coverage` states the plugin and fields versions it ran as

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Add `dirname` to the existing `node:path` import and
  `fileURLToPath` from `node:url`, define `HERE` from `import.meta.url` the way
  `config.mjs:31`, `route.mjs:56` and `self-verify.mjs:60` do, and resolve the
  manifest as `process.env.CADENCE_PLUGIN_MANIFEST` or
  `join(HERE, '..', '..', '.claude-plugin', 'plugin.json')` - the same
  env-override precedent as `CADENCE_CONFIG_SCHEMA` / `CADENCE_ROUTE_TABLE`,
  present for hermetic tests, never for production. Add a small
  `pluginVersion()` helper returning the manifest's `version` when it is a
  string and `null` on any unreadable, malformed or version-less manifest -
  never a throw, because this is provenance and must not sink a working gate.
  Emit `version: {plugin, uat_fields: UAT_FIELDS_VERSION}` as the FIRST key of
  the `criteria-coverage` envelope, always present (it is a statement about the
  run, not an optional finding); `UAT_FIELDS_VERSION` is already imported.
  Record in the comment WHY both halves are reported (D-03): mid-cycle the
  manifest names the last RELEASED version, `2.0.0` today on a tree running
  v2.1.0-dev code, so the capability number is the half that does not lag - and
  D-04's point that a seam genuinely predating the fields fails loudly instead
  (`v1.5.0`'s planning.mjs has no `criteria-coverage` subcommand at all, so the
  call returns `ok:false, reason:"usage"`), which is why the statement exists
  for the opposite skew. This closes the unclosed half of the phase-5 human
  verify carried in CAPTURE.md ("record the plugin version the check runs
  against"), the skew that downgraded this gate through the
  `${CLAUDE_PLUGIN_ROOT}`-resolved 1.5.0 cache. In planning.test.mjs give the
  `run` helper an optional 4th `env` argument merged over `process.env` into the
  `execFileSync` options, leaving every existing call unchanged, then add three
  rows: a repo run whose expected `version.plugin` is READ from
  `.claude-plugin/plugin.json` in the test rather than pinned as a literal (a
  literal would break at every release bump) and whose `version.uat_fields` is
  `"1"`; a run with `CADENCE_PLUGIN_MANIFEST` pointed at a fixture manifest
  written into the temp tree, asserting the fixture's version; and a run
  pointing that variable at a nonexistent path, asserting `version.plugin` is
  `null` with `ok: true` and no stack.
- **Verify:** `node cadence-core/bin/planning.mjs criteria-coverage --dir
  .planning` prints a `version` object whose `plugin` equals the `version` field
  of `.claude-plugin/plugin.json` and whose `uat_fields` is `"1"`; the same
  command run with `CADENCE_PLUGIN_MANIFEST` set to a scratch manifest holding a
  different version prints that version; `node --test
  cadence-core/bin/planning.test.mjs` exits 0.

### Task 5: `uat merge` persists its findings envelope beside the phase's artifacts

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** In `cmdUat`'s `merge` arm (planning.mjs:491-582), collect the
  entries the merge DISCARDS as it counts them, then persist the envelope to
  `join(dir, 'phases', String(n), 'FINDINGS.json')` through `atomicWrite`
  immediately after `writeUat` - resolved under the run's `--dir` exactly as
  `uatFile(dir, n)` is, never as a bare relative path, or every test on a temp
  tree writes into the process cwd instead. The file is a NEW artifact, not a UAT.md section (D-05): a
  `## Verifier findings` block is cut by `sectionBound` on the next `uat record`
  and a `### ` extra is promised user-owned and verbatim by
  `templates/UAT.md:80-82`, so a section is worse than not persisting - it looks
  durable and is not. Content, exactly (D-06): `auto_passed`, `gaps`, `added`,
  `skipped`, `rejected`, then `rejected_entries` and `skipped_entries`, both
  arrays always present even when empty, serialized with `JSON.stringify(...,
  null, 2)` plus a trailing newline so a reviewer can diff it. A rejected entry
  is `{list, reason, entry}` where `list` is `passes` / `gaps` /
  `human_checks`, `reason` is `no-matching-item` (a pass resolving to no item)
  or `no-usable-name` (a gap or human check with no renderable name), and
  `entry` is the payload entry verbatim. A skipped entry is `{list, reason:
  'already-recorded', item, status, entry}` where `item` is the matched item's
  `k` and `status` its status at the time of the conflict. The `human_checks`
  entry that matches an existing item (the bare `continue` at `planning.mjs:566`)
  gets a `skipped_entries` row too, with the SAME `already-recorded` reason -
  recording the entry changes no counter, so this is inside D-14's deferral, not
  across it. Leaving it out would let the artifact whose whole purpose is making
  a discarded finding recoverable discard one silently, which is this phase's own
  failure mode. Say in the comment that its counter is still deferred and the row
  is therefore present in the file while absent from `skipped`. The counters alone
  add nothing a transcript already had - `verify-deep.md:41` prints them - and
  accepted findings are recoverable from the items they wrote; the unrecoverable
  material is what was counted and then dropped. Do NOT change any counting: the
  bare-`continue` gap where a `human_checks` entry matching an existing item
  lands in neither counter is deferred, and this file mirrors the counters
  rather than correcting them. Write the file on every successful merge,
  including an all-zero one, so its ABSENCE means no merge ran; a second merge
  on the same phase overwrites it with that merge's envelope (the deep pass is
  once per phase by verify.md's first-session rule, and the envelope is the
  merge's own return value - D-09, computed inside the seam because the verifier
  is contractually read-only and never writes). Add `findings:
  'phases/<N>/FINDINGS.json'` to the merge's stdout envelope so the write is
  observable in the transcript. A failed FINDINGS write is REPORTED, not thrown:
  catch it and return the normal `ok()` envelope with `findings: null` and
  `findings_error: <the error message>` beside the five counters. Throwing here
  unwinds to the dispatch catch at `:1420`, which emits `{ok:false, reason:
  'internal'}` and takes the counters down with it - after `writeUat` has already
  rewritten UAT.md, so the merge is neither undone nor reported, and a retry
  re-merges against non-pending items and persists an envelope claiming every
  finding was a conflict. Losing the counters to protect the file that exists to
  preserve them is the wrong trade; a visible `findings_error` is neither silent
  nor destructive. In planning.test.mjs add rows on
  the existing `uatTree()` fixture: after a merge carrying a conflicting pass, a
  nameless gap and a nameless human check, the file exists with the seven keys
  in order and its two arrays carry those entries with their reasons and the
  matched item's `k`/`status`; a merge whose `human_checks` carries an entry
  matching an existing item writes that entry into `skipped_entries` while
  `skipped` stays at its deferred count; a merge with a clean payload still writes the
  file with both arrays empty; the file's bytes are IDENTICAL before and after a
  subsequent `uat record` on the same phase (read and compare the raw bytes);
  and a second merge replaces it with the second merge's counters.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` exits 0; in a
  scratch tree, `uat merge --phase 1` followed by `uat record --phase 1 --item 1
  --result pass` leaves `phases/1/FINDINGS.json` byte-identical (`cmp` reports
  no difference against a copy taken before the record).

### Task 6: `uat record --criterion` repairs a dropped link, and the contract table admits it

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs,
  cadence-core/bin/self-verify.mjs
- **Action:** In `cmdUat`'s `record` arm, validate `--criterion` BEFORE any
  write, beside the existing `--origin` guard: reject anything failing
  `/^AC\d+$/` with `fail('bad-args', ...)` naming the received value, reusing
  the same test `uat init` applies at `:408-411` so the two faces cannot drift
  (a flag given with no value parses as boolean `true` and is refused by the
  same test). Then add `criterion` to the flag-to-field list at `:477-479` so an
  accepted value is written; `criterion` is already registered in `UAT_FIELDS`,
  so it renders directly after `expected` and survives every later rewrite. Add
  `'--criterion'` to the `'uat record'` entry in `self-verify.mjs`'s CONTRACTS
  table (D-14) - without it, prose naming the flag fails the invocation check
  with `unknown-flag`, which is exactly why this task precedes the prose tasks.
  Note in the comment that the repair also requires `--result` (record has no
  field-only mode) and that re-recording an item's CURRENT status is therefore
  the repair form; without this flag the diagnostic added in task 2 would route
  users to `--origin`, which on a fieldless checklist writes `origin: criterion`
  and converts zero breaks into one break per criterion with no seam able to add
  `criterion` back (CAPTURE.md, phase 5). In planning.test.mjs, on the
  `linkedTree()` fixture: `uat record --phase 1 --item 1 --result pass
  --criterion AC9` puts `criterion: AC9` on item 1 in the raw bytes with the
  field in its registered position and no duplicate line; a value of `AC-1`,
  `ac1` or a bare `--criterion` with no value returns `ok:false` with reason
  `bad-args`, and the UAT.md bytes are unchanged from before the call.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` exits 0 and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

### Task 7: State the new rule where the gate is documented

- **Files:** cadence-core/references/acceptance-criteria.md,
  cadence-core/workflows/audit.md, cadence-core/bin/weight-budgets.json
- **Action:** In `references/acceptance-criteria.md`'s coverage contract
  (`:145-186`): add `fieldless-checklist` to the `breaks` row of the key table
  as the second breaking shape (`{phase, break, file}` - one per phase, naming
  the checklist to repair); change the `legacy` row to the `{phase, reason}`
  entry shape; rewrite "The legacy rule tests for an absent `fields_version`
  frontmatter marker" into the five-term rule, keeping the phase-3 paragraph
  that explains why the marker replaced the two-field premise and adding D-01's
  argument - both the AC-id grammar and `fields_version` post-date `v1.5.0`, so
  a CONTEXT declaring `AC<N>` ids cannot predate the fields, which makes a
  fieldless checklist beside one a dropped link rather than an old file, with
  phase 6 as the shipped counterexample; state that the break fires whatever the
  roadmap box says and why; and state the repair (`uat record --phase <N> --item
  <k> --result <its current status> --criterion AC<N>` per item, noting that
  `--origin criterion` is not a substitute because it names no id). Add a short
  paragraph to "The coverage contract" for the version statement: `version.
  plugin` from `.claude-plugin/plugin.json` read relative to the script with
  `CADENCE_PLUGIN_MANIFEST` overriding it for tests, `version.uat_fields` from
  `UAT_FIELDS_VERSION`, why both are reported rather than the manifest alone,
  and D-04's note that an older seam has no such subcommand so the statement
  exists for the modern-seam-over-old-file skew. Repoint step 2 of "Rebuilding
  the demonstration fixture" at `git show v2.0.0:.planning/phases/1/CONTEXT.md`
  and `git show v2.0.0:.planning/phases/1/UAT.md`: the live paths it names were
  deleted by the v2.0.0 prune and phase 1 now holds different content, so the
  recipe as written silently builds the wrong fixture. In `workflows/audit.md`:
  extend the coverage-arm key list at `:51-57` with the `fieldless-checklist`
  break shape and the `version` line the report should quote; add a
  `fieldless-checklist` bullet to `## 3. Interpret the breaks` beside
  `uncovered` (what it means - the checklist carries items but none of the
  fields, so nothing in it can be traced - and its two exits: repair the links
  with `uat record --criterion` per item, or re-run `/cad-verify <N>` if the
  phase never got a real checklist); correct the FAIL line at `:95-100`, which
  today reads "any criterion is `uncovered`" and would let a
  `fieldless-checklist` break pass, to fail on ANY coverage break while keeping
  the by-id reporting for `uncovered`; and rewrite the legacy sentences at
  `:117-134` for the five-term rule and the reason-carrying entry. Then qualify
  the TWO blanket statements of the unchecked-box rule, which task 2's break
  makes false and which the enumerated edits above would otherwise leave
  standing: `workflows/audit.md:62-63` ("a phase whose checkbox is unchecked
  contributes its `uncovered` count but no `breaks` entry, so work still in
  flight cannot fail a mid-cycle run") and
  `references/acceptance-criteria.md:203-207` ("**An unchecked roadmap box
  counts but never breaks.**"). Both must say that `uncovered` and
  `missing-uat` are box-gated while `fieldless-checklist` is not, because `uat
  init` writes `fields_version` before it looks at an item, so no phase passes
  through the fieldless state in flight. The first is the exact sentence a model
  would quote to explain away a `fieldless-checklist` break on an in-flight
  phase - the interpretive form of the hole this phase closes. Keep the other
  edits tight - replace sentences rather than appending paragraphs - then
  update `audit.md`'s entry in `weight-budgets.json` to the value
  `node cadence-core/bin/weight.mjs` reports for it (its budget currently equals
  its exact size, so any growth is an overrun until the manifest is
  regenerated); `references/` is unweighed and needs no entry.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun` and no `unknown-flag`; `grep -n "fieldless-checklist"
  cadence-core/workflows/audit.md cadence-core/references/acceptance-criteria.md`
  returns hits in both files; and both blanket sentences are gone -
  `grep -n "work still in flight cannot fail"
  cadence-core/workflows/audit.md` and `grep -n "counts but never breaks"
  cadence-core/references/acceptance-criteria.md` each return nothing, with
  `grep -c "fieldless-checklist" ` on each of those two files >= 2 (the key-table
  or bullet mention plus the qualification). Nothing else in this phase tests
  prose, so an unqualified sentence is otherwise invisible.

### Task 8: State the repair and the persisted envelope where /cad-verify writes

- **Files:** cadence-core/workflows/verify.md,
  cadence-core/workflows/verify-deep.md, cadence-core/templates/UAT.md,
  cadence-core/bin/weight-budgets.json
- **Action:** `workflows/verify.md:84-86` is false today and has been since `uat
  init` began writing `fields_version` unconditionally - it tells the model that
  a CONTEXT whose criteria carry no ids "reads as a pre-field legacy checklist,
  reported and never a failure". Replace it with what the seam now does: a
  checklist this seam writes always carries the marker and is therefore never
  legacy; items built from a CONTEXT that declares no ids carry no `criterion`
  and report as `untraced`, which is additive; and legacy now requires a
  fieldless checklist beside a CONTEXT declaring no ids, which no seam-written
  file can be. In the same file, add `FINDINGS.json` to the commit list at
  `:221-223` (D-10: that list enumerates its files by name, so an unnamed
  artifact stays untracked beside a committed UAT.md and the falsifiability
  claim lasts only until the next clone). In `workflows/verify-deep.md:41`,
  say that the seam persists the envelope to `.planning/phases/<N>/FINDINGS.json`
  - the five counters plus the entries it discarded - and that the report quotes
  the same counters; keep the verifier's read-only contract untouched, the write
  is the seam's. In `templates/UAT.md`, restate the `origin` bullet's repair
  clause at `:95-99`: `uat record --criterion AC<N>` restores a link that was
  never written or was lost, `--origin` declares an item that legitimately has
  none, and `--origin criterion` is not a substitute for the link because it
  names no id; and rewrite the `fields_version` bullet at `:100-106` for the
  five-term rule - a checklist with no marker, no links and beside a CONTEXT
  declaring no ids is legacy, one carrying items beside declared ids is a
  `fieldless-checklist` break naming the file to repair. Then regenerate the
  `weight-budgets.json` entries for `verify.md` and `verify-deep.md` (and any
  other weighed surface this phase's edits moved) from
  `node cadence-core/bin/weight.mjs`; `templates/` is unweighed.
- **Verify:** `node --test cadence-core/bin/*.test.mjs` exits 0, `npx tsc -p
  tsconfig.ci.json` exits 0, and `node cadence-core/bin/self-verify.mjs` reports
  `ok:true` with an empty `problems` array - no `budget-overrun`, no
  `unknown-flag`, no `unknown-subcommand`.

## Notes

- Plan shape matches the CONTEXT directive: one plan. Every task touches
  `planning.mjs`, `planning.test.mjs` or `self-verify.mjs`, and the one
  file-disjoint split (seam vs prose) is a dependency, not a parallel - task 6's
  CONTRACTS entry is what lets tasks 7 and 8 name `--criterion` without
  self-verify reporting `unknown-flag`.
- Discretionary choices recorded here because CONTEXT left them open: the
  `fieldless-checklist` break fires regardless of the roadmap checkbox (task 2);
  `legacy` entries carry one fixed reason string rather than a per-phase
  computed one; `FINDINGS.json` is overwritten by a later merge on the same
  phase rather than accumulating; and the merge's stdout gains a `findings` path
  key so the write is visible in the transcript.
- CONTEXT AC5's literal command omits `--result`, which `uat record` requires
  (`planning.mjs:461` fails `bad-result` on an absent one, file byte-unchanged).
  `/cad-verify` builds the checklist from that CONTEXT text, so the item as
  worded fails against a CORRECT deliverable. The working form is
  `uat record --phase <N> --item <k> --result <the item's current status>
  --criterion AC<N>`; record has no field-only mode, so the repair is a
  re-record. Read AC5 that way at verification rather than as written, and if
  the field-only mode is wanted, it is a separate requirement.
- No CHANGELOG task: `workflows/milestone.md:40` scaffolds the dated release
  heading at the close, and nothing in this repo stages per-phase entries. No
  README task either - `README.md:100` describes `/cad-audit` as tracing "every
  acceptance criterion to the check that tested it", which this phase makes more
  true rather than drifting from.
- Every weighed surface in this repo currently sits at exactly its budget (zero
  headroom measured on audit.md, verify.md and verify-deep.md), so the
  `weight-budgets.json` regeneration in tasks 7 and 8 is load-bearing, not
  housekeeping: without it self-verify reports `budget-overrun` and AC7 fails.
