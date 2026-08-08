---
status: testing
phase: 1
fields_version: 1
started: 2026-08-07
updated: 2026-08-08
---

## Items

### 1. Unconfigured static analysis blocks a failing commit
expected: In a scratch repo with a lint script but NO .planning/config.json, `planning.mjs detect-commands --root <repo>` names that lint command, and an executor given a task whose edit fails it makes three bounded attempts, returns a `blocked` checkpoint, and leaves NO commit for that task.
criterion: AC1
status: blocked
reason: Seam half PROVEN here: in a scratch repo with scripts.lint and no .planning/config.json, detect-commands --root returns {"lint":"npm run lint","source":{"lint":"package.json"}}. Dispatch half (three bounded attempts, blocked checkpoint, no commit) still gated: dispatched agents load the installed 2.4.0, which has zero occurrences of detect-commands. Verifiable only after v2.5.0 ships and is installed.

### 2. The LSP grant is live and inert without a plugin
expected: Both `agents/cad-executor.md` and `agents/cad-executor-xhigh.md` list `LSP` in `tools:`, `self-verify` returns ok:true with `LSP` in KNOWN_TOOLS, and dispatching a cad-executor on this machine (no code-intelligence plugin installed) completes normally rather than erroring on the unrecognized entry.
criterion: AC2
status: blocked
reason: Static half PROVEN here: agents/cad-executor.md:4 and agents/cad-executor-xhigh.md:4 both list LSP in tools:, self-verify.mjs:195 carries LSP in KNOWN_TOOLS, and self-verify returns ok:true problems:[]. Inert-on-dispatch half still gated: the installed 2.4.0 agents carry no LSP entry, so dispatching here exercises nothing. Verifiable only after v2.5.0 ships and is installed.

### 3. The trace carries four families under one correlation id
expected: A completed phase leaves `.planning/trace.jsonl` holding routing, provider, lifecycle and outcome events all sharing ONE `corr`, with every worker dispatch paired to a later return, checkpoint or escalation and `unpaired` empty. A re-run of the same phase must NOT pair across runs.
criterion: AC3
status: blocked
first_pass: fail
source: verifier
evidence: cadence-core/bin/lib/trace.mjs:238 builds the worker key as `${key(e.phase)} ${key(e.plan)}` and :240-247 push/shift on it with no corr in the key, contradicting the header's claim at :108-110 that a re-run starts a new id; live `trace render --phase 1` counts {routing:2, provider:9, lifecycle:0, outcome:0}
reported: behavior wrong - renderTrace pairs lifecycle brackets on (phase, plan) and never consults corr, so a re-run closes the previous run's dangling dispatch and names the wrong worker unpaired; separately the live trace has never carried the lifecycle or outcome families
severity: major
cause: renderTrace pairs lifecycle events by (phase, plan) and never consults corr, so a re-run closes the previous run's dangling dispatch with the new run's terminal event and names the wrong worker unpaired; a re-run from the same sha also collapses both runs into one correlation id.
fix: 4377cfd+cb3291b, retest
reason: Pairing half PROVEN fixed by 4377cfd: live trace render --phase 1 returns unpaired:[] and the cross-run case is green. Four-families half unverifiable here: lifecycle and outcome producers are prose in this working tree's execute.md / review-triggers.md / verify.md, but the plugin executing this session is the installed 2.4.0, which carries none of it - live counts are {routing:7, provider:91, lifecycle:0, outcome:0}. Verifiable only after v2.5.0 ships and is installed, same as items 1, 2 and 16.

### 4. The trace renders and displays without writing
expected: `planning.mjs trace render --phase 1` prints the four family counts, and `/cad-progress --trace` displays them while leaving `.planning/STATE.md` byte-identical.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: `planning.mjs trace render --phase 1` printed the four family counts live; renderTrace only stats and reads; progress.md:43,86-98,161-162 is a read-only early branch that stops

### 5. A trace-write failure cannot change a resolve envelope
expected: With `.planning/` made unwritable, `route.mjs resolve --role cad-executor` returns an envelope byte-for-byte identical to the writable case.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: route.test.mjs:1441 run by name, 1 pass - trace.jsonl as a directory and .planning as a regular file both leave the envelope byte-identical

### 6. No mergeLayers callsite drops its warnings
expected: `self-verify` reports zero `undocumented-merge-warnings`: every `mergeLayers` callsite under `cadence-core/bin/**.mjs` either binds `warnings` or carries the documented header sentence. Adding an unsurfaced callsite makes it report.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: self-verify ok:true with merge-warnings in checked, problems:[]; self-verify.test.mjs:1471-1500 pins the reporting falsifier and both clean arms

