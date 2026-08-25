---
phase: 3
plan: 1
requirements: [CAP-01, CAP-02]
files:
  - cadence-core/bin/lib/filing-decision.mjs
  - cadence-core/bin/filing-decision.test.mjs
  - cadence-core/bin/issue-filing.mjs
  - cadence-core/bin/issue-filing.test.mjs
  - cadence-core/bin/lib/issue-decision.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/lib/census-registry.mjs
  - cadence-core/bin/reason-census.test.mjs
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning-files.test.mjs
  - cadence-core/bin/planning/recall.mjs
  - cadence-core/bin/planning-recall.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/references/triage-gate.md
  - cadence-core/bin/weight-budgets.json
  - .planning/FILED.md
  - .planning/phases/3/live-forge-check.md
---

# Phase 3: CAPTURE is transient - Plan 1 (the tracker takes the finding)

## Goal

A finding a gate will not fix now leaves the run at the moment the gate decides,
as an issue on this repository's own tracker, because the user was asked in that
same step. Nothing about that decision touches `.planning/CAPTURE.md`.

## Must be true when done

- A gate fire that produces findings it will not fix now puts them to the user
  ONCE for that fire, and every finding the user names is an issue on the forge
  phase 1 persisted, created before the fire's step ends.
- A finding the user does not name is filed carrying the decline label, and the
  same `(file, claim)` pair raised by a later fire is not put to the user again.
- Neither answer changes `.planning/CAPTURE.md` by a byte.
- A fire whose decline lookup came back on a filled page refuses the fire and
  says the lookup was incomplete, rather than asking about findings it may
  already have asked about.
- A create that does not land - no CLI, no forge configured, a nonzero exit -
  refuses and names each finding that was not filed; no finding is dropped
  because the tracker could not be reached.
- `planning.mjs recall` still surfaces a finding that was routed to the tracker,
  as a row carrying that issue's title.
- Every refusal `reason` token the tree carried before this phase is still
  spelled the same way afterwards.

## Context

No CONTEXT.md exists for this phase; the ROADMAP's 14 success criteria and its
Naming constraint block are the locked decisions, and every discretionary choice
below is named in the task that makes it.

- The act takes its own word: **filing**. `deferral`, `deferred` and
  `DEFERRED-*.json` are spoken for three ways (ROADMAP Naming constraint) and
  none of them is reused, extended or renamed here.
- The write is a NEW face beside `lib/forge-decision.mjs`'s `CREATE_TABLE`
  pinned-vector pattern, in its own module. `lib/issue-decision.mjs` gains no
  writing row - its header's "NOTHING HERE WRITES" claim survives this phase -
  and its only edit here is the correction of a comment that measurement has
  falsified.
- Out of scope in this plan: everything about the CAPTURE file itself - the
  walked-bullet bound, the annotation check, the `## Archive` report and the
  phase-close assertion are PLAN-2's, which runs after this one because the two
  share declared files.

## Tasks

### Task 1: The set that reaches the ask, taken off the structured payload

- **Files:** cadence-core/bin/lib/filing-decision.mjs,
  cadence-core/bin/filing-decision.test.mjs
