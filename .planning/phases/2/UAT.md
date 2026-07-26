---
status: testing
phase: 2
started: 2026-07-25
updated: 2026-07-25
---

## Items

### 1. cursor set --total rejects a non-integer before writing
expected: `planning.mjs cursor set --phase N --status planned --next /cad-execute --name Foo --total abc` exits ok:false reason:"bad-args" and STATE.md is unchanged (no `Phase: N of NaN` line). A valid `--total 4` still writes and reports ok:true.
status: pass
first_pass: pass
source: verifier
evidence: cursor set --total abc -> {"ok":false,"reason":"bad-args","detail":"cursor set --total needs an integer"} exit=1; fixture STATE.md byte-identical after, grep -c NaN = 0. Valid --total 4 -> ok:true and wrote 'Phase: 2 of 4 (Foo)'. planning.mjs:168

### 2. phase-done valueless --reqs fails as bad-args, not internal
expected: `planning.mjs phase-done` with a bare `--reqs` before the next flag exits ok:false reason:"bad-args" (not reason:"internal"). A real `--reqs FIX-01,FIX-02` still parses to the id list.
status: pass
first_pass: pass
source: verifier
evidence: Both bare forms (--reqs --n 2, and trailing --reqs) -> {"ok":false,"reason":"bad-args","detail":"phase-done --reqs needs a comma-separated id list"} exit=1, no reason:internal. Real --reqs FIX-01,FIX-02 on a rows fixture -> reqs:["FIX-01","FIX-02"], flipped exactly those two, Deferred row untouched. planning.mjs:217-219

### 3. route resolve --attempt rejects a non-integer as usage
expected: `route.mjs resolve --role plan --attempt abc` exits ok:false reason:"usage" (not reason:"unresolved"). A numeric `--attempt 2` resolves normally.
status: pass
first_pass: pass
source: verifier
evidence: resolve --role cad-planner --attempt abc -> {"ok":false,"reason":"usage","detail":"resolve --attempt must be an integer"} exit=1, not unresolved; --attempt 2.5 likewise. Guard fires before role resolution. --attempt 1/2 and no --attempt all resolve ok:true attempt:1/2. NOTE: the criterion's own example uses --role plan, which is not a known role; happy path re-verified with cad-planner.

### 4. config validate rejects a scalar top-level config
expected: `config.mjs validate` on a file whose entire content is `42` exits ok:false reporting the non-object top-level (not ok:true, checked:0). A normal object config still validates ok:true.
status: pass
first_pass: pass
source: verifier
evidence: validate on a file containing 42 -> ok:false, checked:0, errors:[{key:"(root)",error:"top-level config must be a JSON object",value:42}] exit=1; array [1,2,3] same; {"granularity":"fine"} -> ok:true checked:1 exit=0. config.mjs

### 5. config get does not return a scalar config as the config
expected: `config.mjs get` with a scalar `.planning/config.json` falls back to global+default values rather than reporting `42` at source:"repo".
status: pass
first_pass: pass
source: verifier
evidence: cwd with .planning/config.json = 42: get granularity -> {"ok":true,"values":{"granularity":"standard"},"source":"global","warnings":["config layer .planning/config.json top-level is not an object; skipped"]}. No 42 anywhere, source is not repo. Control {"granularity":"fine"} -> source:"global+repo". lib/config-merge.mjs

### 6. Failing-capable regression test per bug, full suite green
expected: Each of #42, #45.1, #45.2, #45.3 has a test that reproduces the pre-fix behavior (NaN written / internal / unresolved / clean-scalar) and asserts the corrected behavior, and `node --test cadence-core/bin/*.test.mjs` passes.
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs at HEAD: 275 pass, 0 fail. Failing-capability proven directly: git worktree at 4e624df (pre-fix, requireInt helper only) with HEAD's three changed test files copied in -> 5 fail / 112 pass, the failures being exactly the #42, #45.1, #45.2 and both #45.3 (validate + read face) regression tests. Only the 4 fix files differ across that range, so the failures are attributable.

