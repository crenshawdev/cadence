# Phase 2: Adaptive routing is reachable - Context

Gathered: 2026-08-29
Feeds: /cad-plan 2

## Scope boundary

In: RNG-04. `cadence-core/templates/config.json` stops writing `stakes`, so a
project `/cad-new-project` or `/cad-adopt` initialises reaches the unset-`stakes`
resolution `config.schema.json:8` documents. `route.mjs` emits set-ness on the
resolve envelope so unset is machine-checkable rather than a free-text `reason`
sentence, `config.mjs get stakes` answers unset instead of reporting the default
as a configured value, and both init workflows say what is actually written.
Out: the resolver's own arithmetic, which v3.5.7 phase 3 already shipped and
this phase only makes reachable - the unset->`solo` discount, the fail-closed
hold at `shipped` on an unreadable plan, and the explicit floor are unchanged
behaviour proved from existing tests. Also out: any change to the `route-table.json`
grids, to the surfaces seam, and any second init question.
Deferred: migration for projects already initialised. They keep
`"stakes": "shipped"` pinned in their own `.planning/config.json` and this phase
adds no seam to clear it - no `config.mjs unset <key>` subcommand and no
`/cad-config` "leave it to the resolver" option. RNG-04 lands for new projects
only; the existing-project half is a later phase's call if it is wanted.
Plan shape: one plan - a template deletion, one envelope field across two faces,
one warning-arm widening, two prose edits with their budget re-pins, and tests in
two existing suites over a fixture builder that already exists.

## Durable decisions

