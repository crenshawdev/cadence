# Phase 1: What the config says is what routing does - Context

Gathered: 2026-08-15
Feeds: /cad-plan 1

## Scope boundary

In: `config.schema.json`'s gate defaults and per-level `purpose` prose,
`config.mjs get`'s answer for an unset gate, a new `self-verify.mjs` check
comparing both against `route-table.json`, and the retirement of the workaround
paragraph in `workflows/execute.md` and `workflows/plan.md` plus the stale
Default column in `references/config-catalog.md`. Serves GAT-02, GAT-03, ENF-02.
Out: `route-table.json`'s `review` grid (authority, does not move); any new
config key, flag or command; `config.mjs set`/`check` behaviour; the two
prototype-getter faces at `config.mjs:258`/`:261` recorded in CAPTURE.md;
`route-table.json`'s stale "five triggers" `_meta.review` count.
Deferred: None.
Plan shape: one plan.

## Durable decisions

- D-01 (Schema defaults): All four `review.triggers.*.gate` defaults become the
  `null` sentinel, `risk_surface` included, even though its `blocking` default
  agrees at every level today. The alternative - a scalar default is legal iff
  every level's cell equals it - passes today and goes quiet the first time a
  `risk_surface` cell moves, which is the re-drift ENF-02 exists to catch.
  Evidence: `cadence-core/config.schema.json:77`, `:80` (the `null`-outside-the-enum
  shape already ships for `risk_surface.surfaces`), `cadence-core/bin/prose-agreement.test.mjs:204`,
  `cadence-core/route-table.json` `_meta.review`.
- D-02 (Get read face): `config.mjs get` emits one `warnings[]` entry naming
  `route.mjs resolve` for an unset gate ONLY when the caller named a gate key
  explicitly; a keyless full read (~72 keys) stays clean. A bare `null` alone
  under-serves GAT-02's "reported so a reader can tell a level's gate from a
  layer's"; a warning on every read appends four lines to prose that
  `workflows/milestone.md:104` and `verify.md:111` relay to the user.
  Evidence: `cadence-core/bin/config.mjs:243-263`, `:257`, `.planning/REQUIREMENTS.md:14`.
- D-03 (Self-verify check): Mandatory prose grammar - every `*.gate` `purpose`
  must carry a stated `<gate> at <level>` clause for `solo`, `shipped` and
  `critical`, and a missing clause is itself a self-verify problem. Only
  `phase_diff` states levels today; the opt-in alternative lets a maintainer
  silence the prose half by deleting one sentence, the hole check 14 was written
  to close for CONTRACTS rows. This phase fixes the grammar `prose-agreement.test.mjs:5-13`
  declined to invent for `references/review-triggers.md`.
  Evidence: `cadence-core/config.schema.json:71`, `:74`, `:77`, `:81`,
  `cadence-core/bin/self-verify.mjs:74-82`, `cadence-core/bin/prose-agreement.test.mjs:5-13`.

## Decisions

- D-04 (Schema defaults): `route-table.json`'s `review` grid is the authority
  and does not move; the schema moves to it. Evidence:
  `cadence-core/bin/prose-agreement.test.mjs:127` drives `route.mjs resolve` at
  each level and asserts `references/review-triggers.md` and `docs/WORKFLOW.md`
  copy it; `81bdb5d` (v3.2.0) moved `shipped.phase_diff` `advisory` -> `off`
  deliberately and left the schema behind.
- D-05 (Schema defaults): The gate keys' `values` arrays stay four-membered -
  `null` is NOT added - so `set` and `check` behave byte-identically. Measured
  2026-08-15: with `"default": null` and an untouched `values`,
  `config.mjs check review.triggers.diff.gate=null` still returns
  `must be one of: off, advisory, blocking, adjudicated`. Evidence:
  `cadence-core/bin/config.mjs:70-73`, `:72`.
- D-06 (Get read face): `config.mjs:261`'s
  `layered[k] !== undefined ? layered[k] : SCHEMA[k].default` line is unchanged;
  the schema data edit does the work, so a pinned value reads back
  byte-identical. Evidence: `cadence-core/bin/config.mjs:261` is the only
  consumer of any schema `default` in executable code.
- D-07 (Get read face): `config.mjs get` never consults `route-table.json` to
  answer a level's gate. Evidence: `.planning/REQUIREMENTS.md:14` ("without
  pretending the seam knows something it does not"),
  `cadence-core/bin/route.mjs:110-116` and `route-table.json` `_meta.tiers`
  state the mirror-image rule for the resolver.
