---
status: testing
phase: 1
fields_version: 1
started: 2026-08-24
updated: 2026-08-24
---

## Items

### 1. Detection reports exactly which forge CLIs resolve
expected: With stub executables on the child's PATH, detection names exactly which of tea/gh/glab resolve; with an empty stub dir it reports none. No subprocess is spawned during detection (asserted via $CAD_SPAWN_MARKER).
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Live, controlled PATH: gh+tea stubs only -> action ask, installed exactly [forgejo/tea, github/gh]; empty stub dir -> ok:false, installed [], exit 1. No stub output reaches the envelope. Resolution is onPath alone (forge.mjs:264) and on-path.mjs reads no Cadence env override (on-path.mjs:19), so the production resolver is what the stub exercises. forge.test.mjs:348 asserts $CAD_SPAWN_MARKER empty - passes by name.

### 2. Both entry points reach the forge step, and ask nothing once configured
expected: /cad-new-project on a fresh directory and /cad-adopt on an existing repository each reach the forge step. Running either again against a repository whose forge keys are non-null asks nothing.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: `forge.mjs detect --dir .` is the last line of the EXISTING setup fence in both new-project.md:74 and adopt.md:45 - no new turn. Both carry all three action arms (new-project.md:84/87/90, adopt.md:70/73/76), the `configured` arm saying 'Say NOTHING and ask nothing'. self-verify invocations check green. Observed live: a repo with all three keys set, run with NO forge binary on PATH, answers action `configured` with installed [].

### 3. Origin-derived defaults are offered correctly
expected: Given ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence.git the slug default is crenshawdev/cadence and the provider default is absent. Given https://gitlab.com/g/sub/r.git the provider default is gitlab and the slug is g/sub/r.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Live: ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence.git -> defaults {provider:null, repo:'crenshawdev/cadence'}; https://gitlab.com/g/sub/r.git -> defaults {provider:'gitlab', repo:'g/sub/r'}. Envelope host stays null on both - no host default is ever derived (D-08). forge.test.mjs:267/:280 pass by name; forge-decision.test.mjs:277 pins that a slug failing the grammar yields no default rather than raw text.

### 4. The tracker resolves the persisted forge, not origin
expected: With the forge keys set and origin removed, issue-check resolves the persisted provider and slug rather than emitting no-remote.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: issue-check.test.mjs:793/817/837/857 all pass by name; :793 asserts the fixture truly has no remote, then that action=report and the recorded argv carries `--login work` and no `--remote`. Traced independently end to end: config.mjs set -> .planning/config.json -> forge.mjs detect reads back `configured` -> issue-check records `gh issue list --repo crenshawdev/tracer --state all --json number,state --limit 200`. classifyOrigin is no longer called from issue-check.mjs.

### 5. Zero providers refuses with a hint, and no CLI bytes leak
expected: Zero providers detected returns ok:false with a hint naming an install. No forge-CLI stdout or stderr appears anywhere in the envelope and detail is null on every forge arm. refusal-hints passes.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Live refuse arm carries detail:null and a hint naming the install for each of tea/gh/glab. Leak probe: a stub printing tokens to stdout AND stderr and exiting 7 produced a create refusal containing neither token, detail null, hint present; stderr is discarded at the spawn (forge.mjs:165). self-verify.mjs ok:true, problems [], refusal-hints included. The `usage`/`internal` arms carry a detail by the seam-wide exemption in lib/refusal-hints.mjs:74-77 and carry no third-party bytes.

### 6. The recorded creation argv per provider
expected: gh repo create <owner>/<repo> --private; glab repo create <owner>/<repo> --private --remoteName origin; and on Forgejo a tea login list --output json read followed by one of two argvs - tea repos create --name <repo> --login <login> --private when <owner> is that login's own user, or with --owner <owner> added when it is not. The tea arm is followed by a recorded git remote add origin. No creation argv is recorded without a prior confirmation naming provider, owner, name and visibility.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: All four arms recorded live: `gh repo create o/r --private` + `git remote add origin <url>`; `glab repo create o/r --private --remoteName origin` with no git line; `tea login list --output json` + `tea repos create --name r --login forge.example.com --private` + `git remote add origin` when the owner IS the login user, and the same with `--owner acme` inserted when it is not. Without --confirmed the argv log stays empty. prose-agreement.test.mjs:2510 pins the four-fact confirmation ahead of the single create invocation by offset, and :2514 is a falsifier that reddens when the invocation is moved above it.

