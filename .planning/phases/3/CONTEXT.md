# Phase 3: Flags that do more or less than they say - Context

Gathered: 2026-08-18
Feeds: /cad-plan 3

## Scope boundary

In: RVW-03 - the cross-model half of a review panel becomes stakes-dependent in
both of its fields, at `cadence-core/route-table.json`'s `tiers` grid plus a new
`efforts` grid beside it, `cadence-core/bin/route.mjs`'s resolve envelope,
`cadence-core/config.schema.json`'s per-trigger `tier`/`effort` defaults, and
the step-4 prose in `cadence-core/references/review-triggers.md`. REL-01 -
`git.create_tag` reduced to the land-time tag cut alone, with
`cadence-core/workflows/milestone.md` step 2's release-mode discriminator moved
onto a confirmed version plus a BOUNDED tag probe, and the key's schema
`purpose`, catalog and reach rows corrected. ISS-01 - the resolve loop in
`cadence-core/bin/issue-check.mjs` bounded by a wall-clock budget over the loop
rather than by a per-call timeout its only exit condition cannot detect.

Out: `review.consult.tier`/`.effort` and `review.decision_review.tier`/`.effort`
- the other two tier-carrying surfaces `DESIGN.md:314-322` groups with these.
RVW-03 is scoped to a review-trigger PANEL, and folding them in pulls
`workflows/decision-review.md` and `references/consult.md` into the edit set,
each with its own weight budget and catalog row, and needs a `route.mjs` call
`/cad-decision-review` has never made. The mapping of the tier vocabulary onto
the cells grid's model aliases, rejected at `DESIGN.md:314-333` and not
re-opened here. The six requirements of `v3.5.4` closed in phases 1 and 2.

Deferred: None.

Plan shape: multiple plans, same phase - the three requirements share no file
and no test file. RVW-03 is the `route-table.json`/`route.mjs`/schema cluster,
REL-01 is `milestone.md` plus the config docs plus a bounded tags read, ISS-01
is `issue-check.mjs` alone; three independent fix sites with three independent
falsifiers and non-overlapping leases.

## Durable decisions

- D-01 (RVW-03): The level-dependence is added by RE-KEYING the existing
  `tiers` grid on (stakes level, trigger). The tier vocabulary
  (`flagship|balanced|cheap`) is NOT mapped onto the cells grid's model
  aliases. Evidence: `DESIGN.md:314-333` records that rejection verbatim -
  "the cell grid owns model resolution one phase after it shipped, and a second
  model axis beside it is the indirection that grid removed";
  `cadence-core/route-table.json` `_meta.tiers` states the grid is
  hand-transcribed from schema defaults precisely so `route.mjs` never reads
  `config.schema.json`; `cadence-core/bin/route.mjs:492-497` is its single
  reader.
- D-02 (RVW-03): The re-keyed grid is DENSE - every stakes level names every
  trigger - rather than a base row with per-level overrides or a per-level tier
  bump resolved in `route.mjs`. A sparse grid means a level silently inheriting
  another level's tier, which is this requirement's own defect one indirection
  further in. Evidence: `cadence-core/bin/lib/route-cells.mjs:8-11` fixes the
  locating convention (``tiers/<trigger>`` for the one grid that keys on a
  trigger alone) and `:284-315` walks the trigger list in both directions,
  reporting `missing-cell` for an absent entry - an arm a sparse grid would
  have to weaken; `cadence-core/bin/self-verify.test.mjs:146` carries the
  flat-tiers fixture that moves with it.
- D-03 (RVW-03): The resolved per-trigger tier is RETURNED in the `resolve`
  envelope beside `reviewers`, and `review-triggers.md` step 4 takes it from
  that line instead of resolving `trigger.tier` from a read no prose specifies.
  This is the same move RVW-02 (v3.2.0) made for the reviewer SET. Evidence:
  `cadence-core/references/review-triggers.md:225-226` says to resolve
  `model = review.providers.<name>.tiers[trigger.tier]` while a grep over
  `cadence-core/workflows/`, `cadence-core/references/` and `skills/` finds no
  `config.mjs get review.triggers.*` call that would produce it;
  `cadence-core/bin/route.mjs:636` already emits `review`, `reviewers`,
  `surfaces` and `verify`.