- **Action:** Create `lib/filing-decision.mjs` as the pure, testable core of the
  filing question, in the shape and discipline `lib/forge-decision.mjs` states in
  its own header: zero-dep, no filesystem, no spawn, no `process`, unknown or
  missing input never throws. It exports two things in this task. First, the
  selection: given a composed adjudication payload - the same
  `{voices: [{voice, model, returned, rulings}]}` object
  `planning.mjs adjudication --payload` already takes - it returns the findings
  the gate will not fix now. Build the entries with `buildEntries` from
  `lib/adjudication-record.mjs` rather than walking the payload again, and select
  off two fields of the entries it returns and nothing else: `ruling` -
  `downgraded` and `refuted` are the non-survivors - and the raised `severity`,
  where anything that is not `blocker` or `high` is the blocking arm's remainder.
  A `survived` entry at `blocker` or `high` is NOT in the set: it is the thing
  the gate is halting over. Never read `REVIEW-<trigger>-<discriminator>.md`, and
  never accept prose as an input here at all - the payload is the only argument,
  which is what makes "the ask follows the payload" a property rather than a
  promise. A payload `buildEntries` refuses comes back as a refusal carrying that
  detail, never as an empty set, because "nothing to ask about" and "this payload
  is unreadable" send the fire down opposite paths. Second, the fingerprint:
  `(file, claim)` and nothing else, NUL-joined the way `convergenceKey` in
  `lib/adjudication-record.mjs` joins its triple, then digested with
  `node:crypto`'s `createHash` and rendered as a fixed-width lowercase hex token.
  `line` is deliberately excluded - `convergenceKey` includes it, and a decline
  keyed on it forgets itself the moment the file shifts by one line. Add NO field
  to the finding object to carry any of this: `findingIssue` in
  `lib/adjudication-record.mjs` refuses any key outside `FINDING_KEYS`
  (`file`, `line`, `severity`, `claim`, `failure_scenario`), so the fingerprint
  is DERIVED at every use and the disposition rides BESIDE a finding the way
  `RULING_KEYS` puts `ruling` beside `finding`, never inside it.
- **Verify:** `node --test cadence-core/bin/filing-decision.test.mjs` passes,
  with cases proving: a payload holding one `survived` blocker, one `downgraded`
  high and one `survived` low returns exactly the second and third; a payload
  whose `voices[0].returned.findings[0].claim` disagrees with a prose fixture
  returns the payload's claim (the prose is never read); two findings differing
  only in `line` produce the SAME fingerprint and two differing in `claim`
  produce different ones; and a payload `buildEntries` refuses returns a refusal
  whose detail names the entry, not an empty set.

### Task 2: One pinned argument vector per forge, for the create and the lookup

- **Files:** cadence-core/bin/lib/filing-decision.mjs,
  cadence-core/bin/filing-decision.test.mjs
- **Action:** Add the provider table to `lib/filing-decision.mjs`, built on
  `CREATE_TABLE`'s pattern in `lib/forge-decision.mjs` (CONTEXT D-14's shape: one
  row per provider, a builder that returns the argv, and a stated fact beside it)
  and keyed by the same three provider names `PROVIDER_TABLE` uses, since the
  persisted `git.forge_provider` value is used directly as the key. Do not repeat
  the binary name - `PROVIDER_TABLE` already says which binary drives which
  provider. Each row carries a CREATE argv and a decline-LOOKUP argv, and the
  flags are MEASURED facts, recorded in the row's comment with the version and
  the date the way `CREATE_TABLE`'s header records its own. Measured 2026-08-25
  on this machine from each CLI's own `--help`, gh 2.98.0, glab 1.114.0, tea
  0.15.1: create takes `--title`/`--body`/`--label`/`--repo` on gh,
  `--title`/`--description`/`--label`/`--repo` on glab, and
  `--title`/`--description`/`--labels`/`--repo`/`--login` on tea; the label flag
  is singular on gh and glab and plural-comma on tea, which is the one spelling
  all three share on the create call. `glab issue create` MUST carry `-y/--yes`
  ("Don't prompt for confirmation to submit the issue") - without it the child
  blocks on a confirmation prompt inside a gate step, which is the hang the
  ROADMAP's open question named as the dangerous one - and every row must supply
  a description/body, because gh prompts for one when it is absent and glab opens
  an editor. None of the three prints machine-readable output on a successful
  create (no `--json` on any create face), so no row may claim to read an issue
  number back: exit zero is the whole answer, which also keeps
  no-third-party-output (CONTEXT D-16) true by construction. The decline lookup
  is ONE list call filtered by the label: `--label`/`--state all`/`--json
  number,title`/`--limit` on gh, `--label`/`--all`/`--output json`/`--per-page`
  on glab, `--labels`/`--state all`/`--fields index,title`/`--output
  json`/`--limit`/`--login` on tea. Carry the same per-provider page sizes
  `HOST_TABLE` states and its truncation rule with them: a response that FILLS
  its page is INCOMPLETE and carries no records, exactly as `normalizeList` in
  `lib/issue-decision.mjs` decides it, because Forgejo clamps `tea issues list`
  at 50 rows server-side whatever `--limit` asks. Write that normalizer HERE
  rather than importing one: this one reads `title` to recover a fingerprint and
  the other reads `state` to answer whether an issue is open, and
  `lib/issue-decision.mjs` is a read-only face this phase does not extend. The
  decline label is a fact of the table like `--private` is - one frozen literal,
  never a parameter, never a flag, never caller-derived text - and the row states
  that a label the instance does not already hold may be refused by the forge
  rather than created, which is what task 8's live run settles.
