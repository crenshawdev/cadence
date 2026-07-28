# Phase 4: A stated grammar for the roadmap phase list - Context

Gathered: 2026-07-28
Feeds: /cad-plan 4

The design brief is the four findings that reverted the v1.3.1 attempt
(`.planning/CAPTURE.md:51-56`), each of which must be closed by construction
rather than by another heuristic. The analysis pass reproduced the cursor half
live at HEAD: `cursor set --phase 1 --status "ready to plan"` against an empty
`## Phases` returns `{"ok":false,"reason":"cannot-derive"}`, which is exactly
what `workflows/milestone.md:85-93` step 6 prescribes, so the prescribed close
step cannot run on the tree its own step 3 produces.

## Scope boundary

In: a phase-list classifier over the `## Phases` section (D-01) keyed on a
`Phase <number>` token (D-02) and reading past today's `## `-bounded extent
(D-03); a stated grammar plus a named out-of-grammar table in
`cadence-core/references/` with per-shape diagnostics (D-04); a text-only
closed-state verdict with surviving phase dirs reported as their own drift kind
(D-05); the `AGREE` closed-milestone arm (D-09); an additive closed-state field
on an `ok:true` `status` envelope (D-08); a `cursor set` closed-state derivation
so the seam succeeds against a pruned roadmap (D-10); `/cad-phase add` named as
the next-action destination in both `progress.md` and `milestone.md` (D-07); a
parser-level grammar table in `planning-files.test.mjs` (D-11); a minimal
targeted `skills/cad-health/SKILL.md` edit (D-12); and every contradicted
shipped surface moving in the same change with `weight-budgets.json` (D-14).

Out: widening `PHASE_LINE` itself (D-01) - the canonical phase entry is
unchanged. The full `cad-health` re-spine, already deferred to its own branch;
only the two rules at `SKILL.md:33,38-40` are touched. A new cursor lifecycle
value (D-06). A new `planning.mjs` subcommand, and therefore any `CONTRACTS`
row or `self-verify.mjs` change (D-15). A verdict that consults the filesystem
(D-05, rejected). A roadmap-authoring step inside `/cad-milestone`, and a
create-the-entry arm inside `/cad-plan` (D-07, both rejected).

Deferred: None
Plan shape: one plan - the prose surfaces consume the seam's output on three
counts (`progress.md` names the envelope field and drift kind, `milestone.md`
step 6 depends on the `cursor set` derivation, and a `${CLAUDE_PLUGIN_ROOT}`
citation of the new reference fails `self-verify` check 3 with `missing-path`
until that file exists), and the natural finer cuts - envelope, drift, cursor -
all land in `planning.mjs` and `planning.test.mjs` together. The file lists do
partition, so `plan-overlap` would pass; the dependency is the judgment half of
`workflows/execute.md:59-79`, and the gain would be one short plan for the cost
of a worktree, a merge, and a prose rewrite if the contract moves.

## Durable decisions

- D-01 (the canonical phase entry is unchanged; this phase adds a CLASSIFIER
  over the section, not a wider phase parser): `PHASE_LINE` stays exactly
  `- [ ] **Phase N: Name** - desc` (`planning-files.mjs:52`, and `:125-135`
  where `setPhaseBox` uses the same shape). `planning-files.mjs:1067-1080`
  states the reason as D-08 of an earlier cycle: unifying every `Phase N:`
  matcher "for consistency" would change what counts as a phase for `status`,
  `audit`, `phase-done` and the cursor's `total` - a state-machine change
  smuggled in as a parser fix. `templates/ROADMAP.md:55-59` states the same
  contract to users ("Phase status is the `## Phases` checkbox, and nothing
  else"). Chosen over widening the recognizer, which closes finding 1 by making
  five more shapes real phases and silently re-points five consumers.
- D-02 (near-miss detection keys on a `Phase <number>` token, not on bullet or
  checkbox decoration): this is the line that separates finding 1 from finding
  3. All five verified failing shapes - `- Phase 1: Ship auth`,
  `### Phase 1: Auth`, `1. Phase 1: Auth`, a `| Phase | Name |` table row and
  `- ✓ Phase 1: Auth` - carry `Phase` and a number; both false-positive shapes
  - a stray `- [ ] decide scope` bullet and a bolded `**Phase` word - carry no
  number. `planning-files.mjs:1041-1065` (`shiftPhaseTokens`,
  `findProsePhaseRefs`) already treats `\bPhase (\d+)\b` as *the* phase token in
  this codebase, and `:118` (`escN`) makes decimal phase numbers legal. Chosen
  over a sentinel line that `/cad-milestone`'s prune writes (which closes
  findings 1 and 3 with no recognizer at all, but makes every roadmap closed
  before this change unparseable), and over classifying from
  `.planning/phases/<N>/` alone.
