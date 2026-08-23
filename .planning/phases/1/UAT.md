---
status: testing
phase: 1
fields_version: 1
started: 2026-08-23
updated: 2026-08-23
---

## Items

### 1. The chain names what history simplification dropped
expected: /cad-why on cadence-core/bin/lib/release-decision.mjs prints text naming b86fc25c, 051f0df1 and 9237a539 as commits also touching that path which the chain does not list, and says history simplification dropped them. A path with nothing excluded prints no such block at all.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Real run names exactly b86fc25c, 051f0df1, 9237a539 as excluded with parentCount 2 each, states git's default history simplification as the cause, names the `git log --full-history --` invocation, and keeps the `Pass --top` truncation note last. None of the three appears among the chain's 7, confirmed against `git log -M --follow` directly. A real path with nothing excluded (cadence-core/bin/fixtures/why.chain-worst.json) renders `excluded: []` and no block at all; the -L arm carries `excluded: null` and no block.

### 2. CONTEXT records the reachability choice as a numbered decision
expected: .planning/phases/1/CONTEXT.md carries D-01 naming what the reachability choice costs on a path with a busy merge history, with the figures and the date it was measured on.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: CONTEXT.md:30-63 D-01 states the cost (one extra --full-history query, 6 ms on the 191-commit planning.mjs, a capped note of a few hundred bytes) with the date 2026-08-23 and git 2.55.0. Every figure reproduced independently: 152/191 all 39 merges, 68/96 all 28, 12/17 all 5, 7/10 all 3; the query timed 0.007 s; the rendered block on planning.mjs measures 409 B. criteria-size reports context_found true, context_criteria 6, over [].

### 3. The entry cap's stated reason is measurement-backed
expected: Rendering the worst measured path at the shipped DEFAULT_TOP prints under the 10,000-byte line conventions.md states, and lib/why-render.mjs's comment states that measurement, its date, and the maximality claim it supports.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: lib/why-render.mjs:42-60 states the three measured paths, their byte counts at --top 6 and --top 7, the date and the maximality claim; DEFAULT_TOP = 6 at line 112 and why.mjs:16 says `default 6`. All six stated figures reproduce byte-for-byte today (9,129/10,343, 8,158/9,474, 8,526/9,764). Scoped to those three paths the claim survives falsification - see the separate gap on the sample's coverage.

### 4. The pin reddens when the number and its stated reason disagree
expected: why-render.test.mjs goes red when DEFAULT_TOP and the comment's stated figure disagree - the fixture render is under the threshold at the default and over it at one above.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Ran the shipped why-render.test.mjs against mutated copies in a scratch tree: DEFAULT_TOP=7 reddens the under-threshold case AND the header-claim case; DEFAULT_TOP=5 reddens the over-threshold case AND the header-claim case; DEFAULT_TOP=6 is 20/20 green. The header's `// MEASURED CAP: 6 entries, 2026-08-23.` line parses with the test's own regex. The frozen fixture carries 8 entries and 2 excluded against a cap of 6, so the cap is really exercised.

### 5. closeOver orders by instant and guards an unparseable date
expected: closeOver attaches a commit whose %cI string sorts on the wrong side of a close to the close it actually belongs to as an instant, returns null on an unparseable date rather than throwing, and the pinning test fails against the string-compare implementation.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Reverted ONLY closeOver to the pre-phase string form in a scratch copy and ran the shipped test file: the mixed-offset case fails with actual 'v1.0.0' expected 'v2.0.0' and the unparseable case fails returning the v1.0.0 prune instead of null. Both pass against the shipped lib/why-corpus.mjs:936-949, which parses instants on both sides, picks the smallest instant at or after the commit's with a full-sha tiebreak, and skips a prune whose own date will not parse. The pre-existing EARLIEST case stays green under both implementations, so the ordinary answer is unchanged.

### 6. Suite and self-verify are green
expected: node cadence-core/bin/test.mjs reports 0 failures and node cadence-core/bin/self-verify.mjs --root . returns ok:true with problems: [].
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: `node cadence-core/bin/test.mjs` -> tests 2935, pass 2934, fail 0, skipped 1. `node cadence-core/bin/self-verify.mjs --root .` -> ok:true, problems: []. No debt marker (TODO/FIXME/XXX/HACK/placeholder/not implemented) was added anywhere in the phase diff e40c9c30..65267c0a.

