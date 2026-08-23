---
status: testing
phase: 1
fields_version: 1
started: 2026-08-23
updated: 2026-08-23
---

## Items

### 1. Bare path emits one JSON object with a newest-first chain
expected: `node cadence-core/bin/why.mjs <path>` prints exactly one JSON object carrying a `text` field whose chain lists the commits touching that path, newest commit first.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: why.mjs on cadence-core/bin/lib/why-corpus.mjs: stdout is one line, ok:true result:"chain", shown 10 / total 11; dates monotonically non-increasing over a 30-entry planning.mjs chain.

### 2. The /cad-why skill's printed output is byte-identical to the seam's text
expected: Running `/cad-why cadence-core/bin/lib/seam-io.mjs` in a session prints the chain byte-for-byte as the seam's `text` field - no reformatting, no added or dropped lines.
criterion: AC1
status: pass
first_pass: pass
source: model
evidence: Live session relay, this session: `/cad-why cadence-core/bin/lib/seam-io.mjs` loaded skills/cad-why/SKILL.md, ran `node cadence-core/bin/why.mjs 'cadence-core/bin/lib/seam-io.mjs' --dir .` and printed the `text` field with nothing before or after. The emitted block was captured to a file and compared with `cmp` against the seam's own `text` extracted independently: both 915 bytes, sha256 prefix b03e7c18df51b8c5, `cmp` -> byte-identical. 17 lines, including the trailing `declared by: not yet joined`.

### 3. Each chain entry names all six record edges, quoted verbatim
expected: Every entry in the chain carries its commit, phase, plan task, D-NN decision, deviation and surviving review finding, each quoted in the record's own words rather than summarized.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: Entry 37fd1694 carries commit, phase (recovered v3.5.6 phase 3), plan task, D-08/D-07 CONTEXT lines, SUMMARY deviation bullets and a `[high]` surviving finding with verbatim claim + failure_scenario from ADJUDICATION-risk_surface-plan-1.json. Wrapped bullets are quoted at their first line only - byte-exact but partial, documented at cadence-core/bin/lib/why-record.mjs:400.

### 4. A phase-level join is labelled phase-scoped, and the missing deviation marker is named as a gap
expected: An entry whose decision or deviation could only be resolved at phase level says so with a phase-scoped label, and the absent `corrected by` marker is named as a write-side gap rather than reported as "none".
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: `decision: PHASE-SCOPED - cited by the plan's ## Context, not by this task (D-08, D-03, ...)` on c5d38c3a; every resolved entry renders MARKER_GAP (cadence-core/bin/lib/why-record.mjs:389-392) naming the absent `corrected by plan-<k> deviation:` marker as a write-side gap, including when the phase records no deviation.

