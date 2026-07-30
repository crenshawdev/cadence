---
phase: 6
status: complete
completed: 2026-07-29
---

# Phase 6: The remaining silent drops - Summary

Every config key's real reach is now stated where the key is set, proved
re-runnably by a 72-row reach table and a new `self-verify` check, and the
three remaining resolved-then-dropped paths (a global-layer risk waiver, a
string-compared write-face refusal, a URL hostname read as a key) are closed.

## What shipped

- URL masking in `self-verify` check 1 - `cadence-core/bin/self-verify.mjs:312`,
  so an `https://` hostname stops tokenizing as a `git.*` config key
- Nine rewritten key `purpose` strings stating each key's real reach at the
  point of setting - `cadence-core/config.schema.json`
- The reach table and the check that totals it -
  `cadence-core/bin/lib/config-reach.mjs`,
  `cadence-core/references/config-reach.md` (72 rows, one per schema key),
  `self-verify` check 9 (`config-reach`)
- Per-trigger knob claims scoped to the cross-model backend -
  `skills/cad-plan-review/SKILL.md`, `skills/cad-decision-review/SKILL.md`,
  and `cadence-core/templates/config.json` (scaffolded triggers carry `gate`
  only)
- `/cad-decision-review`'s subagent arm states what it resolves -
  `cadence-core/workflows/decision-review.md`
- Repo-layer-only `risk.override.<surface>` in the resolver, with the ignored
  global waiver named in `warnings` - `cadence-core/bin/route.mjs:105`,
  `cadence-core/bin/lib/config-merge.mjs` (additive `layers`)
- Filesystem-identity path comparison in the config write face (`fsIdentity`,
  three-step fallback) - `cadence-core/bin/config.mjs:213`
- Documented plugin home moved to `git.jcrenshaw.dev` - `README.md`,
  `.claude-plugin/plugin.json`
- HST-01 in the traceability record - `.planning/REQUIREMENTS.md`,
  `.planning/PROJECT.md`, `.planning/ROADMAP.md`
- The record - `CHANGELOG.md`, `DESIGN.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 1ffa48f | fix(6): stop reading a URL hostname as a config key token |
| 1 | 2 | ea6a221 | docs(6): state each config key's real reach at the point of setting |
| 1 | 3 | 659d8f6 | feat(6): prove every config key's reach is stated where it is set |
| 1 | 4 | 8c99cd6 | fix(6): stop handing out a per-trigger knob the default reviewer drops |
| 1 | 5 | a96face | docs(6): say what /cad-decision-review's subagent arm actually resolves |
| 1 | 6 | e09a0e5 | fix(6): stop honouring a global-layer risk waiver in every repo |
| 1 | 7 | 10f03d5 | fix(6): compare the global config path by identity, not by string |
| 1 | 8 | 79df1e6 | docs(6): move the plugin's documented home to git.jcrenshaw.dev |
| 1 | 9 | ed2ae8a | docs(6): add HST-01 to the traceability record |
| 1 | 10 | 9548db6 | docs(6): record the scoping, the repo-scope close, and the hosting move |

Range: `ec4b4b5..9548db6`, 10 commits, 23 files, +857/-77.

## Deviations

- [deviation] Task 3 (`659d8f6`), blocker fixed inline: writing the six
  `model.overrides.<role>` keys literally in prose reported
  `unknown-config-key: model.overrides.cad`, because check 1's segment class
  `[a-z_0-9<>]` truncates a hyphenated key and the reach table must name keys
  verbatim. The `known` test now also accepts a token ending at a non-word
  boundary inside a real key (`.` and `-` end a token, `_` does not, so
  `git.on` still fails against `git.on_protected`). One test row pins both
  halves. This is check 1's forward known-test, not check 1b's tokenizer, so
  D-05 stands.
- [deviation] Task 3 (`659d8f6`): `parseReachTable` returns `rows: null` (not
  `[]`) when the `## Reach rows` heading is absent, with a
  `missing-reach-section` parser issue, and self-verify skips `reachIssues` in
  that case - following `parseActiveIds`' null-vs-`[]` convention so one
  authoring fault does not arrive as 72 copies of another. Pinned by its own
  test row.
- [deviation] Task 5 (`a96face`): `decision-review.md` ends LARGER than before
  despite the prescribed trim (9436 -> 9741). D-12 makes a justified bump
  equally legal; the trim was still taken (the `<purpose>` third paragraph is
  gone, the `<guardrails>` copy with the D-07 citation stands).
- [deviation] Task 8 (`79df1e6`): AC7 was NOT verified - it needs an
  interactive `/plugin` run against the live remote, which no executor command
  can stand in for. The executor continued to Tasks 9 and 10 rather than
  halting, since nothing downstream depends on it. Carried as an open item.

## Open items

- **AC7 (human-verify).** In a live Claude Code session,
  `/plugin marketplace add https://git.jcrenshaw.dev/crenshawdev/cadence.git`
  then `/plugin install cadence@cadence` must both succeed. Untested.
- **The two read faces now disagree about a global-layer risk waiver, with
  nothing said.** `config.mjs get` returns `risk.override.auth: true` and no
  warning for a waiver only the global layer holds, while `route.mjs` ignores
  it and warns - verified live against a scratch two-layer fixture. `get` is
  documented as "EFFECTIVE values ... the only correct way for a workflow to
  read config" (`cadence-core/bin/config.mjs:12`), and `workflows/config.md:46`
  drives the `/cad-config` menu off it, so the menu shows `true` for a waiver
  that waives nothing. D-06 scoped this phase to the resolver and the write
  face, and DESIGN's new marker records it - but it is the phase's own defect
  shape, so it should close rather than stay recorded.
