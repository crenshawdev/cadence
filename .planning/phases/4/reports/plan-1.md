PLAN COMPLETE
Plan: .planning/phases/4/PLAN-1.md
Tasks: 4 of 4
| Task | Commit | Note |
|---|---|---|
| 1. The declarative contract module and its evaluator | 67e6593 | `lib/arg-contract.mjs` + `arg-contract.test.mjs`; three dispositions exercised on both axes, one flat `{ok,value,detail}` on every path, a spawned probe proving zero bytes on stdout/stderr; suite 2363 pass / 0 fail; self-verify ok:true; tsc clean |
| 2. `CONTRACTS` moves into the module, self-verify reads it back | c4f34a6 | `grep -c "const CONTRACTS = {"` on self-verify returns 0; falsifier watched failing - deleting `--phase` from the `plan-overlap` row reports `unknown-flag` on `cadence-core/workflows/execute.md`, restored; new test pins the single table; 2364 pass / 0 fail; tsc clean |
| 3. Every row gains its value grammar | e0a19c8 | 144 flag entries, 16 scripts, 77 subcommand rows, each with `required` + `type` + `value` + `bare`; completeness walk plus a pin on the declarations D-04/D-05/D-12 bind; 2367 pass / 0 fail; self-verify ok:true problems []; tsc clean |
| 4. self-verify adopts the contract for its own `--root` | 983c143 | `--root ''` and bare `--root` each print exactly one line `{"ok":false,"reason":"missing-flag-value","detail":"--root"}`, exit 1, 0 bytes stderr; absent `--root` and `--root .` still ok:true; 2367 pass / 0 fail; tsc clean |

Deviations:
- [deviation] Task 3 asserts "every disposition must reproduce the behavior that
  ships today". For roughly a dozen value-carrying string flags on
  `planning.mjs` that is not expressible in the three-word vocabulary: today a
  bare `--name`, `--sources`, `--reason`, `--reported`, `--severity`, `--cause`,
  `--fix`, `--evidence` mints the boolean `true` at `parseArgs` and the seam
  WRITES IT THROUGH (`Name: true` into STATE.md, `sources: true` into a UAT
  front-matter), which is neither refuse, warn nor fallback. Declared `refuse`
  for all of them - the same disposition the plan's own load-bearing list
  mandates for `--dir`, `--root`, `--role`, `--step`, `--reviewer` and
  `--trigger`, and the same class of defect (#42/#45) `--item`, `--text` and
  `--payload` already refuse in that file. Nothing adopts these rows in this
  plan, so no shipped behavior moved here; plan 2's adoption of `planning.mjs`
  is where they take effect, and it should expect a bare `--name` to start
  refusing rather than writing `true`.

Open items:
- The evaluator reads ARGV only (`evaluateFlag(argv, flag, spec)`). Declined the
  fuller shape of a second door taking `parseArgs`' `opts` object, where a bare
  flag arrives as the boolean `true`: the Verify is met by the argv door, and
  all four remaining parsers have an argv array in hand. `planning.mjs` reads
  `opts.<name>` throughout, so plan 2 either passes `process.argv` at the guard
  sites or states what an opts-shaped door needs - one is a call-site choice,
  the other is a new export, and neither is guessable from here.
- Task 1's Verify names "0 failures out of 2357". The suite is 2367 now: the
  ten rows this plan added across `arg-contract.test.mjs` (9) and
  `self-verify.test.mjs` (1). 0 failures throughout.
- `flagNames()` accepted both a bare array and a grammar object between tasks 2
  and 3 so the move could be a pure move; task 3 narrowed it to `Object.keys`.
  Nothing outside the module reads a row directly.