### 7. A torn config layer is named, not silently defaulted
expected: With `.planning/config.json` unparseable, a `git commit` on a NON-protected branch returns `ask` naming the parse failure. The same must hold when the torn layer is the user-global one, since that layer also carries protected_branches.
criterion: AC4
status: pass
first_pass: fail
source: verifier
evidence: cadence-core/bin/git-guard.mjs:110-111 filters warnings by the prefix `config layer <repoLayer> `, so a global-layer parse warning never reaches the arm at :148 even though that layer also carries protected_branches and on_protected
reported: git-guard.test.mjs after 0ab7046: 33/33 pass, including 'a torn USER-GLOBAL layer asks too, naming that layer', 'a torn global layer asks on release too', and 'a torn repo layer never CANCELS a deny the global layer configured'
severity: major
cause: The torn-layer arm is anchored to 'config layer <repoLayer> ', matching the REPO layer only. mergeLayers emits a flat string per layer, so a torn USER-GLOBAL layer - which also carries protected_branches and on_protected - matches nothing, branchDecision is already null from the defaulted list, and the hook emits nothing at all.
fix: 0ab7046, retest

### 8. lease-check refuses an undeclared staged path
expected: `planning.mjs lease-check --phase N --plan k` returns ok:false naming a staged path the plan did not declare, and passes when every staged path is declared. It must also catch a staged RENAME whose source belongs to another plan, and must NOT refuse a declared path merely because it contains non-ASCII characters.
criterion: AC5
status: pass
first_pass: fail
source: verifier
evidence: cadence-core/bin/planning.mjs:1441-1442 runs `git diff --cached --name-only` with no -z, no `-c core.quotePath=false` and no rename-source handling; the exact/prefix comparison at :1454-1456 then admits a rename that destroyed another plan's declared file, and refuses a declared `src/caf\303\251.js`
reported: planning.test.mjs after 1d24d9a: 258/258 pass, including 'a rename is checked on BOTH sides, so another plan's file is not renamed away' and 'a declared non-ASCII path is admitted, not refused for its bytes', plus the two unrepresentable-path fail-closed cases
severity: blocker
cause: git diff --cached --name-only prints only a rename's destination, so a staged rename whose source belongs to another plan passes the lease; and without -z or -c core.quotePath=false git octal-escapes any non-ASCII path, so a declared src/cafe.js comes back quoted and reads as undeclared.
fix: 1d24d9a, retest

### 9. An executor staging an undeclared path halts
expected: An executor that stages a file outside its plan's declared `files:` returns a `blocked` checkpoint instead of committing, on both the sequential and the parallel path. A file the USER pre-staged must not halt the phase.
criterion: AC5
status: pass
first_pass: fail
source: verifier
evidence: cadence-core/bin/planning.mjs:1443-1456 compares every staged path against the plan's declared list with exactly one exemption (the plan's own report file, :1450); skills/cad-executor-contract/SKILL.md:73-75 turns any ok:false into a blocked checkpoint and :55-56 forbids the executor from touching staging it did not create
reported: Undeclared-path half delivered and tested: lease-check refuses and NAMES the path (planning.test.mjs 258/258), executor contract turns ok:false into a blocked checkpoint. User-pre-staged half met by PREVENTION rather than by the lease gate distinguishing provenance: PLAN-2 task 5 was cut on the standing repeat-FAIL instruction, and execute.md:66-77 now runs git diff --cached --quiet before the first dispatch, asking stash/commit/abort on a dirty index, so a user-staged file is never present when an executor runs. Mechanism differs from the plan and is prose-only, so nothing tests it - accepted deliberately.
severity: major
cause: lease-check compares the ENTIRE staged index against the plan's files:, with no signal separating what this executor staged from what was already in the index, so a file the user staged themselves makes the executor halt on work the plan never touched.
fix: 62c8774 (task 5 cut, met upstream in execute.md), retest

### 10. A scaffolded config carries no pre-written trigger gates
expected: A freshly scaffolded `.planning/config.json` from `templates/config.json` contains no `review.triggers` block, so the stakes level decides every gate.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/templates/config.json has no review.triggers block at all

### 11. phase_diff resolves from the level, not the template
expected: `route.mjs resolve --role cad-reviewer` returns `phase_diff: "adjudicated"` at stakes critical and `"advisory"` at shipped, with no gate-disagreement warning.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: live route.mjs resolve --role cad-reviewer: adjudicated at critical, advisory at shipped, no warnings key in either envelope

