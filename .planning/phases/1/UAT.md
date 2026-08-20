---
status: testing
phase: 1
fields_version: 1
started: 2026-08-20
updated: 2026-08-20
---

## Items

### 1. /cad-config --surfaces opens the interview with evidence side by side
expected: A live `/cad-config --surfaces` run in /code/cadence prints the answered set ["secrets","destructive","untrusted_input"] beside what detect-surfaces evidences NOW (inconclusive: true, evidenced: []), and asks with exactly two options - all eight FIRST and labelled (recommended), the current three second - neither pre-selected. (Also intended: every evidenced category the answer does not cover is named; this repo evidences none, so that half cannot be observed here.)
status: pass
first_pass: pass
reported: Confirmed live on screen: options rendered as 1. All eight (recommended) / 2. Keep current three / 3. Type something, each carrying the envelope's own reason string. The highlight sat on option 2 only because the user arrowed down to it - it did not open there, so neither option was pre-selected.

### 2. Declining the --surfaces arm leaves config.json byte-identical
expected: After declining that question, `git status --porcelain .planning/config.json` prints nothing and `config.mjs get review.triggers.risk_surface.surfaces` still returns the same three values.
status: pass
first_pass: pass
source: model
evidence: Declined live in this session: /cad-config --surfaces reached the ask-user seam and the user rejected it. Immediately after, `git status --porcelain .planning/config.json` printed nothing (working tree clean, md5 85b10f9442272aa44befe1bf93d783cf) and `node cadence-core/bin/config.mjs get review.triggers.risk_surface.surfaces` -> {"ok":true,"values":{"review.triggers.risk_surface.surfaces":["secrets","destructive","untrusted_input"]},"source":"global+repo"}. No `config.mjs set` was called on the declined path.

### 3. No two options carry the same set on the #206 demo tree
expected: `detect-surfaces --root <demo tree>` (express + stripe + prisma + passport, with auth/, migrations/, api/, workers/, a .sql file and an openapi.yaml) returns exactly two options: the first all eight categories, the second the six evidenced (auth, migrations, billing, concurrency, api_contract, untrusted_input). No two option sets are equal.
status: pass
first_pass: pass
source: verifier
evidence: Rebuilt the demo tree from scratch and ran detect-surfaces against it: evidenced = the six (api_contract, auth, billing, concurrency, migrations, untrusted_input), exactly two options, option 0 = all eight in CATEGORIES order, option 1 = those six, no repeated set. Same fixture pinned at cadence-core/bin/surface-scan.test.mjs:228/:242; that file is 26/26.

### 4. --answered re-run puts the uncovered categories in the second option
expected: `detect-surfaces --root <demo tree> --answered secrets` keeps the first option's set at all eight and makes the second exactly those six plus secrets - not all eight (destructive absent).
status: pass
first_pass: pass
source: verifier
evidence: `detect-surfaces --root <demo tree> --answered secrets`: option 0 = all eight, option 1 = the six plus secrets with destructive absent, options 2 and 3 distinct, four in total at the cap. Pinned at surface-scan.test.mjs:257.

### 5. --answered rejects bad input by naming it
expected: `detect-surfaces --answered` with nothing after it and `--answered nope` each print {"ok":false,"reason":"bad-args"} naming the offending input.
status: pass
first_pass: pass
source: verifier
evidence: Bare `--answered` -> bad-args naming the flag (arg-contract row, lib/arg-contract.mjs:585); `--answered nope` -> bad-args naming `nope` and the eight (planning.mjs:2839); `--answered ' , '` -> bad-args (planning.mjs:2836). All exit 1 with ok:false.

### 6. Prose and lib agree on what `recommended` contains, falsified both ways
expected: `node --test cadence-core/bin/prose-agreement.test.mjs` passes; changing the count word in review-triggers.md's ## risk_surface detection section makes it fail naming the disagreement, and dropping an entry from scanTree's recommended array makes it fail too. Both reverts leave the tree clean.
status: pass
first_pass: pass
source: verifier
evidence: Passes as shipped; falsified live in a scratch copy from the prose side (count word eight->seven, wrapped) and the code side (recommended array minus one), each failing with the disagreement named, each restored byte-identical. prose-agreement.test.mjs:1755/:1778.