### 7. The cap's 3-path sample misses the real worst case by 3x, so the response is not bounded under the 10,000-byte line
expected: behavior wrong - the header's bounding claim does not hold on real paths; the maximality measurement was taken on a sample that excludes every path near the worst case
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Retest after d6114916. The gap was a false bounding claim, not a byte count, so the check is whether the header still claims what measurement does not support. `git show d6114916` replaces `the response is bounded by TRUNCATING THE ENTRY COUNT` with `the entry COUNT is truncated`, and adds a paragraph stating the cap does NOT bound bytes, that join fields are unbounded, and naming the sweep: 548 paths rendered, median 5,569 B, 63 (11.5%) at or over 10,000 B, worst design-notes/sweep-2026-08-10-context-weight.md 30,825 B. Sweep re-run independently at verify time and those are its own figures. `grep -n 'MEASURED CAP' lib/why-render.mjs` still prints line 77, so the AC4 pin is intact; `node --test why-render.test.mjs` -> 20 pass 0 fail. Staged diff confirmed comment-only (no non-comment line in `git diff --cached -U0`), so no behavior changed and the maximality claim below the table stands as scoped.
reported: behavior wrong - the header's bounding claim does not hold on real paths; the maximality measurement was taken on a sample that excludes every path near the worst case
severity: major
cause: The header's first paragraph makes a GLOBAL bounding claim (`the response is bounded by TRUNCATING THE ENTRY COUNT`) that the three-path table beneath it cannot support. The maximality claim itself is carefully scoped and true as worded - `the worst of THOSE paths` - but the cap truncates ENTRY COUNT while per-entry join bytes are unbounded, so a path with few commits and heavy join fields blows the line at any cap. Independently confirmed: cadence-core/bin/why-record.test.mjs renders 29,378 B at the shipped default of 6, showing 6 of total 6 with only 1 excluded, so the bytes are join fields and not the new exclusion block. Not a regression - the shipped cap of 10 was worse - but the same defect class WHY-03 named: a byte claim whose sample does not reach the case it is made about. AC3 passed because it asks only about the worst MEASURED path; the criterion was the weak part.
fix: d6114916, retest

### 8. The false WHY-02 premise is still live at three sites in the project record, one more than SUMMARY names
expected: behavior wrong - the planning record states as measured fact something this phase measured false, and now contradicts its own CONTEXT.md
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Retest after 6a81b938. `grep -rn 'collapsed into' .planning/ROADMAP.md .planning/PROJECT.md` returns nothing, so no site still carries the false account. All three now name the merges b86fc25c, 051f0df1, 9237a539, and PROJECT states explicitly that 0bf62847 is single-parent (0bba96f4) and already among the reachable 7. Re-measured independently at verify time before editing: `git log --format='%h %p' -1 0bf62847` -> `0bf62847 0bba96f4` (one parent), and `git log -M --follow --format=%h -- cadence-core/bin/lib/release-decision.mjs` lists 0bf62847 among its 7. Matches phases/1/CONTEXT.md D-01, so the record no longer contradicts itself.
reported: behavior wrong - the planning record states as measured fact something this phase measured false, and now contradicts its own CONTEXT.md
severity: minor
cause: Three sites carry the account this phase measured false, not the two SUMMARY names. Re-confirmed independently: `git log --format='%h %p' -1 0bf62847` returns a single parent 0bba96f4, and 0bf62847 is already one of the 7 commits the --follow arm returns. Live sites: .planning/ROADMAP.md:16-17, .planning/ROADMAP.md:54-55, .planning/PROJECT.md:206-207. SUMMARY's open item names ROADMAP:53-56 and PROJECT's ### Active, but not ROADMAP:14-17, the milestone framing paragraph carrying the same false sentence. phases/1/CONTEXT.md:52-60 records the correction, so the planning record now contradicts itself.
fix: 6a81b938, retest

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 2
