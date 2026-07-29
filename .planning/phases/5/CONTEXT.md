# Phase 5: Acceptance-criteria ids - Context

Gathered: 2026-07-29
Feeds: /cad-plan 5

## Scope boundary

In: a phase-local id on every CONTEXT acceptance criterion, a declared
criterion->UAT carrier that survives the whole UAT lifecycle, an origin marker
distinguishing criterion-derived items from verifier-added ones, a new
coverage-check subcommand folded into `/cad-audit`'s single verdict, the grammar
written into `cadence-core/references/`, and a backfill of the four completed
UAT files.

Out: promoting the `(human-verify: needs <tool>)` suffix to a declared field and
the `verify.md` routing that would follow (D-11); the `human_checks` counting bug
(D-14); any archaeology into v1.4.0 to recover the case ROADMAP.md:93 names
(D-15).

Deferred:
- The `human_checks` bare-`continue` counting bug - an entry matching an existing
  item is counted in neither `skipped` nor `rejected`
  (`cadence-core/bin/planning.mjs:~525`, contradicting `verify-deep.md:38`).
  Stays in `.planning/CAPTURE.md` for its own phase; only the origin marker is in
  scope here.

Plan shape: multiple plans - the eight criteria split at the grammar/reader/check
seam (AC1, AC2, AC3, AC5) versus the carrier seam (AC4, AC6).

## Durable decisions

- D-01 (Grammar): The id is a phase-local `AC<N>` token at the head of each
  `- [ ]` bullet under `## Acceptance criteria` - not phase-prefixed, not globally
  unique. Evidence: all four of `.planning/phases/{1,2,3,4}/CONTEXT.md`, first at
  `d8cb34b`; `REQ_ID_EXACT` (`cadence-core/bin/lib/planning-files.mjs:275`)
  requires a hyphen, so `AC1` is structurally disjoint from the requirement-id
  vocabulary. Rejected `AC-01`: it IS admitted by `REQ_ID_EXACT`, so a criterion
  id pasted into a plan's `requirements:` frontmatter reads as a requirement and
  mints phantom `orphans.plan_ids`. If wrong: the audit this phase strengthens
  gains fabricated breaks.

- D-02 (Grammar): `/cad-phase` renumber cannot touch a criterion id. Computed
  edits are ROADMAP/REQUIREMENTS/STATE only
  (`cadence-core/bin/planning.mjs:1029-1056`, `:1087-1091`); phase dirs move whole
  via `gitMv` with contents never rewritten (`:1128-1140`); `shiftPhaseTokens`
  (`planning-files.mjs:1334-1341`) matches `\bPhase (\d+)\b` and `phases/(\d+)/`.
  The renumber test pins a non-event; the only way to fail it is to embed the
  phase number. Rejected path-shaped and phase-prefixed ids (`P4-AC1`,
  `phases/4/CONTEXT.md#AC3`): they go stale on the first insert because the
  directory moved and the file body did not. If wrong: the id renumbers under the
  user, which this phase's first roadmap criterion forbids.

- D-03 (Grammar): The grammar is enforced by a READER only, so the phase must
  ship both the diagnostic path for the un-idded shape AND the `context.md`
  skeleton edit that makes new files in-grammar. CONTEXT.md has no seam writer and
  no `cadence-core/templates/` file; the whole skeleton is inline at
  `cadence-core/workflows/context.md:265-300`, which writes
  `- [ ] {pass/fail, observed behavior}` with no id. The only seam that opens
  CONTEXT.md is `planning.mjs:875-878` -> `parseContextDecisions`
  (`planning-files.mjs:648-657`), durable-decision bullets only. Unlike the four
  v1.4.0 grammars - each of which has a writer (`insertReqRows`/`setReqStatus`,
  `setPhaseBox`/`cmdRenumber`, `renderUat`, `parsePlanRequirements`) - this one
  has none. If wrong: the reference and classifier ship while `/cad-context` keeps
  writing bare bullets, and every new CONTEXT is out of grammar the day after the
  phase closes.

- D-04 (Carrier): The criterion->UAT link is lost at `workflows/verify.md`'s
  `build_or_resume` step (`:44-100`), where the model re-words each criterion into
  `{name, expected}` and `uat init` validates only that both strings are non-empty
  (`planning.mjs:393-409`; only `it.source` is carried through). Nothing in the
  payload, the file, or the parser carries a back-reference, so the fix is a third
  payload field, not a new parser of UAT prose. Rejected inferring the link by
  string similarity: that is the model-judgment shape phase 4's D-01 rejected in
  favour of declared data.

- D-05 (Carrier): The carrier is a new per-item `criterion:` line in UAT.md,
  registered in `UAT_FIELDS` (`planning-files.mjs:664-666`). `parseUat`
  (`:715-754`) already accepts any `^(\w+):\s*(.+?)\s*$` field line, but
  `renderUat` (`:767-787`) filters against the whitelist and every `uat record`
  rewrites the whole file (`planning.mjs:449-451`), so an unregistered field
  survives `init` and is destroyed by the first `record`. Rejected prefixing the
  item heading (`### 3. AC3 - name`): it couples the id to `uat refresh`'s dedupe
  key (`planning.mjs:415-419`), so a reworded criterion mints a duplicate item.
  Rejected a `criteria:` map in UAT frontmatter: it splits the linkage from the
  thing it links.

