---
status: testing
phase: 1
fields_version: 1
started: 2026-08-15
updated: 2026-08-15
---

## Items

### 1. Referenced issues named with their state
expected: On a branch whose commits reference issue numbers, /cad-land step 1 prints one sentence naming each referenced number and whether it is open ("your branch references #42 and #47; #42 is still open"), scanning #N, closes #N and fixes #N. A not-found number is named not found, never as closed. Proved by a failing-capable test over a fabricated log.
status: pass
first_pass: pass
source: model
evidence: node --test issue-decision.test.mjs issue-check.test.mjs -> tests 1-3 'the report names each referenced issue with its state' (github/gitlab/forgejo over stub CLIs), 24 'scanIssueRefs finds the three forms, dedupes, sorts, mints no near-miss', 26 'partitionIssues answers open/closed/not-found, and not-found is never closed'; 34 pass 0 fail. skills/cad-land/SKILL.md step 1 report arm prints the sentence and names a not-found number as not found.

### 2. Open-issue list is the fallback, not the headline
expected: When no commit on the branch references an issue, step 1 lists the open issues on the detected host instead; when something IS referenced, the bare list is not printed.
status: pass
first_pass: pass
source: model
evidence: test 4 'a branch referencing NO issue still reports the open list as the fallback'; SKILL.md step 1: 'Print the open list ONLY when referenced is empty - it is the fallback, never the headline'.

### 3. Every degradation path prints exactly ONE line and the land continues
expected: no remote / unrecognized host / forge CLI absent / no tea login / nonzero exit each produce ONE line naming that reason, list nothing, never retry and never block the land. Each path fault-injected with a test proving what the caller sees.
status: pass
first_pass: pass
source: model
evidence: tests 8-16, nine 'degrades in ONE line' rows: key off, no origin remote, unrecognized host, no tea login, binary absent, CLI nonzero, response truncated at the page limit, renamed field, ref scan fails. Live run here: action skip, reason 'tea holds no login for ssh.jcrenshaw.dev: no tracker report', detail null - exit 0, one line, land continues.

### 4. A hanging forge CLI cannot stall a land
expected: Against a stub that never exits, the call is killed at its bound and step 1 prints the timeout line rather than waiting; proved by a test, not by inspection.
status: pass
first_pass: pass
source: model
evidence: test 6 'a forge CLI that never returns is killed at the bound and the land continues' - execFileSync timeout 10000 with killSignal SIGKILL (issue-check.mjs:76-91), driven by a stub that never exits.

### 5. git.issue_check ships as a bool defaulting to true
expected: config.mjs get git.issue_check reports true against a repo that does not set it, and the key is present in config.schema.json, templates/config.json, the config catalog and the reach table.
status: pass
first_pass: pass
source: model
evidence: node cadence-core/bin/config.mjs get git.issue_check -> true against a repo that does not set it; grep -c issue_check: config.schema.json 1, templates/config.json 1, config-catalog.md 1, config-reach.md 1.

### 6. The new key shares no vocabulary with git.auto_close
expected: The key name, its schema purpose and its catalog question use no close/merge/unattended/auto wording, so a tracker report cannot read as authorization to merge. Landing closes no issue and nothing on the path writes to a tracker.
status: pass
first_pass: pass
source: model
evidence: grep -icE 'close|merge|unattended|auto' over the issue_check lines in schema, catalog and reach -> 0. grep for tracker-write verbs in issue-check.mjs and lib/issue-decision.mjs -> 0 each; every argv in HOST_TABLE is an 'issue list'. SKILL.md: 'This report never writes: landing closes no issue'.

### 7. The off switch says nothing and spawns no forge CLI
expected: With git.issue_check false, step 1 says nothing about the tracker at all and no forge process is spawned.
status: pass
first_pass: pass
source: model
evidence: test 17 'the key-off arm spawns NO forge CLI at all, not merely an empty report' (spawn-marker assertion with an on-control) and test 8. decideIssueCheck answers a third action 'off' (b9a1f26); SKILL.md off arm: 'say NOTHING about the tracker: not the reason, not that it was skipped'.

### 8. The GitLab arm resolves through the same seam, proven with a stubbed glab
expected: A PATH-injected glab stub drives the gitlab row end to end - argv and JSON normalizer - with no real glab installed on this machine.
status: pass
first_pass: pass
source: model
evidence: test 29 'the gitlab row is proved against a CAPTURED glab sample, with no glab spawned' plus test 2 (gitlab end-to-end over a PATH-injected stub) and test 28 (every row carries its paging flag). glab is absent on this machine; resolution goes through the one onPath() site in issue-check.mjs.

### 9. The report is about THIS repository
expected: The forge call carries the owner/name selector parsed from origin AND runs with cwd set to --dir, so a --dir pointing elsewhere cannot report another project's tracker. Asserted directly, not inferred from cwd.
status: pass
first_pass: pass
source: model
evidence: test 5 'the forge call names the --dir repo, not the one the process cwd sits in' - asserts the owner/name selector in argv directly, so a cwd-only implementation fails it. Live run parsed repo crenshawdev/cadence from origin.

### 10. not-found is never rendered as closed, and an unreadable fetch answers nothing
expected: A referenced number absent from a complete list reports not-found; a response truncated at the page limit or carrying a renamed field degrades to the one-line reason instead of reporting not-found.
status: pass
first_pass: pass
source: model
evidence: tests 26 'not-found is never closed', 27 'partitionIssues answers NOTHING over a fetch that is not complete', 31 'a response TRUNCATED at the limit is unreadable, never an issue list', 32 'a RENAMED field is unreadable, not an empty record set'.

### 11. Registered on the public surfaces
expected: The key and the check appear in references/COMMANDS.md, README.md, .planning/DOCS-CLAIMS.md and the config catalog, with node cadence-core/bin/self-verify.mjs reporting ok:true.
status: pass
first_pass: pass
source: model
evidence: grep -c issue_check: COMMANDS.md 1, README.md 2, .planning/DOCS-CLAIMS.md 4, config-catalog.md 1. node cadence-core/bin/self-verify.mjs -> ok:true, 21 checks, problems:[].

## Summary

total: 11
passed: 11
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