### 12. Lockfiles stop flooring a phase to critical
expected: `package-lock.json`, `Cargo.lock`, `yarn.lock`, `poetry.lock` and `pnpm-lock.yaml` each resolve `solo` at stakes solo, while `src/lock.rs` still floors to critical.
criterion: AC6
status: pass
first_pass: fail
source: verifier
evidence: cadence-core/bin/lib/risk-surfaces.mjs:65 `LOCKFILE_RE = /(?:\.lock|-lock\.json)$/i`; live matchSurfaces returns concurrency/critical for pnpm-lock.yaml and packages.lock.json while the other four return []
reported: live matchSurfaces after a42cbde: package-lock.json, Cargo.lock, yarn.lock, poetry.lock, pnpm-lock.yaml all return []; src/lock.rs still returns concurrency/critical on pattern 'lock'
severity: major
cause: LOCKFILE_RE covers exactly the two shapes D-05 names, *.lock and *-lock.json, so pnpm-lock.yaml and packages.lock.json still tokenize to a lock token and still floor the phase to critical.
fix: a42cbde, retest

### 13. Every provider failure mode has a passing test
expected: `node --test cadence-core/bin/review-provider.test.mjs` passes with a case per mode: request timeout, HTTP 4xx, HTTP 5xx, dead or unknown model id, malformed or truncated body, and an empty findings set (which is ok:true with no `degraded` flag).
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/review-provider.test.mjs -> 49 pass / 0 fail, one named case per mode plus the empty-findings ok:true case

### 14. A dropped reviewer is named in the trace
expected: A reviewer that drops out of a fired trigger writes a provider trace event naming the reason. This must include the drop-outs most likely to fire in practice: no-key, bad-provider, bad-args, bad-payload and over-cap.
criterion: AC7
status: pass
first_pass: fail
source: verifier
evidence: cadence-core/bin/review-provider.mjs:754-760 (review), :779-785 (consult), :810-818 (detect-models): resolveProvider (bad-provider :711, no-key :714) and assertUnderCap (over-cap :281) both fail() before `meta` is constructed, and the sole appendEvent call at :361 is reached only through meta
reported: live .planning/trace.jsonl after 3b3d09b carries all five named drop-outs as provider events with degraded:true and a detail reason: no-key, bad-provider, bad-args, bad-payload, over-cap
severity: major
cause: meta is constructed after resolveProvider and assertUnderCap have already thrown DONE, so the drop-out causes most likely to fire in practice - no-key, bad-provider, bad-args, bad-payload, over-cap - reach traceProvider never and write no event at all.
fix: 3b3d09b, retest

### 15. decide refuses a milestone the repo already published
expected: In a repo whose `### Active` names a version `git tag --list` already carries, `git-branch.mjs decide` returns `{"action":"ask","branch":null}` naming both numbers. On THIS repo (Active v2.5.0, newest tag v2.4.0) it must still return `create`/`cadence/v2.5.0`. A milestone that merely sorts below some higher tag but is not itself tagged must NOT be refused.
criterion: AC8
status: pass
first_pass: fail
source: verifier
evidence: cadence-core/bin/git-branch.mjs:96 passes highestSemverTag(readTags(dir)); lib/branch-decision.mjs:144-149 refuses on compareVersions <= 0. Live: decideBranch({integrationName:'cadence/v1.9.1', publishedVersion:'v2.0.0'}) -> ask/branch:null claiming 1.9.1 'has already published as a tag'
reported: live decideBranch after 45b4d6e: cadence/v1.9.1 (untagged, sorts low) -> create/cadence/v1.9.1; cadence/v2.4.0 (tagged) -> ask/branch:null naming milestone 2.4.0 and tag v2.4.0; cadence/v2.5.0 -> create/cadence/v2.5.0
severity: major
cause: The guard compares the milestone against highestSemverTag rather than testing membership in the tag list readTags already returned, so an untagged maintenance milestone below some higher release is refused with a reason asserting a tag that does not exist.
fix: 45b4d6e, retest

### 16. /cad-health reports a planning-doc version drift
expected: Running `/cad-health` against a tree whose `PROJECT.md ### Active` version does not sort above the shipped manifest reports the drift and names BOTH numbers.
criterion: AC8
status: blocked
reason: The code under test is not the code that runs. This phase's commits live in the working tree at /data/code/cadence; dispatched agents and /cad-* skills load the INSTALLED plugin at ~/.claude/plugins/cache/cadence/cadence/2.4.0, which carries tools: Read, Write, Edit, Bash, Grep, Glob (no LSP), no lib/trace.mjs, and zero occurrences of detect-commands or lease-check. Verifiable only after v2.5.0 ships and is installed.

