---
status: testing
phase: 4
started: 2026-07-28
updated: 2026-07-28
---

## Items

### 1. Non-canonical phase shapes classify as live
expected: All five verified shapes - `- Phase 1: Ship auth`, `### Phase 1: Auth`, `1. Phase 1: Auth`, a `| Phase | Name |` table row, and `- ✓ Phase 1: Auth` - classify the phase list as LIVE (out-of-grammar / not closed), never as a closed milestone. A roadmap whose `## Phases` checkbox list is wiped but whose `### Phase N:` details survive under `## Phase Details` also classifies as live.
status: pass
first_pass: pass
source: verifier
evidence: Six scratch fixtures through `planning.mjs status`: `- Phase 1: Ship auth` -> phase-bullet (line 5); `### Phase 1: Auth` -> phase-heading; `1. Phase 1: Auth` -> phase-ordered-item; table row -> phase-table-row (line 7); `- ✓ Phase 1: Auth` -> phase-bullet; wiped list + surviving `### Phase 1: Auth` -> phase-heading (line 7). All ok:false, none cycle:"none".

### 2. Genuinely closed milestone returns ok:true with the closed field
expected: An empty `## Phases` section returns an `ok:true` status carrying `cycle:"none"` with `current:null` and `total:0`, and still does so when the section holds ordinary non-phase prose (a stray `- [ ] decide scope` bullet, or a sentence with a bolded `**Phase` word carrying no number). HEAD returned `unparseable-roadmap` for both.
status: pass
first_pass: pass
source: verifier
evidence: Fixture c1 (empty section + bare `## Phase Details`) and c2 (`- [ ] decide scope` + bolded `**Phase**` word) both emit {"ok":true,"current":null,"total":0,"cycle":"none","phases":[]}. planning.mjs:114,205-210

### 3. Out-of-grammar diagnostics name the offending line
expected: Each rejected shape's diagnostic identifies the offending line - `{line, code, text}` with one of `phase-heading`, `phase-bullet`, `phase-ordered-item`, `phase-table-row`, `phase-prose-line` - rather than one blanket `unparseable-roadmap` string.
status: pass
first_pass: pass
source: verifier
evidence: All five codes observed live, incl. phase-prose-line: {"ok":false,"reason":"unparseable-roadmap","detail":"line 5: Phase 2 rolls to the next milestone.","issues":[{"line":5,"code":"phase-prose-line"}]}. Emitter planning.mjs:103-113; classifier lib/planning-files.mjs:131-143

### 4. The grammar is written down and pinned by a parser-level table
expected: `cadence-core/references/roadmap-phases.md` states the roadmap phase-list grammar and names the out-of-grammar shapes, and each named shape has a row in the `PHASE_LIST_ROWS` table in `cadence-core/bin/planning-files.test.mjs` asserting its stated behavior.
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/references/roadmap-phases.md (162 lines; out-of-grammar table at :103-109). PHASE_LIST_ROWS at planning-files.test.mjs:425-545, 22 rows driven at :547-554; all five codes covered (:490-539) plus an exact {line,code,text} assertion at :556-560

### 5. Cursor agreement against an empty phase list
expected: With an empty phase list, `planning.mjs status` reports `agrees:true` for cursor statuses `phase complete` and `ready to plan`, reports drift for `planned`, `executed` and `context gathered`, and `paused` keeps its existing any-point carve-out.
status: pass
first_pass: pass
source: verifier
evidence: Six live runs on a zero-phase roadmap: `phase complete`/`ready to plan`/`paused` all agrees:true; `planned`/`executed`/`context gathered` all agrees:false with a `cursor` drift ('derived closed milestone (no phases in ROADMAP)'). planning.mjs:171-189

### 6. An interrupted close reports closed state AND phase-dir drift
expected: An empty `## Phases` with `phases/N/PLAN.md` still on disk reports the closed state AND a drift entry of kind `phase-dir` naming the surviving directory.
status: pass
first_pass: pass
source: verifier
evidence: Empty `## Phases` + .planning/phases/2/PLAN.md: {"ok":true,"cycle":"none","phases":[],"drift":[{"kind":"phase-dir","phase":2,"detail":"phases/2/ survives the milestone close (1 plan files)"}]}. planning.mjs:135-147

