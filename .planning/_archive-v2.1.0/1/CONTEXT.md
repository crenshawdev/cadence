# Phase 1: The gate that proved nothing - Context

Gathered: 2026-07-30
Feeds: /cad-plan 1

## Scope boundary

In: COV-01 in full - a checklist carrying items but none of the
acceptance-criteria fields produces a named, verdict-moving diagnostic instead
of a `legacy` exemption; `criteria-coverage` states the plugin version and UAT
fields version it ran as; the verifier's findings envelope is persisted beside
the phase's other artifacts; `uat record` gains the `--criterion` repair flag
the new diagnostic sends users to; and the test suite returns to green.

Out: every other v2.1.0 requirement (TRI-02, REV-03, TOK-02, REL-03, CFG-02,
DOC-01, RNG-02, HST-02) - later phases of this cycle. Any change to
`classifyAcceptanceCriteria`'s own grammar: this phase changes what
`criteria-coverage` does with the classification, not how CONTEXT is read.

Deferred: two open CAPTURE items in the same subsystem, left because neither is
COV-01 and both widen the grammar rather than close the exemption -
(a) the near-miss `## Acceptance criteria` heading is silent
(`lib/planning-files.mjs:751` admits only `/^## Acceptance criteria\s*$/`, so a
capital-C typo drops every criterion out of the domain with no diagnostic);
(b) the criteria-section walk is not fence-aware, unlike `parseUat`'s own
`sectionBound`, so a `- [ ] AC2:` line inside a fenced block mints a phantom id.

Plan shape: one plan. The parallel `/cad-execute` path needs one plan per
executor, and every split of this work shares `planning.mjs`,
`planning.test.mjs`, or `self-verify.mjs`; the one file-disjoint split
(seam vs prose) is a dependency rather than a parallel, because the prose's
self-verify check reads the CONTRACTS entry the seam plan writes.

## Durable decisions

- D-01 (legacy rule): The `legacy` conjunction gains a fifth term - the phase's
  CONTEXT declares no `AC<N>` ids. The AC-id grammar (`5a3327a`) and
  `fields_version` (`fd31c04`) both shipped after `v1.5.0`, so a CONTEXT
  carrying AC ids cannot predate the fields and a fieldless checklist beside one
  is a dropped link, not a pre-field file. Rejected: sibling evidence (makes one
  phase's verdict depend on another's files, and a single-phase project has no
  siblings) and keep-legacy-plus-arithmetic (reports the contradiction without
  removing the exemption). Evidence: `cadence-core/bin/planning.mjs:859-863`,
  `lib/planning-files.mjs:790-887`, `.claude-plugin/plugin.json`.
- D-02 (diagnostic shape): The diagnostic is ONE `fieldless-checklist` break per
  phase, naming the file to repair, with the phase's `untraced` item entries
  suppressed and its criteria restored to `counts`. Verdict-moving by
  construction: `breaks` is the only key that moves a verdict
  (`planning.mjs:775-779`), so an additive-only key would leave the gate exactly
  as permeable as it is - the objection that reversed additive `unseeded` in
  v1.4.0. Rejected: one break per criterion (nine breaks plus seventeen
  `untraced` entries are all symptoms of one missing marker). Evidence:
  `planning.mjs:775-779`, `:875-881`,
  `cadence-core/references/acceptance-criteria.md:145-158`.
- D-03 (version source): `criteria-coverage` reports BOTH the plugin version,
  read from `.claude-plugin/plugin.json` relative to the script's own location,
  and `UAT_FIELDS_VERSION`. The manifest alone is insufficient: mid-cycle it
  names the last RELEASED version (`2.0.0` today, on a tree running v2.1.0-dev
  code), so the capability number is the half that does not lag. A
  `CADENCE_PLUGIN_MANIFEST` env override pins it for tests. Rejected: a
  generated constant in `bin/` (one more thing to forget at release), manifest
  alone. Evidence: same relative-path pattern in `config.mjs:31`, `route.mjs:56`,
  `weight.mjs:20`, `self-verify.mjs:60`; env-override precedent
  `CADENCE_CONFIG_SCHEMA` / `CADENCE_ROUTE_TABLE`; `planning.mjs:37-54` reads
  nothing outside `--dir` today; `lib/planning-files.mjs:918`.
