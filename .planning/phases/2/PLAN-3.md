---
phase: 2
plan: 3
requirements: [ARG-05]
files:
  - cadence-core/bin/config.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/bin/lib/retired-keys.mjs
  - cadence-core/bin/retired-keys.test.mjs
---

# Phase 2: Readers that accept what they have a rule against - Plan 3

## Goal

Every `config.mjs` face reports a prototype-member key as the unknown key it is,
rather than as a silent success naming no key or as a retirement claim the
retirement table never made.

## Must be true when done

- `config.mjs get __proto__`, `get constructor` and `get toString` each print
  `reason:"unknown-key"` naming the key and exit 1, where all three print
  `{"ok":true,"values":{}}` and exit 0 today.
- `config.mjs get stakes __proto__` refuses, instead of answering
  `{"ok":true,"values":{"stakes":"shipped"}}` - one key of the two asked for,
  with nothing saying the other was dropped.
- `config.mjs check '__proto__=1'` reports `unknown key`, never
  `retired in v2.0.0: undefined`, which is a fabricated retirement claim for a
  key that was never retired.
- A genuinely retired key still reports its real `since` and its
  replacement/detail sentence at the same face.
- The behaviour is the same for EVERY `Object.prototype` member, not for
  `__proto__` alone, and the tests say so by walking the set.
- `node --test 'cadence-core/bin/*.test.mjs'` passes with zero failures and
  `node cadence-core/bin/self-verify.mjs` passes.

## Context

CONTEXT.md D-12 (`Object.hasOwn` at all four bare index reads - `config.mjs:271`,
`:274`, `:165` and `lib/retired-keys.mjs:155` - matching the guard `validate`
already carries at `config.mjs:138-142`; no new helper and no new reason code)
and D-13 (the fix and its tests are stated over every `Object.prototype` member,
not over `__proto__` alone; `config.test.mjs:901-907` already pins `constructor`
and `prototype` on the MERGE path, and the READ path has no counterpart). The
`deepMerge` `__proto__` latent item is out of scope - nothing reads it.

## Tasks

### Task 1: The read face stops answering for a key the schema does not hold

- **Files:** cadence-core/bin/config.mjs (`get` - its `unknown` filter + its value read),
  cadence-core/bin/config.test.mjs
- **Action:** `get` decides which requested keys are unknown with
  `wanted.filter((k) => !SCHEMA[k])`, and `SCHEMA` is a plain object, so every
  `Object.prototype` member resolves truthy through the prototype chain and
  passes that filter as if it were a schema key. The value line then reads
  `SCHEMA[k].default`, and for `__proto__` the assignment into `values` runs the
  object's own setter and stores nothing - which is how `get __proto__` measured
  `{"ok":true,"values":{}}` at exit 0 and `get stakes __proto__` measured one key
  of the two asked for. Guard both index reads with `Object.hasOwn`, the same
  guard `validate` carries at `:138-142` for the same reason, and carry that
  comment's point onto these two: a bare lookup answers with `Object.prototype`,
  a truthy "spec" carrying no `type` and no `default`. No new helper and no new
  reason code (D-12) - `fail('unknown-key', unknown)` is already the right
  answer, and the whole fix is that a prototype member now reaches it. Keep the
  keyless `get` walking `Object.keys(SCHEMA)` exactly as it does; that path
  already yields own keys only, and the `:274` guard there is defensive rather
  than reachable once `:271` is fixed - implement it anyway, because D-12 names
  both and a future caller path would inherit the hole. In `config.test.mjs`,
  cover the whole `Object.prototype` member set (D-13) rather than `__proto__`
  alone, and WALK the set rather than hand-listing it: the twelve names
  `Object.getOwnPropertyNames(Object.prototype)` yields include
  `__defineGetter__` and its three siblings beside the obvious `constructor` /
  `toString` / `valueOf`, and a hand-list is how the next member added to the
  language stops being covered. Each must refuse with `unknown-key` at exit 1,
  plus the mixed read `get stakes __proto__` refusing rather than answering for
  `stakes`. Keep those rows separate from the merge-path
  block at `:901-907`, which says of itself that it PINS rather than proves and
  must never stand in for an arm that distinguishes the repair - these read-path
  rows do distinguish it.
