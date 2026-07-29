---
phase: 2
status: complete
completed: 2026-07-28
---

# Phase 2: The stakes axis - Summary

The routing axis is renamed, not revalued: `model.profile` over
`fast`/`balanced`/`quality` is gone and a bare top-level `stakes` key over
`solo`/`shipped`/`critical` replaces it, with no back-compat alias, the `auto`
mode deleted, and escalate-on-failure promoted to `model.escalate_on_failure`
and honoured unconditionally.

## What shipped

- **The retired vocabulary, stated once** - `cadence-core/bin/lib/retired-keys.mjs`,
  a zero-dep frozen map of the four retired dotted keys to their replacement or
  their removal reason, read by both the write face and both read faces.
- **The `stakes` key** - `cadence-core/config.schema.json` and
  `cadence-core/templates/config.json`, bare and top-level beside `granularity`,
  defaulting to `shipped` in all three places (schema, template, `route.mjs`
  DEFAULTS).
- **A stakes-keyed matrix** - `cadence-core/route-table.json`'s `profiles` object
  is now `stakes`, keyed `solo`/`shipped`/`critical`, each row carried verbatim so
  `shipped` resolves byte-identically to what `balanced` did. `profile_order` and
  the whole `auto` block are gone.
- **Unconditional escalation** - `cadence-core/bin/route.mjs`: `clampIdx`,
  `bumpTier`, `stepProfile`, the `auto` branch and the ceiling arithmetic deleted;
  `--files` and `--ambiguity` dropped from `parseArgs` and from the self-verify
  contract; the singular `warning` field is now a `warnings` array.
- **A refusal that names its own fix** - `cadence-core/bin/config.mjs`:
  `checkPairs` calls `retiredKeyError` before the schema lookup, so a retired key
  is refused by name rather than as a generic `unknown key`; `check` now speaks
  the same `{ok:false, reason:"invalid", detail:[...]}` contract `set` does;
  `crossWarnings` is deleted entirely.
- **The prose swept to the stakes question** - `workflows/config.md`,
  `workflows/plan.md`, `skills/cad-config/SKILL.md`, `references/seams.md`,
  `references/review-triggers.md`, `INTERNALS.md`, with all 63
  `weight-budgets.json` entries regenerated to exact fit.
- **The break stated where a user meets it** - `CHANGELOG.md` under
  `## [Unreleased]` (Removed / Changed / Upgrading), and a dated
  `AXIS REPLACED (2026-07-28)` marker appended to `DESIGN.md`'s model-routing
  record.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 9a26dce | state the retired config vocabulary once, in a shared lib |
| 1 | 2 | 6070567 | rename the routing axis to a bare stakes key in the schema |
| 1 | 3 | caef376 | resolve stakes in route.mjs, retire auto, escalate unconditionally |
| 1 | 4 | 4ee6eef | refuse a retired key at the write face, name it at the read face |
| 1 | 5 | 2fb8c7f | sweep the budgeted surfaces to the stakes question |
| 1 | 6 | 1508e38 | sweep the reference and internals prose, close the route flag contract |
| 2 | 1 | a0033fb | state the v2.0.0 stakes break and the upgrade action under Unreleased |
| 2 | 2 | 2e6b124 | record the spend-to-stakes axis replacement in DESIGN's routing record |

Range: `517bada..2e6b124`, 8 commits, 20 files.

## Deviations

- [deviation] Task 2 directed a rewrite of "the four `model.overrides.<role>`
  lines (`:14-17`)"; only one (`config.schema.json:14`, `cad-planner`) actually
  carried the retired wording. The one line was rewritten, the others left
  byte-identical rather than inventing edits. (6070567)
- [deviation] Task 3's `route.test.mjs` enumeration omitted two rows, `:89-95`
  and `:120-130`, both ceiling/`auto` machinery this phase reverses. Both were
  deleted; their surviving claim is carried by the new default-escalation and
  every-stakes-level rows. (caef376)