- D-04 (which skew the version catches): A seam genuinely predating the fields
  fails LOUDLY, not silently - `v1.5.0`'s `planning.mjs` has no
  `criteria-coverage` subcommand, so the call returns `ok:false,
  reason:"usage"`. The version statement therefore exists for the opposite skew,
  a modern seam reporting green over an old file, which is why the `legacy`
  report must carry a stated reason rather than a bare phase list. Evidence:
  `git show v1.5.0:cadence-core/bin/planning.mjs` (no such subcommand);
  `.planning/PROJECT.md:125-127`; `.planning/CAPTURE.md` phase 5, the
  `${CLAUDE_PLUGIN_ROOT}`-resolved 1.5.0 cache.
- D-05 (envelope location): The findings envelope is persisted as a NEW file,
  `.planning/phases/<N>/FINDINGS.json`, not as a section inside UAT.md. A `## `
  section cannot survive: `parseUat`/`renderUat` splits on `^### ` and cuts each
  part at `sectionBound`, so a `## Verifier findings` block is silently dropped
  by the next `uat record` - worse than not persisting, because it looks
  durable. A `### ` extra survives but `templates/UAT.md:80-82` promises `### `
  extras are user-owned and verbatim. JSON rather than markdown: seam-written,
  seam-read data, and deliberately outside the recall corpus, which indexes
  SUMMARY/UAT/CONTEXT only. Evidence: `lib/planning-files.mjs:974-996`,
  `:1013-1032`; `planning.mjs:70-84`, `:614-625`, `:1061-1084`;
  `cadence-core/workflows/milestone.md:59`.
- D-06 (envelope contents): The file holds the five counters plus the entries
  the merge DISCARDED - `rejected_entries` and `skipped_entries`. The counters
  alone add nothing a transcript already had (`verify-deep.md:41` prints them),
  and accepted findings are recoverable from the UAT items they wrote; the
  unrecoverable material is the entries counted and then dropped. Evidence:
  `planning.mjs:527-535`, `:547-553`, `:567-570` (the D-14 counting gap,
  deliberately still open); `.planning/ROADMAP.md:44`.

## Decisions

- D-07 (change site): The rule to change is the four-term conjunction at
  `planning.mjs:859-863`, whose `continue` removes the phase from
  `nCriteria`/`nCovered`/`nUncovered` and from every break. The fix is that
  conjunction plus a new envelope key - not a change to
  `classifyAcceptanceCriteria`, which is pure and never sees a UAT file.
  Evidence: `planning.mjs:844-863`, `:894-913`; live on a `v2.0.0` checkout the
  envelope already self-contradicts (`legacy:[6]`, `counts.criteria:36`, while
  `phases[6]` reports `criteria:9`) with no diagnostic.
- D-08 (repair path): `uat record` gains `--criterion AC<N>`, reusing the
  `^AC\d+$` validation `uat init` already applies, and `templates/UAT.md:99` is
  restated. Without it the new diagnostic routes users to a repair that makes
  the report worse: `--origin` on a fieldless checklist writes `origin:
  criterion`, disqualifying the phase from the legacy rule and converting zero
  breaks into one break per criterion, with no seam able to add `criterion`
  back. Evidence: `self-verify.mjs:77-78`, `planning.mjs:408-411`, `:472-481`,
  `templates/UAT.md:95-99`.
- D-09 (who writes it): The envelope is `uat merge`'s own return value, computed
  inside the seam, so persistence is a seam-side write during `merge` - never
  the agent's and never the orchestrator's. The verifier is contractually
  read-only. Evidence: `planning.mjs:526`, `:581`;
  `skills/cad-verifier-contract/SKILL.md:14-16,147,182`;
  `cadence-core/workflows/verify.md:245-248`.
- D-10 (the artifact gets committed): `workflows/verify.md:221-223` enumerates
  its commit files by name, so `FINDINGS.json` must be named there or it stays
  untracked beside a committed UAT.md and the falsifiability claim holds only
  until the next clone. Evidence: `verify.md:221-223`; `.gitignore` does not
  exclude `.planning/`.
- D-11 (fixtures): Phase 6's checklist and the repair of the broken phases-1-4
  test both use inlined constants in the shape `coverageTree` already consumes,
  per the `P1_CRITERIA`/`P1_ITEMS` precedent. Rejected: a committed fixtures
  path (none exists under `cadence-core/`, and it re-creates the failure mode
  just hit) and shelling out to `git show` (adds a git dependency to a suite
  that has none). The real file stays recoverable at
  `git show v2.0.0:.planning/phases/6/UAT.md`. Evidence:
  `planning.test.mjs:1693-1725`, `:1664-1691`, `:26-28`.
