---
phase: 1
plan: 1
requirements:
  - IVW-01
files:
  - cadence-core/bin/lib/surface-scan.mjs
  - cadence-core/bin/surface-scan.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/references/review-triggers.md
  - cadence-core/references/config-catalog.md
  - cadence-core/references/COMMANDS.md
  - cadence-core/workflows/config.md
  - skills/cad-config/SKILL.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: The question you cannot ask again - Plan

## Goal

The only configuration question Cadence asks on its own becomes one a user can
reach deliberately, see the evidence for, and answer again after the repository
has changed shape - and it stops presenting two identical options.

## Must be true when done

- `/cad-config --surfaces` opens the risk-surface interview on demand: it shows
  the currently answered set beside what `detect-surfaces` evidences NOW, side
  by side, and names every category the scan evidences that the answer does not
  cover.
- Opening that arm and declining leaves `.planning/config.json` byte-identical -
  the existing answer survives unless the user picks a new one.
- `planning.mjs detect-surfaces` returns the question's option list itself, and
  on the #206 demo tree (Express + Stripe + Prisma + Passport, with `auth/`,
  `migrations/`, `api/`, `workers/`, a `.sql` file and an `openapi.yaml`) no two
  options carry the same set: the first is all eight, the second is the six
  evidenced.
- The `inconclusive` arm changes only the REASON the recommended option states -
  its set is all eight either way - and a test pins both arms against each other.
- `cadence-core/references/review-triggers.md` and
  `cadence-core/bin/lib/surface-scan.mjs` agree on what `recommended` contains,
  and a `prose-agreement.test.mjs` arm reddens when either side is doctored.
- Both interview sites render through the ask-user seam under the cap
  `cadence-core/references/seams.md` states - recommended first and labelled,
  never pre-selected - checked by a test rather than assumed of a model.
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
  empty `problems` array, and `node --test 'cadence-core/bin/*.test.mjs'`
  reports zero failures.

## Context

- No `phases/1/CONTEXT.md` exists; this plans from the ROADMAP goal and its seven
  Success Criteria alone.
- The drift is prose-versus-code and the CODE is right: `scanTree` returns
  `recommended = [...CATEGORIES]` unconditionally with a comment stating why
  (framework built-in auth ships no separate dependency, so a narrowed
  recommendation persists a scope that skips the only blocking review the project
  has). `review-triggers.md`'s ask bullets are the PREVIOUS contract, which is
  what rendered all eight in slot 1 and again in the last slot. Recalled from
  `.planning/CAPTURE.md`, found 2026-08-17.
- The option list moves into the seam rather than staying a rule a model composes
  at the fire site. That is what makes Success Criteria 3 and 6 provable at all -
  distinctness cannot be proven against a fixture while the options are composed
  per run - and it is the same defect class the phase closes. Recorded in Notes.
- Out of scope: the eight categories themselves, `lib/risk-diff.mjs`, the
  `blocking` gate level, and the degraded-resolve fallback defect in this same
  reference (see Notes).

## Tasks

### Task 1: Compute the interview's option list in the pure lib

- **Files:** cadence-core/bin/lib/surface-scan.mjs, cadence-core/bin/surface-scan.test.mjs
- **Action:** Add one exported pure function to `lib/surface-scan.mjs` (start at
  `scanTree` and the `UNSPEAKABLE` derivation above it) that turns a `scanTree`
  result, plus the set a config layer has already answered, into the ORDERED list
  of choices the one-time question offers - each choice carrying the category set
  it would write and the reason to state beside it. The list is what stops #206
  recurring: today it is composed by a model reading prose, and a composed list is
  what put the same eight categories in two slots. Keep every rule the file's
  header states - pure (no fs, no emit, no process, no Date, no randomness) and no
  source text as an input.
  The rule, exactly. With NO answered set: the first choice is `recommended` (all
  eight), the second is the evidenced categories alone. With an answered set the
  first choice is STILL `recommended` (all eight), exactly as on the unanswered
  path - the recommendation never narrows on what a scan failed to evidence,
  whatever has already been answered - the second is that answered set plus every
  category `evidenced` names that it does not already contain (the
  added-Stripe-six-months-in case this phase exists for), the third is the answered
  set unchanged, the fourth is the evidenced categories alone. Then drop, in order, any
  choice whose set is empty and any whose set repeats an earlier choice's, building
  every set in `CATEGORIES` order so two spellings of one set compare equal. Never
  return more choices than the option cap `cadence-core/references/seams.md` states
  for the ask-user seam.
  The reason distinguishes the `inconclusive` arm from the evidenced arm and, on
  the evidenced arm, names the `signal` string `scanTree` already returns per
  category. The reason is the ONLY thing `inconclusive` changes: the first choice's
  set is `recommended` either way. Never narrow the first choice on an inconclusive
  scan and never drop a `silent` category out of all eight - both are the
  absence-from-silence conclusion the file's header exists to refuse.
