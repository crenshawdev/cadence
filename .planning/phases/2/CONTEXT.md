# Phase 2: References load where they are used - Context

Gathered: 2026-08-05
Feeds: /cad-plan 2

## Scope boundary

In: the five sites where a command pays in turn one for prose only one of its
branches reads - splitting `references/git.md` (LOD-01), extracting the triage
gate and restating its adjudicated arm as a structured multi-select (LOD-02),
inlining the `conventions.md` phantoms (LOD-03), deciding the `/cad-config`
catalog on a measurement (LOD-04), and judging every remaining eager include
per skill against the break-even test (LOD-05). Transport by default: bytes
move and load later, content is preserved. The milestone's one deliberate
behaviour exception lands here - `review-triggers.md` § 6's adjudicated arm
stops mandating open-ended prose.

Out: skill and rung-agent descriptions, and putting `cadence-core/references/**`
and `templates/**` under the weight budget (both phase 3); removing or
weakening any review, gate, rung or guardrail; deferring `/cad-land`'s eager
includes wholesale (rejected in the source work order: loses ~11k on any run
reaching the step to save ~3.3k on one that does not - D-05 defers only the
publish half); moving workflow rationale to design-notes (dropped outright).

Deferred: None.

Plan shape: multiple plans, same phase - split along the requirement seams
(LOD-01 git split + citation sweep / LOD-02 triage gate + carve-out /
LOD-03+04+05 inlines, catalog decision, break-even sentence and budgets), each
independently executable, sharing one review surface.

## Durable decisions

- D-01 (the split point): `git-guard.md` takes rails 1, 2 and 4 PLUS
  `### What the guard sees`; `git-publish.md` takes rail 3 and
  `### What the guard does NOT see (rail 3)` with a one-line pointer back.
  `What the guard sees` sits physically under rail 3 but opens "Both rails read
  one function (`cadence-core/bin/lib/git-segments.mjs`) ... so they always
  agree on what a command IS" - it documents rail 1's commit guard as much as
  rail 3's push guard, and the four guard-only skills would otherwise lose the
  only prose explaining why `rg -t sh "git commit"` never prompts while
  `git commit` does. Resulting sizes: guard ~6,000 B (6,880 minus the paragraph
  D-02 moves), publish 4,450 B, against today's single 11,330 B file. Rejected:
  following the physical nesting into `git-publish.md`, and duplicating the
  subsection into both (a two-copy invariant nothing checks). Evidence:
  `cadence-core/references/git.md:124-149,150-182`,
  `cadence-core/bin/git-guard.mjs:13,69,136,141`.
- D-02 (the worktree paragraph leaves rail 1): `git.md:78-89`, the ~900 B
  `worktree.baseRef` fork-point paragraph, moves to `references/seams.md`
  § spawn-agent Worktree isolation - the rule it actually belongs to, which
  `git.md:81` already cross-cites. It serves `execute.md`'s `choose_path` and
  `cad-executor-contract`, not the commit guard, and rides all four guard-only
  skills today for nothing. Rejected: leaving it in `git-guard.md` to avoid a
  third destination. Evidence: `cadence-core/references/git.md:78-89,81`,
  `cadence-core/workflows/execute.md` (`choose_path`),
  `skills/cad-executor-contract/SKILL.md`.
- D-03 (the eager map): `/cad-phase`, `/cad-pause`, `/cad-undo` and
  `/cad-milestone` `@`-include `references/git-guard.md` only; `/cad-land`
  keeps the guard eager (steps 1, 2 and its triage commits all use rails 1-2)
  and READS `git-publish.md` at step 4b, where the seam call and the
  `auto_close` policy apply. `/cad-milestone` reads `git.auto_close` and chains
  into `/cad-land`, but `milestone.md:66-67` already restates the rail-3 policy
  inline ("do NOT push it - publishing the tag is /cad-land's decision"), so
  guard-only holds without losing the rule. Rejected: keeping both files eager
  on `/cad-milestone` as a stated exception. Evidence:
  `skills/cad-land/SKILL.md:20-21,33-38,54,91-105`,
  `cadence-core/workflows/milestone.md:8,62-67,127-139`,
  `skills/cad-pause/SKILL.md:21`, `skills/cad-undo/SKILL.md:24`,
  `skills/cad-phase/SKILL.md:24`.