- D-01 (template shape): `stakes` is DELETED from
  `cadence-core/templates/config.json`, never written as `null` and never
  replaced by a placeholder. Rejected: a nulled key - `route.mjs:252` treats
  `undefined` and `null` alike as unset, but `config.mjs` refuses the value.
  Measured 2026-08-29: `config.mjs validate --file <template with "stakes": null>`
  returns `{"ok":false,...,"errors":[{"key":"stakes","error":"must be one of:
  solo, shipped, critical","value":null}]}`, and `config.mjs set stakes=null`
  returns the same refusal - so a nulled key makes the first config read on every
  brand-new project fail. Evidence: `cadence-core/templates/config.json:3`;
  the shipped precedent for an omitted key is the absent `review.triggers` block,
  pinned by `cadence-core/bin/route.test.mjs:1027-1041` ("the template must write
  no gate at all"). This is the project's absent-is-not-zero rule applied to a
  template.
- D-02 (the consequence is accepted whole): on a fresh project a phase whose
  plans all read clean now routes `solo` - sonnet instead of opus, plan review
  `advisory` instead of `blocking`, deep verify `off` instead of `on` - and
  nothing re-floors those back up. Measured 2026-08-29 on a fixture repo built
  from the shipped template with `stakes` deleted, one plan declaring
  `docs/README.md`: `route.mjs resolve --role cad-executor --phase 3` returns
  `{"stakes":"solo","model":"sonnet","review":{"plan":"advisory","diff":"off",
  "risk_surface":"blocking","phase_diff":"off"},"verify":"off"}`. Evidence: the
  grids are `cadence-core/route-table.json` `review.solo` and `verify.solo`;
  consistent with `v3.5.7/phases/3/UAT.md`. If wrong: every new project silently
  loses a blocking plan review and a deep verify pass nobody asked to drop -
  which is exactly the trade RNG-04 asks for, stated here so a later reader does
  not read it as a regression.
- D-03 (no second init question): neither init workflow starts ASKING for a
  stakes level; the key stays unset silently and is only REPORTED. Evidence:
  `cadence-core/workflows/new-project.md:58-64` and
  `cadence-core/workflows/adopt.md:54-59` both state one deliberate exception to
  "ask no configuration questions" - the forge, on FRG-02 grounds - and say
  "Every other key keeps the template's value". A second question contradicts a
  stated invariant in both files and re-pins the level this phase exists to leave
  unset.
- D-04 (proof of unset): `stakes_set` joins the `route.mjs resolve` envelope,
  spelled snake_case on the envelope's own convention beside the shipped
  precedent `surfaces_answered`, and `replay` carries it too. Rejected: proving
  unset from the existing first `reason` entry (`stakes default "shipped" (unset
  in layers: repo)`, pinned by `cadence-core/bin/route.test.mjs:725`) - no
  envelope change, but the only proof shipped to a caller stays free text; and
  keeping the internal spelling `stakesSet`, which matches the criterion's
  literal text but breaks the envelope's convention. Evidence: `stakesSet` lives
  only inside `readConfig` (`cadence-core/bin/route.mjs:252`, consumed at `:717`,
  `:789`, `:908`) and is not emitted - measured 2026-08-29, the envelope keys are
  exactly `ok, role, agent, model, effort, review, reviewers, reviewer_tiers,
  reviewer_efforts, surfaces, surfaces_answered, verify, stakes, escalated,
  pinned, attempt, reason` (built at `route.mjs:1375`); `surfaces_answered` at
  `:74` and `:1277` is the precedent for "did a layer answer this, or is this the
  seam's own answer". Replay carries it because `route.mjs:1460` already emits
  both `stakes` and `surfaces_answered` from that path and the `levelFor`
  docblock (`:590-600`) states the rule that resolve and replay land in one
  implementation, "so a replay would not come to report a level no resolve would
  produce".
- D-05 (the read agrees with the write): `config.mjs`'s unset-warning arm widens
  to cover `stakes` with its own noun. Today the arm exists at
  `cadence-core/bin/config.mjs:448-453` but is gated by
  `LEVEL_KEY = /^review\.triggers\.[^.]+\.(gate|tier|effort)$/` at `:379`, which
  `stakes` does not match; the noun pattern to match is `LEVEL_KEY_NOUN` at
  `:385`. Measured 2026-08-29: `config.mjs get stakes` returns
  `{"ok":true,"values":{"stakes":"shipped"},"source":"repo"}` identically for the
  stakes-less config and today's template. Rejected: leaving the seam alone and
  letting only `route.mjs resolve`'s `reason` distinguish the two states - that
  has the init workflow tell the user `stakes` is unset while the very next
  `/cad-config` read tells them it is `shipped` from the repo layer, which is the
  "a default reported as a configured value" failure `route.mjs:243-252` and
  `:905-910` exist to prevent, reproduced one seam over.
- D-06 (migration scope): projects initialised before this phase keep
  `"stakes": "shipped"` pinned and this phase adds NO seam to clear it. Rejected:
  a `config.mjs unset <key>` subcommand (costs a `lib/arg-contract.mjs`
  `CONTRACTS` row, which `self-verify` check 14 enforces) and a `/cad-config`
  "leave it to the resolver" option that rewrites the file without the key.
  Evidence: `cadence-core/bin/config.mjs:541` dispatches
  `validate | check | set | get | keys` and nothing else; measured
  `config.mjs set stakes=null` returns `{"ok":false,"reason":"invalid",...}`; none
  of the six ROADMAP criteria names a migration. Cadence's own repo is unaffected
  either way - `.planning/config.json:40` sets `"stakes": "critical"` explicitly.
  Consequence accepted knowingly: an existing project reaches the documented
  behaviour only by hand-editing JSON.

## Decisions

- D-07 (replacement prose): the new sentences in both init workflows state the
  unset state and the LEVEL it resolves to in the schema's own terms - floors at
  `solo` when every plan in scope read clean, holds the `shipped` default when any
  could not - and do NOT enumerate the gate and verify consequences. Evidence:
  `cadence-core/config.schema.json:8` is the source wording;
  `cadence-core/references/config-catalog.md:70-72` is the shipped phrasing
  precedent for an unset row ("unset->the stakes level decides, per trigger
  (`route.mjs resolve` answers it)"). The current sentences are
  `cadence-core/workflows/new-project.md:65-66` and
  `cadence-core/workflows/adopt.md:60-62`, byte-identical to each other. Naming
  both arms is what stops an unreadable plan silently pricing a phase at `shipped`
  from reading as a bug.
- D-08 (budget re-pin): any growth in `new-project.md` or `adopt.md` re-pins its
  `cadence-core/bin/weight-budgets.json` row in the SAME commit. Measured
  2026-08-29, budget rows equal on-disk bytes exactly:
  `workflows/new-project.md` 26241/26241, `workflows/adopt.md` 21030/21030,
  `templates/config.json` 1420/1420. The check is a ceiling
  (`cadence-core/bin/self-verify.mjs:813-818`, `if (bytes > budget)`), so the
  template SHRINKING by the deleted key is free and needs no re-pin, but there is
  zero headroom on either workflow. Precedent for the same-commit re-pin:
  `.planning/tasks/bound-plan-size/RECORD.md:9`.
- D-09 (no citation guard): rewriting those sentences trips no citation guard, and
  the `.planning/DOCS-CLAIMS.md` rows quoting them are left as the records they
  are. Evidence: `cadence-core/bin/citation-census.test.mjs:1-40` scopes both
  grammars to `planning.mjs` / `planning/<module>.mjs` citations only, and its
  DOCS-CLAIMS arm covers "only the rows whose `doc` cell names this seam"; the
  rows at `.planning/DOCS-CLAIMS.md:1381` (NEW-PROJECT-27) and `:1126` (ADOPT-09)
  already carry `corrected - ee0199b` resolutions.
  `cadence-core/references/config-catalog.md:25`'s `stakes` Default column is not
  pinned to the schema either -
  `cadence-core/bin/prose-agreement.test.mjs:1927-1958` pins only
  `workflow.max_plan_tasks` that way.
- D-10 (where the proof lives): criteria AC3 and AC6 are proved by tests in the
  EXISTING suites, not by a new `self-verify` check - the fixture resolves in
  `route.test.mjs`'s floor section, the README claim in
  `prose-agreement.test.mjs`. Evidence:
  `cadence-core/bin/route.test.mjs:1495-1530` already ships `floorRoot`, a
  whole-repo fixture builder taking a config, plans and repo files, and
  `:1027-1041` already uses the shipped template AS the fixture;
  `cadence-core/bin/prose-agreement.test.mjs:104-127` (`resolvedReview`) is the
  shipped pattern for holding doc prose against real `route.mjs resolve` output;
  every `self-verify` check in its `checked:` list
  (`cadence-core/bin/self-verify.mjs:1398`) is static cross-file consistency and
  none spawns a fixture. A `self-verify` check would end up asserting prose shape
  rather than behaviour, which is what AC6 says not to do. A new test file needs
  no group registration - `cadence-core/bin/test.mjs:39-43` falls an unnamed stem
  into `other`, which CI runs.
- D-11 (floor tests unchanged): every existing floor test writes its own `stakes`
  into its own fixture config and never reads the template, so AC4's "unchanged
  and green" holds without edits. Evidence: `cadence-core/bin/route.test.mjs:1543`
  (`stakes: 'critical'` never resolved below), `:1586` (unset -> solo),
  `:1584-1590` (`stakes: 'solo'` still raises), `:2171` (a waived surface holds at
  the configured stakes); all build through `floorRoot`, which writes its own
  `.planning/config.json`. The one test that reads the shipped template,
  `:1027-1041`, asserts `rs.stakes === 'shipped'` and stays green off `DEFAULTS` -
  measured 2026-08-29, a phase-less resolve on the stripped template still returns
  `{"stakes":"shipped","model":"opus"}` - but its inline comment "the template
  ships at shipped" becomes false and is the one line in that suite this phase
  must touch.

## Acceptance criteria

- [ ] AC1: `cadence-core/templates/config.json` contains no `stakes` key, and
      `config.mjs validate` on a config merged from that template returns
      `ok:true`.
- [ ] AC2: `route.mjs resolve` returns `stakes_set: false` when no config layer
      sets `stakes` and `stakes_set: true` when one does; `route.mjs replay`
      reports the same field over the same data.
- [ ] AC3: On a fixture repo built from the shipped template, a phase whose plans
      all read clean resolves `stakes: "solo"`, and the same phase with one
      unreadable plan resolves `stakes: "shipped"` at `ok:true`. Both shown from
      `route.mjs resolve` output, not from prose.
- [ ] AC4: `config.mjs get stakes` with no layer setting it returns the unset
      warning naming `route.mjs resolve` as the seam that answers it; with
      `stakes` set it returns the value and no warning.
- [ ] AC5: `cadence-core/workflows/new-project.md` and
      `cadence-core/workflows/adopt.md` no longer state that shipped stakes were
      written; each states `stakes` is unset and names both arms of what unset
      resolves to. Neither file exceeds its `weight-budgets.json` row.
- [ ] AC6: A test holds the README's adaptive-routing claim against real
      `route.mjs resolve` output over a template-initialised fixture. The four
      existing floor tests (`route.test.mjs:1543`, `:1586`, `:1584-1590`,
      `:2171`) are green unchanged, and `:1027-1041`'s "the template ships at
      shipped" comment no longer contradicts the file.
- [ ] AC7: `node cadence-core/bin/test.mjs` is green and `self-verify` reports
      `ok:true`.

## Flagged assumptions

- D-04 fixes THAT the envelope carries set-ness and that replay carries it too,
  but not whether `readConfig` returns the flag outward or the envelope builder
  re-derives it at `route.mjs:1375`. AC2 pins the observable and leaves the shape
  to /cad-plan.
- D-05's widening is Likely on SHAPE: widening `LEVEL_KEY` itself would pull
  `stakes` into an arm written for `review.triggers.*.{gate,tier,effort}` keys and
  their `LEVEL_KEY_NOUN` phrasing. If the planner finds the two nouns do not share
  a sentence, the named alternative is a separate unset arm for `stakes` beside
  the existing one rather than a widened regex. If wrong, the warning text reads
  as written for a different key.
- D-10 leaves the README test's home to the planner: `prose-agreement.test.mjs`
  is the precedent, but that file's `resolvedReview` helper resolves against the
  live repo config, and AC6 needs a template-initialised fixture. Whether the
  helper generalises or a second one lands beside it is /cad-plan's call.