- **Verify:** `node --test cadence-core/bin/surface-scan.test.mjs` passes with new
  rows showing: `scanTree({})` and `scanTree({dirs:['migrations']})` each produce a
  first choice whose set is all eight while their reasons differ; the
  evidenced-only choice is absent on the inconclusive scan and present on the
  other; an answered set of `['secrets']` against `scanTree({dependencies:['stripe']})`
  produces a FIRST choice whose set is all eight and a SECOND whose set is exactly
  `['billing','secrets']`; an answered set equal to all eight produces choices with
  no two equal sets and still leads with all eight; and no call returns more than
  four choices.

### Task 2: The seam returns that option list, and the #206 demo tree proves it

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/surface-scan.test.mjs
- **Action:** `cmdDetectSurfaces` emits the option list on its envelope beside the
  `evidenced`, `silent`, `unspeakable`, `inconclusive` and `recommended` fields it
  already emits, under the same always-report convention that block states -
  present even when the tree evidences nothing, so a caller can tell "the structure
  evidences nothing" from "did not look". Add an `--answered` flag carrying the set
  a config layer already holds, comma-separated, so `/cad-config`'s re-run reaches
  the same rule the first fire does instead of merging the current answer itself;
  the flag absent means nobody has answered. Read it exactly the way `risk-check
  run` reads `--surfaces` in this same file - split on commas, trim, drop empties,
  then `fail('bad-args', ...)` both when nothing usable follows the flag and when a
  token is outside `CATEGORIES`, naming the offending tokens. Declare it in
  `lib/arg-contract.mjs`'s `CONTRACTS` under the existing `detect-surfaces` row with
  the shape `risk-check run`'s `--surfaces` row carries; without that row
  self-verify's invocations check files an `unknown-flag` against every prose site
  that uses it.
- **Verify:** `node --test cadence-core/bin/surface-scan.test.mjs` passes with a
  fixture building the #206 demo tree - a `package.json` declaring express, stripe,
  prisma and passport, plus `auth/`, `migrations/`, `api/`, `workers/`, a `.sql`
  file and an `openapi.yaml` - where `detect-surfaces --root <tree>` shows
  `evidenced` as exactly auth, migrations, billing, concurrency, api_contract and
  untrusted_input; the option list carries no two equal sets, its first set is all
  eight and its second is those six. Plus rows showing `--answered secrets` on that
  same tree keeps the first option's set at all eight and puts those six plus
  secrets in the SECOND option, whose set is NOT all eight (destructive is absent
  from it), and `--answered` with nothing after it and
  `--answered nope` each print `{"ok":false,"reason":"bad-args"}` naming the
  offending input. `node cadence-core/bin/self-verify.mjs --root .` prints
  `"problems":[]`.

### Task 3: review-triggers.md's ask renders the seam's options instead of composing them

- **Files:** cadence-core/references/review-triggers.md, cadence-core/bin/weight-budgets.json
- **Action:** In `## risk_surface detection (shipped defaults, configurable)`,
  replace the three bullets that follow "Then ask through the ask-user seam
  (seams.md)": the `inconclusive` arm, the "Otherwise recommend" arm, and the "Fill
  the remaining slots ... the evidenced categories alone, and all eight" arm. The
  two recommendation arms collapse into one, because `recommended` is all eight
  either way and `inconclusive` changes only the REASON stated; the third bullet is
  what made option 1 and the last option the same list. The replacement instructs
  rendering the option list the `detect-surfaces` envelope now returns, in the
  order it returns it, the first labelled `(recommended)`, never pre-selected, each
  option stating the reason that came with it - and composes no options here. Keep
  the sentence saying `evidenced` and `unspeakable` are what that reason is built
  from, and keep the D-14 sentence forbidding a narrower recommendation on evidence
  that does not exist.
  Two live rails. First, no line in this section may take the form of a hyphen, a
  backticked lower-case token and a hyphen: `prose-agreement.test.mjs`'s CST-02 arm
  slices this whole section on `## risk_surface detection` and reads every such
  line as one of the eight category tokens, so a bullet whose text begins with the
  word `recommended` in that punctuation reddens that test by inventing a ninth
  category - write those instructions as sentences, not as that bullet form. Second, the section
  must keep stating how many categories the recommended option carries as a WORD the
  test file's `WORD_TO_NUMBER` table knows, because task 5's check reads that word.
  Re-pin this file's row in `cadence-core/bin/weight-budgets.json` in the same
  commit if the edit grows it past its entry; the budget is a ceiling, so a shrink
  needs no re-pin.
