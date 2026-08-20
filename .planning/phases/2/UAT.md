---
status: testing
phase: 2
fields_version: 1
started: 2026-08-20
updated: 2026-08-20
---

## Items

### 1. deferred is a real gate value the config and resolver both accept
expected: config.mjs set review.triggers.<t>.gate=deferred succeeds for all four triggers, route.mjs resolve returns deferred in its review map for the pinned trigger, an unknown gate is refused naming all five values, and self-verify.mjs --root . reports no gate-vocabulary-drift.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Live: config.mjs set succeeded for all four triggers; check on `nope` refused with 'must be one of: off, advisory, deferred, blocking, adjudicated'; route.mjs resolve --role cad-reviewer returned deferred for every pinned trigger; self-verify.mjs --root . returned ok:true with problems:[] (routing-cells and gate-agreement included). config.schema.json:77,80,83,87 + route-table.json:19 + route.mjs:126 carry the same five names in the same order.

### 2. deferral is a fire receipt risk-check status joins on
expected: trace append --family outcome --event deferral --trigger <t> --plan <p> --base <b> --sha <s> is accepted, risk-check status over that range reports the range as fired rather than unfired, and a test reddens when deferral is removed from FIRE_RECEIPTS.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: Live in two scratch repos, both polarities: a matched `destructive` range with no receipt answered {ok:false, reason:"risk-fire-missing", state:"unfired"}; after `trace append --family outcome --event deferral` (ok:true) the same range answered {ok:true, state:"recorded"}. planning.mjs:4169 FIRE_RECEIPTS; planning.test.mjs's two new risk-check arms are green.

### 3. a deferred fire leaves the queue member and the review file, and no adjudication
expected: REVIEW-<trigger>-<discriminator>.md in the advisory arm's shape with DEFERRED-<trigger>-<discriminator>.json beside it, no ADJUDICATION-*.json, and the adjudication-record seam still refuses a finding with no ruling.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Live `deferred record` wrote DEFERRED-diff-plan-1.json holding the findings verbatim with resolved base_id/head_id, no ADJUDICATION-* alongside, and a second call refused with `record-exists`. buildEntries probed directly refuses a missing ruling and a fourth ruling value; RULINGS is frozen at three. The REVIEW file's shape is the raw {"findings": [...]} object (.planning/phases/2/REVIEW-risk_surface-plan-1.md) and triage-gate.md:19 passes that same path as --payload.

### 4. a run whose gate defers a blocker finishes unattended
expected: The phase reaches executed, its commits exist on the integration branch, and nothing prompted for input. (human-verify: needs a live /cad-execute chain)
criterion: AC4
status: skipped
reported: skipped
reason: Needs a live /cad-execute chain. Deferred to phase 3's own execution, which will exercise the deferred arm for real rather than against a scratch phase.

### 5. /cad-land refuses while a deferred finding is unadjudicated
expected: The land refuses with git.auto_close false, the refusal names each finding by trigger and discriminator, and deleting the refusal reddens a test. (human-verify: needs a live /cad-land run)
criterion: AC5
status: skipped
reported: skipped
reason: Needs a live /cad-land run, and the arm that would run if it did NOT refuse publishes to a remote. Deferred to phase 3's own land.

### 6. /cad-progress reports the deferred count off the status envelope
expected: The count of unadjudicated deferred findings appears in /cad-progress, it comes from the planning.mjs status envelope rather than the cursor string, and after a deferring run the cursor's Next: line names the queue.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:496-513 puts `deferred` on every ok status envelope unconditionally; observed live as {"members":[],"findings":0,"unreadable":[]} on this repo and as two named members on a scratch tree. progress.md names the key at its derive site (:38), its report site (:163-168, 'never taken off the cursor'), and a route row (:185) placed below the recovery rows (:199); execute.md:471-487 switches the cursor to --next-file on a deferring run and :493 stages the queue. Both pinned by new prose-agreement arms.

