---
status: testing
phase: 1
fields_version: 1
started: 2026-08-15
updated: 2026-08-15
---

## Items

### 1. Divergent config pair resolves two values from two sources
expected: With user-global git.auto_close true and the repo .planning/config.json not setting it, a failing-capable test shows autoCloseRequested true (merged) and autoCloseAuthorized false (repo layer), and no site derives the AUTHORIZED value from a bare `config.mjs get git.auto_close`.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: One source for the authorized value (cadence-core/bin/lib/repo-auto-close.mjs, two callsites at git-publish.mjs:135 and :249); merged requested value at git-publish.mjs:110-113. Live on global-true/repo-unset: authorized -> ok:false requested:true exit 1; repo-true -> ok:true action:repo-authorized exit 0. Six-case lib test plus the config-seams divergence arm.

### 2. The skipped-ask / halt pairing still reads one value
expected: /cad-land skips the publish ask on autoCloseRequested and the blocking risk_surface gate reads that same value; a test goes red if the two ever read different sources.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: config-seams.test.mjs:572-579 (get true, gate halts on a blocker on the same pair) plus the prose-agreement call-site pin that forbids step 3 branching on a raw repo read or on `authorized`.

### 3. GitLab refuses, and no forge CLI runs
expected: Under global-true/repo-unset the GitLab arm refuses with $CAD_SPAWN_MARKER showing no forge CLI ran, and neither skills/cad-land/SKILL.md nor cadence-core/references/git-publish.md still says no seam call is needed on GitLab.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: git-publish.test.mjs:318-345 asserts the refusal and existsSync($CAD_SPAWN_MARKER)===false with a non-vacuous control; `no seam call is needed` survives only inside the test that forbids it; SKILL.md:139-151 and references/git-publish.md:24-27 restate the rule, order-pinned before both `glab mr create` and the `glab mr view` reuse probe.

### 4. The refusal envelope names which authorization was missing
expected: 'off everywhere' and 'requested globally, repository never authorized' produce visibly different detail text from one core, with reason unchanged as auto-close-off.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: authorizationDetail at lib/publish-decision.mjs:54-65 returns two distinct sentences and null when authorized; gate 1 at :113-116 is the only detail-carrying refusal; reason stays auto-close-off on both arms, observed live.

### 5. The two resolutions are documented where the key is set
expected: config.schema.json's git.auto_close purpose and config-reach.md's reach cell both describe the two-boolean behaviour and which arm reads which, and self-verify reports no unstated-reach.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: config.schema.json:48 keeps the reach phrase verbatim and names both arms; config-reach.md:139 names authorized and the GitLab consult beside publish; self-verify problems:[] (no unstated-reach).

### 6. The exploit was watched to fail first
expected: Against the tree as it stood before the fix, the GitLab path is demonstrated authorizing an unattended merge under global-true/repo-unset - recorded, not asserted.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: .planning/spikes/gitlab-authorization-gap/SPIKE.md, run against 24411e5, with the gate PASSing and the marker recording `glab mr create` then `glab mr merge` with no refusal between.

### 7. Suite and self-verify run clean
expected: node --test 'cadence-core/bin/*.test.mjs' and node cadence-core/bin/self-verify.mjs both run clean.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: 1932 pass / 0 fail; self-verify ok:true problems:[].

### 8. Walk /cad-land step 3(b) on a real GitLab repository whose .planning/config.json never sets git.auto_close while the user-global layer sets it to true, once with an MR already open for the branch and once with none.
expected: In both runs the agent runs `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-publish.mjs" authorized --dir <root>` before it touches the remote, gets ok:false, and stops - no `glab mr view`, no `glab mr create`, no `glab mr merge` - surfacing the detail sentence about a user-global setting not authorizing this repository.
origin: verifier
why_human: Out-of-reach resource plus live-agent behaviour: `glab` is absent on this machine and there is no GitLab remote to run against, and the GitLab enforcement is prose rather than a runtime interlock (land-cleanup.mjs does not refuse a merge whose consult was skipped), so no probe in the repo can observe whether a real run honours the ordering. The seam-level and prose-level pins are already verified (truth 3); this is the only remaining claim they cannot reach.
status: pass
first_pass: pass
source: model
evidence: Walked on a real GitLab repo (git@gitlab.com:vintagetechie-dev/audits.git) in a scratch clone with the divergent pair supplied via CADENCE_GLOBAL_CONFIG (repo has no .planning/config.json). Run (a) no MR open: authorized -> ok:false requested:true, marker absent, branch never pushed. Run (b) MR reported OPEN by a glab stub, walked by a fresh agent given only SKILL.md: it consulted authorized BEFORE any probe, got ok:false and stopped. Marker records exactly one forge invocation, `glab issue list` from issue-check.mjs, and zero mr view/create/merge; ls-remote shows the branch was never pushed and the real repo still has no open MRs.

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