- D-04 (RVW-03): `review.triggers.<t>.tier`'s schema `default` moves to the
  `null` sentinel and its `purpose` gains per-level clauses, mirroring what
  GAT-02 already did for `.gate`. Evidence: `cadence-core/config.schema.json:77`
  (gate: `default: null`, purpose naming "advisory at solo, blocking at
  shipped, adjudicated at critical") against `:78,81,84,88` (tier: hard
  `"flagship"`/`"balanced"` defaults, no level clause);
  `cadence-core/bin/config.mjs:236-240,282-285` already warns on an unset gate
  that the stakes level decides; measured 2026-08-18, no layer in this repo or
  the user-global layer sets any `review.triggers.*.tier` yet the effective read
  still answers `flagship`/`balanced` - a value nothing resolves.
- D-05 (RVW-03): The cross-model reasoning EFFORT moves with the tier: an
  `efforts` grid keyed the same way as the re-keyed `tiers` grid, returned in
  the same envelope. Tier alone leaves "both halves of the panel moved" only
  two thirds true. Evidence: `cadence-core/route-table.json` carries no
  per-trigger effort grid at all; `cadence-core/bin/route.mjs:130-166` reads
  `gate`, `tier` and `surfaces` from config and never `effort`;
  `cadence-core/config.schema.json:79,82,85,89` pin it at `high`/`medium`;
  `cadence-core/references/review-triggers.md:39-46` states tier and effort are
  the two fields that reach the cross-model backend and nothing else does.
- D-06 (RVW-03): `review.consult.*` and `review.decision_review.*` stay OUT,
  as recorded in the scope boundary. Evidence:
  `.planning/REQUIREMENTS.md:35-38` scopes RVW-03 to "a cross-model review
  panel"; `DESIGN.md:314-322` notes `/cad-decision-review` "never calls
  `route.mjs`, so its `cad-reviewer` arm runs at the session default at every
  stakes level" - a second, separately shaped defect;
  `cadence-core/workflows/decision-review.md:43` reuses only step 3's reviewer
  set.
- D-07 (REL-01): After the fix `git.create_tag` is read by exactly ONE site -
  `skills/cad-land/SKILL.md`'s tag cut - and milestone step 2 decides release
  mode from the tag probe plus a confirmed version. Evidence:
  `cadence-core/workflows/milestone.md:22-28` is the conflated read while
  `:68-72` already states the tag is not cut there (tag-after-merge);
  `skills/cad-land/SKILL.md:182-194` is the real tag site and already guards on
  the same key; `cadence-core/references/config-reach.md:142` names
  `milestone.md` alone and omits the tag site entirely.
- D-08 (REL-01): The manifest bump stays gated on a CONFIRMED version rather
  than becoming unconditional. Evidence:
  `cadence-core/bin/release-bump.mjs:111-119` returns `action:"skip"` /
  `no-plugin-manifest` when the manifest is absent but EMITS `no-target-version`
  when the version is missing, and `cadence-core/workflows/milestone.md:50-56`
  instructs the model to treat an `ok:false` as a STOP - so an unconditional
  call turns a non-release close from a skip into a failure;
  `cadence-core/bin/lib/release-decision.mjs:18-42` states "There is
  deliberately NO prose derivation here (D-03, REL-03)".
- D-09 (REL-01): The step-2 tag probe is BOUNDED through phase 2's
  `lib/git-tags.mjs readTags`, exposed to prose as a read-only tags subcommand,
  rather than left as the bare `git tag` it is today. This phase makes that
  probe more load-bearing (it becomes the discriminator `create_tag` used to
  be), and leaving it on the upward-discovery path phase 2 just closed one
  level up would let a project inside an umbrella repository read as a release
  project it is not. Evidence: `cadence-core/workflows/milestone.md:23-24` is
  the bare probe; `cadence-core/bin/lib/git-tags.mjs:14-21` documents the
  TAG-01 bound and that the caller must state the project root;
  `git-branch.mjs:69` and `planning.mjs:1307` are its only callers, so no seam
  exposes it to prose today.