### 7. The inconclusive arm changes only the reason, not the set
expected: A test pins both scan arms: scanTree({}) and a tree evidencing a category each yield a first choice whose set is all eight, with differing reasons; the evidenced-only choice is absent on the inconclusive scan and present on the other.
status: pass
first_pass: pass
source: verifier
evidence: surface-scan.test.mjs:106 and :118 pin both arms (same all-eight first set, differing reasons, evidenced-only choice absent when nothing was evidenced); confirmed live on this repo (inconclusive) and the demo tree (evidenced).

### 8. Both interview sites carry the ask-user rendering contract, under the seam's cap
expected: A prose-agreement arm reads the cap and the recommended-first / never-pre-selected clauses from seams.md and asserts both review-triggers.md's ask and workflows/config.md's --surfaces section carry them, and that interviewOptions() never exceeds the cap. Deleting the never-pre-selected clause from either site makes it fail naming that site.
status: pass
first_pass: pass
source: verifier
evidence: prose-agreement.test.mjs:1833 reads the cap word from seams.md and asserts four clauses at three sites plus the builder's ceiling over five cases; falsified live at each of the two interview sites in a scratch copy, failing with that site named, both restored.

### 9. self-verify is clean on the whole tree
expected: `node cadence-core/bin/self-verify.mjs --root .` prints ok:true with "problems":[] - no deferred-read-unread, no unknown-flag, no budget-overrun.
status: pass
first_pass: pass
source: verifier
evidence: `node cadence-core/bin/self-verify.mjs --root .` -> ok:true, "problems":[].

### 10. The full test suite is green
expected: `node --test 'cadence-core/bin/*.test.mjs'` reports zero failures.
status: pass
first_pass: pass
source: verifier
evidence: `node --test 'cadence-core/bin/*.test.mjs'`: 2477 tests, 2476 pass, 0 fail, 1 pre-existing skip; `npx tsc -p tsconfig.ci.json` exits 0.

### 11. On a first fire the second option's reason names an answered set that does not exist
expected: behavior wrong - with `held` empty the union candidate (surface-scan.mjs:340) wins the dedup over the evidenced-only candidate (:345), so the option carrying the six evidenced categories is presented as 'the answered set plus what the scan now evidences beyond it' to a project that has answered nothing
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fixed in 6a516f0. The guard at surface-scan.mjs is now `held.length && gap.length`, so with nothing answered the union candidate is dropped and choice 4 survives the dedup: on the #206 signal set option[1] = [auth,migrations,billing,concurrency,api_contract,untrusted_input] with reason 'only what the structure evidences: auth (directory auth/), ...' and no mention of an answered set. Pinned by surface-scan.test.mjs 'with nothing answered the evidenced choice states the EVIDENCE, not a phantom answer', falsified live against the old guard (26 pass / 1 fail, the failure quoting the phantom 'the answered set plus what the scan now evidences beyond it'). surface-scan.test.mjs 27/27.
reported: behavior wrong - with `held` empty the union candidate (surface-scan.mjs:340) wins the dedup over the evidenced-only candidate (:345), so the option carrying the six evidenced categories is presented as 'the answered set plus what the scan now evidences beyond it' to a project that has answered nothing
severity: minor
cause: The candidate-2 guard at surface-scan.mjs:336 tests `gap.length` alone. With `held` empty, gap === evidenced, so the union candidate is emitted with surfaces = order([...held, ...evidenced]) = evidenced, and the dedup keeps the FIRST occurrence - candidate 2 - so candidate 4's correct reason ('only what the structure evidences') is dropped as a repeat. The file's own ORDER comment at :285 states the intended resolution ('with nothing answered, 2 collapses onto 4'), i.e. 4 should be the survivor. Fix: widen the guard to `held.length && gap.length` so the union candidate is only offered when there IS an answered set for it to add to. No test pins the union reason on an unanswered tree (surface-scan.test.mjs:135 asserts it only on the --answered secrets case), so the change is behaviourally scoped to the first-fire path.
fix: 6a516f0, retest

