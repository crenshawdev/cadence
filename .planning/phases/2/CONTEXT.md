# Phase 2: The stakes axis - Context

Gathered: 2026-07-28
Feeds: /cad-plan 2

## Scope boundary

In: the `model.profile` -> `stakes` key rename carrying three values, the
`auto` mode's retirement with escalate-on-failure made unconditional, a refusal
at the config write face that names the replacement, a diagnostic at both live
read faces, the prose sweep across the seven surfaces criterion 3 names, the
`[2.0.0]` CHANGELOG break notice, and the test + weight-budget lockstep those
edits force.
Out: the `(stakes, role)` bundle cell resolving `{model, effort, review,
verify}` (phase 3); risk-driven rung floors (phase 4); wiring `fire(trigger)`'s
claude-subagent arm to the reviewer rungs (phase 3); issue #63's `base_effort`
rebase (phase 3); making `fable` routable (closed by D-03, not deferred).
Deferred: None
Plan shape: multiple plans, same phase - /cad-plan decides the split; every
plan but the first stays red on AC6/AC7 until the schema + `route.mjs` core
lands, so the ordering is forced even though the work divides

## Durable decisions

- D-01 (Vocabulary): The stakes values are `solo` / `shipped` / `critical`,
  exactly three. `solo` = nobody else runs this, a break costs me time and only
  me; `shipped` = other people run this, a break comes back as a bug report;
  `critical` = a break is not a bug report. Evidence:
  `cadence-core/references/review-triggers.md:140-167` is the operative
  definition of `critical` - the auth / DB-migration / money / destructive-ops
  / secrets list phase 4 detects. Rejected `personal` / `production`: both
  `personal` and `solo` leak, but in opposite directions, and the leak
  direction decides it. `solo` misreads toward team size, so a two-person side
  project picks the rung *above* - a safe error. `personal` misreads toward the
  author, so an independent developer pins the bottom rung to everything - the
  unsafe error, and precisely the self-assessment collapse issue #81 was
  written to prevent. If wrong: phase 4's computed floor has no rung to assert
  and the ladder degrades into self-grading.
- D-02 (Vocabulary): The key is renamed `model.profile` -> bare top-level
  `stakes`, not merely revalued. Evidence: `cadence-core/config.schema.json:7`
  (`granularity` is the working precedent for a bare key); a routing cell
  yields `{model, effort, review, verify}`, so nesting under `model.` would
  assert that stakes is a model setting - the same category error one level up
  from the one the release exists to fix. `model.profile: "critical"` reads as
  a claim about the model. If wrong: the config sentence stays incoherent after
  a breaking release that could have fixed it for free.
