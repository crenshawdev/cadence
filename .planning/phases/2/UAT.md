---
status: testing
phase: 2
fields_version: 1
started: 2026-09-03
updated: 2026-09-03
---

## Items

### 1. task.md states the completion rule once and the three sites point at it
expected: cadence-core/workflows/task.md carries one statement of the rule (written:false for an absent planning root reports done with the disposition stated; written:false for any other cause withholds done). The skip arm, the risk_check step and the record step point at that one rule instead of restating it. A prose-agreement.test.mjs pin goes red when either half of the rule is removed.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/workflows/task.md:208-230 states the rule once ("stated here and nowhere else"), half one :212-220 naming both seam spellings, half two :222-230 with the literal "any other reason" - which greps to exactly one line, inside the risk_check step. Skip arm :166-168, record step :308-313 and done step :354-355 point at it and carry no verdict of their own; `[ -d .planning ]` appears only at :51 and in the rule's own "never on" sentence :226. The pin cadence-core/bin/prose-agreement.test.mjs:1637-1697 passes at HEAD and went red four ways in an isolated copy: half one deleted, half two deleted, half one negated in place, and the record step given its own verdict.

### 2. Treeless seam test: every seam answers written:false and creates nothing
expected: A test on taskRepo(commits, {planning:false}) in planning-task-record.test.mjs runs trace append, trace close, task-record and risk-check run; each answers ok:true, written:false with a reason naming the absent root, and .planning/ does not exist afterwards. The test passes.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/bin/planning-task-record.test.mjs:145-217 passes (435 ms) and is in the 3772-test suite run. Three trace appends and the close assert reason === 'ENOENT' exactly; task-record asserts /no planning root/; the --surfaces re-run asserts ok:true, checked:true with trace.written false and trace.reason 'ENOENT'; afterwards existsSync(dir) and existsSync(root/tasks) are both false. CADENCE_GLOBAL_CONFIG is pointed at a nonexistent path so the bare call's refusal is the seam's, not the developer's machine's.

### 3. Live inline /cad-task on a treeless scratch repo completes with a Risk check line
expected: An inline /cad-task on a scratch repo with no .planning/ completes. Its done block carries a line naming the risk check's verdict and says the record is unrecorded because there is no planning root, with no Record: line. (human-verify: needs a live /cad-task session)
criterion: AC3
status: pass
first_pass: pass
source: model
evidence: Live inline /cad-task run by the coordinator on a scratch repo (git init, branch work off main, no .planning/, CADENCE_GLOBAL_CONFIG pointed at a nonexistent file so no global surfaces answer). Bracket appends answered {ok:true,written:false,reason:"ENOENT"}. Commit d4b1e9b (docs: add a one-line README). Bare `risk-check run --phase 0 --base 39e28af --head HEAD` refused {ok:false,reason:"surfaces-unanswered"}; `detect-surfaces --root .` returned one option (all eight); the question was put to the user in the run, answered "all"; re-run with --surfaces <all eight> answered {ok:true,checked:true,matches:[],inconclusive:false,empty:false,trace:{written:false,reason:"ENOENT"}}. task-record answered {ok:true,written:false,reason:"no planning root at .planning, and this command creates neither it nor tasks/"}. trace close answered {ok:true,written:false,reason:"ENOENT"}. Rendered done block: Done / Commit(s): d4b1e9b / Files: README.md / Risk check: checked: true, matches: [] over all eight surfaces, unrecorded because there is no planning root. No Record: line.

### 4. After the live run, no .planning/ and no tasks/<slug>/ exist
expected: ls -a on the scratch repo after that /cad-task run shows no .planning/ directory and no tasks/<slug>/ directory. (human-verify: needs a live /cad-task session)
criterion: AC4
status: pass
first_pass: pass
source: model
evidence: After the run, in the scratch repo: `ls -a` -> `. .. .git README.md`; `find . -path ./.git -prune -o -type d -print` -> `.` only (no .planning/, no tasks/); `git status --short` empty; `git log --oneline` -> d4b1e9b docs: add a one-line README, 39e28af init.