### 7. cursor set succeeds against a pruned roadmap
expected: `planning.mjs cursor set --phase 1 --status "ready to plan" --next "..."` against a pruned roadmap returns `ok:true` with NO `--name`/`--total` flags, writing `Phase: 1 of 0 (no active cycle)`, and the next `cursor get` reads it back without `unparseable-cursor`. HEAD returned `{"ok":false,"reason":"cannot-derive"}`.
status: pass
first_pass: pass
source: verifier
evidence: `cursor set --phase 1 --status "ready to plan" --next "/cad-phase add"` on a pruned roadmap -> {"ok":true,"cursor":{"phase":1,"total":0,"name":"no active cycle"}}; STATE.md holds `Phase: 1 of 0 (no active cycle)`; following `cursor get` ok:true, no unparseable-cursor. planning.mjs:263-273, closed arm ahead of the prior-cursor fallback at :275-281

### 8. Test suite, typecheck and self-verify all clean
expected: `node --test cadence-core/bin/*.test.mjs` passes, `npx tsc -p tsconfig.ci.json` exits 0, and `node cadence-core/bin/self-verify.mjs` reports `problems:[]` - no `budget-overrun` for the bumped prose files, no `missing-path` for the new reference.
status: pass
first_pass: pass
source: verifier
evidence: `node --test cadence-core/bin/*.test.mjs` -> tests 674 / pass 674 / fail 0, exit 0; `npx tsc -p tsconfig.ci.json` exit 0; `self-verify.mjs` -> {"ok":true,"checked":"config-keys, invocations, paths, internals-paths, budgets, tools","problems":[]}

### 9. An interrupted close routes to /cad-milestone, not /cad-phase add
expected: `workflows/progress.md`'s route table (first-match-wins, one suggestion) has a `phase-dir` drift row that routes to `/cad-milestone` to finish the interrupted prune, ahead of the `cycle is none` row. Today the only matching row offers `/cad-phase add` - a new phase on top of an unfinished prune.
status: pass
first_pass: fail
source: verifier
evidence: Retest after d410fa3: progress.md:109 `Drift kind \`phase-dir\` (interrupted prune) | /cad-milestone` sits directly above :110 `cycle is none | /cad-phase add`, so first-match-wins now reaches the reconcile rule at :64-66.
reported: missing - the reconcile rule exists but its route row does not, so the rule is unreachable
severity: major
cause: progress.md's reconcile step (:64-66) and its route table (:103-110) were written in the same change but only the reconcile half learned the phase-dir kind. The table is first-match-wins with one suggestion, so the rule at :64-66 is structurally unreachable.
fix: d410fa3, retest

### 10. Other status consumers understand cycle:"none"
expected: `workflows/coverage.md`, `workflows/execute.md` and `workflows/plan.md` have a stated rule for an `ok:true` status with `cycle:"none"` and an empty `phases[]`. Today `grep -n cycle` on those three returns nothing, and `coverage.md`'s "highest phase whose status is complete, else executed" has no rule for an empty array.
status: pass
first_pass: fail
source: verifier
evidence: Retest after e530b9e: grep -c cycle on coverage/execute/plan.md returns 2/3/2 (was 0/0/0). Each states the ok:true + cycle:'none' + empty phases[] case and routes to /cad-phase add.
reported: missing - three workflows read the status envelope and were never taught the new state; what used to stop them at ok:false now returns ok:true
severity: major
cause: PLAN.md:5's files list scoped the prose sweep to the surfaces that CONTRADICTED the new state (progress, milestone, cad-health, cad-progress) and missed the surfaces that merely CONSUME it. coverage/execute/plan.md were previously protected by ok:false on an empty roadmap; cycle:'none' removed that guard without telling them.
fix: e530b9e, retest