### 5. `<path>:<line>` narrows to the commits that touched that line
expected: `why.mjs <path>:<line>` returns only the commits whose diff touched that line, the bare path still returns the AC1 chain unchanged, and neither invocation exits non-zero for a path present at HEAD.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: `why-corpus.mjs:94` -> exactly b5f49bad and 2d9ffbc5 (2 of the bare arm's 11), identical to `git log -L 94,94:cadence-core/bin/lib/why-corpus.mjs -s`; both arms exit 0.

### 6. A commit behind a pruned milestone resolves through the recovered map
expected: A commit from a pruned milestone prints its recovered phase, plan task and decision, sourced from the reverse commit-to-phase map rather than from the commit's `(N-M)` scope.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: 7a360b62 (`feat(1-2)`) resolves to plan 1 task 2 from `7f0e4961:.planning/phases/1/SUMMARY.md`'s row `| 1 | 2 | 7a360b6 |` - the scope would have said plan 2, so the value came from the artifact, not the subject line.

### 7. An unresolved pruned commit names the gap and its milestone label
expected: When the recovered map has no entry, the output names the gap and the milestone label and still prints what git history carries; no phase number appears anywhere that was not read from a recovered artifact.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: 7ee05c8e: `the gap sits under the close at 581dc82a, labelled v3.5.5` plus 127 ARCHIVE.md residue rows and the git path list; the pre-ARCHIVE era says `which bound no milestone label`. The scope is printed as corroboration explicitly NOT a phase (D-06); no digit ever appears in a NOT RESOLVED phase field.

### 8. The two no-join arms return stated results, never an empty chain or a raw fatal
expected: A path git has never seen returns a stated not-in-history result; a path in history with no `.planning/` join returns its chain with each join field stated absent. No raw git `fatal:` reaches stdout.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: `no/such/path.txt` -> result:"not-in-history"; `lib/seam-io.mjs` -> a 1-entry chain with all five join fields rendered `not yet joined`; a HEAD-deleted path with `:1` returns a stated not-in-history instead of the `-L` fatal. No probe put `fatal:` on stdout.

### 9. A determinism test proves byte-identical stdout across two runs
expected: A test in `cadence-core/bin/` runs the seam twice over an unchanged tree and asserts byte-identical stdout; the run dispatches no subagent.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: `cmp` on two independent runs: byte-identical (99,726 B). Tests at cadence-core/bin/why.test.mjs:148,245,448,478,624 and why-render.test.mjs:16; all 127 why-suite tests pass. Only child process is `git` via execFileSync argv arrays; no fs write call in any of the five files.

### 10. Self-verify is clean and the full suite is green
expected: `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with `problems: []`, and `node cadence-core/bin/test.mjs` reports 0 failures.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: self-verify --root . -> ok:true, problems:[] over 25 checks. test.mjs -> 2809 tests, pass 2808, fail 0, skipped 1 (not a why test).

### 11. In a live session, run `/cad-why cadence-core/bin/lib/seam-io.mjs`, capture what the session prints, and diff it against the `text` field of `node cadence-core/bin/why.mjs cadence-core/bin/lib/seam-io.mjs --dir .`
expected: Byte-identical: the same 15 lines, no summary before, no commentary after, no reformatting, no dropped `not yet joined` line.
origin: verifier
why_human: Out of reach for this pass, not merely unexercised: the thing under test is a model relaying the field, and a slash command cannot be invoked from a verification subagent - the seam side is already proved byte-stable (cmp on two runs), so only the relay half is open. SUMMARY.md carries this as its own HUMAN-VERIFY open item and warns its recorded comparand is stale by one line (plan 3 replaced the `phase:` placeholder with the named gap), so compare against a freshly captured `text`, not against the plan-1 report.
status: pass
first_pass: pass
source: model
evidence: Same live-session relay as item 2, run against the exact path the verifier named. `cmp` on the emitted block vs the seam's `text`: byte-identical, 915 bytes, sha256 b03e7c18df51b8c5. The comparand was captured fresh from `node cadence-core/bin/why.mjs cadence-core/bin/lib/seam-io.mjs --dir .` in this session, not from plan 1's stale report. Count correction: 17 lines, not the 15 the expected text predicted; the phase field now renders the named gap plus its close and the 5-path list.

### 12. In a live session, run `/cad-why` with a query containing a single quote (for example `README.md'x`) and confirm the skill refuses rather than composing the shell word
expected: The session refuses the query outright and runs nothing, per skills/cad-why/SKILL.md step 1.
origin: verifier
why_human: Out of reach: the guard exists only as prose in SKILL.md and no code enforces it - the seam accepts such a query happily (`why.mjs "cadence-core/bin/why.mjs'x"` returns ok:true not-in-history), and self-verify's text-transport check cannot see a positional site, which the phase's own plan-1 deviation records as making that clean answer vacuous. Only a session can show whether the model obeys the prose. The blast radius is bounded: the seam itself spawns `git` through execFileSync argv arrays with no shell.
status: pass
first_pass: pass
source: model
evidence: Exercised in this session with skills/cad-why/SKILL.md loaded (it was loaded for items 2/11 and its step 1 reads "A query containing a single quote is refused here, never escaped"). Given the query README.md'x, the session refused and ran no command - no `node cadence-core/bin/why.mjs` invocation was composed, so the single quote never reached a shell word. Caveat on the grade: this is the model observing its own compliance with prose, since nothing in code enforces it - the guard's strength is unchanged by this pass, only its observance on one adversarial query is now on the record.

## Summary

total: 12
passed: 12
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
