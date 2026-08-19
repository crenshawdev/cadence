PLAN COMPLETE
Plan: .planning/phases/2/PLAN-3.md
Tasks: 2 of 2
| Task | Commit | Note |
|---|---|---|
| 1 - The read face stops answering for a key the schema does not hold | ad56095 | `Object.hasOwn` at `config.mjs` `get`'s unknown filter (`:284`) and its value read (`:292`). Baseline reproduced first: `get __proto__`, `get constructor`, `get toString` each `{"ok":true,"values":{}}` at exit 0, `get stakes __proto__` answered `{"stakes":"shipped"}` for one key of the two. All four now `{"ok":false,"reason":"unknown-key","detail":[<key>]}` at exit 1; `get stakes` and the keyless `get` unchanged. Three test rows added walking `Object.getOwnPropertyNames(Object.prototype)` (12 names) and asserting exit status; the two refusal rows watched FAILING against the reverted `:284` guard, then restored. `node --test config.test.mjs` 79/79. |
| 2 - The write face stops fabricating a retirement | ac8dca0 | `Object.hasOwn` inside `retiredKeyError` (so every caller inherits it, not at the caller) and at `checkPairs`'s `SCHEMA[key]`. Baseline reproduced: `check '__proto__=1'`, `'constructor=1'`, `'toString=1'`, `'hasOwnProperty=1'` each `retired in v2.0.0: undefined`; all now `{"key":<key>,"error":"unknown key"}` at exit 1, and `set --global '<member>=1'` refuses with no file created. `check 'review.triggers.pre_ship.gate=x'` still prints its full `retired in v3.2.0: ...` sentence. Two `retired-keys.test.mjs` rows (the `Object.prototype` walk, plus a row pinning `since` + replacement + detail on two real retirements with differing `since`) and three `config.test.mjs` rows; all three refusal rows watched FAILING against the reverted `retiredKeyError` guard, then restored. `Object.entries(RETIRED_KEYS)` walk in `retiredKeysIn` left alone as planned. |
Deviations: none
Open items: none

Verification run for the whole plan: `node --test cadence-core/bin/*.test.mjs` 2271/2271 pass, 0 fail; `node cadence-core/bin/self-verify.mjs` `{"ok":true,...,"problems":[]}`; `npx tsc -p tsconfig.ci.json` exit 0. `detect-commands` reports `lint: null` for this repo, so there is no lint subprocess to run - typecheck is the whole static-analysis surface Cadence can find here.