- [deviation] Task 4's Verify predicted one warning from `get stakes` against a
  stale fixture; run non-hermetically it printed three, because the dev's real
  user-global config also holds `model.auto.escalate_on_failure` and
  `model.auto.max_escalations`. Hermetically it prints exactly one and the test
  row pins that. This is a live preview of what this machine warns on upgrade,
  not a defect. (4ee6eef)
- [deviation] AC3's diff arm read literally ("`git diff` touches no `tier_order`
  line") matches one line, `-  const order = TABLE.tier_order;` - the deleted
  `bumpTier` body task 3 itself mandates removing. Confirmed: `git diff
  517bada..HEAD -- cadence-core/route-table.json cadence-core/config.schema.json`
  shows no changed `tier_order`, `rung_order` or `review.providers.*.tiers.*`
  line. (caef376)
- [deviation] Risk-surface gate: the executor judged no match against
  `references/review-triggers.md` and committed rather than checkpointing,
  reading "public API/wire contracts" as external protocols rather than a
  plugin's own config schema whose break is the milestone's declared purpose.
  The orchestrator concurred, and the diff went to a two-reviewer adjudicated
  pass regardless.
- [deviation] PLAN-2 task 1's `### Removed` subsection carries a fifth bullet the
  plan did not enumerate: `route.mjs resolve` no longer accepts `--files` or
  `--ambiguity`. PLAN-1's 1508e38 narrowed that CLI contract in the same release,
  so naming it keeps a scripted caller from finding out at runtime. (a0033fb)

## Open items

Ordered by severity. Items 1-13 are the adjudicated survivors of the two `diff`
review fires (gate `advisory`, mode `adjudicated`; reviewers `cad-reviewer` and
`openai/gpt-5.4-mini`, both grounded against the repo).

1. **HIGH - the release note's headline claim is false for 5 of 6 roles.**
   `CHANGELOG.md:52` says "the per-role effort rung ladder is reachable on a
   default install" and "a retry swaps to the role's `escalate_to` rung at every
   stakes level"; `DESIGN.md:391`'s marker repeats it. In
   `cadence-core/route-table.json`, `escalate_to === base_effort` for
   `cad-planner`, `cad-verifier`, `cad-executor`, `cad-reviewer` and
   `cad-assumptions-analyzer`, so `route.mjs resolve --role <any of those>
   --attempt 2` takes the no-op arm and reports `escalated:false`, `rung held at
   high`. Only `cad-plan-checker` swaps (`rung low->high`). 6 of the 13 shipped
   rung files are reachable by no config and no attempt count. The wording is
   literally defensible and practically misleading; it needs either a corrected
   sentence or a route-table change, and the decision is not this phase's to make
   alone.
2. **HIGH - `route.mjs`'s `warnings` array reaches no user.** The retired-key
   diagnostic is emitted correctly but no surface instructs the orchestrator to
   relay it: `references/seams.md`'s routing bullets say only `escalated`/`reason`
   are "for logging" and give `warnings` no surfacing rule, while the adjacent
   "Tell the user when a pin fires" bullet proves the repo's own standard is that
   a diagnostic reaches the user only when a bullet says to show it. A stale
   config therefore moves `cad-planner` from sonnet to opus on every dispatch with
   the notice sitting unread in JSON.
3. **MEDIUM - a mutation-proved test-coverage loss in `config.test.mjs:41`.** The
   rewritten row's fixture holds no `model` key, so `model.escalate_on_failure`
   takes the auto-vivify path, not the write-through-an-existing-parent path the
   pre-change fixture exercised - and its new comment claiming otherwise is false.
   Proved by mutation: making `setInto` clobber an existing intermediate object
   fails the suite at 517bada and passes all 36 rows at HEAD.
4. **MEDIUM - a second mutation-proved loss in `route.test.mjs:208`.** The row
   named "layers deep-merge" no longer puts the same parent object in both layers,
   so replacing `deepMerge`'s recursion with a flat spread leaves all 64 rows
   across both files green.