- **Verify:** `node cadence-core/bin/config.mjs get __proto__` prints
  `{"ok":false,"reason":"unknown-key","detail":["__proto__"]}` and exits 1, and
  the same for `constructor` and `toString`, where all three print
  `{"ok":true,"values":{}}` at exit 0 today; `get stakes __proto__` refuses
  naming `__proto__`; `get stakes` still prints its value at exit 0 and a keyless
  `get` still returns every schema key; `node --test cadence-core/bin/config.test.mjs`
  passes, and the new rows go red with either `Object.hasOwn` reverted to the
  bare index read.

### Task 2: The write face stops fabricating a retirement

- **Files:** cadence-core/bin/lib/retired-keys.mjs (`retiredKeyError`),
  cadence-core/bin/retired-keys.test.mjs,
  cadence-core/bin/config.mjs (`checkPairs` - its schema lookup),
  cadence-core/bin/config.test.mjs
- **Action:** `check` and `set` both reach `checkPairs`, which asks
  `retiredKeyError(key)` first and then `SCHEMA[key]`, and both are bare index
  reads on plain objects: `RETIRED_KEYS['__proto__']` resolves to
  `Object.prototype`, whose `since`, `replacement` and `detail` are all
  undefined, which is how `config.mjs check '__proto__=1'` measured
  `retired in v2.0.0: undefined` - a WRONG diagnostic rather than a missing one,
  since it names a retirement that never happened and sends the user looking for
  a replacement. Guard both with `Object.hasOwn` (D-12). Put the retirement guard
  inside `retiredKeyError` rather than at its caller, so every caller inherits
  it; a genuinely retired key still resolves its own frozen spec because those
  entries are own properties of the frozen object literal, so `Object.hasOwn`
  changes nothing for them - do not filter by value shape instead, because a spec
  whose `replacement` is `null` is a legitimate row and 14 of the table's 16 rows
  ship that way. Leave the `Object.entries(RETIRED_KEYS)` walk at `:196` alone:
  it already sees own enumerable keys only. Keep the retired-then-schema order
  and the comment at `config.mjs:158-162` that explains it - a retired key must
  not be answered with the generic `unknown key`, and that stays true for the
  keys that really are retired. Add rows to `retired-keys.test.mjs` walking
  `Object.getOwnPropertyNames(Object.prototype)` through `retiredKeyError` and
  getting `null` from every one (D-13), plus a row proving a real retirement
  still returns its own `since`, replacement and detail sentence - that row
  settles
  CONTEXT's flagged assumption that the guard can be placed without losing the
  retirement vocabulary. Add the end-to-end `check` and `set` rows to
  `config.test.mjs`.
- **Verify:** `node cadence-core/bin/config.mjs check '__proto__=1'` prints an
  errors entry of `{"key":"__proto__","error":"unknown key"}` and never
  `retired in v2.0.0: undefined`, exiting 1; the same for `constructor=1` and
  `toString=1`; `check 'review.triggers.pre_ship.gate=x'` still prints its real
  `retired in v3.2.0: ...` sentence; `set '__proto__=1'` refuses and writes
  nothing; `node --test cadence-core/bin/config.test.mjs
  cadence-core/bin/retired-keys.test.mjs cadence-core/bin/config-seams.test.mjs`
  passes.

## Notes

- This plan shares no file with PLAN-1 or PLAN-2 and carries no ordering
  constraint against either; its two tasks are ordered only because both touch
  `config.mjs`.
- `config.mjs validate` is already correct (`Object.hasOwn` at `:138-142`) and is
  not re-done here; the four sites D-12 names are the complete set of bare index
  reads left in these two files, confirmed by grepping `SCHEMA[` and
  `RETIRED_KEYS[` on 2026-08-18.