- **The eight `risk.override.*` reach rows still say `universal`, and check 9
  is structurally blind to it.** By `config-reach.md`'s own human test ("is
  there a configuration in which this value is resolved and then not honoured")
  the answer became YES at `e09a0e5`, so the Reach cell should carry the
  narrower phrase and the eight schema `purpose` strings should repeat it
  verbatim. They do not - `risk.override.auth`'s purpose never mentions the
  repo scope. `reachIssues` returns at `reach === UNIVERSAL`
  (`config-reach.mjs:136`) before the purpose test, so the check cannot flag
  the one narrowing this phase introduced.
- **The global-waiver warning's remediation is wrong for a misspelled surface
  or a non-boolean value.** `risk.override.athu: true` in the global layer now
  warns "set it in this repo's own `.planning/config.json`", but
  `config.mjs set` refuses that key outright (`"athu" is not a risk surface`) -
  both verified live. `riskFloor`'s two diagnostic arms
  (`route.mjs:208`, `:215`) are unreachable for global-layer entries now that
  `riskOverrides` reads the repo layer alone.
- **The URL mask covers `https?://` only.** `git@git.jcrenshaw.dev:...` and
  `ssh://git.jcrenshaw.dev/...` still tokenize as `git.*` keys
  (`self-verify.mjs:312`). Forgejo's clone widget offers the SSH form by
  default, so the first contributor who pastes it into a prose surface turns
  CI red on a hostname - the shape `1ffa48f` says it eliminated.
- **`fsIdentity`'s last fallback throws outside the try.** `resolvePath(p)`
  (`config.mjs:215`) on a non-string path (e.g. `config.mjs set --file` with
  the flag's value missing) raises a TypeError that escapes `repoScopedErrors`
  and degrades a diagnosable failure into `reason:"internal"`; verified -
  `ec4b4b5` returned `reason:"read"`.
- **The global waiver warning fires wrongly when both layers are one file.**
  With `CADENCE_GLOBAL_CONFIG` pointing at the repo config, the waiver IS
  honoured (via `layers.repo`) yet `route.mjs` still warns it was ignored -
  verified live. Same root as the still-open phase-2 capture item about
  `mergeLayers` having no identity check between the two layer paths.
- **A duplicate reach row is dropped with no issue emitted**
  (`config-reach.mjs:95`), so a stale row masks a corrected one in the very
  check whose purpose is that nothing about a key's reach is skipped silently.
- **`normalize` does not case-fold the Reach cell** (`config-reach.mjs:31`), so
  `Universal` or `universal.` falls through to the purpose test and reports
  `unstated-reach` - telling the author to paste the wrong phrase into the
  purpose rather than to fix the cell. The grammar has no code for "reach is
  outside the declared vocabulary".
- The self-hosted test badge renders "Not found" until a runner exists on that
  host - a verified, accepted state per CONTEXT, not a defect.
- Deferred by CONTEXT, untouched: the template's pre-written per-trigger `gate`
  values (three gate-disagreement warnings on every scaffolded resolve), and
  whether GitHub remains the issue tracker after the hosting move.

## Goal check

The ten commits plausibly deliver the goal, and the parts that make it
re-runnable are green rather than asserted. The reach table has exactly 72
rows and the schema exactly 72 keys (counted from
`cadence-core/references/config-reach.md` and `config.schema.json`), and
`node cadence-core/bin/self-verify.mjs` reports `ok:true` with `config-reach`
present in `checked` and zero problems; `node --test cadence-core/bin/*.test.mjs`
passes 1045/1045 and `npx tsc -p tsconfig.ci.json` exits 0. The stated-reach
half holds where the plan aimed it: `config.mjs keys` shows all five
`review.triggers.*.tier` keys plus `review.decision_review.tier` carrying
"cross-model reviewers only", `workflow.research` carrying "new-project
research step only", `granularity` "new-project roadmap step only", and
`workflow.skip_discuss` "progress next-step suggestion only" -
`review.consult.tier` is correctly left `universal` because a consult is always
a cross-model call. The hosting move is complete on the surfaces it claimed:
`grep -rn "github.com/crenshawdev" README.md .claude-plugin/plugin.json`
returns nothing.

What is missing is the phase's own shape reappearing in two places the plan did
not reach. First, `config.mjs get` still hands back a global-layer
`risk.override.<surface>` as an effective value with no warning while
`route.mjs` drops it (both verified live on a two-layer fixture) - the value is
resolved, carried, and thrown away, which is the definition the goal uses, and
D-06 scoping it out records the gap rather than closing it. Second, the eight
`risk.override.*` reach rows still read `universal` and their schema purposes
never mention the repo scope, and `reachIssues` short-circuits on `universal`
before the purpose test (`config-reach.mjs:136`), so the new check is
structurally incapable of catching the narrowing the same phase introduced.
Neither blocks the phase - both are recorded above - but the goal's claim
"closed everywhere it remains" is not yet literally true. AC7 is unverified and
needs a human at a live `/plugin` prompt.