### 11. /cad-milestone step 6 names /cad-phase add
expected: `workflows/milestone.md` step 6's prose names `/cad-phase add` as the next-action destination after a close, matching `progress.md`'s route table.
status: pass
first_pass: pass
source: verifier
evidence: workflows/milestone.md:89-101 (flagless `cursor set` block plus '/cad-phase add is the destination because it is the only workflow that appends a phase line') and :128-130 in step 8's report

### 12. HUMAN: /cad-progress reports the closed milestone
expected: Against a scratch TEMPLATE-shaped tree pruned by the amended `milestone.md` step 3, running `/cad-progress` prints the closed-milestone header (no phase list) and offers `/cad-phase add` as the single next step.
status: pass
first_pass: pass
evidence: Closed by user override (John), 2026-07-28. No slash-command output captured in-session. Seam layer beneath it independently verified: a pruned TEMPLATE-shaped tree returns {ok:true,cycle:"none",current:null,total:0} and the cursor reads 'Phase: 1 of 0 (no active cycle)' with agrees:true. What remains unobserved is progress.md's prose report and route selection.

### 13. HUMAN: /cad-health is clean against a closed milestone
expected: Against that same pruned tree, `/cad-health` reports no structural issue - the `## Phases` 1..M no-gaps rule and the cursor `of M` == phase-count rule both take their closed-milestone case.
status: pass
first_pass: pass
evidence: Closed by user override (John), 2026-07-28. /cad-health was observed clean against a LIVE 3-phase tree, not against a closed milestone, so rules 3 and 5's closed-milestone clauses remain unexercised. Prose is in place at skills/cad-health/SKILL.md:30-46.

### 14. HUMAN: /cad-phase add round-trips on a pruned roadmap
expected: Running `/cad-phase add` against that pruned roadmap appends a phase entry that a following `planning.mjs status` reads back as phase 1 of a live cycle - including `workflows/phase.md`'s own "current total + 1" derivation from zero.
status: pass
first_pass: pass

### 15. A canonical phase line under a later ## heading gets a dead-end diagnostic
expected: behavior wrong - the emitted fix instruction is a no-op on the reported line, and the real cause (wrong section) is never named
status: pass
first_pass: fail
source: verifier
evidence: Retest after 7b3474b: a canonical entry under '## Next milestone (draft)' now returns {"line":7,"code":"phase-outside-section","text":"- [ ] **Phase 1: Auth** - log in"} instead of phase-bullet.
reported: behavior wrong - the emitted fix instruction is a no-op on the reported line, and the real cause (wrong section) is never named
severity: minor
cause: classifyPhaseList (planning-files.mjs:133-141) classifies by line SHAPE only. A byte-perfect canonical entry outside the canonical extent matches PHASE_LINE but is reported phase-bullet, whose documented fix is a no-op on it. The classifier has no arm that asks 'does this line already match PHASE_LINE?' before choosing a code.
fix: 7b3474b, retest

### 16. /cad-pause erases the interrupted-close evidence
expected: behavior wrong - a flagless cursor set now overwrites the only surviving signal of an unfinished close
status: pass
first_pass: fail
source: verifier
evidence: Retest after e4db428: interrupted close (empty ## Phases + phases/3/, cursor 'Phase: 3 of 5 (Billing)'). Flagless pause wrote 'Phase: 3 of 5 (Billing)'; status after still reports cycle:none with drift kinds [phase-dir, cursor] - the stale-total evidence survived the pause.
reported: behavior wrong - a flagless cursor set now overwrites the only surviving signal of an unfinished close
severity: minor
cause: cmdStatus computes the stale-total drift solely from parsed.total !== 0 (planning.mjs:196-202), making the cursor's stale 'of <M>' the single surviving signal of an unfinished close. cursor set's new closed arm (:267-273) overwrites total with 0 on any flagless call, and cad-pause/SKILL.md:33-35 is flagless.
fix: e4db428, retest

## Summary

total: 16
passed: 16
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 4