- D-04 (the whole of § 6 moves): the triage reference takes
  `review-triggers.md:172-196` - all three gate arms plus the closing
  `cad-verify` paragraph - not the adjudicated arm alone. `plan.md:224-226`
  branches across all three arms at one call site and `verify.md`'s gateless
  fire depends on the closing paragraph, so all four consumers need exactly one
  file. Rejected: extracting only the adjudicated arm (1,351 B), under which
  `plan.md` and `verify.md` must open both files to resolve their branch -
  adding a read on the paths this phase exists to cheapen. Evidence:
  `cadence-core/references/review-triggers.md:172-196`,
  `cadence-core/workflows/plan.md:224-226`,
  `cadence-core/workflows/verify.md:194-197`.
- D-05 (the multi-select is the tool, not a reply form): the adjudicated arm
  specifies `AskUserQuestion` with `multiSelect: true`, batched ceil(N/4) per
  call to fit the tool's 4-option cap - the same batch-asks rule
  `conventions.md` § Parallel work already states - with NONE still the
  default. `references/seams.md:13` binds the tool to "Structured choice (2-4
  mutually exclusive options)", and that stale binding is the sole stated
  reason `review-triggers.md:178-182` mandates prose today; the binding is
  corrected in the same pass. Rejected: a numbered list with a fixed reply form
  ("reply with the numbers, or NONE"), which needs no seam edit but leaves the
  gate typed rather than tapped. Evidence:
  `cadence-core/references/seams.md:8-15`,
  `cadence-core/references/review-triggers.md:178-182`,
  `.planning/CAPTURE.md` (2026-07-30 entry).
- D-06 (the carve-out moves with the gate and gets scoped): the
  `git.auto_close` carve-out at `review-triggers.md:185-189` travels into the
  triage reference AND is restated as scoped to the `pre_ship`/`cad-land` arm,
  closing the open [high] at `.planning/CAPTURE.md:180`. Today it sits in the
  generic adjudicated arm, so a repo opting into the unattended land close
  suppresses the triage prompt at EVERY adjudicated gate while
  `land-cleanup.mjs gate` does not exist outside `/cad-land` - grounded
  plan-review survivors are silently discarded. Rejected: leaving the carve-out
  behind while the gate moves, splitting one rule across two files. Evidence:
  `cadence-core/references/review-triggers.md:185-189`,
  `.planning/CAPTURE.md:180`, `cadence-core/bin/land-cleanup.mjs:100`,
  `cadence-core/bin/land-cleanup.test.mjs:140`.
- D-07 (`cad-plan-review` stays eager - an explicit KEEP): its whole body is
  one `fire('plan')`, so all 15,734 B of `review-triggers.md` is consulted on
  EVERY path and LOD-05's "a reference consulted on every path stays eager"
  applies. Recorded as a decision rather than passed over, because a future
  reader optimizing eager totals would move it. Rejected: eager-loading only
  § 6 plus fire's steps 1-5, which needs a second split of
  `review-triggers.md` this phase does not make. Evidence:
  `skills/cad-plan-review/SKILL.md:16,28,41`.
- D-08 (all 17 parentheticals inline, none becomes an include): the 17 bare
  `conventions.md` citations in `cadence-core/workflows/*.md` cite only THREE
  distinct rules - 14 cite § Parallel work (896 B whole, 611 B first
  paragraph), 2 cite its batch-asks paragraph (266 B), 1 cites § Paths'
  lazy-create rule (305 B) - all against a 5,115 B file. Every one is inlined
  at its use site. `skills/cad-pause`'s `@`-include of `conventions.md`, the
  only one in the plugin, is dropped with them: it pays 5,115 B for a single
  266 B citation on a skill whose entire job is a WIP commit plus a cursor
  write, cutting 4,849 B from every `/cad-pause` run and leaving
  `conventions.md` eager nowhere. Rejected: a blanket `@`-include into the 14
  citing commands (5,115 B eager to deliver at most 896 B of rule - the exact
  inversion this phase exists to stop), and keeping `cad-pause`'s include as a
  live example of the mechanism. Evidence:
  `cadence-core/references/conventions.md:22-25,35-49`,
  `skills/cad-pause/SKILL.md:21-22,43`.