- D-07 (Carrier): The existing `sources:` frontmatter field is NOT a usable
  provenance channel and is not extended into one. It is declared in
  `templates/UAT.md`, allowed at `self-verify.mjs:64`, and written at
  `planning.mjs:404` when present - but `verify.md` issues `uat init --phase <N>`
  with no `--sources`, and no shipped UAT file carries it. If wrong: the check
  reads absent-and-never-written as "built from PLAN+ROADMAP" and exempts every
  phase.

- D-08 (Seam shape): The check ships as a NEW `planning.mjs` subcommand with its
  own envelope, and `workflows/audit.md` folds its result into the one verdict.
  `cmdAudit` (`planning.mjs:585-608`) reads REQUIREMENTS.md, ROADMAP.md and each
  phase's `PLAN*.md` only - it opens neither CONTEXT.md nor UAT.md - and the phase
  list to walk is the same `parseRoadmapPhases` map it already builds. Rejected
  extending `audit`: `:702-711` pins its counts identity
  (`total = traced + broken + deferred`) with a comment stating why, and
  `audit.md` section 4 derives PASS/FAIL from `counts.broken` after a milestone
  filter the model applies to `requirements[]` BY ID - a criterion break carries no
  requirement id to filter on, so an out-of-scope phase's break would block a ship
  it should not. Rejected attaching it to `uat status --phase N`: that puts a
  milestone-gate concern inside a per-phase status command. `.planning/CAPTURE.md`
  (phase 2) records the cost of the opposite error: an additive-only field left the
  ship gate "exactly as permeable as it was".

- D-09 (Direction): The two directions are ASYMMETRIC. A criterion with no UAT
  item is a verdict-BREAKING code naming the id; a UAT item tracing to no criterion
  is ADDITIVE - reported, never breaking. This matches the shipped `unpicked` /
  `active_issues` split (`planning.mjs:663-711`, `audit.md` section 4). If wrong:
  every phase whose deep pass appended a legitimate gap item - four of four this
  cycle - makes the ship gate unpassable.

