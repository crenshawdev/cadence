PLAN PARTIAL
Plan: .planning/phases/2/PLAN-3.md
Tasks: 1 of 2
| Task | Commit | Note |
|---|---|---|
| 1 - The read face stops answering for a key the schema does not hold | ad56095 | `Object.hasOwn` at `config.mjs` `get`'s unknown filter and its value read. Baseline reproduced first: `get __proto__`, `get constructor`, `get toString` each `{"ok":true,"values":{}}` at exit 0, `get stakes __proto__` answered `{"stakes":"shipped"}`. All four now `{"ok":false,"reason":"unknown-key","detail":[<key>]}` at exit 1. Three test rows added walking `Object.getOwnPropertyNames(Object.prototype)` (12 names) with exit-status assertions; the two refusal rows watched FAILING against the reverted guard, then the guard restored. `node --test config.test.mjs` 79/79. |
Deviations: none
Open items: none