- **Verify:** `sed -n '/^## risk_surface detection/,$p' cadence-core/references/review-triggers.md`
  (this is the file's last top-level heading, so the range runs to EOF) shows one
  recommendation arm rather than two, no sentence instructing the caller to fill a
  slot with all eight, and exactly the eight existing category bullets in the
  hyphen-backtick-hyphen form. `node --test cadence-core/bin/prose-agreement.test.mjs`
  passes (CST-02 still reads exactly eight categories out of that section) and
  `node cadence-core/bin/self-verify.mjs --root .` prints `"problems":[]`.

### Task 4: /cad-config gains the deliberate entry point

- **Files:** skills/cad-config/SKILL.md, cadence-core/workflows/config.md, cadence-core/references/config-catalog.md, cadence-core/references/COMMANDS.md, cadence-core/bin/weight-budgets.json
- **Action:** Add a `--surfaces` branch to `/cad-config`. In `skills/cad-config/SKILL.md`
  the `argument-hint` gains it and `<objective>`'s Routing list gains one line. In
  `cadence-core/workflows/config.md`, `## 1. Route` gains the branch and a new
  top-level section states the arm - place it beside `## Review provider setup (cold
  branch)`, never inside `## Interactive menu (no args)`. The arm: read the effective
  answer with `config.mjs get review.triggers.risk_surface.surfaces`, never a raw read
  of `.planning/config.json` for a workflow value per this file's own Validation seam
  rule, where a null value means nobody has answered and all eight stand; run
  `detect-surfaces --root .` with `--answered <a,b,c>` carrying that answer, dropping
  the flag when nothing is answered; show the answered set beside what the scan
  evidences NOW, side by side, naming each evidenced category with its `signal` and
  calling out every one the answered set does not contain, because that gap is the
  whole reason this arm exists; ask through the ask-user seam, rendering the
  envelope's options in its order, the first labelled `(recommended)`, never
  pre-selected, and say plainly that keeping the current answer and declining are
  both valid answers; write ONLY on an explicit pick, through the Validation seam
  (`config.mjs set`), at the repo layer. A decline calls no `set` and edits no file -
  re-running this arm must never cost a user the answer they already gave.
  Rails. Do not rename `## Interactive menu (no args)` or its `### The walk`
  heading and do not renumber that list's items: `lib/deferred-reads.mjs` anchors
  `cad-config`'s `references/config-catalog.md` row at `Interactive menu (no
  args)/The walk/2`, and self-verify check 13 goes red on a shifted region. Keep the
  "Four sets stay edit-the-file-only and have no catalog row" sentence true and its
  count unchanged - `review.triggers.risk_surface.surfaces` HAS a catalog row, so it
  is not a fifth. In `config-catalog.md`, that row's Value column stops offering a
  free-typed list and routes to this step the way `review.providers.*` routes to
  Review provider setup: a second door writing the same key with no evidence beside
  it is the shape this phase closes. `COMMANDS.md`'s `/cad-config` row names the arm.
  Re-pin every grown row in `weight-budgets.json` in this same commit.
- **Verify:** Deterministic half: `node cadence-core/bin/self-verify.mjs --root .`
  prints `"problems":[]` (no `deferred-read-unread`, no `unknown-flag`, no
  `budget-overrun`) and `node --test 'cadence-core/bin/*.test.mjs'` reports zero
  failures. Then human-verify (needs a live `/cad-config` run, which the executor
  cannot dispatch): 1. reinstall the plugin from this branch and `/clear`; 2. run
  `/cad-config --surfaces` in `/code/cadence`; 3. expect the transcript to show
  `config.mjs get` returning this repo's answered `["secrets","destructive","untrusted_input"]`
  and `detect-surfaces` returning `inconclusive: true` with no evidenced category,
  the turn printing those three beside the fact that the structure evidences
  nothing, and the question offering two options - all eight FIRST and labelled
  `(recommended)`, the current three second and unchanged - with neither
  pre-selected; 4. decline; 5. expect
  `git status --porcelain .planning/config.json` to print nothing and
  `node cadence-core/bin/config.mjs get review.triggers.risk_surface.surfaces` to
  still return those same three.

### Task 5: Pin `recommended` across the prose and the lib, falsified in both directions

- **Files:** cadence-core/bin/prose-agreement.test.mjs
- **Action:** Add one `test()` that reads the `## risk_surface detection` section of
  `cadence-core/references/review-triggers.md` through the file's `doc()` helper and
  compares what it says `recommended` contains against what `scanTree` returns, for
  BOTH scan arms - an inconclusive tree and one evidencing a category - so the check
  pins the collapse itself: the same recommended count either way, only the reason
  differing. Read the prose's figure as a WORD through the existing `countWord` and
  `WORD_TO_NUMBER` helpers rather than as a digit, which is how that section spells
  it. Express the comparison so the test can re-run it over doctored inputs and
  assert it throws in both directions: once with the prose's count word replaced,
  once with a category dropped from the recommended array it was handed. One-sided
  assertion is exactly how this drifted for a release - the CST-02 arm already in
  this file verifies the category LIST across three surfaces and has never verified
  what `recommended` CONTAINS. Do not parse the section's bullet or table shape:
  `self-verify.mjs:927` records a standing decision that this surface has no stated
  grammar, so a shape check reddens on a reformat that changed no fact.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes on the
  tree as shipped. Falsify it live in both directions and restore: change the count
  word in that section of `review-triggers.md` to a different word from
  `WORD_TO_NUMBER`, re-run, and the new test fails naming the disagreement; revert.
  Then drop one entry from the recommended array in `lib/surface-scan.mjs`'s
  `scanTree` return, re-run, and the same test fails; revert. Both reverts leave
  `git status --porcelain` reporting nothing beyond the test file.