- D-10 (ISS-01): The bound becomes a wall-clock BUDGET over the resolve LOOP,
  with each call's timeout derived from the remaining budget; `MAX_RESOLVES`
  stays as the separate call-count cap. Evidence:
  `cadence-core/bin/issue-check.mjs:245-255` - the loop's only exit is
  `if (one.timedOut) break;` - and `:108-123` sets `timedOut` from
  `err.signal === 'SIGKILL'` alone, so five resolves each answering at 9.9 s
  with exit 1 cost ~50 s and never trip it; `:79-92` states MAX_RESOLVES exists
  so a hung CLI "must not be able to multiply the bound by the cap";
  `cadence-core/bin/lib/capture-file.mjs:237,275` is this tree's existing
  `Date.now()` deadline pattern.
- D-11 (ISS-01): A FAST non-zero resolve does NOT stop the loop - only budget
  exhaustion and a timeout do. An absent issue is a legitimate answer the loop
  must be able to collect several of. Evidence: measured 2026-08-18 against
  this repo's own forge, `tea issues 999999 --repo <slug> --output json` exited
  1 in 245 ms and a full `issue-check.mjs check --dir /data/code/cadence
  --base main` completed in 789 ms resolving 10 referenced numbers;
  `cadence-core/bin/lib/issue-decision.mjs:182-195` documents that the forgejo
  row lists `--state open` so a CLOSED number requires the extra call;
  breaking on the first non-zero exit reddens the shipped fixture at
  `cadence-core/bin/issue-check.test.mjs:496-525`, which expects `#47` resolved
  `closed` from a resolve the list never named.
- D-12 (ISS-01): The budget derives from the existing
  `--timeout-ms`/`DEFAULT_TIMEOUT_MS` surface - no new flag and no new config
  key. Evidence: `cadence-core/bin/issue-check.mjs:69-92` states twice that a
  named constant is chosen over a config key because "the milestone licenses
  exactly one new key" and "a value reachable at the call site is directly
  testable"; `cadence-core/bin/self-verify.mjs:421-424` is the contract table a
  new flag would have to join; `skills/cad-land/SKILL.md:40` is the sole
  callsite and passes no timeout at all, so a new flag would be inert on the
  shipped path.

## Decisions

- D-13 (REL-01): `milestone.md:9-12`'s up-front one-shot config read drops
  `git.create_tag` and keeps `git.auto_close`, and the DOCS-CLAIMS rows
  asserting that pair move in the same change. Evidence:
  `.planning/DOCS-CLAIMS.md:793` (MILESTONE-01) asserts "One
  `config.mjs get git.create_tag git.auto_close` reads both keys";
  `.planning/DOCS-CLAIMS.md:682` (CONFIG-26) carries the catalog row.
- D-14 (REL-01): `git.create_tag`'s schema `purpose` ("Tag on milestone") and
  its catalog and reach rows are corrected to name the land-time tag cut. The
  requirement's own framing is the documented words, so leaving them makes the
  flag keep misdescribing its reach after the code is right. Evidence:
  `cadence-core/config.schema.json:51`;
  `cadence-core/references/config-catalog.md:44`;
  `cadence-core/references/config-reach.md:142`.
- D-15 (ISS-01): Exhausting the budget still yields `ok:true`,
  `action:"report"`, exit 0, with the unreached numbers reported `unresolved`.
  Evidence: `cadence-core/bin/issue-check.mjs:256-266` fixes `unresolved` as the
  honest non-answer; `cadence-core/bin/issue-check.test.mjs:527-542` already
  asserts the cap's remainder is `unresolved` and the harness at `:63-99`
  asserts status 0 on every path; `skills/cad-land/SKILL.md:42-52` branches on
  `action` alone.