- D-12 (tests to retarget): `planning.test.mjs:1783-1793` and `:1823-1833` are
  near-duplicates that each build a fieldless, marker-less checklist and assert
  `legacy:[1]` with `counts.criteria:0`. BOTH move, or the suite goes red in a
  way that looks like the new rule is wrong. SC2's two rows are already partly
  covered by `:1801-1811` and `:1813-1821`. Evidence: those four cases.
- D-13 (prose surfaces move together): Four surfaces state the current rule -
  `references/acceptance-criteria.md:145-186`, `workflows/audit.md:117-134`,
  `templates/UAT.md:100-106`, and `workflows/verify.md:84-86`, which is already
  false ("a CONTEXT whose criteria carry no `AC<N>` ids ... reads as a pre-field
  legacy checklist, reported and never a failure") since `uat init` began
  writing `fields_version` unconditionally. Weighed surfaces and their budgets:
  `audit.md` 8203, `verify.md` 11784, `verify-deep.md` 2083,
  `skills/cad-verifier-contract/SKILL.md` 7676; `references/` and `templates/`
  are unweighed. Evidence: those files; `planning.mjs:427-437`;
  `lib/surface-weight.mjs:8-12`; `self-verify.mjs:456-460`.
- D-14 (seam contract): Every new flag needs a `CONTRACTS` entry in
  `self-verify.mjs:68-129`; `criteria-coverage` currently declares `[]` and
  `uat merge` declares `['--phase']`. Evidence: `self-verify.mjs:68-129`,
  `:131-132`, `:15-17`.
- D-15 (red baseline is in scope): The suite is already failing at HEAD and
  repairing it belongs to this phase, not to a precondition someone else met:
  `lib/planning-files.test.mjs:1177-1185` reads `.planning/phases/1-4/CONTEXT.md`,
  which the v2.0.0 milestone prune deleted. Measured: 1051 tests, 1 failure,
  `ENOENT .../phases/1/CONTEXT.md`. Evidence: that run; the live `.planning/`
  holds no `phases/` directory.

## Acceptance criteria

- [ ] AC1: Running `criteria-coverage` on a tree carrying phase 6's shipped
      checklist (17 items, 0 `criterion`, 0 `origin`, no `fields_version`)
      beside a CONTEXT declaring AC1-AC9 returns a `fieldless-checklist` break
      naming phase 6, `legacy` does not contain 6, and `counts.criteria`
      includes those 9.
- [ ] AC2: On the same command, a checklist with no fields beside a CONTEXT
      declaring no `AC<N>` ids is still in `legacy` with no break, and a
      phase-3-shaped file (marker present, 7 `criterion`, 0 `origin`) is not in
      `legacy`. Both are test rows.
- [ ] AC3: `criteria-coverage` output states the plugin version and the UAT
      fields version it ran as, and a run with `CADENCE_PLUGIN_MANIFEST` pointed
      at a fixture manifest reports that fixture's version rather than the
      repo's.
- [ ] AC4: After a `uat merge`, `.planning/phases/<N>/FINDINGS.json` holds the
      five counters plus `rejected_entries` and `skipped_entries`, and the file
      is byte-identical after a subsequent `uat record` on the same phase.
- [ ] AC5: `uat record --phase N --item M --criterion AC3` writes the link into
      the checklist, and a value failing `^AC\d+$` is refused with a named
      diagnostic instead of being written.
- [ ] AC6: `node --test cadence-core/bin/*.test.mjs` exits 0, including the
      `lib/planning-files.test.mjs` case that currently ENOENTs on the pruned
      `phases/1-4/CONTEXT.md`.
- [ ] AC7: `npx tsc -p tsconfig.ci.json` exits 0 and
      `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
      `budget-overrun` on any surface this phase edits.

## Flagged assumptions

- No host-provided plugin-version environment variable is assumed to exist
  beside `CLAUDE_PLUGIN_ROOT`; the manifest read is the source - Unclear; if
  wrong, a more honest source exists mid-cycle and the manifest read is
  redundant. Nothing in-repo can settle what else the host sets.
- The AC-id signal in D-01 misclassifies a project that hand-wrote `AC<N>` ids
  into a CONTEXT before upgrading past `v1.5.0` - Likely rare; if wrong, that
  project gets a false `fieldless-checklist` report on a genuinely pre-field
  checklist.
- Suppressing `untraced` for a phase carrying the new diagnostic (D-02) assumes
  the missing marker is the only cause - Likely; if wrong, a second, unrelated
  cause of untraced items is hidden behind the first report until the marker is
  repaired.