### Task 6: Pin the rendering contract at both interview sites

- **Files:** cadence-core/bin/prose-agreement.test.mjs
- **Action:** Add one `test()` that reads `## Seam: ask-user` in
  `cadence-core/references/seams.md` for its three binding rules - the option cap
  per question, the recommended-option-first-and-labelled convention, and the
  clause that this is a display convention and never a pre-selection - and asserts
  that BOTH interview sites carry them: the ask in `## risk_surface detection` of
  `references/review-triggers.md` and the `--surfaces` section of
  `cadence-core/workflows/config.md`. Take the cap from `seams.md` rather than from
  a number written into this test, so raising the seam's cap moves both sites'
  requirement with it. Then close the loop on the code side in the same test: the
  option list `lib/surface-scan.mjs` returns never exceeds that cap - on an
  inconclusive scan, on an evidenced scan, and on an already-answered re-run alike.
  Nothing structural enforces how a model renders this question, so this check IS
  the enforcement: a site that quietly drops the never-pre-selected clause, or a
  builder that grows a candidate past the cap, reddens here.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes.
  Falsify and restore: delete the never-pre-selected clause from
  `references/review-triggers.md`'s ask, re-run, and this test fails naming that
  site; revert. Delete it from `workflows/config.md`'s `--surfaces` section, re-run,
  and it fails naming that site; revert. Then the whole-tree gate, with every task
  in this plan landed: `node cadence-core/bin/self-verify.mjs --root .` prints
  `{"ok":true,...,"problems":[]}`, `node --test 'cadence-core/bin/*.test.mjs'`
  reports zero failures, and `npx tsc -p tsconfig.ci.json` exits 0.

## Notes

- **One deliberate structural addition, recorded here rather than assumed.** The
  ROADMAP's diagnosis says "the fix is the prose", and it is - for the duplicate
  option. But Success Criterion 3 requires the option list be "proven against the
  #206 demo fixture" and Criterion 6 requires the rendering be "checked rather than
  assumed", and neither is provable while a model composes the options per run:
  there is nothing for a test to read. So the option list becomes a `detect-surfaces`
  answer (tasks 1-2) and the prose renders it (task 3). This is the same split the
  file already documents - the seam keeps the invariant, the user keeps the
  judgment - and it is why `--answered` exists rather than the workflow merging the
  current answer itself.
- **Not touched, and live in a file this plan edits.** `review-triggers.md`'s
  degraded-resolve fallback ("config gate, tier and effort") is unfollowable against
  the null schema defaults and reads raw unvalidated config values; recorded in
  `.planning/ARCHIVE.md` from `v3.5.4` phase 3's SUMMARY. It is a different defect
  from IVW-01 and is deliberately left alone here.
- Human-verify in task 4 is the only step the executor cannot run: `/cad-config` is
  a live skill invocation, and Criteria 1 and 2 are both about what a real run does.
