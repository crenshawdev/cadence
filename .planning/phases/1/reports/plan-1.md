PLAN COMPLETE
Plan: .planning/phases/1/PLAN.md
Tasks: 6 of 6
| Task | Commit | Note |
|---|---|---|
| 1: The gate-agreement rule as a pure lib, unit-tested from fixtures | cfd573a | `cadence-core/bin/lib/gate-agreement.mjs` + 28-row `gate-agreement.test.mjs`; six codes (`gate-default-drift`, `gate-default-invalid`, `gate-prose-missing`, `gate-prose-drift`, `gate-grid-missing`, `gate-row-malformed`). Frozen pre-patch schema + frozen shipped `review` grid as literals. self-verify still exited 0 (unwired); `node --test cadence-core/bin/*.test.mjs` 1861 pass; `npx tsc -p tsconfig.ci.json` exit 0. |
| 2 + 3: Wire the check into self-verify; move the four schema gate rows onto the route table | 690d268 | ONE commit by user decision (see Deviations). Check 18 wired in the `route-table.json` arm at `self-verify.mjs:1046-1083`, filed against `cadence-core/config.schema.json`; header check list now 1..18; `checked` gains `gate-agreement`. Four CLI arms on a synthetic root in `self-verify.test.mjs` (own schema, own route table, grid deliberately unlike the shipped one). All four `review.triggers.*.gate` defaults now `null`, `values` arrays untouched, each `purpose` carrying its solo/shipped/critical clause. `node cadence-core/bin/self-verify.mjs` exits 0 `problems: []`; `node --test cadence-core/bin/*.test.mjs` 1865 pass 0 fail; `npx tsc -p tsconfig.ci.json` exit 0; `config.mjs check review.triggers.diff.gate=null` -> `ok:false`, `must be one of: off, advisory, blocking, adjudicated`. AC6 falsified on the LIVE tree after the phase: deleting `blocking at shipped` from `review.triggers.plan.gate`'s purpose made self-verify report exactly one problem, `gate-prose-missing` naming `plan` and `shipped`; the schema was restored byte-identical and self-verify is `problems: []` again. |
| 4: `config.mjs get` reports an unset gate as unset | 5356dc9 | `GATE_KEY` shape match + one `allWarnings` entry per explicitly-named unset gate, naming the key and `route.mjs resolve`. `config.mjs:261`'s value line and `:258`'s `wanted.filter` both untouched (D-06, scope boundary). Five arms in `config.test.mjs`: both states of all four triggers, the `set` round trip, the keyless read, the `check ... =null` refusal. Measured with isolated layers: all four unset -> `null` + exactly one warning; pinned -> byte-identical, no warning; keyless -> no gate warning. `node --test cadence-core/bin/*.test.mjs` 1870 pass 0 fail; self-verify `problems: []`; `npx tsc -p tsconfig.ci.json` exit 0. |
| 5: Retire the workaround paragraph from both workflow files | 703a357 | Both paragraphs rewritten: the instruction (gates come from the routing bundle) stays, the false reason goes. Budget rows re-measured and re-pinned - execute.md 25289 -> 25287, plan.md 22041 -> 22067, no other row moved. `DOCS-CLAIMS.md` EXECUTE-07 and PLAN-09 moved to `stale` / `corrected - v3.4.1 phase 1`. AC5 sweep assessed over its whole output: 22 remaining hits, all legitimate, each enumerated in the commit message; neither workflow file appears. `references/conventions.md:73` left alone per D-11. self-verify `problems: []`; `node --test cadence-core/bin/*.test.mjs` 1870 pass 0 fail; `npx tsc -p tsconfig.ci.json` exit 0. |
| 6: The catalog's gate row stops publishing a default routing never fires | 65d8f72 | Default cell now `unset→the stakes level decides, per trigger (`route.mjs resolve` answers it)`; the twelve per-level values deliberately NOT transcribed, the per-value Explanation copy and the `.tier` / `.effort` rows untouched. Budget row re-measured and re-pinned 8824 -> 8815, no other row moved. `DOCS-CLAIMS.md` CONFIG-CATALOG-08 moved to `stale` / `corrected - v3.4.1 phase 1`, closing the standing CAPTURE.md phase-5 item. self-verify exits 0 `problems: []` with `checked` naming `gate-agreement`; `node --test cadence-core/bin/*.test.mjs` 1870 pass 0 fail; `npx tsc -p tsconfig.ci.json` exit 0. |

Deviations:

- [deviation] Task 2's `Verify:` asserts BOTH `node cadence-core/bin/self-verify.mjs`
  exits 1 against the unpatched schema AND `node --test cadence-core/bin/*.test.mjs`
  still passes at that commit. Those two are mutually exclusive on this tree,
  because `cadence-core/bin/self-verify.test.mjs:210-214` already asserts the
  LIVE tree is clean:

      test('the repo itself passes self-verification', () => {
        const r = run();
        assert.equal(r.ok, true);
        assert.deepEqual(r.problems, []);
      });

  Measured with the check wired and the schema unpatched:
  `node --test cadence-core/bin/self-verify.test.mjs` -> 140 tests, 139 pass,
  1 fail, the failure being exactly that row. RESOLVED at a structural
  checkpoint by user decision: tasks 2 and 3 land as ONE commit (`690d268`), so
  the wiring, its CLI test and the reconciled schema arrive together and no
  commit is knowingly red. The task-2 `Action:` line "do not add any live-tree
  assertion to the test file" stands and was honoured - the assertion already
  existed, was not removed, was not loosened, and no count-pin assertion moved.
  The failing-run evidence the plan asks to be RECORDED rather than asserted was
  produced before the schema edit and is carried verbatim below; it is the
  phase's proof for ROADMAP criterion 1 and was not re-run as a commit-boundary
  requirement.