- **Verify:** `node --test cadence-core/bin/filing-decision.test.mjs` passes,
  with a pinned-vector case per provider asserting the exact create argv and the
  exact lookup argv as arrays (the glab create vector contains `-y`), plus:
  a lookup response of exactly the page size reports incomplete with no records,
  one row under it reports complete, and a response that is not a JSON array
  reports incomplete rather than throwing.

### Task 3: The seam that asks the tracker once and writes what it is told

- **Files:** cadence-core/bin/issue-filing.mjs,
  cadence-core/bin/issue-filing.test.mjs, cadence-core/bin/lib/arg-contract.mjs,
  cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/self-verify.test.mjs,
  cadence-core/bin/lib/census-registry.mjs
- **Action:** Create `bin/issue-filing.mjs` as the workflow-facing seam over
  `lib/filing-decision.mjs`, modelled on `bin/forge.mjs` - one JSON line on
  stdout through `lib/seam-io.mjs`'s `emit`, every child spawned with its stderr
  discarded at the spawn and bounded by an explicit timeout, and no byte of any
  child's output on any envelope. Two subcommands. `unfixed --payload <file>
  [--dir <path>]` reads the composed adjudication payload from a FILE (never
  inline, never stdin - reviewer text carries arbitrary quoting, the reason
  `adjudication --payload` states), runs task 1's selection, then makes ONE
  label-filtered list call for the whole fire and returns the findings that
  remain after every already-declined fingerprint is dropped, each with its
  fingerprint. One call per fire whatever the finding count: never a call per
  finding. An INCOMPLETE lookup refuses the fire - it is not "nothing was
  declined" - and the refusal says the page was filled and the set cannot be
  trusted. `file --payload <file> [--dir <path>]` reads a dispositions payload
  that pairs each finding with `accept` or `decline`, keeping the disposition
  BESIDE the finding for the `FINDING_KEYS` reason task 1 states, and creates one
  issue per entry through the selected CLI's pinned create vector, with the
  decline label on the declined ones. Both faces read the persisted forge record
  - `git.forge_provider`, `git.forge_repo`, `git.forge_host` - through
  `mergeLayers`, destructuring `warnings` at the callsite and putting it on every
  envelope, because the merge-layers census admits only the two
  warning-surfacing arms; then re-pin that census in `self-verify.test.mjs` (it
  reads SIXTEEN callsites over TWELVE files today) and add this file to the
  `self-verify-merge-layers` row's `subjects` in `lib/census-registry.mjs` in the
  same commit. Reuse `missingForgeKeys` from `lib/forge-decision.mjs` for
  "is a forge configured" rather than restating the rule, the way
  `lib/issue-decision.mjs` already imports it, and on the forgejo arm resolve the
  login the way `bin/forge.mjs`'s `teaLoginFor` does, through `loginNamesHost`,
  refusing before any create when none serves the host. Every refusal that can
  precede a create does precede it, `bin/forge.mjs`'s `create` header states why;
  a failure PART WAY through a batch names which findings landed and which did
  not, on the `runTransition` stop-at-first-failure discipline, because a caller
  told "filed" about a finding that was not filed has been told the wrong thing.
  Declare both subcommands and every flag in the `CONTRACTS` table in
  `lib/arg-contract.mjs` - a script under `bin/` with no row fails self-verify's
  uncontracted-script check - and re-pin the flag-entry and top-level row counts
  in `arg-contract.test.mjs`. Every `ok:false` carries a hint naming the next
  step; self-verify's refusal-hint check reads this file from the moment it
  exists.
- **Verify:** `node --test cadence-core/bin/issue-filing.test.mjs` passes against
  argv-recording stubs injected by prepending to the child's PATH - the pattern
  `bin/forge.test.mjs` and `bin/issue-check.test.mjs` already use, with no
  test-only override honoured in production - proving: a five-finding fire makes
  exactly ONE list call; a finding whose fingerprint the lookup returned is
  absent from `unfixed`'s answer; a lookup response filling the page returns
  `ok:false` naming the incomplete read and makes no create call; `file` with
  three accepts and two declines makes five create calls of which exactly the two
  declined carry the label flag; a create exiting nonzero returns `ok:false`
  naming the findings that were not filed. `node cadence-core/bin/self-verify.mjs`
  reports zero problems and `node --test cadence-core/bin/arg-contract.test.mjs`
  and `cadence-core/bin/self-verify.test.mjs` pass.

### Task 4: A filed finding stays reachable by recall

- **Files:** cadence-core/bin/issue-filing.mjs,
  cadence-core/bin/lib/planning-files.mjs,
  cadence-core/bin/planning-files.test.mjs,
  cadence-core/bin/planning/recall.mjs,
  cadence-core/bin/planning-recall.test.mjs,
  cadence-core/bin/trace.test.mjs,
  cadence-core/bin/planning-lease-check.test.mjs, .planning/FILED.md
- **Action:** `recall` builds its corpus from `phases/*/{SUMMARY,UAT,CONTEXT}.md`,
  `CAPTURE.md`, `ARCHIVE.md` and `tasks/*/RECORD.md` and reads no forge, so a
  finding routed to the tracker leaves the corpus entirely - and "a bullet
  `/cad-capture` writes is reachable by `/cad-plan`'s recall" is the shipped
  `CAP-01` guarantee. Close that at FILE time, for ACCEPTED entries ONLY: when
  `issue-filing.mjs file` creates an issue for an entry whose disposition is
  `accept` it appends one bullet naming that issue's title to
  `.planning/FILED.md`; an entry whose disposition is `decline` creates its
  labelled issue and appends NOTHING. Criterion 1 says no artifact anywhere holds
  a declined finding, and `.planning/FILED.md` is an artifact inside the recall
  corpus this same task adds - a declined title mirrored there is the
  accumulation the phase goal removes, reappearing one indirection later. The
  decline label on the forge, read back by task 3's one label-filtered lookup, is
  the ONLY place a decline persists, which is what criterion 12's paginated
  lookup is a lookup over. `.planning/FILED.md` is a new top-level planning file
  that is this plan's chosen home for the mirror - `.planning/CAPTURE.md` is byte-unchanged by criterion 1
  and `.planning/ARCHIVE.md` is UNTOUCHED by criterion 7, so neither can hold it.
  Write it through `withPlanningFileLock` and `atomicWrite`, the guard
  `lib/capture-file.mjs` exports for exactly this read-modify-write shape, and
  create the file with its heading when it is absent. The bullet is a column-0
  `- ` line so it reads as a bullet to a walk, carrying the ISO date, the
  provider, the slug, the fingerprint token and the title; it carries no finding
  body, so what enters the corpus is a pointer and not the thing that was just
  moved out of the run. Add `parseFiledRows` beside `parseArchiveRows` in
  `lib/planning-files.mjs` and walk it in `planning/recall.mjs` LAST, after the
  tasks tier, on the position argument that walk already states twice: `search()`
  orders by score then corpus position, so appending leaves every existing corpus
  index where it is and a tree with no `.planning/FILED.md` emits the bytes it
  emitted before. An absent or unreadable file is empty data through the same
  guarded `read()`, never a throw - the empty-corpus contract rests on it. Both
  census holders for the planning seam are declared in this plan because
  `planning/recall.mjs` is inside their subject path; re-pin whichever of them
  moves.
- **Verify:** A test in `planning-recall.test.mjs` writes a `.planning/FILED.md`
  bullet, runs `planning.mjs recall` with terms from that title, and asserts a
  result whose `source` names `FILED.md` and whose snippet carries the title; a
  second asserts the corpus is byte-identical to the pre-walk answer when the
  file is absent. A THIRD, in `issue-filing.test.mjs`, runs `file` over a
  dispositions payload of three accepts and two declines against the argv stubs
  and asserts `.planning/FILED.md` holds exactly THREE bullets and that neither
  declined finding's title or fingerprint appears anywhere in the file - the
  falsifying case for "no artifact anywhere holds a declined one", which a test
  over successful accepts alone passes vacuously.
  `node --test cadence-core/bin/planning-files.test.mjs
  cadence-core/bin/planning-recall.test.mjs cadence-core/bin/trace.test.mjs
  cadence-core/bin/planning-lease-check.test.mjs` passes.

### Task 5: The gate asks once, in the step that decided

- **Files:** cadence-core/references/triage-gate.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Write the ask into `references/triage-gate.md`, which is where all
  five gate arms are already stated, so no firing site needs its own copy. State
  it once and have both arms point at it: the blocking arm's below-blocker/high
  remainder, the adjudicated arm's non-survivors, and any `recorded not fixed`
  disposition are the same set, and it is produced by running
  `issue-filing.mjs unfixed --payload <the same composed payload file the
  adjudication record was written from>` - never by re-reading the REVIEW file's
  prose, and never by the model deciding which findings qualify. Present what
  comes back through `AskUserQuestion` under the TWO CAPS this file already
  states and does not restate here: at most three findings per question with NONE
  first and default, `ceil(N/3)` questions, at most four questions per call. That
  is ONE ask STEP for the fire however many findings it holds - fifteen findings
  are not fifteen prompts, and the friction of asking per finding is what made
  the old silent-write path attractive. Say plainly what each answer does: a
  finding the user names becomes an issue; a finding the user does not name is
  filed carrying the decline label, which is what stops a later fire asking the
  same question forever; NOTHING is written to `.planning/CAPTURE.md` on either
  answer, and no finding is annotated, parked or carried. State the resolution
  rule here, in the triage reference, because criterion 4 puts it here: an item
  is RESOLVED BY REMOVAL - filed on the tracker or dropped - never by annotation
  and never by relocation within the file, and the `KEPT <date>` and `recorded
  not fixed` shapes are what adjudication-by-annotation looks like. Name no
  command in that sentence: the check enforcing it ships in PLAN-2, and a
  reference naming a subcommand the `CONTRACTS` table does not yet declare fails
  self-verify as `unknown-subcommand` the moment this plan commits. Then one
  `issue-filing.mjs file` call with the dispositions, and report what was filed;
  a refusal from either call is reported and the findings are still in hand -
  never dropped because the tracker could not be reached. Do not add a receipt or
  a trace event: this is a step inside a fire that already leaves one. Re-pin
  this surface's exact byte size in `weight-budgets.json` in the same commit -
  the budget entry is the file's current size to the byte, so any growth is an
  overrun until it is re-pinned.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports zero problems -
  which covers the budget entry, and covers every `issue-filing.mjs` invocation
  this prose adds against the `CONTRACTS` row task 3 declared, so a subcommand or
  flag spelled wrong in the prose fails as `unknown-subcommand` or
  `unknown-flag`. `node --test cadence-core/bin/prose-agreement.test.mjs
  cadence-core/bin/seam-calls.test.mjs` passes. Reading the new section back:
  it names ONE `unfixed` call and ONE `file` call per fire, it defers the
  question and option caps to this file's own two-caps paragraph rather than
  restating them, and it carries no instruction that produces a prompt per
  finding - `grep -n "per finding" cadence-core/references/triage-gate.md`
  returns nothing that reads as an instruction to ask one.

### Task 6: The tree stops claiming glab is absent

- **Files:** cadence-core/bin/lib/issue-decision.mjs
- **Action:** Two comments in this file assert as an external fact that `glab` is
  not installed here, and both are false as of 2026-08-25: `/usr/bin/glab`,
  version 1.114.0. The first is in the module header's three-CLI block, which
  says the gitlab row "is proved by a captured sample and a PATH-injected stub,
  never a spawn"; the second is in `HOST_TABLE`'s header, which gives "inventing
  argv for a `glab` that is absent from this machine would ship an untestable
  change" as the reason the gitlab row carries no `resolve`. Correct both to what
  is true now, and correct them HONESTLY rather than by deleting the sentence:
  the binary is present and its version measured, the gitlab row's argv is still
  proved by a PATH-injected stub rather than a live spawn (that discipline is
  unchanged and is not a consequence of the binary's absence), and the reason the
  row carries no `resolve` is now that `glab` pages to its `--per-page` and the
  row's read is complete, not that nothing could be tested. Change no argv, no
  limit and no exported function in this file, and add no writing row to it - its
  "NOTHING HERE WRITES" claim is a property this phase leaves intact.
- **Verify:** `grep -n "absent from this machine\|No \`glab\` on this machine"
  cadence-core/bin/lib/issue-decision.mjs` returns nothing, the file still names
  glab 1.114.0 and the measurement date, `git diff` on this file shows comment
  lines only, and `node --test cadence-core/bin/issue-decision.test.mjs
  cadence-core/bin/issue-check.test.mjs` passes.

### Task 7: The refusal vocabulary is pinned forward

- **Files:** cadence-core/bin/reason-census.test.mjs,
  cadence-core/bin/lib/census-registry.mjs
- **Action:** This phase adds refusal arms and must be provably unable to have
  removed or renamed an existing one. Pin the vocabulary as a committed sorted
  list of the refusal `reason` tokens the tree carries, derived by a STATED
  method rather than by a number: read the sites with `refusalSites` from
  `lib/refusal-hints.mjs` - the scanner self-verify's own refusal-hint check
  already uses, so there is one definition of "this is a refusal" in the tree -
  keep the entries whose token is a plain string literal, and drop the sentinel
  and the interpolated ones, which are expressions rather than tokens and would
  pin a shape instead of a word. Assert FORWARD by set containment: every token
  on the committed list must still be produced by the live tree, and a token the
  live tree produces that the list does not carry PASSES. One-directional on
  purpose - criterion 9 requires a refusal arm that necessarily adds tokens, so a
  two-directional empty-diff would contradict it. The failure message names each
  missing token, since "a token vanished" is only actionable if you know which.
  The list is a hand-maintained census, so it carries a `CADENCE-CENSUS` marker
  at its assertion and a row in `CENSUSES` in `lib/census-registry.mjs` in the
  SAME commit - a marker with no row reddens the suite. Give the row subjects
  `cadence-core/bin/` and say in its `counts` text that additions pass, so a
  reader of a future plan-time refusal knows the row is asking them to confirm
  nothing was RENAMED rather than to justify a new reason. Record the count the
  method yields in the test's own header beside the method; the ROADMAP's figure
  of 112 was measured on 2026-08-24 by an unrecorded method and a count that
  cannot be re-derived is the kind of claim this repository treats as a defect.
- **Verify:** `node --test cadence-core/bin/reason-census.test.mjs` passes on the
  live tree. Deleting one token from the committed list still passes (additions
  are legal), and renaming one refusal's token in any file under
  `cadence-core/bin/` makes it FAIL naming that token - demonstrate both by
  temporary edit and revert. `node --test cadence-core/bin/census-registry.test.mjs`
  passes, which is what proves the marker has its row. Then the whole suite:
  `node cadence-core/bin/test.mjs` runs every group green and
  `npx tsc -p tsconfig.ci.json` exits 0.

### Task 8: The write proved against all three forges, live

- **Files:** .planning/phases/3/live-forge-check.md
- **Action:** Everything above is proved against PATH-injected stubs, which
  proves the argv and not the forge. Prove the argv against the real thing on
  all three providers and commit the transcript in the phase record, the way
  HST-02's live install proof was recorded. Three runs, each on a scratch
  repository the operator owns, none of them this one. Use a FIVE-finding fire,
  three accepted and two declined, so the same run also settles criterion 10's
  batching and criterion 11's one-query claim against a real tracker rather than
  a stub: file all five through `issue-filing.mjs file`, then run `unfixed` a
  second time against a payload carrying the SAME `(file, claim)` pairs and
  confirm the two declined ones do not come back. ONE of the three provider runs
  is driven by a REAL FIRE and not by those two subcommands: criterion 1 says
  "verified by running a gate that produces them", and a transcript of direct
  `file` and `unfixed` calls proves the seam while proving nothing about whether
  a firing site reaches task 5's ask at all, in its own step, before that step
  ends. For that one run, fire a `blocking`-gated trigger over a payload carrying
  the five findings, answer the ask it raises, and record where in the fire the
  ask appeared relative to the end of the step that produced the findings. A fire
  that never asks is the failure this run exists to catch, and no test in tasks
  1-5 can catch it - they prove the seam's argv and the reference's prose, not
  that a gate arm reaches either. Record for each provider:
  the exact argv the seam ran, the exit status, whether the decline label had to
  exist beforehand or the forge created it on the create call - the ROADMAP's
  open question, unanswerable without a live create - and what the CLI printed on
  success, to confirm the no-machine-readable-output reading task 2 pinned. Note
  any provider whose behaviour contradicts a row and fix the ROW, not the
  transcript. NO host, org or username may reach the implementation as a literal
  as a result of what is learned here: whatever the transcript shows, the fix
  belongs in the table's argv or its comment.
- **Verify:** human-verify. The operator runs the three live filings with `tea`,
  `gh` and `glab` authenticated against their own scratch repositories and
  observes: the gate-driven run ASKS - the ask arrives from inside the fire, in
  the step that decided, before that step ends, and the three accepted findings
  are issues on the tracker by the time that step returns; five findings produce
  ONE ask step, not five; three issues exist on
  each tracker without the decline label and two exist with it; the second
  `unfixed` returns the three accepted findings' peers and neither declined one;
  and `git status` shows `.planning/CAPTURE.md` unmodified after all three runs.
  The transcript is committed
  at `.planning/phases/3/live-forge-check.md`, and
  `grep -rn "jcrenshaw" cadence-core/` returns nothing outside test fixtures.

## Notes

- **This phase is two plans because of capacity, not independence.** Fourteen
  ROADMAP criteria do not fit one plan's eight-task ceiling. PLAN-1 and PLAN-2
  share declared files (`lib/arg-contract.mjs`, `arg-contract.test.mjs`,
  `self-verify.test.mjs`, `lib/census-registry.mjs`, `weight-budgets.json`,
  `trace.test.mjs`, `planning-lease-check.test.mjs`), so they are NOT independent
  slices: `plan-overlap` will route them sequential, which is the intended shape.
  Run PLAN-1 first - PLAN-2's phase-close assertion is the check on the mechanism
  PLAN-1 builds.
- **The reason-token census will be felt by later plans.** Its subjects are
  `cadence-core/bin/`, so any future plan touching a seam is refused at plan time
  until it declares `reason-census.test.mjs`. That is the honest scope - a
  removal or rename can happen in any of those files - and the tax is one lease
  line. A narrower subject set cannot be enumerated without guessing where the
  next refusal will be written.
- **`.planning/FILED.md` is a durable file that grows.** It is one pointer line
  per ACCEPTED filed issue - never a declined one, per criterion 1 - it is
  outside the CAPTURE walk, and no gate reads it as a queue; the accumulation the phase forbids is a queue of unresolved work in the
  file `/cad-plan` recalls from, not an index of what was filed. Chosen over
  `.planning/ARCHIVE.md` because criterion 7 states that file is UNTOUCHED, and
  over `.planning/CAPTURE.md` because criterion 1 requires it byte-unchanged.
- **Measured 2026-08-25 for this plan, from each CLI's own `--help`:** gh 2.98.0
  `issue create` has `--title`, `--body`, `--label`, `-R/--repo` and no JSON
  output flag; glab 1.114.0 `issue create` has `-t`, `-d`, `-l`, `-R` and
  `-y/--yes` "Don't prompt for confirmation to submit the issue"; tea 0.15.1
  `issues create` has `-t`, `-d`, `-L/--labels`, `-r/--repo`, `-l/--login`.
  `tea issues list` offers `--labels` and a `--fields` set including `title` and
  `labels`. That settles the ROADMAP's third open question - glab DOES block
  without `-y` - and leaves its label-autocreate question for task 8's live run.
- The task ceiling in the dispatch (8 per plan) replaces the template's
  "typical 3-10 tasks" line.