### 12. The evidence-gap callout is unpinned and unexercised - the arm passes with it deleted
expected: unwired - the plan's Must-be-true clause exists only as a sentence in workflows/config.md with no check holding it there and no scenario that would notice its absence
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fixed in 5808648. prose-agreement.test.mjs now carries an assertion scoped to workflows/config.md's `## Risk surfaces` section (looked up by name, not by index) matching /call(?:s|ing)? out every evidenced category the answered set does not contain/i. Falsified live by deleting the sentence from config.md: 34 pass / 1 fail with 'workflows/config.md `## Risk surfaces`: dropped the clause that every evidenced category the answered set does not cover is called out'; file restored, git diff --stat empty. prose-agreement.test.mjs 35/35.
reported: unwired - the plan's Must-be-true clause exists only as a sentence in workflows/config.md with no check holding it there and no scenario that would notice its absence
severity: minor
cause: prose-agreement.test.mjs:1853's RULES list is applied to all three ask-user sites (seams.md, review-triggers.md, workflows/config.md), so the evidence-gap callout - which only workflows/config.md's `## Risk surfaces` step 3 states - cannot be added to it without failing the other two sites. That is why it was left unpinned. Fix: a separate assertion scoped to the config.md `## Risk surfaces` section alone, pinning the claim that every evidenced category the answered set does not contain is called out. The runtime half stays unexercised here because /code/cadence returns inconclusive:true with evidenced:[], so a prose pin is what actually holds the sentence.
fix: 5808648, retest

### 13. In a fresh session, reinstall the plugin from cadence/v3.5.7, /clear, and run `/cad-config --surfaces` in /code/cadence
expected: The turn shows the answered set ["secrets","destructive","untrusted_input"] beside the scan's own result (inconclusive: true, evidenced: []) - said plainly as 'the structure evidences nothing either way', not as a clean bill - and then asks with exactly two options: all eight FIRST and labelled (recommended), the current three second, neither pre-selected. Both `config.mjs get review.triggers.risk_surface.surfaces` and `detect-surfaces --root . --answered ...` should appear in the transcript.
origin: verifier
why_human: Not a truth left unexercised - a resource out of reach: `/cad-config` is a slash command whose body is a skill, and no agent can invoke a skill. I verified everything up to the seam by running the arm's two read commands myself (the envelope they return is exactly what this item expects); what remains is what a MODEL does with that envelope on screen, which only a live session produces.
status: pass
first_pass: pass
reported: Confirmed live on screen: options rendered as 1. All eight (recommended) / 2. Keep current three / 3. Type something, each carrying the envelope's own reason string. The highlight sat on option 2 only because the user arrowed down to it - it did not open there, so neither option was pre-selected.

### 14. Decline that question, then check `git status --porcelain .planning/config.json` and re-read the key
expected: git status prints nothing and `node cadence-core/bin/config.mjs config.mjs get review.triggers.risk_surface.surfaces` still returns ["secrets","destructive","untrusted_input"].
origin: verifier
why_human: Same out-of-reach resource: the decline only exists inside a live `/cad-config --surfaces` run. The code half is already settled - the arm's sole writer is `config.mjs set` on an explicit pick, detect-surfaces never writes, and running both read steps against this repo left config.json's md5 and the working tree unchanged - so what a human is adding is that a real decline takes the no-write path.
status: pass
first_pass: pass
source: model
evidence: Declined live in this session: /cad-config --surfaces reached the ask-user seam and the user rejected it. Immediately after, `git status --porcelain .planning/config.json` printed nothing (working tree clean, md5 85b10f9442272aa44befe1bf93d783cf) and `node cadence-core/bin/config.mjs get review.triggers.risk_surface.surfaces` -> {"ok":true,"values":{"review.triggers.risk_surface.surfaces":["secrets","destructive","untrusted_input"]},"source":"global+repo"}. No `config.mjs set` was called on the declined path.

## Summary

total: 14
passed: 14
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 2
