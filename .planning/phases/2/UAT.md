---
status: testing
phase: 2
fields_version: 1
started: 2026-08-16
updated: 2026-08-16
---

## Items

### 1. Wrapped bullets prune as whole spans, fence-aware
expected: Against a fixture whose ## Active bullets wrap, the prune removes each completed bullet's lead line plus its indented continuations, leaves no orphaned prose, leaves the section's trailing column-0 paragraph intact, and treats a ## Active heading inside a code fence as not the section.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: milestone-prune.mjs:161 sectionSpan for both ends, :175-181 span walk; the three named fixture tests pass and planning.mjs:4168 calls the function.

### 2. Archived parenthetical is the whole span, byte-faithful, pipes escaped
expected: A ## Shipped row's parenthetical is the whole span joined on single spaces with no lowercasing, and any | is escaped so the row keeps exactly five unescaped pipes. Proved on a fixture whose bullet contains a |.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: milestone-prune.mjs:207 escapes | at the row interpolation only; 'the archived parenthetical is the whole span joined, first letter as authored' and the pipe test pass.

### 3. Prune over this repository's own REQUIREMENTS.md needs no hand repair
expected: Running the transform over a copy of the real .planning/REQUIREMENTS.md leaves zero orphaned continuation lines, every row the run added five-piped, and every new parenthetical a complete clause.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: milestone-prune.test.mjs:407 corpus test over the real files passes: no orphan lines, every ADDED row five-piped, every pre-existing row byte-identical (CFG-01/RVW-01 pinned as scars per plan scope).

### 4. Tracker reports for a split-endpoint remote, skips for a stranger
expected: issue-check reports for a remote whose SSH host differs from its web host but shares a registrable domain with a login, and skips with the existing reason for a remote sharing no registrable domain with any login.
criterion: AC4
status: pass
first_pass: fail
source: model
evidence: Fixed in 6df63e0, retested. `node --test cadence-core/bin/*.test.mjs` -> 1949 pass / 0 fail. Both halves now hold: `a split-endpoint origin a login NAMES is bound to the REMOTE` (issue-check.test.mjs) reports for ssh://git@ssh.example.com:2222/org/repo against a login whose ssh_host names that endpoint, and `an origin NO login names skips, and asks tea nothing about it` asserts action skip, the existing `tea holds no login for git.stranger.org` line, and zero `tea issues` argv with the login probe still recorded. NARROWING, stated: AC4 worded the report condition as a SHARED REGISTRABLE DOMAIN; what ships requires a login to NAME the origin host exactly (name, url host or ssh_host). The split-endpoint case is reportable when the login records its ssh_host, which is what this repository was corrected to do. Live: issue-check on this repo still returns report / ssh.jcrenshaw.dev / crenshawdev/cadence, 26 open.
reported: behavior wrong - the first half is delivered, the second is not. A remote that shares nothing with any configured login no longer skips: it now REPORTS, and the report can carry another server's issues. This is a real gap wearing the ruling's clothes. The user's ruling (delete the login-matching surface) was correct about the domain math being unfixable without a PSL, but the ruling covered the MATCHING rule, not the guard. What shipped replaces a loud, correct skip with a silent wrong affirmative answer on the land path - the exact class of failure the phase goal exists to end - and it is the only phase-2 residual that was NOT filed as an issue (SUMMARY records it under 'Not filed, recorded here').
severity: major
cause: classifyOrigin's no-login arm is now reachable only for an EMPTY tea login list. Deleting the domain-matching rule also deleted the precondition that ANY login names this host, so a remote no login serves takes the report arm and tea silently falls back to config order.
fix: 6df63e0, retest

### 5. The five degradations stay reason-unique
expected: No remote, unrecognized host, missing CLI, no login and nonzero exit each still produce their own distinct reason line, and /cad-land still never blocks on the tracker.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: issue-check.test.mjs:303-372 matrix: one row per class, reason-uniqueness enforced by SEEN_REASONS, status 0 and empty referenced/open on every arm; all pass.

### 6. cad-land's tracker step reports this repository's issues
expected: Running /cad-land on this repository, step 1's tracker line names the issues this branch's commits reference with their states instead of printing a skip line. (human-verify: needs live git.jcrenshaw.dev tracker)
criterion: AC6
status: pass
first_pass: pass
reported: good

### 7. Suite and self-verify run clean
expected: node --test cadence-core/bin/*.test.mjs and node cadence-core/bin/self-verify.mjs both run clean.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: 1948/1948 pass, 0 fail; self-verify ok:true with problems: [].

### 8. The live seam reads the real tracker
expected: node cadence-core/bin/issue-check.mjs check --dir /data/code/cadence --base main returns action report, host ssh.jcrenshaw.dev, repo crenshawdev/cadence and a complete open list, where it printed a no-login skip line before this phase.
status: pass
first_pass: pass
source: model
evidence: `node cadence-core/bin/issue-check.mjs check --dir /data/code/cadence --base main` -> {"ok":true,"action":"report","host":"ssh.jcrenshaw.dev","repo":"crenshawdev/cadence","open":[131,...,187] (26 entries),"detail":null,"warnings":[]}. Complete read, no truncation detail. The same command printed `tea holds no login for ssh.jcrenshaw.dev: no tracker report` before this phase.

### 9. Run `node cadence-core/bin/issue-check.mjs check --dir /data/code/cadence --base main` and read the envelope.
expected: action: report, host: ssh.jcrenshaw.dev, repo: crenshawdev/cadence, and an `open` array that is a complete list (no truncation warning). Before this phase the same command printed `tea holds no login for ssh.jcrenshaw.dev: no tracker report`.
origin: verifier
why_human: It spawns `tea` against the live git.jcrenshaw.dev instance - an external service over the network, which this verification pass is barred from touching. No stub can stand in: the property under test is that tea's own `--remote origin` binding resolves the real login.
status: pass
first_pass: pass
source: model
evidence: `node cadence-core/bin/issue-check.mjs check --dir /data/code/cadence --base main` -> {"ok":true,"action":"report","host":"ssh.jcrenshaw.dev","repo":"crenshawdev/cadence","open":[131,...,187] (26 entries),"detail":null,"warnings":[]}. Complete read, no truncation detail. The same command printed `tea holds no login for ssh.jcrenshaw.dev: no tracker report` before this phase. Run by the walk, not the verifier: the verifier was barred from the network, the walk is not.

### 10. Run /cad-land on this repository and read step 1's tracker line.
expected: The line names the issues this branch's commits reference with their states, not a skip line. Note before walking: `git log main..HEAD --grep '#[0-9]'` is empty on cadence/v3.5.1, so the walk will see the open-list fallback rather than named issues unless a commit citing a #N lands first - that is open item #187, and the walk should be judged on 'reports rather than skips', not on named issues.
origin: verifier
why_human: Needs the live git.jcrenshaw.dev tracker read through the interactive /cad-land flow; the phase prompt tags AC6 human-verify and forbids attempting it as a machine check.
status: pass
first_pass: pass
reported: good

## Summary

total: 10
passed: 10
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
