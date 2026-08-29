---
status: testing
phase: 2
fields_version: 1
started: 2026-08-29
updated: 2026-08-29
---

## Items

### 1. Template ships no stakes key
expected: cadence-core/templates/config.json contains no "stakes" key, and config.mjs validate on a config merged from that template returns ok:true.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: 'stakes' in JSON.parse(template) -> false; grep for stakes in the file -> no match; `config.mjs validate --file cadence-core/templates/config.json` -> {"ok":true,"checked":46,"errors":[]}. The diff is exactly one removed line and zero added, so no collateral key loss. End to end: a template copy plus the two forge `config.mjs set` writes the init workflows make still has no stakes, and resolves solo/sonnet on a clean phase.

### 2. resolve and replay report stakes_set
expected: route.mjs resolve returns stakes_set:false when no config layer sets stakes and stakes_set:true when one does; route.mjs replay reports the same field over the same data.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: resolve: stakes_set false on a stakes-less template copy (stakes 'shipped'), true on the same file with stakes:'critical'. replay over the fixture repo: stakes_set false unset, true with stakes:'solo' written, and route.test.mjs:2208 cross-checks replay against resolve off one config. Carried from readConfig's own stakesSet at route.mjs:1386/:1476, never re-derived. Spelling is snake_case `stakes_set` per CONTEXT D-04, not the ROADMAP's literal `stakesSet`.

### 3. Both floor arms from a template-built fixture
expected: On a fixture repo built from the shipped template, a phase whose plans all read clean resolves stakes:"solo", and the same phase with one unreadable plan resolves stakes:"shipped" at ok:true - both shown from route.mjs resolve output, not prose.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Template-built fixture, clean plan: {'ok':True,'stakes':'solo','stakes_set':False,'model':'sonnet','verify':'off'}. Same phase with PLAN-2.md as a directory: {'ok':True,'stakes':'shipped','model':'opus'} plus the withheld-discount warning naming the plan. Both from route.mjs resolve output, reproduced by hand and pinned by route.test.mjs:1877 (164/164 green).

### 4. config.mjs get stakes answers unset
expected: config.mjs get stakes with no layer setting it returns the unset warning naming route.mjs resolve as the seam that answers it; with stakes set it returns the value and no warning.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Unset -> ok:true, values.stakes 'shipped', one warning naming both `stakes` and `route.mjs resolve` and naming no gate or model. Set -> the configured value with no `warnings` key at all. Keyless -> zero warnings mentioning stakes, on both a bare fixture and a real post-init config. config.test.mjs 102/102, 0 fail.

### 5. Both init workflows state stakes is unset
expected: new-project.md and adopt.md no longer say shipped stakes were written; each states stakes is unset and names both arms of what unset resolves to. Neither file exceeds its weight-budgets.json row.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: `grep -rn "shipped stakes" cadence-core/workflows/` returns nothing; both files carry the same sentence (identical after whitespace normalisation) naming solo for all-clean plans and the shipped default for an unreadable one, and both arms are true of the real resolver. Budget rows equal the measured bytes exactly: new-project.md 26373=26373, adopt.md 21162=21162 (weight.mjs and wc -c agree). No budget-overrun and no unknown-flag in self-verify.

### 6. README claim held by a test; floor tests green unchanged
expected: A test holds the README's adaptive-routing claim against real route.mjs resolve output over a template-initialised fixture. The four existing floor tests are green unchanged, and route.test.mjs:1027-1041's "the template ships at shipped" comment no longer contradicts the file.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: prose-agreement.test.mjs 60/60 with the new arm, which reads the claim by substring and asserts a template-initialised resolve lands strictly below config.schema.json's default per route-table.json's stakes_order. Independently falsified: with "stakes":"shipped" restored the same fixture resolves shipped/stakes_set:true, failing both assertions. The four floor tests are untouched by the diff and green at :1566, :1579, :1608, :2258; the 'the template ships at shipped' message is gone (grep finds no occurrence repo-wide).

### 7. Full suite and self-verify green
expected: node cadence-core/bin/test.mjs is green and self-verify reports ok:true.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/test.mjs -> 3574 pass / 0 fail. node cadence-core/bin/self-verify.mjs -> ok:true, problems: []. No debt markers introduced anywhere in the phase diff.

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