- D-03 (the classifier reads a wider extent than `parseRoadmapPhases` does):
  today `body = section.split(/^## /m)[0]` (`planning-files.mjs:61-63`) bounds
  the scan before `## Phase Details`, which the shipped template places
  immediately after `## Phases` (`templates/ROADMAP.md:22-38`). That bound is
  what makes the worst case in the brief possible: a wiped checkbox list with
  intact `### Phase N:` details and live `phases/N/PLAN.md` on disk reads as a
  clean close with `agrees:true` and no drift. `cutPhaseDetail`
  (`planning-files.mjs:1082-1092`) proves a detail heading is a per-phase
  artifact a real prune removes, so its survival is evidence. Two readers with
  deliberately different extents is the cost; a later contributor "restoring
  consistency" re-opens the false close.
- D-04 (out-of-grammar shapes are NAMED with a per-shape diagnostic, and the
  grammar is written down in `cadence-core/references/`): a rejected shape's
  diagnostic identifies the offending line rather than emitting today's single
  hardcoded `unparseable-roadmap` string (`planning.mjs:96`). Finding 3's stated
  harm is a `detail` naming a grammar the user is not violating, which a blanket
  reason cannot avoid. `references/plan-frontmatter.md:150-191` (per-code table
  with a Payload column) and `references/git.md:271-283` (the rail-3
  out-of-grammar table, each row pinned by a test) are the phase-1 and phase-3
  precedents, and `references/` costs no weight budget (phase-3 D-12). The
  out-of-scope note at `plan-frontmatter.md:197`, which currently says the
  roadmap list has "their own, unrelated grammars", gains a pointer. Chosen over
  stating the grammar in `templates/ROADMAP.md`'s Notes block, and over keeping
  one reason with the offending lines in `detail` only.
- D-05 (the closed-state verdict is text-only and pure in `lib/`; surviving
  phase dirs are a SEPARATE drift kind computed in `cmdStatus`): an interrupted
  close reports the closed state AND a drift entry, which is the accurate pair.
  Keeping the classifier pure and total in `lib/` is what lets the grammar table
  run at parser level (phase-3 D-07, phase-1 D-06); a verdict that consults the
  filesystem grows I/O and pays a node spawn per row. `planning.mjs:64-79`
  (`derivePhases`) and `:476-487` (`listPlanFiles`) already scan `phases/<N>/`,
  so the corroboration has a home in `cmdStatus` without moving into `lib/`.
  Chosen over folding the filesystem into the verdict, and over treating
  surviving dirs as disproof (falling back to `unparseable-roadmap`), which
  re-breaks `/cad-progress` in the exact state this phase exists to support and
  lets one orphan dir block the closed state permanently.
- D-06 (no new cursor lifecycle value; `phase complete` and `ready to plan`
  carry the closed state): `CURSOR_STATUSES` (`planning-files.mjs:12-15`) and
  `references/conventions.md:66-72` ("Do not invent other values") are the
  constraint, finding 4 frames its rule in terms of the existing values, and the
  reverted attempt added none. Accepted cost: `ready to plan` now means both
  "phase 1 of a live cycle" and "no cycle at all". Chosen over adding
  `milestone closed`, which would ripple into `conventions.md`,
  `skills/cad-health/SKILL.md:24-27`, every workflow that writes a status and
  the `AGREE` table - a lifecycle change rather than a scoped fix. The v1.2.0
  capture note that first proposed a between-milestones status predates this
  brief and is treated as superseded.