5. **MEDIUM - `get <retired key>` answers generically.** `config.mjs get
   model.profile` returns `{"ok":false,"reason":"unknown-key"}` and names no
   replacement, while `check model.profile=balanced` two subcommands over names
   `stakes` and all three values. Converged independently by both reviewers.
6. **MEDIUM - an explicit opt-out inverts on upgrade.** A user who set
   `model.auto.escalate_on_failure: false` gets escalation ON, because the key is
   recognised as retired and then discarded in favour of the new `true` default.
   The CHANGELOG's step 2 tells them to carry the value across, so it is
   documented - but combined with item 2, a user who does not read the CHANGELOG
   gets no notice at all.
7. **MEDIUM - the Upgrading procedure cannot detect a botched step 2.**
   `config.mjs set` validates only the incoming pairs, so step 3 returns
   `{ok:true}` against a file still holding the whole stale `model` block, while
   `validate` on that same file reports four `unknown key` errors. The procedure
   wants a terminal validate step it does not name.
8. **LOW - `validate` still answers a retired key with the generic `unknown
   key`.** D-07 scoped it out on the evidence that no workflow invokes it, which
   is true, but `workflows/config.md`'s cheat-sheet advertises it as "whole file
   ok?" - which is what a model runs when a user asks exactly that.
9. **LOW - the `unresolved` early return drops `cfg._warnings`.** A half-migrated
   config (`{"stakes":"quality","model":{"profile":"fast"}}`) returns
   `{ok:false, reason:"unresolved"}` with no `warnings` field at all, on the one
   code path where the config is provably wrong.
10. **LOW - `INTERNALS.md:13` lists `fable` as a stakes-matrix target.** "Each
    answer maps an agent's tier ... to a Claude alias (haiku, sonnet, opus,
    fable)" contradicts `route-table.json`'s `_meta.aliases` ("deliberately absent
    from the stakes matrix ... reachable only by explicit pin"),
    `references/seams.md` and `route.test.mjs`, which asserts no cell of
    `table.stakes` holds `fable`. Introduced by this phase's own task 6, against
    a decision (D-03) this phase spent effort getting right elsewhere.