### 17. The verifier traces a value and debug consults the checklist
expected: `skills/cad-verifier-contract/SKILL.md` level 3 `Wired` requires one real value traced end to end across each seam, with no fifth level added; `cadence-core/references/bug-patterns.md` exists and `workflows/debug.md` reads it before forming the first hypothesis.
criterion: AC8
status: pass
first_pass: pass
source: verifier
evidence: cad-verifier-contract/SKILL.md:75-82 (level 3, no fifth level); references/bug-patterns.md 76 lines, read at workflows/debug.md:69-73 before any candidate is written

### 18. In a scratch repo carrying a lint script and NO .planning/config.json, dispatch a cad-executor on a task whose edit fails that lint. 1. `cd` to a throwaway repo with `package.json` scripts.lint that fails on the edited file and no `.planning/config.json`. 2. Run `node /data/code/cadence/cadence-core/bin/planning.mjs detect-commands --root .` and confirm `"lint":"npm run lint"`. 3. Dispatch a cad-executor on a plan task whose edit fails that lint. 4. Run `git log --oneline -1` afterwards.
expected: The executor makes three bounded attempts, returns a `blocked` checkpoint naming the lint failure, and step 4 shows NO commit for that task.
origin: verifier
status: blocked
reason: The code under test is not the code that runs. This phase's commits live in the working tree at /data/code/cadence; dispatched agents and /cad-* skills load the INSTALLED plugin at ~/.claude/plugins/cache/cadence/cadence/2.4.0, which carries tools: Read, Write, Edit, Bash, Grep, Glob (no LSP), no lib/trace.mjs, and zero occurrences of detect-commands or lease-check. Verifiable only after v2.5.0 ships and is installed.

### 19. Dispatch a cad-executor on this machine, which has no code-intelligence plugin installed. 1. Run `node /data/code/cadence/cadence-core/bin/self-verify.mjs` and confirm `ok:true`. 2. Dispatch any cad-executor task (either rung). 3. Watch the dispatch's first turn for a tools-frontmatter error.
expected: The dispatch completes normally; the unrecognized `LSP` entry is ignored rather than erroring the agent.
origin: verifier
status: blocked
reason: The code under test is not the code that runs. This phase's commits live in the working tree at /data/code/cadence; dispatched agents and /cad-* skills load the INSTALLED plugin at ~/.claude/plugins/cache/cadence/cadence/2.4.0, which carries tools: Read, Write, Edit, Bash, Grep, Glob (no LSP), no lib/trace.mjs, and zero occurrences of detect-commands or lease-check. Verifiable only after v2.5.0 ships and is installed.

### 20. After the next `/cad-execute`, read the trace. 1. Run `node /data/code/cadence/cadence-core/bin/planning.mjs trace render --phase <that phase>`. 2. Read `counts` and `unpaired`. 3. Confirm every event shares one `corr`.
expected: All four counts (routing, provider, lifecycle, outcome) are non-zero, every event carries the same `corr`, and `unpaired` is empty.
origin: verifier
status: blocked
reason: The code under test is not the code that runs. This phase's commits live in the working tree at /data/code/cadence; dispatched agents and /cad-* skills load the INSTALLED plugin at ~/.claude/plugins/cache/cadence/cadence/2.4.0, which carries tools: Read, Write, Edit, Bash, Grep, Glob (no LSP), no lib/trace.mjs, and zero occurrences of detect-commands or lease-check. Verifiable only after v2.5.0 ships and is installed.

### 21. Run /cad-health against a tree whose PROJECT.md ### Active version does NOT sort above what it has shipped. 1. Copy a planning tree to scratch and set `### Active` to a version at or below the newest `git tag --list` entry. 2. Run `/cad-health` there. 3. Read the issue list.
expected: Check 7 reports a version drift naming BOTH numbers and which comparand answered.
origin: verifier
status: blocked
reason: The code under test is not the code that runs. This phase's commits live in the working tree at /data/code/cadence; dispatched agents and /cad-* skills load the INSTALLED plugin at ~/.claude/plugins/cache/cadence/cadence/2.4.0, which carries tools: Read, Write, Edit, Bash, Grep, Glob (no LSP), no lib/trace.mjs, and zero occurrences of detect-commands or lease-check. Verifiable only after v2.5.0 ships and is installed.

## Summary

total: 21
passed: 13
failed: 0
pending: 0
skipped: 0
blocked: 8
reworked: 7