### 7. neither rail moved
expected: A census test shows git-guard.mjs is reached by no gate value and its existing cases still pass, a second re-arm on a deferred gate is refused even under a different corr, and self-verify.mjs --root . returns ok:true with problems: [].
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: git diff --stat for git-guard.mjs across bedf576..8bd5243 is empty; git-guard.test.mjs censuses the five gate literals, the exact config keys, and the whole import set, plus a behavioural case with review.triggers.risk_surface.gate=deferred pinned; route.test.mjs censuses all nine review cells and re-asks the resolver at each level; prose-agreement.test.mjs pins the blocking arm's corr filter byte-for-byte beside the deferred arm's queue-keyed rule. self-verify --root . ok:true, problems:[]; full suite 2525/2526 with the one red (milestone-prune corpus) pre-existing - .planning/REQUIREMENTS.md, milestone-prune.mjs and milestone-prune.test.mjs are all absent from this range's diff.

### 8. the queue survives the milestone prune
expected: deferred carry moves unadjudicated members from phases/<N>/ to .planning/deferred/<N>/ before the prune deletes the directory, leaves settled ones behind, and a carried member can still be adjudicated and re-armed from its new home.
status: pass
first_pass: pass
source: verifier
evidence: Live: `deferred carry --phase 3` moved the unadjudicated member to deferred/3/ and left the settled one behind; a repeat onto an existing destination answered `carry-exists` and moved nothing; with phases/7 deleted, `deferred record --round 2` wrote into deferred/7/ and `deferred list` reported it. fireHome (planning.mjs:5004) is the one two-home resolver shared by adjudication and deferred record. Wired at milestone.md:108-120, above the milestone-prune call at :130.

### 9. deferred list is one derivation over both homes
expected: deferred list finds members in phases/<N>/ and in .planning/deferred/<N>/, drops any with a superseding ADJUDICATION sibling, and reports an unreadable directory rather than counting it as empty.
status: pass
first_pass: pass
source: verifier
evidence: Live: members found in phases/<N>/ and in deferred/<N>/ by the same call; a real ADJUDICATION sibling dropped its member while a SYMLINK wearing that name did not; chmod 000 on a phase directory produced {ok:false, reason:"unprovable-queue"} with the readable members still reported; --phase narrowed across both homes. readQueue at planning.mjs:5300-5400 is the single derivation cmdStatus also calls.

### 10. Run a live /cad-execute chain under bypass permissions on a tree with review.triggers.<t>.gate=deferred set and a fire that raises a blocker
expected: The gate fires, the reviewer runs, a REVIEW-<trigger>-<discriminator>.md and a DEFERRED-<trigger>-<discriminator>.json land in .planning/phases/<N>/, a `deferral` receipt is appended, the run CONTINUES to `executed` with nothing prompting for input, and the phase's commits sit on the integration branch.
origin: verifier
why_human: Out of reach, not merely unexercised: /cad-execute's body is a skill and no agent (including this verifier) can invoke a slash command, and the fire-site hop into triage-gate.md's `deferred` arm is agent-executed prose with no code branch to probe. It also needs the host's bypass-permissions mode, which is a property of the operator's session rather than of this repository.
status: skipped
reported: skipped
reason: Needs a live /cad-execute chain. Deferred to phase 3's own execution, which will exercise the deferred arm for real rather than against a scratch phase.

### 11. Run a live /cad-land against a tree with an unadjudicated DEFERRED-*.json and git.auto_close false
expected: The land refuses at the top of step 3 before any publish ask, naming each queued finding by trigger and discriminator with its count, and pointing at references/triage-gate.md; nothing is pushed, merged or tagged.
origin: verifier
why_human: Out of reach and irreversible on the other branch: /cad-land is a skill this verifier cannot invoke, and the arm that would run if it did NOT refuse publishes to a remote. The refusal's siting and its test pin are already verified statically (truth 8); what a live run adds is whether the reading agent obeys it.
status: skipped
reported: skipped
reason: Needs a live /cad-land run, and the arm that would run if it did NOT refuse publishes to a remote. Deferred to phase 3's own land.

## Summary

total: 11
passed: 7
failed: 0
pending: 0
skipped: 4
blocked: 0
reworked: 0