- D-07 (`/cad-phase add` is the next-action destination, named in
  `progress.md`'s route table AND in `milestone.md`): it is the only workflow
  that appends a phase line to an existing roadmap (`workflows/phase.md:13-20`);
  `workflows/plan.md:52-54` stops with "Phase {N} is not in ROADMAP.md" and
  between milestones there is no entry by construction, and
  `workflows/new-project.md:230-268` is initialization-only. This repo's own
  closed roadmap (`git show 58c490b:.planning/ROADMAP.md`) claims "`/cad-plan`
  writes them once the milestone's scope is set", which `plan.md` contradicts -
  a shipped claim this phase corrects. Chosen over adding a roadmap-authoring
  step to `milestone.md` after step 4 (which closes the window at the boundary
  but still leaves it open on a stopped close, and grows an interview-shaped
  step), and over giving `/cad-plan` a create-the-entry arm, which makes
  planning a phase absent from ROADMAP legal and weakens ROADMAP as the phase-set
  source of truth for `status`, `audit` and `phase-done`.
- D-08 (the closed state is an ADDITIVE field on an `ok:true` `status` envelope,
  with `current: null` and `total: 0` preserved as they are today):
  `planning.mjs:9-14` states the seam contract ("Fields are additive-only") and
  `:147-158` is the envelope; `design-notes/planning-mjs-interface.md:44-78`
  documents the shape. The reverted attempt chose `cycle:"none"`. The failure
  this guards is a caller branching on `current === null` alone reading a closed
  milestone as "all phases complete" and routing back to `/cad-milestone` - the
  loop the reverted commit's own `progress.md` note called out. Chosen over
  keeping `ok:false` with a distinct non-fatal reason, which makes every caller
  special-case it.
- D-09 (the `AGREE` logic gains a closed-milestone arm, replacing the reverted
  `else if (noCycle) agrees = true;`): against an empty phase list,
  `phase complete` and `ready to plan` agree; `planned`, `executed` and
  `context gathered` are drift; `paused` keeps its existing any-point carve-out
  (`planning.mjs:82-86,131-144`). Finding 4 states this mapping verbatim and
  names what the blanket `agrees = true` costs: drift detection dies in the one
  state where the cursor is the only surviving evidence, so an interrupted close
  reports healthy.
- D-10 (`cursor set` succeeds against a pruned roadmap BY CONSTRUCTION - the
  derivation chain gains a stated closed-milestone rule): reproduced live at
  gather time, `cursor set --phase 1 --status "ready to plan"` on an empty
  `## Phases` returns `{"ok":false,"reason":"cannot-derive"}`
  (`planning.mjs:185-208`, the flag > ROADMAP > prior-cursor > fail chain).
  `milestone.md:85-93` shows step 6 without `--name`/`--total`, with the
  pass-them-explicitly escape hatch only as a parenthetical after the code
  block, and step 3 always produces the tree that needs them. The alternative
  failure is worse than the error: inheriting the prior cursor's stale `total`
  (`planning.mjs:200-204`) writes `Phase: 1 of 5` against a zero-phase roadmap,
  which reads as an `of M` mismatch to `/cad-health`. Chosen over leaving the
  seam alone and moving the fix into `milestone.md` prose.

## Decisions

- D-11 (breadth is pinned by a parser-level table in `planning-files.test.mjs`;
  only a handful of rows re-assert at seam level): phase-1 D-06 and phase-3 D-09
  verbatim. `planning-files.test.mjs` currently has ZERO roadmap coverage, and
  every existing roadmap-parse assertion is seam-level
  (`planning.test.mjs:159-165`), paying an `execFileSync` node spawn per case
  through the harness at `:1-12`. A 15-30 row grammar table run that way is the
  exact per-case cost phase 1 rejected.
- D-12 (`cad-health` is in scope for a minimal targeted edit, not the deferred
  re-spine): `skills/cad-health/SKILL.md:33` requires `## Phases` entries
  numbered 1..M with no gaps and `:38-40` requires cursor `M` == ROADMAP phase
  count, so a legitimately closed milestone reports as unhealthy. Only those two
  rules gain the closed-milestone case; the full re-spine stays deferred to its
  own branch (`design-notes/flow-audit-2026-07-24.md:66`). Shipping the phase
  without it leaves shipped prose contradicting shipped code, the drift
  `self-verify` exists to catch.
- D-13 (`parseCursor`'s 4-line shape is unchanged, so whatever the closed state
  writes still satisfies `Phase: <N> of <M> (<non-empty name>)`):
  `planning-files.mjs:26-37` makes the name group non-optional and non-empty,
  and `lib/require-int.mjs:24-47` mirrors the file format on both ends with `0`
  legal. Phase 2 already paid once for a write the next `cursor get` rejected as
  `unparseable-cursor`.
- D-14 (every contradicted shipped surface moves in the same change, with
  `weight-budgets.json` bumped in the same commit): live check at gather time -
  budgets hold `progress.md` at 5346 and `milestone.md` at 6251, which are the
  exact current byte sizes, and `self-verify` currently returns `problems:[]`,
  so any prose byte fails `budget-overrun` without the bump. Same rail as
  phase-1 D-22, phase-2 D-15 and phase-3 D-12.
- D-15 (no new `planning.mjs` subcommand, so no `CONTRACTS` row and no
  `self-verify.mjs` change is owed): `self-verify.mjs:37-56` holds the
  `planning.mjs` contract table, where `cursor set` already allows `--name` and
  `--total`; phase-2 D-04 attaches the obligation to seam subcommands, and this
  phase adds none. Exposing the classifier as its own `roadmap-state`
  subcommand would owe one, and is not taken.
- D-16 (a new `drift[].kind` moves `progress.md`'s kind list and its reconcile
  routing in the same change): `workflows/progress.md:30` enumerates the kinds
  and `:42-57` routes `cursor` to a rewrite and every other kind to
  `/cad-verify`; `design-notes/planning-mjs-interface.md:70-72` documents the
  set. Left alone, `/cad-progress` misroutes an interrupted close to
  `/cad-verify N` for a phase N the roadmap no longer has.

## Acceptance criteria

- [ ] Each of the five verified non-canonical shapes - `- Phase 1: Ship auth`,
      `### Phase 1: Auth`, `1. Phase 1: Auth`, a `| Phase | Name |` table row,
      and `- ✓ Phase 1: Auth` - classifies the phase list as LIVE, not as a
      closed milestone. A roadmap whose `## Phases` checkbox list is wiped but
      whose `### Phase N:` details under `## Phase Details` survive also
      classifies as live, where the reverted attempt returned
      `{ok:true,cycle:"none",phases:[]}` with `agrees:true` for all six.
- [ ] A genuinely empty `## Phases` section returns an `ok:true` status carrying
      the closed-milestone field, and still does so when the section holds
      ordinary prose that is not a phase entry - a stray `- [ ] decide scope`
      bullet, or a sentence containing a bolded `**Phase` word with no number -
      where HEAD returns `unparseable-roadmap` for both.
- [ ] Running `/cad-progress` against a closed milestone reports the closed
      state and names `/cad-phase add` as the next action, and running
      `/cad-phase add` against that same pruned roadmap appends a phase entry
      that a following `planning.mjs status` reads back as phase 1 of a live
      cycle. `/cad-milestone` step 6's prose names the same destination.
- [ ] Against an empty phase list, `planning.mjs status` reports `agrees:true`
      for cursor statuses `phase complete` and `ready to plan`, and reports
      drift for `planned`, `executed` and `context gathered`; `paused` keeps its
      existing any-point carve-out. An interrupted close - empty `## Phases`
      with `phases/N/PLAN.md` still on disk - reports the closed state AND a
      drift entry naming the surviving directory.
- [ ] `planning.mjs cursor set --phase 1 --status "ready to plan" --next "..."`
      against a pruned roadmap returns `ok:true` with no `--name`/`--total`
      flags, and the cursor it writes is read back by the next `cursor get`
      without `unparseable-cursor`, where HEAD returns
      `{"ok":false,"reason":"cannot-derive"}`.
- [ ] A `cadence-core/references/` file states the roadmap phase-list grammar
      and names the shapes that are out of grammar, each named shape has a row
      in the parser-level table in `planning-files.test.mjs` asserting its
      stated behavior, and each rejected shape's diagnostic identifies the
      offending line rather than emitting one blanket `unparseable-roadmap`
      string.
- [ ] `node --test cadence-core/bin/*.test.mjs` and
      `npx tsc -p tsconfig.ci.json` both pass, `self-verify` reports no
      `budget-overrun` and no `missing-path`, and `/cad-health` reports no
      structural issue against a legitimately closed milestone.

## Flagged assumptions

- Whether `/cad-phase add`'s existing shape fits as the between-milestones entry
  point - Likely but unverified. It was designed for mid-cycle insertion into a
  populated roadmap, and opening a cycle from zero phases is a different
  conversation. Would matter if `add` turns out to need its own empty-roadmap
  arm, which would grow D-07's blast radius from a route-table entry to a
  workflow change.
- The exact set of non-canonical shapes users actually write - Unclear. The five
  in the brief are verified failing, but D-02's rule generalizes past them, so
  the grammar table's row set is the planner's judgment against the stated rule
  rather than a closed enumeration. Phase-1 D-20 applies: a shape left out of
  grammar needs a diagnostic, not silence.
- Whether the closed-state field should reuse the reverted attempt's
  `cycle:"none"` spelling - left to the planner. D-08 pins the shape (additive,
  on `ok:true`, `current: null` and `total: 0` preserved) but not the name; the
  reverted commit is recoverable if the spelling is worth keeping for callers
  written against it.
- The `weight-budgets.json` byte-exactness in D-14 was live-checked at gather
  time. If another change lands on `progress.md` or `milestone.md` first, the
  numbers move and the bump is against the new sizes, not these.
- Whether this phase adds to the `[1.4.0]` CHANGELOG entry - Unclear. Phases 1
  and 2 of this cycle added none; only phase 3 did, under its own D-14, because
  it contradicted a shipped `[1.3.1]` "Known gaps" bullet. This phase closes a
  gap that entry may also name, which would put it in the same situation.