- D-10 (Absence): An absent CONTEXT.md and an absent UAT.md are both "nothing to
  prove", never a break. CONTEXT is a documented optional artifact
  (`workflows/context.md` purpose plus the guardrail "never create one
  retroactively"); the audit gate runs at `workflows/milestone.md:11-17` step 1
  while the prune that deletes phase dirs runs at `:52-66` step 3, so prior
  milestones' CONTEXT/UAT files are simply not on disk. If wrong: every audit after
  any milestone close FAILs on archived Traceability rows whose dirs were pruned by
  design, and `/cad-milestone`'s own gate becomes unpassable.

- D-12 (Origin): `source: verifier` CANNOT be the verifier-added marker. It
  records where a RESULT came from, not where an ITEM came from: all 7 items of
  `.planning/phases/4/UAT.md` carry it and all 7 map 1:1 onto AC1-AC7, and the same
  holds for phases 1 and 3. In the seam it is set on an existing pending item
  matched by a `passes` entry (`planning.mjs:493`) and identically on an appended
  gap (`:518`). If wrong: the verifier-added exemption swallows nearly every item in
  every shipped checklist and the reverse direction reports nothing.

- D-13 (Origin): A dedicated `origin: criterion|verifier|smoke` field, set at
  append time and repairable after the fact via `uat record --origin` - which needs
  its entry in both `planning.mjs:441-443`'s `[flag, field]` list and
  `self-verify.mjs:66-67`'s mirror, or it is an `unknown-flag` problem. The
  `human_checks` append path (`planning.mjs:524-530`) writes no `source` and no
  origin marker at all - observable at `.planning/phases/1/UAT.md` items 12 and 14 -
  and gets the marker in this phase. Rejected deriving origin from the absence of
  `criterion` plus `source: verifier`: it re-overloads `source` and cannot
  distinguish verifier-added from criterion-derived-but-link-lost.

- D-16 (Migration): Backfill the four completed UAT files as an explicit execution
  task AND ship a legacy exemption - both, not either. Verified counts: phases 1-4
  each have 7 criteria (28 total, all `AC1`-`AC7`); their UAT files have 14, 8, 7
  and 8 items (37 total), so the backfill is 28 `criterion` links plus `origin` on
  the 9 extras. A checklist where NO item carries `criterion` reads as pre-field
  legacy - reported, not broken - so an existing user project does not hard-fail on
  upgrade. Note `uat init` refuses when the file exists (`planning.mjs:400`) and
  `refresh` appends without rewriting (`:411-422`), so no seam path adds a field to
  an existing item today; the backfill needs one. Rejected exemption alone (this
  milestone's audit would then prove nothing about phases 1-4) and backfill alone
  (hard-fails every existing user).

## Decisions

- D-06 (Carrier): `uat refresh` must carry the new fields in lockstep with
  `uat init`. Today `init` carries `source` (`planning.mjs:405-406`) and `refresh`
  drops every field but `name`/`expected` (`:417-420`), and `verify.md:48-58`
  routes every re-run of a phase through `refresh`. If wrong: any phase verified
  across more than one session - the normal case for a partial UAT - produces
  untraceable items even after `init` is fixed.

- D-11 (Grammar): The `(human-verify: needs <tool/service>)` suffix
  (`workflows/context.md:225-234,293`, read by `workflows/verify.md:74-78`) is
  in-grammar trailing prose. The classifier admits and ignores it, id extraction is
  unaffected, and `verify.md` keeps its current prose read. Rejected promoting it to
  a declared field (`{id, text, humanVerify}`): cleaner long-term but widens phase 5
  into verify.md's routing.

- D-14 (Scope): The `human_checks` counting bug stays in CAPTURE for its own phase;
  only the origin marker is in scope here. See Deferred above.

- D-15 (Fixture): The fixture is SYNTHESIZED from this cycle's phase-1 pair
  (`.planning/phases/1/CONTEXT.md` AC1-AC7 plus `.planning/phases/1/UAT.md`'s 14
  items) with two items deleted - real prose, synthetic defect. `ROADMAP.md:93`'s
  v1.4.0 provenance is corrected in the same phase rather than chased: the analyzer
  checked every `docs: phase N UAT` commit across all refs against its own CONTEXT
  at that commit, and no committed checklist has fewer items than its phase's
  criteria, while v1.4.0's criteria carry no `AC<N>` ids at all. Rejected dropping
  the end-to-end case for grammar-table rows alone.

- D-17 (Lockstep): A new subcommand forces a `self-verify.mjs` CONTRACTS entry
  (`:57-76`, where `audit: []` declares zero flags) before any workflow may name it,
  plus a `TWO_WORD` entry (`:120`) if it takes a two-word form; otherwise
  `unknown-subcommand`/`unknown-flag` fire (`:327-343`). `cadence-core/references/`
  costs no weight budget (`lib/surface-weight.mjs:53-80` measures `agents/*.md`,
  `skills/**/SKILL.md` and `cadence-core/workflows/*.md` only), but
  `weight-budgets.json` budgets `audit.md` 5078 (`:23`), `context.md` 16046 (`:26`)
  and `verify.md` 10830 (`:43`) to the byte, and all three take prose edits this
  phase. Per-row tests land in `cadence-core/bin/planning-files.test.mjs` beside
  `NORMALIZE_ROWS` (`:400`), `PHASE_LIST_ROWS` (`:426`/`:564`) and `ACTIVE_ROWS`
  (`:694`/`:922`), one `test()` per row - NOT one looped assertion, which hides
  every row after the first failure.

## Acceptance criteria

- [ ] AC1: A CONTEXT `## Acceptance criteria` bullet carrying `AC<N>` parses to
      `{id, text}` through the new reader, and every out-of-grammar shape in the new
      `cadence-core/references/` grammar table returns its named diagnostic instead
      of a changed reading, with one `planning-files.test.mjs` `test()` per row.
- [ ] AC2: The new seam call on the synthesized fixture (this cycle's phase-1
      CONTEXT plus UAT with two items removed) returns a verdict-breaking code
      naming exactly the two uncovered ids and no others.
- [ ] AC3: The same call reports a UAT item with no `criterion` without changing the
      verdict; an item carrying `origin: verifier` is not reported; a checklist where
      no item carries `criterion` is reported as legacy and does not break.
- [ ] AC4: A `criterion` written by `uat init` is byte-present in the file after
      `uat refresh` and after `uat record`; the same holds for `origin`, which
      `uat record --origin` can set after the fact.
- [ ] AC5: `/cad-phase insert` at a position before an existing phase leaves that
      phase's CONTEXT `AC<N>` ids byte-identical, pinned by a renumber test.
- [ ] AC6: Phases 1-4's UAT files carry `criterion` on every criterion-derived item
      and `origin` on every item that is not, and the new seam call returns zero
      breaks for all four.
- [ ] AC7: `/cad-audit` on the fixture issues FAIL naming the uncovered ids, rather
      than PASS-with-warnings. (human-verify: needs an interactive /cad-audit run -
      it is a slash-command surface no executor can invoke)
- [ ] AC8: `node --test cadence-core/bin/*.test.mjs` and `tsc -p tsconfig.ci.json`
      pass, and `self-verify` reports `ok:true` with the new subcommand and its flags
      in CONTRACTS and no `budget-overrun` on `audit.md`, `context.md` or `verify.md`.

Tooling probed on this machine: node, npx, local tsc and git all present. AC7 is
the only human-verify criterion.

## Flagged assumptions

- `ROADMAP.md:93` names a fixture case that does not exist - "the v1.4.0 phase-1
  case ... the round-1 checklist that dropped AC4 and AC5". Verified false (see
  D-15). The line needs correcting, but /cad-context does not edit ROADMAP, so it
  belongs to an execution task in this phase's plan or to /cad-verify 5. The planner
  must not treat that sentence as a source for the fixture.