- D-03 (Vocabulary): `fable` is NOT routable this cycle and stays reachable
  only by an explicit `model.overrides.<role>` pin. This closes the question
  rather than deferring it. Evidence: Anthropic's current model catalog does
  now rank Fable 5 above Opus 5 ("Claude Fable 5 remains the highest-capability
  tier"), so `cadence-core/route-table.json:6`'s stated reason - that the
  ranking "is not established" - is stale and is NOT why this decision holds.
  It holds on three operational facts: Fable 5 requires 30-day data retention
  and returns `400 invalid_request_error` on every request from a
  zero-data-retention org (Cadence is a public plugin, so that is other
  people's orgs); its safety classifiers return `stop_reason: "refusal"` on
  cyber-adjacent content, and Cadence reviews its own git-guard rails, secrets
  handling and shell tokenizer; and its documented multi-minute turns push
  against `review.request_timeout_ms` (540000) inside the 600000ms Bash
  ceiling, where CAPTURE.md already records a 292s-vs-118s spread for one model
  at one effort. If wrong: a shipped default hard-fails for ZDR users, and a
  blocking review gate can pass having silently lost its reviewer to a refusal
  - the exact shape CAPTURE.md recorded for the 120s timeout. Phase 3's
  criterion 4 (`fable` stays pin-only) is reinforced by this, not contradicted:
  phase 3 must not re-open it.
- D-04 (The auto retirement): The `auto` value is deleted rather than carried
  as a fourth enum member or moved to its own key.
  `model.auto.escalate_on_failure` is promoted to `model.escalate_on_failure`
  and honoured at every stakes level. Evidence: `cadence-core/bin/route.mjs:96-137`
  gates ALL escalation behind `profile === 'auto'` - the tier bump, the profile
  step, and the `escalate_to` rung swap phase 1 shipped - while the default is
  `balanced` (`config.schema.json:9`, `route.mjs:43`,
  `templates/config.json:4`), so phase 1's 13 rung files are unreachable out of
  the box and `workflows/plan.md:203,206` pass `--attempt 2` for nothing. Both
  alternatives were considered and rejected: keeping it as a fourth value
  re-creates the category error (three values answer "what does a break cost",
  the fourth answers "how should the resolver behave") and forces phase 3's
  cell to special-case it; moving it to its own key leaves the ladder
  opt-in-only and sets up a second escalation mechanism for phase 4's computed
  floor to collide with. If wrong: phase 1's whole deliverable stays dead for
  every default install.
- D-05 (Sweep scope): Cadence carries FOUR orthogonal routing axes and the
  sweep must not conflate them: stakes (`solo|shipped|critical`, renaming this
  phase), the role tier (`light|standard|heavy`, `route-table.json:8`), the
  effort rung (`low|medium|high|xhigh|max`, `route-table.json:10`), and the
  cross-model provider tier (`flagship|balanced|cheap`,
  `config.schema.json:52-84`). Evidence: 10 of the schema's `balanced`
  occurrences belong to `review.providers.*.tiers.*` and only ONE
  (`config.schema.json:10`, `model.auto.ceiling`) belongs to the spend ladder.
  Conflating the provider axis has already cost a silently dropped reviewer
  (CAPTURE.md, phase 2). If wrong: a regex sweep on `balanced` breaks
  `review-provider.mjs` model resolution, `references/model-hints.json`'s tier
  tags and `workflows/config-review.md`'s assignment flow.

## Decisions

- D-06 (Refusal faces): The default is `shipped`, written in three places that
  move together. Evidence: `config.schema.json:9`, `cadence-core/bin/route.mjs:43`
  (whose comment says it mirrors the schema), `cadence-core/templates/config.json:4`.
  Rejected: `solo` silently downgrades every existing project on upgrade;
  a required key with no default is a second breaking change and no schema key
  works that way today.
- D-07 (Refusal faces): The read-side diagnostic fires at `route.mjs resolve`
  AND `config.mjs get`, not at `validate`. Evidence: `config.mjs validate`
  appears in one surface only (`workflows/config.md:130`) and no skill or
  workflow invokes it, so a diagnostic placed there is never seen;
  `config.mjs:226-238` already threads `mergeLayers` warnings and is documented
  as how every workflow reads config; `route.mjs:49` destructures
  `mergeLayers` and drops `warnings` on the floor, so threading it also closes
  the phase-1 gap CAPTURE.md recorded (six of seven callers silently drop a
  torn config layer). `route.mjs:150-168` is the existing single-warning
  precedent.
- D-08 (Refusal faces): The write face is `checkPairs`, reached by both `set`
  and `check`, and a retired name naming its replacement is machinery that does
  not exist yet. Evidence: `cadence-core/bin/config.mjs:120-135` emits a generic
  `'unknown key'`; `:47-72` (`checkValue`) produces `must be one of: ...` for
  an enum miss; `:204` fails before any read or write, so the refusal is
  already atomic. `workflows/config.md:161-175` documents the
  `{ok:false, reason:"invalid", detail:[{key,error,value}]}` contract, and
  `cannot set through "..."` is the existing precedent for a detail that names
  its own fix.
- D-09 (Refusal faces): A retired KEY fails worse than a retired VALUE, so
  criterion 2 needs the old key recognised explicitly at read time - it cannot
  fall out of the enum check. Evidence: a retired value yields
  `{ok:false, reason:"unresolved"}` (`route.mjs:139-140`, pinned by
  `route.test.mjs:154-158`), but after the rename `route.mjs:53` reads
  `m.profile ?? DEFAULTS.profile`, never sees the old key, resolves at the
  default, and `:89` still reports `config:repo` - a default route labelled as
  a configured one.
- D-10 (Vocabulary): Bare `stakes` sits OUTSIDE self-verify's validated
  dotted-token drift check, and the prose spelling `stakes.<word>` is a hard CI
  failure. Evidence: `cadence-core/bin/self-verify.mjs:240` splits
  `BARE_KEYS`; `:290-292` covers them only by `\bkey\b`; `:278-289` is the
  dotted check a bare key never reaches. The analyzer verified empirically that
  prose reading `stakes.critical` returns
  `{"kind":"unknown-config-key","detail":"stakes.critical"}`. Writing
  convention is therefore `stakes: critical` or backticked bare values.
- D-11 (The auto retirement): The difficulty-signal path goes with `auto`.
  Evidence: `--files` and `--ambiguity` are passed by NO live workflow or
  skill - only `references/seams.md:92-98` documents them and only
  `route.test.mjs:83,134,142,149` exercises them, so that half has never run in
  production. Table-side `auto.base_profile`, `auto.signals.*` and
  `auto.max_tier_bump` (`route-table.json:28-35`) go with it.
- D-12 (The auto retirement): `model.auto.ceiling` dies with `auto` - it is the
  only other schema enum carrying spend vocabulary
  (`config.schema.json:10`). This also moots `config.mjs:143-155`
  (`crossWarnings`), which reads `profile_order` and `auto.base_profile` across
  a file boundary and would otherwise fire unconditionally once `profile_order`
  is renamed, because `[].indexOf(x)` is `-1` for both sides and `-1 <= -1`
  holds. `config.test.mjs:427-443` pins that behaviour today.
- D-13 (Lockstep): `DESIGN.md` gets an appended dated status marker, not a
  rewrite. Evidence: `cadence-core/bin/self-verify.mjs:162-168` deliberately
  excludes DESIGN / LINEAGE / CHANGELOG from the prose walk because "they
  legitimately name keys that were later cut, while explaining the cut";
  `DESIGN.md:334-380` is a marker stack, and phase 1 added
  `SUPERSEDED (2026-07-28)` to this same subsystem.
- D-14 (Lockstep): The `[2.0.0]` entry is authored under `## [Unreleased]`, not
  under a literal `## [2.0.0]` heading. Evidence:
  `cadence-core/bin/lib/release-decision.mjs:95-98` makes
  `prependChangelogEntry` a no-op when a `## [2.0.0]` heading already exists,
  and `:106-122` inserts the heading BELOW Unreleased without moving its
  contents; `workflows/milestone.md:36-42` states the seam scaffolds and the
  human authors; commit `497a4ea` records the promotion being done by hand.
- D-15 (Lockstep): Every weight budget is exact-fit, so any prose edit inside a
  budgeted surface must regenerate `cadence-core/bin/weight-budgets.json` in the
  same change. Evidence: `workflows/config.md` measures 16681 against a budget
  of exactly 16681; all 63 entries match byte-for-byte;
  `self-verify.mjs:388-399` enforces. Same shape as commit `994761d` last week.
  `cadence-core/references/*.md` are NOT in the manifest, so `seams.md` and
  `review-triggers.md` edits are unbudgeted.
- D-16 (Lockstep): Three test files encode the retired vocabulary as passing
  assertions and must move in the same commit as the schema. Evidence:
  `bin/self-verify.test.mjs:160-176` enumerates every schema key as a coverage
  fixture (adding `stakes` without adding it there yields `inert-config-key`);
  `bin/config.test.mjs:212` asserts the literal array
  `['fast','balanced','quality','auto']`; `bin/route.test.mjs` builds ~45
  configs through a `cfg({profile: ...})` helper, including the
  ladder-consistency rows at `:332-408` and the fable-pin row at `:249-265`
  that phase 3's criterion 4 inherits. `config.test.mjs:212` in particular must
  be re-derived from the new schema, not search-and-replaced - that is how a
  test encodes a defect as a passing assertion (CAPTURE.md, phase 2, v1.3.1).

## Acceptance criteria

- [ ] AC1: `node cadence-core/bin/config.mjs check model.profile=balanced`
      returns `{ok:false, reason:"invalid"}` whose `detail[].error` names
      `stakes` as the replacement rather than the generic `unknown key`; and a
      retired VALUE (`stakes=quality`) is refused with a message naming the
      three valid ones
- [ ] AC2: Given a repo config still holding `model.profile: "balanced"`, both
      live read faces speak - `node cadence-core/bin/config.mjs get stakes` and
      `node cadence-core/bin/route.mjs resolve --role cad-planner` each emit one
      warning naming `model.profile` and pointing at `stakes`; neither resolves
      silently at the default, and route's reason string does not report
      `config:repo` for a value it never read
- [ ] AC3: `grep -rn "model\.profile\|profile_order\|model\.auto\."
      --include="*.md" --include="*.json" --include="*.mjs" .` returns matches
      only under `.planning/`, in `CHANGELOG.md`, and in `DESIGN.md`'s dated
      marker; and `git diff` touches no `review.providers.*.tiers.*` line, no
      `tier_order` line and no `rung_order` line
- [ ] AC4: With NO `stakes` key set anywhere,
      `resolve('cad-plan-checker', cfg, ['--attempt','2'])` returns
      `agent: 'cad-plan-checker-high'`, `escalated: true` - phase 1's rung
      ladder is reachable at the shipped default, which it is not today
- [ ] AC5: `config.schema.json` holds `stakes`
      (`["solo","shipped","critical"]`, default `"shipped"`) and
      `model.escalate_on_failure`, and holds no `model.profile`, no
      `model.auto.ceiling` and no `model.auto.max_escalations`
- [ ] AC6: `node --test cadence-core/bin/*.test.mjs` exits 0 and
      `npx tsc -p tsconfig.ci.json` exits 0
- [ ] AC7: `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
      `unknown-config-key`, no `inert-config-key` and no budget overage; and
      `CHANGELOG.md`'s `## [Unreleased]` names the break plus the exact command
      a user runs on upgrade

## Flagged assumptions

- `.planning/ROADMAP.md` phase 2 criterion 1 ("`config.schema.json`'s
  `model.profile` enum holds only the stakes values") and `.planning/PROJECT.md`'s
  Constraints line ("`model.profile`'s enum values change with no back-compat
  alias") both still describe a revalue rather than a rename plus an `auto`
  retirement - Confident; reported, not edited, by the user's choice this pass.
  REQUIREMENTS.md STK-01 WAS corrected here, so the audit source of truth is
  accurate. If not reconciled, /cad-verify 2 walks a criterion naming a key the
  phase deleted.
- The three-plan split sketched under Plan shape (schema+route core / prose
  sweep + budgets / CHANGELOG + DESIGN) is illustrative, not prescriptive -
  Likely; /cad-plan owns the actual breakdown, and `plan-overlap` will refuse
  any split that puts `route-table.json` or `route.mjs` in two plans at once.
- A typo in bare `stakes` prose is caught by nothing, the same hole
  `granularity` has carried since v1.0.0 - Confident; D-10 states the
  consequence but this phase does not close it. Worth a CAPTURE item rather
  than scope growth here.
- Whether `model.escalate_on_failure` keeps a companion `max_escalations` key
  is left to the planner - Unclear; `model.auto.max_escalations` exists today
  with default 1, and D-04 retires the `auto.` prefix without settling whether
  the cap survives under the new key or is dropped as unused.