### 5. surfaces-unanswered arm asks the question and re-runs with --surfaces
expected: When risk-check run refuses surfaces-unanswered, task.md's risk_check step asks the one-time surface question and re-runs with --surfaces. A prose pin asserts the arm exists. On a treeless repo with no global surfaces answer, the bare run refuses and the --surfaces re-run reaches a verdict.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/workflows/task.md:180-195 runs `detect-surfaces --root .`, puts the one-time question through the ask-user seam exactly as references/risk-surface.md:92-115 states it, and re-runs the same `risk-check run --phase 0` line with `--surfaces`, with the treeless no-persist reasoning stated. Pinned at prose-agreement.test.mjs:1700-1725 (passes; red when the paragraph is deleted). Both commands are real seams (planning.mjs:304, planning/risk-check.mjs:191-256), and the seam test measures the bare refusal plus the --surfaces verdict on a treeless fixture.

### 6. Suite, typecheck and self-verify green; task.md weight budget matches
expected: node cadence-core/bin/test.mjs passes, npx tsc -p tsconfig.ci.json exits 0, and self-verify passes with weight-budgets.json's task.md row matching the file's measured size.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/test.mjs exit 0, 3772/3772 pass, 0 fail; npx tsc -p tsconfig.ci.json exit 0 (run separately from the suite); node cadence-core/bin/self-verify.mjs exit 0 with problems:[] over 30 checks including budgets; wc -c task.md = 20719 = weight-budgets.json:81.

### 7. Run an inline /cad-task on a fresh scratch git repo that has no .planning/ and no user-global surfaces answer, and read its final report
expected: The run completes. Its Report block carries a `Risk check:` line naming the verdict the seam returned (or `risk_check_skipped` if nothing landed) followed by "unrecorded because there is no planning root", and NO `Record:` line. When the bare risk-check run refuses `surfaces-unanswered`, the coordinator asks the one-time surface question and re-runs with --surfaces rather than stopping.
origin: verifier
why_human: Out of reach, not merely unexercised: this needs a live interactive /cad-task coordinator session in Claude Code, including an ask-user prompt that must be answered by a person mid-run. I cannot start a slash-command session or answer its prompt from here; nothing in the tree executes workflows/task.md, so no probe renders that report. The mechanical half is already proven (seam test + prose pins); only the coordinator's rendering is open.
status: pass
first_pass: pass
source: model
evidence: Live inline /cad-task run by the coordinator on a scratch repo (git init, branch work off main, no .planning/, CADENCE_GLOBAL_CONFIG pointed at a nonexistent file so no global surfaces answer). Bracket appends answered {ok:true,written:false,reason:"ENOENT"}. Commit d4b1e9b (docs: add a one-line README). Bare `risk-check run --phase 0 --base 39e28af --head HEAD` refused {ok:false,reason:"surfaces-unanswered"}; `detect-surfaces --root .` returned one option (all eight); the question was put to the user in the run, answered "all"; re-run with --surfaces <all eight> answered {ok:true,checked:true,matches:[],inconclusive:false,empty:false,trace:{written:false,reason:"ENOENT"}}. task-record answered {ok:true,written:false,reason:"no planning root at .planning, and this command creates neither it nor tasks/"}. trace close answered {ok:true,written:false,reason:"ENOENT"}. Rendered done block: Done / Commit(s): d4b1e9b / Files: README.md / Risk check: checked: true, matches: [] over all eight surfaces, unrecorded because there is no planning root. No Record: line.

### 8. After that same /cad-task run, `ls -a` the scratch repo and look for .planning/ and tasks/<slug>/
expected: Neither exists - no .planning/ directory and no tasks/<slug>/ directory anywhere in the repo, and `git status` shows only the task's own commits.
origin: verifier
why_human: It observes the aftermath of the live session above, so it inherits the same out-of-reach dependency: without a real /cad-task run there is no aftermath to inspect. The seam-level half is already proven mechanically (nothing exists after seven seam calls on the treeless fixture); what is open is what a coordinator does between those calls.
status: pass
first_pass: pass
source: model
evidence: After the run, in the scratch repo: `ls -a` -> `. .. .git README.md`; `find . -path ./.git -prune -o -type d -print` -> `.` only (no .planning/, no tasks/); `git status --short` empty; `git log --oneline` -> d4b1e9b docs: add a one-line README, 39e28af init.

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