- D-16 (ISS-01): The new bound is proved with the existing PATH-stub harness -
  a stub that sleeps and exits non-zero - not with a live forge. Evidence:
  `cadence-core/bin/issue-check.test.mjs:54-91` - `stub()` already supports
  `sleep` ("`sleep` seconds before printing proves the call bound"), `code`,
  and an `issue` map whose unmatched number "exits 1 with no output, which is
  what tea does for an issue that is not there".
- D-17 (mechanics): Every prose edit that GROWS a budgeted surface carries a
  `cadence-core/bin/weight-budgets.json` bump in the SAME commit; a shrink does
  not. Evidence: `cadence-core/bin/self-verify.mjs:910-947` - the check is a
  ceiling (`bytes > budget`); measured 2026-08-18, all five surfaces this phase
  touches sit EXACTLY at their budget (`workflows/milestone.md` 11413,
  `skills/cad-land/SKILL.md` 13273, `references/config-catalog.md` 9257,
  `references/config-reach.md` 19521, `references/review-triggers.md` 30644), so
  any addition is an immediate `budget-overrun`; phase 2's D-11 locked the same
  rule for workflow files.
- D-18 (mechanics): The `git.create_tag` reach row is REWRITTEN because its
  reach site changes file, and the tier rows are rewritten because their
  resolution source changes - not merely re-worded. Evidence:
  `cadence-core/references/config-reach.md:1-40` states that check 9 proves the
  table and the schema agree with EACH OTHER and explicitly does not prove
  either agrees with the code, and `:142` currently points `create_tag` at
  `milestone.md`; `cadence-core/bin/self-verify.mjs:39-44` is check 9's
  statement.
- D-19 (mechanics): The contradictory "three grids" claims are settled by this
  phase rather than left for a later sweep, since the fourth grid is the one
  this phase makes move. Evidence: `INTERNALS.md:17` enumerates "the three
  grids - 18 cells, the review gates, the verify switch", omitting `tiers`;
  `cadence-core/route-table.json` `_meta.note` says "Three grids" while
  `cadence-core/bin/lib/route-cells.mjs:2-3` says "four grids";
  `.planning/DOCS-CLAIMS.md:1182` (INTERNALS-42) and `:455,1131` (README-19,
  README-63) carry those claims as `accurate`.

## Acceptance criteria

- [ ] AC1: For the same trigger, `route.mjs resolve` returns a different
      cross-model tier AND a different effort at `solo` vs `shipped` vs
      `critical`, and both ride the returned envelope beside `reviewers` -
      checked on at least the `plan` and `risk_surface` triggers.
- [ ] AC2: On a repository where no layer sets it,
      `config.mjs get review.triggers.plan.tier` reports the value the resolver
      actually uses at the effective stakes level rather than a fixed
      `flagship`, and `self-verify` reports no `missing-cell` for either the
      `tiers` or the `efforts` grid, walked in both directions.
- [ ] AC3: With `git.create_tag: false`, the milestone close still bumps the
      plugin manifest version; `grep -rn "create_tag" cadence-core/ skills/`
      shows the key read at exactly one site, the land-time tag cut; and the
      key's schema `purpose` no longer states that the tag happens at milestone
      close.
- [ ] AC4: The bounded tags read returns no tags for `sub/.planning`, where
      `sub/` is a non-repository project inside a repository tagged `v9.9.0`,
      and still returns that repository's tags when run inside a real tagged
      repository.
- [ ] AC5: With a PATH-stubbed `tea` that sleeps and exits non-zero,
      `issue-check.mjs check` over five or more referenced numbers completes
      inside one stated wall-clock budget rather than five call timeouts, exits
      0 with `ok:true` and `action:"report"`, and reports the unreached numbers
      `unresolved`.
- [ ] AC6: RVW-03, REL-01 and ISS-01 each carry a check with a
      `WATCHED FAILING AT <sha>` header whose sha resolves to a real commit
      preceding the fix, and that check fails when re-run against that commit's
      tree.
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` and
      `node cadence-core/bin/self-verify.mjs` both exit 0.

## Flagged assumptions

None - all assumptions confirmed.