### 7. A real repository is created end to end on Forgejo
expected: (human-verify: needs a live forge account) One real repository is created end to end on Forgejo, with origin set and reachable afterward.
criterion: AC7
status: pass
first_pass: pass
source: model
evidence: Settled live against git.jcrenshaw.dev. `forge.mjs create --provider forgejo --repo john/cadence-ac7 --confirmed --remote-url ssh://git@ssh.jcrenshaw.dev:2222/john/cadence-ac7.git` returned {"ok":true,"provider":"forgejo","owner":"john","repo":"john/cadence-ac7","visibility":"private","remote_wired":true,"detail":null}. `git remote -v` named the wired origin on both fetch and push. REACHABILITY, the clause the earlier run could not settle: `git ls-remote origin` exited 0 over that remote (empty ref list, the repo being empty), run under GIT_SSH_COMMAND with UserKnownHostsFile=/dev/null so the operator's known_hosts was not modified. Privacy confirmed on the prior run of the same path by an unauthenticated GET returning 404. Throwaway deleted afterward; `tea repos search cadence-ac7` returns empty. Separately demonstrated, and filed as an open item rather than folded into this pass: the scp-style `git@ssh.jcrenshaw.dev:john/cadence-ac7.git` form implies port 22 and fails `Permission denied (publickey)` against the host's own sshd, while the instance serves Forgejo on 2222 - the seam validates the URL's shape and accepts either.

### 8. The full suite is not green - why.test.mjs reddens on this phase's own commits
expected: behavior wrong - ROADMAP phase 1 success criterion 7 requires a green suite; `node cadence-core/bin/test.mjs` at HEAD reports tests 3071, pass 3069, fail 1. The failing case's fixture assumption, not the shipped forge code, is what broke: this phase put two commits on cadence-core/bin/lib/issue-decision.mjs and then landed a SUMMARY.md that makes them resolvable, so the live phases/1 label now appears in a window the case asserts it never appears in.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: `node cadence-core/bin/test.mjs` at HEAD (cf2571b8): tests 3071, pass 3070, fail 0, skipped 1. The one skip is the pre-existing environmental case milestone-prune.test.mjs:562, which skips itself between milestones and is unrelated to this phase. The rewritten case was also run alone by name - `node --test --test-name-pattern 'the phase printed is the archived one' cadence-core/bin/why.test.mjs` reports a tick, so it executes and asserts rather than passing vacuously; the assert.ok(entry, ...) guard is what stops a missing entry reading as a pass. Fixed by 7b1205fd.
reported: behavior wrong - ROADMAP phase 1 success criterion 7 requires a green suite; `node cadence-core/bin/test.mjs` at HEAD reports tests 3071, pass 3069, fail 1. The failing case's fixture assumption, not the shipped forge code, is what broke: this phase put two commits on cadence-core/bin/lib/issue-decision.mjs and then landed a SUMMARY.md that makes them resolvable, so the live phases/1 label now appears in a window the case asserts it never appears in.
severity: major
cause: why.test.mjs:218 asserts a GLOBAL ABSENCE over a MOVING WINDOW: it runs why.mjs against the live repo with --top 20 and requires that no entry anywhere in that window carries the phases/1 label. Any phase of the open milestone that touches cadence-core/bin/lib/issue-decision.mjs and lands a SUMMARY naming its commits makes that false, which is exactly what 96ee016d, f70a0443 and 5df1c824 did. The shipped forge code is not implicated. The property the case was written to protect - an archived commit resolves to its archived phase, not to the live phase reusing the number - is already asserted directly and still passes at why.test.mjs:194, which pins sha 00537356 to _archive-v3.4.0/1. So :218 is a weaker, time-dependent restatement of :194 that will redden again on the next phase to touch that file.
fix: 7b1205fd, retest

### 9. Two commits landed over a refusing lease-check, and PLAN-2's file declarations were never corrected
expected: unwired - the phase's `files:` frontmatter is meant to be the record of what the phase touched, and for plan 2 it is not. Both refusals were recorded in SUMMARY rather than fixed, so PLAN-2.md still declares 10 files while the plan's commits touched 12 paths.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fixed by cf2571b8. Both paths the executors landed over a refusing lease-check are now declared in PLAN-2.md's files: - .planning/phases/1/CONTEXT.md (undeclared on 3c7fe164) and cadence-core/bin/lib/issue-decision.mjs (undeclared on f70a0443). Verified by enumerating every path touched by a commit whose subject carries the (1-2) scope and differencing against the declared list: 12 declared, 14 touched. The two that remain undeclared are artifacts of the verify-phase fix itself, not of plan 2's execution - .planning/phases/1/PLAN-2.md, which cannot declare its own frontmatter without circularity, and cadence-core/bin/why.test.mjs, which is the item-8 test fix committed under the 1-2 scope. Stated rather than chased: adding either would make the record less accurate, not more.
reported: unwired - the phase's `files:` frontmatter is meant to be the record of what the phase touched, and for plan 2 it is not. Both refusals were recorded in SUMMARY rather than fixed, so PLAN-2.md still declares 10 files while the plan's commits touched 12 paths.
severity: minor
cause: The orchestrator granted two paths by dispatch instruction (.planning/phases/1/CONTEXT.md for the D-14 correction, cadence-core/bin/lib/issue-decision.mjs for the port fix) without adding either to PLAN-2.md's files: frontmatter. lease-check refused undeclared-files on both commits and each executor recorded the refusal in its report rather than halting, per the dispatch. PLAN-1's equivalent case was handled correctly - its lease was widened in the plan file before the executor continued, and 5df1c824 carries that edit - so the divergence is the orchestrator's, not the executor contract's.
fix: cf2571b8, retest

## Summary

total: 9
passed: 9
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 2