- D-09 (the catalog stays transcribed): `/cad-config`'s catalog is NOT derived
  from `config.mjs keys`. Two independent grounds. Measurement: parsing every
  slash-command invocation across `/home/john/.claude/projects/**/*.jsonl`
  yields 5 `/cad-config` runs in total, none carrying `--review` or a
  `<key>=<value>` token, so by `config.md:16-22`'s Route rule all five reach
  the interactive menu - non-menu runs do not dominate, they are zero of five
  (for scale: `cad-verify` 46, `cad-plan` 44, `cad-execute` 39). Arithmetic:
  `node cadence-core/bin/config.mjs keys` emits 20,769 B on one JSON line
  against a 6,827 B catalog table, and the schema's field union
  (`type, values, default, src, purpose, min, max`) carries no per-value
  explanation field, while `config.md:41-42` requires each option to carry its
  Explanation as the option `description`. Deriving would cost more bytes and
  drop required copy, or force re-authoring the copy INTO the schema - a schema
  change, not a transport change. Rejected: deriving from `config.mjs keys`.
  Evidence: `cadence-core/workflows/config.md:16-22,38-42,61-127`,
  `cadence-core/config.schema.json`, measured `config.mjs keys` output.
- D-10 (the break-even rule generalizes by one sentence): phase 1's D-12 rule
  landed at `cadence-core/references/seams.md:207-219` under **File round-trip
  (when the extra turn pays)**, but every noun in it is a subagent round-trip
  noun - parent, child, artifact, read-back - so it does not literally cover an
  eager-vs-lazy include. One sentence extends the two-clause test to any
  deferred read, so each LOD-05 judgment cites it exactly instead of by
  analogy. Additive prose: it removes no gate and grows a reference by ~200 B
  in a byte-cutting cycle, which is the trade accepted so the mapping is
  written once rather than once per judgment. Rejected: citing the rule as-is
  and restating the mapping at every site. Evidence:
  `cadence-core/references/seams.md:192-219`,
  `.planning/phases/1/CONTEXT.md:121-129`, `.planning/REQUIREMENTS.md` RES-04.

## Decisions