### 7. cursor set writes a STATE.md its own parser rejects (goal generalization)
expected: The phase goal ends 'so no bad flag can corrupt STATE.md', but requireInt checks 'is an integer', not the file format parseCursor accepts (unsigned decimal, no exponent). Three inputs pass the new guard and still corrupt the cursor.
status: pass
first_pass: fail
source: verifier
evidence: bf48810: --total -2 / 1e21 / 1.5 and --phase -1 / 1e21 all -> ok:false bad-args, STATE.md byte-identical, cursor get still ok:true. --phase 2.1 round-trips (decimal insertions preserved). requireCursorNumber mirrors parseCursor on input AND rendered output. 4 of 5 new tests fail against pre-fix source (1.5 was already covered by requireInt, kept as a no-regression guard).
reported: The phase goal ends 'so no bad flag can corrupt STATE.md', but requireInt checks 'is an integer', not the file format parseCursor accepts (unsigned decimal, no exponent). Three inputs pass the new guard and still corrupt the cursor.
severity: major
cause: requireInt validates 'is an integer', not the format parseCursor accepts (lib/planning-files.mjs:28 wants unsigned decimal, no exponent). --total takes requireInt; --phase (planning.mjs:169) is still a bare Number()+NaN check and was never covered by any D-decision.
fix: bf48810, retest

### 8. phase-done --reqs "" silently bulk-flips every non-Deferred row
expected: The new guard rejects only non-strings. Line 233's `opts.reqs ? split : phase-filter` treats '' as absent, so an empty interpolated variable inverts the caller's intent from 'these ids' to 'all rows for this phase'.
status: pass
first_pass: fail
source: verifier
evidence: 68061f5: --reqs with '', '   ', ',' and ',,' -> ok:false bad-args, ROADMAP.md and REQUIREMENTS.md byte-identical. Branch now keys off flag presence, not truthiness. --reqs FIX-01 still flips exactly that row; omitting --reqs still closes the phase with Deferred exempt. All 4 empty-form tests fail against pre-fix source.
reported: The new guard rejects only non-strings. Line 233's `opts.reqs ? split : phase-filter` treats '' as absent, so an empty interpolated variable inverts the caller's intent from 'these ids' to 'all rows for this phase'.
severity: major
cause: The guard at planning.mjs:217 rejects only non-strings, so '' passes; line 233's truthiness test (opts.reqs ? split : phase-filter) then reads '' as 'flag absent' and takes the bulk phase-filter branch.
fix: 68061f5, retest

### 9. config write face still unguarded: a reported write that did not happen
expected: #45.3 closed the validate and read faces; `set` was not covered. The goal's 'or pass config validation' half therefore holds on two faces of three, and the scalar case reproduces exactly the raw-JS-error-as-internal class D-04 set out to eliminate.
status: fail
first_pass: fail
source: verifier
evidence: Array config: set --file w-arr.json granularity=fine -> {"ok":true,"changed":[{"key":"granularity","value":"fine"}]} exit=0, file still [1,2,3] - key never persisted. Scalar config: same command -> {"ok":false,"reason":"internal","detail":"Cannot create property 'granularity' on number '42'"}.
reported: #45.3 closed the validate and read faces; `set` was not covered. The goal's 'or pass config validation' half therefore holds on two faces of three, and the scalar case reproduces exactly the raw-JS-error-as-internal class D-04 set out to eliminate.
severity: major
cause: D-02 scoped #45.3 to the validate and read paths; cmdSet re-serializes the parsed top-level without an object-shape check, so an array round-trips (dropping the key while reporting changed) and a scalar throws a raw TypeError surfaced as reason:internal.
fix: routed to /cad-plan - config write face (set), out of #45.3's validate+read scope

### 10. Falsy non-object config layer is skipped with no warning at all
expected: The read-face warning is gated on truthiness, so the layers most likely to appear from a truncated write are the ones that warn least. Inconsistent with validate, which reports the same files broken.
status: fail
first_pass: fail
source: verifier
evidence: With .planning/config.json set to null, 0, false, and "" in turn: get granularity -> {"ok":true,"values":{"granularity":"standard"},"source":"global"} every time, no warnings key - whereas a truthy 42 does emit the warning. lib/config-merge.mjs:84,88
reported: The read-face warning is gated on truthiness, so the layers most likely to appear from a truncated write are the ones that warn least. Inconsistent with validate, which reports the same files broken.
severity: minor
cause: lib/config-merge.mjs:84,88 gates the skip-warning on layer truthiness, so null/0/false/'' take the silent path while a truthy scalar warns.
fix: routed to /cad-plan - falsy-layer warning, adjacent to the phase-1 malformed-layer residue

## Summary

total: 10
passed: 8
failed: 2
pending: 0
skipped: 0
blocked: 0
reworked: 4
