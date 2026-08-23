PLAN CHECKPOINT: structural
Plan: .planning/phases/1/PLAN-1.md
Tasks: 4 of 5

| Task | Commit | Note |
|---|---|---|
| 1: The query grammar and the two git invocations | 8aeb289b | why-query.mjs (parseQuery, probeArgv, bareArgv, lineArgv, classifyResult) + why-query.test.mjs, 22/22 passing |
| 2: The deterministic renderer and the entry cap | 683608d8 | why-render.mjs (renderChain, DEFAULT_TOP=10) + why-render.test.mjs, 5/5 passing |
| 3: The seam | 417049d3 | why.mjs + CONTRACTS row in arg-contract.mjs + why.test.mjs (10/10); arg-contract-adoption.test.mjs green (283 refusals, new row exercised); self-verify ok:true problems:[] |
| 4: Determinism, and the record that is not an input | 417049d3 (no new commit) | Task 4's three required tests (repeat-run byte-identity, trace.jsonl presence/absence, git-only child-process scan) were already written into why.test.mjs while completing task 3's own file, since both tasks declare that same file. Re-ran `node --test cadence-core/bin/why.test.mjs` standalone for this task: 10/10 passing, including all three. No new diff to commit. |
| 5: Register the command surface | NOT COMMITTED | See checkpoint below. |

Deviations: none
Open items: task 4 landed no commit of its own - its Verify was already satisfied by commit 417049d3 (task 3), which built the three required tests directly rather than in a separate pass.

## Checkpoint detail

Task 5's own within-lease work is done and locally verified, uncommitted in the
working tree:
- `skills/cad-why/SKILL.md` created (self-contained, `allowed-tools: [Bash]`
  only, relays the seam's `text` field verbatim per D-02).
- `cadence-core/references/COMMANDS.md` gained a `/cad-why` row in the Support
  cluster.
- `cadence-core/bin/weight-budgets.json` gained the
  `skills/cad-why/SKILL.md: 1010` row and re-pinned
  `cadence-core/references/COMMANDS.md` from 5196 to 5393 (measured via
  `weight.mjs --root .`).
- `README.md`'s "Today it is 27 skills..." moved to 28 (measured: 34
  `skills/*/` dirs minus 6 `user-invocable: false` contract skills = 28 with
  `cad-why` added).

With those four files staged, `node cadence-core/bin/self-verify.mjs --root .`
returns `ok:true` with `problems: []`, exactly as task 5's Verify predicts.

But task 5's OTHER verify clause - `node cadence-core/bin/test.mjs` reports 0
failures - does not hold, for a reason task 5 did not cause. Running the FULL
suite (task 5 is the first point in this plan that runs it, rather than the
targeted files earlier tasks ran) surfaces one pre-existing failure:
`cadence-core/bin/arg-contract.test.mjs`'s `'every flag in every row declares
a complete grammar'` test hard-codes the table's total flag-entry count (168)
and script count (16). Task 3's fully-in-lease addition of the `why.mjs` row
to `cadence-core/bin/lib/arg-contract.mjs` (two flags, one script) correctly
moves those to 170 and 17 - this is the SAME kind of ratchet update this
plan's own `files:` list already anticipated for `README.md` (skill count)
and `weight-budgets.json` (byte budgets), but `arg-contract.test.mjs` itself
was never named in the plan's `files:` list, so nothing licenses staging a fix
to it:

    node cadence-core/bin/planning.mjs lease-check --phase 1 --plan 1
    {"ok":false,"reason":"undeclared-files", ...,
     "undeclared":["cadence-core/bin/arg-contract.test.mjs"]}

I confirmed the mechanical fix works (two integer literals, `168`->`170` and
`16`->`17`, verified against the actual table with `node --test
cadence-core/bin/arg-contract.test.mjs` passing) and left it as an UNSTAGED,
uncommitted working-tree edit for the continuation to pick up or discard - it
was never `git add`ed.

CHECKPOINT: structural
Current task: 5 - Register the command surface
Need: `cadence-core/bin/arg-contract.test.mjs` added to
`.planning/phases/1/PLAN-1.md`'s `files:` list (it asserts a literal count
over `lib/arg-contract.mjs`'s table, which task 3 - already committed,
417049d3 - correctly grew), so task 5's own two-line count fix in that file
can be staged and committed alongside its already-verified changes. The
fix itself is already sitting in the working tree at
`cadence-core/bin/arg-contract.test.mjs` (unstaged): `168`->`170`,
`16`->`17`, matching the table `lib/arg-contract.mjs` now declares.