- D-08 (Self-verify check): The rule lands as a pure `{code, detail}` lib under
  `cadence-core/bin/lib/`, called from the block that already has both files
  parsed, and names itself in the `checked` string. Fixture-drivable, so AC1's
  failing run stays re-runnable after the data edit lands. Evidence:
  `cadence-core/bin/self-verify.mjs:1046-1083`, `:1063-1064`,
  `cadence-core/bin/lib/route-cells.mjs:1-16`,
  `cadence-core/bin/lib/config-reach.mjs:1-17`,
  `cadence-core/bin/self-verify.test.mjs:1824`, `:1916`.
- D-09 (Self-verify check): The trigger list the check walks is derived from the
  schema's own `review.triggers.*` key names, never hand-kept. Evidence:
  `cadence-core/bin/self-verify.mjs:554-555`, `:1067`,
  `cadence-core/bin/lib/route-cells.mjs:175-177`.
- D-10 (Self-verify check): `config.schema.json:81`'s "writing any value pins it
  at every level and warns" stays verbatim - it is true of shipped code.
  Evidence: `cadence-core/bin/route.mjs:435-468`.
- D-11 (Prose surfaces): The criterion-4 sweep has two live hits, not one -
  `cadence-core/workflows/execute.md:35-39` and
  `cadence-core/workflows/plan.md:58-62` carry the same warning paragraph, and
  `.planning/DOCS-CLAIMS.md:719` (EXECUTE-07) moves with the execute.md one.
  `references/conventions.md:71-76` is not a hit.
- D-12 (Prose surfaces): `cadence-core/references/config-catalog.md:62` is in
  scope - its Default column publishes the same three defaults the router
  resolves at no level, it is transcribed by hand
  (`cadence-core/workflows/config.md:65-72`) so no schema edit reaches it, and
  it is the surface a user reads during `/cad-config`. Closes the standing
  CAPTURE.md phase-5 item.

## Acceptance criteria

- [ ] AC1: A test in `cadence-core/bin/*.test.mjs` feeds the new check the
      pre-patch schema values (`plan: adjudicated`, `diff: advisory`,
      `phase_diff: advisory`) and asserts it returns a problem naming each
      trigger that disagrees with `route-table.json`, including `phase_diff` at
      `shipped`.
- [ ] AC2: `node cadence-core/bin/self-verify.mjs` exits 0 with `problems: []`,
      and its `checked` list names the new check.
- [ ] AC3: On a repo with no gate set,
      `node cadence-core/bin/config.mjs get review.triggers.<t>.gate` returns
      `null` as the value plus one `warnings[]` entry naming `route.mjs resolve`,
      for all four triggers; after
      `config.mjs set review.triggers.diff.gate=blocking`, the same command
      returns `blocking` with no such warning.
- [ ] AC4: `node cadence-core/bin/config.mjs get` with no key names emits no
      gate-related warning, and
      `config.mjs check review.triggers.diff.gate=null` returns `ok:false` with
      `must be one of: off, advisory, blocking, adjudicated`.
- [ ] AC5: A repo-wide grep for the workaround wording returns nothing - neither
      `cadence-core/workflows/execute.md` nor `cadence-core/workflows/plan.md`
      states that a `get` of a gate returns the schema default - and
      `cadence-core/references/config-catalog.md`'s gate row no longer publishes
      a per-key scalar default.
- [ ] AC6: Each of the four `review.triggers.*.gate` `purpose` strings names a
      gate for `solo`, `shipped` and `critical`, and each named gate equals
      `route-table.json`'s `review[level][trigger]`; deleting one level clause
      from any of the four makes `self-verify.mjs` report a problem.
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` passes with no test file
      removed and no count-pin assertion loosened.

## Flagged assumptions

- `workflows/execute.md`, `workflows/plan.md` and `references/config-catalog.md`
  each sit at EXACTLY their `cadence-core/bin/weight-budgets.json` row (measured
  2026-08-15: 25289, 22041, 8824 bytes) - Confident; if wrong: a net-growing
  prose rewrite fails `self-verify.mjs` (AC2, AC7) for a reason unrelated to the
  phase and reads as a check regression. `config.schema.json` and
  `route-table.json` are not weighed surfaces, so schema prose can grow freely.
- The tree-wide count pins that forced a structural checkpoint in v3.4.0 (the
  all-keys fixture at `self-verify.test.mjs:290-300`, the `mergeLayers(` counts
  at `:1591-1592`) are off this phase's path, since it adds no config key and no
  `mergeLayers` callsite - Likely; if wrong: a count assertion reddens on a
  change that touched no key. Mitigation: run `node --test cadence-core/bin/*.test.mjs`
  as a checkpoint immediately after the schema data edit, before any check is
  written.
- `route-table.json`'s `_meta.review` prose still says "the five triggers
  config.schema.json defines" while four remain (`pre_ship` retired in v3.2.0,
  `cadence-core/bin/retired-keys.test.mjs:58`) - Confident; if wrong: nothing
  breaks, but the phase edits an adjacent block and leaves a stale count one
  line away. Planner's call whether to correct it in passing.
