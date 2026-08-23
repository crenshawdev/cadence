PLAN CHECKPOINT: structural
Plan: .planning/phases/2/PLAN-1.md
Tasks: 2 of 5
| Task | Commit | Note |
|---|---|---|
| 1: The surfaced set, own-phase scoped and kinded | 75269066 | New pure module `lib/cite-surfaced.mjs` + 14-case unit table. `node --test cadence-core/bin/cite-surfaced.test.mjs` 14 pass / 0 fail; `npx tsc -p tsconfig.ci.json` clean. |
| 2: The cited mentions, bare and phase-qualified | ee6738e0 | New pure module `lib/cite-cited.mjs` + 11-case unit table. `node --test cadence-core/bin/cite-cited.test.mjs` 11 pass / 0 fail; tsc clean. Replayed over the real corpus: 50 `PLAN*.md`, 1094 mentions, 47 files carrying at least one - in line with the plan's measured 47/1041/43. |
| 3: The `cite-count` subcommand and its envelope | (uncommitted) | Implemented in the working tree and behaviourally verified; BLOCKED at the lease gate before the commit. See the checkpoint below. |

## Checkpoint: task 3 needs one line in a file this plan's lease does not name

**What is on disk, uncommitted and working.** `cadence-core/bin/lib/arg-contract.mjs`
carries the `cite-count` row (`--phase` required/phase, `--payload` optional/string,
`--point` optional/string, all four fields stated, all refuse/refuse), and
`cadence-core/bin/planning.mjs` carries `cmdCiteCount`, its `COMMANDS` entry, its
two imports and its header Subcommands entry. Verified against a scratch fixture:

- `cite-count --phase 2 --payload <file> --dir <fixture>` prints ONE JSON line
  carrying `surfaced` (count + ids), `cited` (count + explicit ids) and
  `cited_by_kind` with all four arms, the three unjoinable ones marked
  `unjoinable: true` rather than `cited: 0`.
- Own-phase exclusion proved in both directions on one payload: a
  `phases/2/CONTEXT.md` row is absent while `_archive-v3.5.0/2/CONTEXT.md` and
  `v3.5.3/phases/1/CONTEXT.md` are present.
- Bare `--payload`, bare `--point`, absent `--payload` and `--point bogus` each
  exit 1 with one `ok:false` line naming the flag; `--point planned` echoes
  `point` on the envelope.
- `node cadence-core/bin/self-verify.mjs --root .` -> `ok:true`, `problems: []`.
- `npx tsc -p tsconfig.ci.json` clean.

**What blocks the commit.** The task's `Verify:` requires
`node --test cadence-core/bin/arg-contract.test.mjs cadence-core/bin/arg-contract-adoption.test.mjs`
to report 0 failures. `arg-contract.test.mjs:303` pins the table's total flag-entry
count:

```
assert.equal(entries, 170, `the table declares ${entries} flag entries`);
```

Three new flag rows make that 173, so the pin has to move to 173. That file is NOT
in this plan's `files:` lease (nor in plan 2's or plan 3's), so `lease-check` would
refuse the commit that carries it.

**Scope of the need, measured.** `node cadence-core/bin/test.mjs` over the whole
tree reports exactly ONE failure, this pin. `self-verify` is clean. Nothing else in
the tree moves.

**Proposed resolution.** Add `cadence-core/bin/arg-contract.test.mjs` to PLAN-1's
`files:` list and change the single integer `170` to `173`. It is a census re-pin of
the same species as the plan's own D-14 re-pins, and the plan already anticipated
this file's staleness in its Notes (the "all 156" header prose) without carrying the
count into the lease.

**Alternatives considered and rejected.** (a) Commit task 3 without the re-pin and
file it as an open item - that lands a red suite, which is the one thing the
static-analysis carve-out forbids, and it leaves the task's `Verify:` unmet.
(b) Drop `--point` to keep the entry count lower - it does not help (any new row
moves the pin) and it contradicts the plan's own Action and D-05.

Deviations: none
Open items:
- Stated bound, visible for plans 2 and 3: a decision row's phase is the `<n>` of
  the `phases/<n>/` segment of its `source`, which every source the corpus walk can
  emit carries (`phases/<n>/...` live, `<label>/phases/<n>/...` archived). A
  hand-written `_archive-v*/<N>/CONTEXT.md` row has no such segment, so it reaches
  `surfaced` as AC2 requires but carries no phase and is therefore unjoinable. The
  rule is what PLAN-1 task 1 states verbatim; widening it to "any numeric segment"
  would join `v2/1/CONTEXT.md` to phase 2 or 1 depending on which end it read from.