11. **LOW - `INTERNALS.md:13`'s guardrail sentence describes deleted machinery.**
    "Role tiers act as floors so a formatter never gets promoted to opus" was a
    guarantee about `auto`'s tier bump; with `bumpTier` gone there is no promotion
    for a floor to bound. Task 6 mandated keeping the sentence, so this is a
    plan-level miss rather than an execution one. ("Your explicit pick always
    wins" is still true.)
12. **LOW - `CHANGELOG.md:28` overstates the flag removal.** `parseArgs` matches
    only `--role`, `--attempt` and `--file` and silently drops anything else, so
    `--files`/`--ambiguity` are ignored, never refused - a carried-over wrapper
    script gets `ok:true` and no warning.
13. **LOW - `/cad-config solo` is not a supported argument form.** Step 3's
    elision ("Run `/cad-config stakes=shipped`, or `solo`, or `critical`") reads
    literally as a bare word, which matches no branch of `workflows/config.md`'s
    Route step.
14. `set` does not warn about retired keys already present in the target file.
    The plan mandates this (`crossWarnings` was deleted) and `get` plus every
    `route.mjs` dispatch do warn, so it is unmissable in practice. Recorded as a
    decision, not a defect.
15. Self-verify's bare-key coverage for `stakes` is partly accidental:
    `BARE_KEYS` coverage is a `\bstakes\b` regex and
    `cadence-core/workflows/new-project.md` already contains the unrelated phrase
    "table stakes". Real prose naming the key landed in tasks 5 and 6, so coverage
    is honest today, but the check would stay green if that prose were deleted.
    Same hole `granularity` has carried since v1.0.0.
16. Phase-1 UAT item 11 (`route.mjs` accepts any `escalate_to` without comparing
    it against `rung_order`) now fires for every user, since escalation is
    unconditional. Narrower than PLAN-1's note suggested: `lib/rung-agent.mjs`'s
    `rungIssues` already emits `rung-demotion` and self-verify has a row for it,
    so CI catches a demoting table; `route.mjs` remains deliberately fail-open.
    Belongs to its phase-1 owner.
17. `.planning/ROADMAP.md:61` and `.planning/PROJECT.md:143` still describe
    `model.profile`'s enum being revalued rather than the key being renamed and
    `auto` retired. `REQUIREMENTS.md` STK-01 was already corrected, so the audit
    source of truth is accurate. Left by the user's choice at plan time;
    `/cad-verify 2` will otherwise walk a criterion naming a key this phase
    deleted.
18. `DESIGN.md:493` ("**Config decisions:** model routing -> minimal (3 profiles
    + auto)") still spells the retired vocabulary. Left alone deliberately per
    PLAN-2's Action: the marker is the record, not a search-and-replace pass.

Three further review findings were adjudicated out as false: that `config.mjs
get` crashes on `SCHEMA[k].default` for a retired key (the `unknown-key` guard
runs first; the live call returns a structured refusal); that a legacy `auto`
config *silently* loses the escalation gate (it resolves with four warnings
naming every retired key, and `reason[0]` reads `stakes default "shipped" (unset
in layers: repo)` with no `config:` token); and that the CHANGELOG's claim about
`config.mjs validate` is wrong (verified live - `validate` does report each
retired key as `unknown key`).

## Goal check

The sum of these eight commits delivers the phase goal. The axis is renamed
rather than revalued: `config.mjs keys` shows `stakes` with values
`["solo","shipped","critical"]` and default `"shipped"` and shows none of the
four retired keys, and `route-table.json` now carries `TABLE.stakes` keyed
`solo`/`shipped`/`critical` with `TABLE.profiles` undefined. The break is refused
at the write face with a message naming its own fix - `config.mjs check
model.profile=balanced` returns `{"ok":false,"reason":"invalid"}` whose
`detail[0].error` reads `retired in v2.0.0: use "stakes" instead (... solo,
shipped, critical)` - while a live bad value still reads as a plain value error
(`check stakes=quality` -> `must be one of: solo, shipped, critical`), so the two
failure modes stay distinct. AC2's read-face arm holds under exactly the input
meant to break it: a config holding the full stale `auto` block resolves with
four warnings naming every retired key and its replacement, and `reason[0]` reads
`stakes default "shipped" (unset in layers: repo)` with no `config:` token, which
is the honest-reason contract the plan mandated. AC3's grep arm is clean - `git
grep -In "model\.profile\|profile_order\|model\.auto\."` outside `.planning/`
returns hits only in the six surfaces whose job is to name the retired
vocabulary (`lib/retired-keys.mjs`, its test, `config.test.mjs`,
`route.test.mjs`, `CHANGELOG.md`, `DESIGN.md`), with zero hits in any workflow,
reference, skill, template, schema or resolver. All three CI arms verified by
direct run at HEAD: `node --test cadence-core/bin/*.test.mjs` reports 802 pass /
0 fail, `npx tsc -p tsconfig.ci.json` exits 0, and `node
cadence-core/bin/self-verify.mjs` prints `ok:true` with `problems: []`.

Two things are missing, and neither is a gap in the rename. The first is that
the phase's own release note oversells its payoff (open item 1): the CHANGELOG
and the DESIGN marker both say the rung ladder is now reachable on a default
install, and `route-table.json` sets `escalate_to === base_effort` for five of
the six roles, so `route.mjs resolve --attempt 2` reports `escalated:false` and
`rung held at high` for all of them - only `cad-plan-checker` swaps. The
plumbing this phase built is correct and unconditional; what it is plumbed into
is mostly flat, which is a phase-1 data question surfacing here rather than a
phase-2 execution failure. The second is that the diagnostic this phase exists
to produce is produced but never displayed (open item 2): nothing in
`references/seams.md` tells the orchestrator to relay `route.mjs`'s `warnings`
array, so AC2 is satisfied at the JSON boundary and not at the user's seat. Both
are one-surface fixes and both want a decision rather than a patch, so they are
recorded here rather than absorbed.