- The AC1 / task-2 evidence, verbatim, produced on the unpatched tree with the
  check wired. It names `plan`, `diff` and `phase_diff`, and two of its entries
  name `phase_diff` together with `shipped`:

```
{"ok":false,"checked":"config-keys, invocations, paths, internals-paths, budgets, tools, agent-skills, agent-behaviour, rung-effort, verifier-write-grant, routing-cells, effort-enums, config-reach, dispatch-phrasing, route-relay, merge-warnings, deferred-reads, script-contracts, nul-bytes, include-consumers, global-only-key-scope, gate-agreement","problems":[{"kind":"gate-default-drift","file":"cadence-core/config.schema.json","detail":"review.triggers.plan.gate: default \"adjudicated\" is what config.mjs get answers for an unset gate, but the review grid fires \"advisory\" at solo, \"blocking\" at shipped - set the default to null so the stakes level decides"},{"kind":"gate-prose-missing","file":"cadence-core/config.schema.json","detail":"review.triggers.plan.gate: the purpose states no gate at solo - every gate purpose must carry a \"<gate> at <level>\" clause for solo, shipped, critical, because the prose is where a user setting the key learns what the level already does"},{"kind":"gate-prose-missing","file":"cadence-core/config.schema.json","detail":"review.triggers.plan.gate: the purpose states no gate at shipped - every gate purpose must carry a \"<gate> at <level>\" clause for solo, shipped, critical, because the prose is where a user setting the key learns what the level already does"},{"kind":"gate-prose-missing","file":"cadence-core/config.schema.json","detail":"review.triggers.plan.gate: the purpose states no gate at critical - every gate purpose must carry a \"<gate> at <level>\" clause for solo, shipped, critical, because the prose is where a user setting the key learns what the level already does"},{"kind":"gate-default-drift","file":"cadence-core/config.schema.json","detail":"review.triggers.diff.gate: default \"advisory\" is what config.mjs get answers for an unset gate, but the review grid fires \"off\" at solo, \"off\" at shipped, \"blocking\" at critical - set the default to null so the stakes level decides"},{"kind":"gate-prose-missing","file":"cadence-core/config.schema.json","detail":"review.triggers.diff.gate: the purpose states no gate at solo - every gate purpose must carry a \"<gate> at <level>\" clause for solo, shipped, critical, because the prose is where a user setting the key learns what the level already does"},{"kind":"gate-prose-missing","file":"cadence-core/config.schema.json","detail":"review.triggers.diff.gate: the purpose states no gate at shipped - every gate purpose must carry a \"<gate> at <level>\" clause for solo, shipped, critical, because the prose is where a user setting the key learns what the level already does"},{"kind":"gate-prose-missing","file":"cadence-core/config.schema.json","detail":"review.triggers.diff.gate: the purpose states no gate at critical - every gate purpose must carry a \"<gate> at <level>\" clause for solo, shipped, critical, because the prose is where a user setting the key learns what the level already does"},{"kind":"gate-prose-missing","file":"cadence-core/config.schema.json","detail":"review.triggers.risk_surface.gate: the purpose states no gate at solo - every gate purpose must carry a \"<gate> at <level>\" clause for solo, shipped, critical, because the prose is where a user setting the key learns what the level already does"},{"kind":"gate-prose-missing","file":"cadence-core/config.schema.json","detail":"review.triggers.risk_surface.gate: the purpose states no gate at shipped - every gate purpose must carry a \"<gate> at <level>\" clause for solo, shipped, critical, because the prose is where a user setting the key learns what the level already does"},{"kind":"gate-prose-missing","file":"cadence-core/config.schema.json","detail":"review.triggers.risk_surface.gate: the purpose states no gate at critical - every gate purpose must carry a \"<gate> at <level>\" clause for solo, shipped, critical, because the prose is where a user setting the key learns what the level already does"},{"kind":"gate-default-drift","file":"cadence-core/config.schema.json","detail":"review.triggers.phase_diff.gate: default \"advisory\" is what config.mjs get answers for an unset gate, but the review grid fires \"off\" at solo, \"off\" at shipped, \"adjudicated\" at critical - set the default to null so the stakes level decides"},{"kind":"gate-prose-drift","file":"cadence-core/config.schema.json","detail":"review.triggers.phase_diff.gate: the purpose says \"advisory at shipped\", but the review grid fires \"off\" at shipped"}]}
```

Open items:

- Task 1's fuller shape, declined: the gate-agreement lib exposes no options
  beyond the caller's `{levels, gates}` vocabularies - no configurable clause
  grammar, no per-code severity, no opt-out register. Nothing in the plan's
  `Verify:` sets any of those, and check 14's reason for `lib/*.mjs` carrying no
  CONTRACTS row is the same reason a lib here carries no config surface.
- Task 2's fuller shape, declined: the CLI test files four arms (clean +
  `checked`, default drift, a deleted level clause, a prose gate the grid does
  not fire) rather than one arm per code. `gate-grid-missing` and
  `gate-row-malformed` are pinned from the lib side in
  `gate-agreement.test.mjs`; the CLI arms exist to prove the WIRING, and a
  fifth and sixth arm would re-prove the lib through a slower path.
- `route-table.json`'s `_meta.review` still says "the five triggers
  config.schema.json defines" while four remain. Out of scope per CONTEXT's
  scope boundary and the plan's `## Notes`; untouched, one line away from a
  block this phase reads.