- D-11 (the citation sweep is wider than SC1's grep, and one arm is enforced):
  `INTERNALS.md:37` names `cadence-core/references/git.md` in backticks and
  self-verify check 3b fails `missing-internals-path` on any backticked repo
  path that does not exist - so deleting `git.md` without editing INTERNALS.md
  exits 1. Unenforced and swept by hand: `config-reach.md:145`,
  `METHOD.md:508,523,608`, and rail-N comments in `git-guard.mjs`,
  `git-branch.mjs`, `git-publish.mjs`, `lib/git-segments.mjs`,
  `lib/dispatch-phrasing.mjs`, `git-guard.test.mjs`, `git-segments.test.mjs`.
  Evidence: `cadence-core/bin/self-verify.mjs:473-478,415-421`,
  `INTERNALS.md:37`, `cadence-core/bin/lib/git-segments.mjs:22-23,61`.
- D-12 (citations disambiguate against the executables): `git-guard.md` and
  `git-publish.md` collide by name with `cadence-core/bin/git-guard.mjs` and
  `git-publish.mjs`, both cited by bare name in prose today. Every citation
  carries the `references/` prefix or the `.md` extension. Evidence:
  `skills/cad-land/SKILL.md:96-105`, `cadence-core/references/git.md:107-113`.
- D-13 (no sentence is dropped in the move): self-verify check 1b
  (`inert-config-key`) requires every one of the 79 schema keys to be named by
  prose somewhere in the walked tree, and `git.md` is the sole or near-sole
  reader for several `git.*` keys - a rail-1 sentence trimmed during the split
  exits 1 reading as a config defect rather than a lost sentence. Evidence:
  `cadence-core/bin/self-verify.mjs:484-490`,
  `cadence-core/references/git.md:7,68-76,105,118-119`.
- D-14 (five citation sites, not three): the RE-READ sites are
  `execute.md:167`, `plan.md:230` and `verify.md:197`, each ending "since this
  workflow does not preload it". Two further citations on `execute.md`'s
  PARALLEL path (`:235`, `:246`) name "§ 6 Consequence, NONE the default" with
  no read instruction at all and get the new pointer too - otherwise the
  `phase_diff` survivors are acted on against a section heading that no longer
  exists. Evidence: `cadence-core/workflows/execute.md:161-170,228-247`.
- D-15 (the extracted file stands alone): it restates the
  `off|advisory|blocking|adjudicated` gate vocabulary in one line (~120 B of
  deliberate duplication) rather than pointing back at `review-triggers.md`
  step 1, and `review-triggers.md` § 6 becomes a pointer. Evidence:
  `cadence-core/references/review-triggers.md:25-29,172-196,198-212`.
- D-16 (numbered list, not a table): the new reference falls inside self-verify
  check 10's dispatch-phrasing scope, and `.planning/CAPTURE.md:190` records
  that a single markdown table row is still evaluable as an imperative
  instruction. The multi-select renders as a numbered list, the form the
  existing catalog rows already prove checkable-safe. Evidence:
  `cadence-core/bin/self-verify.mjs:88-89,436-440`, `.planning/CAPTURE.md:190`.
- D-17 (`@`-includes are skill-only here, so SC4's include arm means the
  SKILL.md): all 20 `@${CLAUDE_PLUGIN_ROOT}` lines in this repo live in
  `skills/*/SKILL.md`; `cadence-core/workflows/`, `cadence-core/references/`
  and `agents/` contain none. An include written into a workflow body is either
  inert or relies on transitive expansion this repo has never exercised, so
  this phase inlines throughout and adds no workflow-level include. Evidence:
  `grep '^@\${CLAUDE_PLUGIN_ROOT}'` over `skills/`, `cadence-core/workflows/`,
  `cadence-core/references/`, `agents/`.
- D-18 (`config.md` is eager on every branch): all 18,265 B load on every
  `/cad-config` run regardless of route (19,601 B turn-one total), so the
  catalog's cost is paid identically by the `--review` and direct-set branches
  the measurement shows are never used. Recorded alongside D-09 so SC5's "not
  left ambiguous" is fully satisfied. Evidence:
  `skills/cad-config/SKILL.md:29`, `cadence-core/bin/weight-budgets.json`.
- D-19 (the stated eager baseline): every LOD-05 keep-or-move call is stated
  against these measured turn-one totals (SKILL.md plus every `@`-included
  file): `cad-land` 36,235 · `cad-milestone` 20,855 · `cad-verify` 19,834 ·
  `cad-config` 19,601 · `cad-pause` 18,523 · `cad-execute` 18,452 ·
  `cad-plan-review` 18,182 · `cad-context` 17,233 · `cad-phase` 15,941 ·
  `cad-undo` 15,633 · `cad-plan` 15,584 · `cad-new-project` 15,349. Only two
  references are eager anywhere - `git.md` (5 skills) and `review-triggers.md`
  (`cad-land`, `cad-plan-review`) - plus `conventions.md` (`cad-pause`) and
  `COMMANDS.md` (`cad-help`). Evidence: measured over `skills/*/SKILL.md`
  `@`-include lines.
- D-20 (budgets regenerate, new references carry none): every skill and
  workflow this phase edits regenerates `weight-budgets.json` in the same
  commit, per phase 1's D-17 - the budget is a ceiling, and phase 1 pinned each
  edited surface at exactly its budget, so removing an `@` line shrinks a
  SKILL.md and silently leaves pre-approved headroom for phase 3's BUD-01 to
  measure against. The two new reference files get no budget entry:
  `lib/surface-weight.mjs` walks only `agents/*.md`, `skills/**/SKILL.md` and
  `cadence-core/workflows/*.md`, and `references/` comes under budget in phase
  3. Evidence: `cadence-core/bin/self-verify.mjs:493-518`,
  `cadence-core/bin/lib/surface-weight.mjs:9-12,54-78`,
  `.planning/phases/1/CONTEXT.md:152-160`.

## Acceptance criteria

- [ ] AC1: `cadence-core/references/git.md` does not exist, `git-guard.md` and
      `git-publish.md` do, `grep -rn "references/git.md"` over
      `cadence-core/`, `skills/`, `agents/`, `INTERNALS.md` and `METHOD.md`
      returns nothing, every surviving "rail N" citation names the file that
      now holds that rail, and `node cadence-core/bin/self-verify.mjs` exits 0.
- [ ] AC2: `/cad-phase`, `/cad-pause`, `/cad-undo` and `/cad-milestone` each
      `@`-include `references/git-guard.md` and no other reference;
      `skills/cad-pause/SKILL.md` includes no `conventions.md`; `/cad-land`
      includes `git-guard.md` but not `git-publish.md`, and `land.md` reads
      `git-publish.md` at the step that acts on the publish rails.
- [ ] AC3: The triage gate is its own file under `cadence-core/references/`;
      all five citation sites - `execute.md:167`, `execute.md:235`,
      `execute.md:246`, `plan.md:230`, `verify.md:197` - name that file and
      instruct no read of `review-triggers.md`, whose § 6 is a pointer.
- [ ] AC4: The extracted adjudicated arm specifies `AskUserQuestion` with
      `multiSelect: true` batched ceil(N/4) and NONE still the default; no
      open-ended-prose mandate remains anywhere in `cadence-core/`;
      `references/seams.md`'s ask-user binding no longer limits the tool to 2-4
      mutually exclusive options; and the `git.auto_close` carve-out reads as
      scoped to `pre_ship`/`cad-land`, with `land-cleanup.mjs` and
      `land-cleanup.test.mjs` naming the file and line that now hold it.
- [ ] AC5: `grep -n "conventions.md" cadence-core/workflows/*.md` returns
      nothing, and each of the three cited rules reads in full at every one of
      its 17 former citation sites.
- [ ] AC6: The `/cad-config` catalog decision is recorded with both the
      run-count measurement and the byte arithmetic, and `config.md`'s catalog
      section states whether the catalog is derived or transcribed with no
      ambiguity left.
- [ ] AC7: `references/seams.md`'s break-even rule covers any deferred read,
      every eager-include keep-or-move call is stated with its reason, and
      `node --test cadence-core/bin/*.test.mjs` plus
      `node cadence-core/bin/self-verify.mjs` both pass with
      `weight-budgets.json` regenerated in the commits that touched budgeted
      surfaces.

## Flagged assumptions

- The `/cad-config` run count is n=5 across all transcripts, which is thin
  enough that the smallness is itself the finding. D-09 therefore rests
  primarily on the byte arithmetic, which is independent of run mix; if a wider
  window showed non-menu runs dominating, the arithmetic still refuses the
  derivation.
- Whether an `@${CLAUDE_PLUGIN_ROOT}` line inside a workflow file that is
  itself `@`-included by a SKILL.md is expanded by the loader is unknown - the
  repo has zero instances. D-17 avoids depending on it rather than resolving
  it; if a later phase wants workflow-level includes, this needs a host answer
  first.
- D-03 assumes `/cad-land` reaches rails 1-2 on every run through its steps 1,
  2 and triage commits. If a `/cad-land` path exists that commits nothing, the
  guard include is eager for a branch that never reads it and that site is
  itself a LOD-05 candidate.
