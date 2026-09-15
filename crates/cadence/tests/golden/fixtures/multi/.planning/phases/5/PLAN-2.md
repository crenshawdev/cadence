---
phase: 5
plan: 2
requirements: [DOC-02]
files:
  - .planning/phases/5/docs-verify-run-2-b.md
---

# Phase 5: What Cadence claims about itself is true - Plan 2 (sweep, half B)

## Goal

Run 2's second half: the eleven N-Z workflow files run 1 recorded, plus a FOURTH
invocation over the four workflow files that ship with no ledger row at all, so
the four commands added since run 1 stop being unswept surface. Then the two
passes that leave NO ledgered row outside run 2's reach - a FIFTH invocation over
the three reference docs the ledger cites but no invocation names, and a targeted
per-row pass over the ten rows whose `doc` is a `.mjs` file.

## Must be true when done

- `.planning/phases/5/docs-verify-run-2-b.md` exists and states the sweep date,
  the HEAD sha it was read at, and all three invocation strings it ran - the third
  byte-identical to `.planning/DOCS-CLAIMS.md:30`, the fourth naming exactly
  `adopt.md`, `minimalism-review.md`, `report.md` and `suggest.md` and nothing
  else, the fifth naming exactly `cadence-core/references/config-catalog.md`,
  `cadence-core/references/recall.md` and
  `cadence-core/references/plan-revision.md` and nothing else.
- All eighteen swept filenames appear in that report, each with its own claim
  table in the `claim | location | verdict | correct value (if stale)` shape
  `cadence-core/workflows/docs-verify.md:46` states, and the report carries a
  further table for the three `.mjs` files covered by the targeted pass.
- No ledgered `doc` value is left unreached: running the check in task 6's verify
  against `.planning/DOCS-CLAIMS.md` names zero docs absent from this report and
  half A's.
- The fourth invocation's four tables are marked in the report as NEW surface -
  claims that were not part of run 1's 547 - so plan 3 can transcribe them into
  the ledger's post-run-1 section rather than into run 1's table.
- Every claim row carries one of exactly three verdicts - `accurate`, `stale`,
  `unverifiable` - and the report ends with a half-B headline count of the form
  `N accurate, M stale, K unverifiable` counted from the table ROWS, stated
  separately for invocation 3, invocation 4, invocation 5 and the targeted
  `.mjs` pass.
- No document under `cadence-core/workflows/` was edited by this plan -
  `git diff --name-only` over the plan's commit range names only the report file.

## Context

Locked by `phases/5/CONTEXT.md`: D-01 re-runs invocation 3 BYTE-IDENTICAL and
ADDS a fourth naming only the four zero-row workflows - widening invocation 3's
glob to reach them instead would make run 1's counts non-comparable, because the
surface would have changed underneath them. Two of the four (`report.md`,
`suggest.md`) make claims about the trace phase 2 rewrote, which is why they are
not deferred a second cycle. D-04 forbids changing `docs-verify.md`'s default
target set. `cadence-core/workflows/docs-verify.md` step 5 is binding: the sweep
STOPS at the report and edits no doc. This plan is a FRESH extraction and does
not read `.planning/DOCS-CLAIMS.md`. Out of scope: the ledger file, the three
direct prose edits, and the test assertions.

Invocations 5 and 6 (tasks 5 and 6) were added after the `plan` review trigger
adjudicated, on the user's call. They exist because 42 ledgered rows across six
files sat outside every invocation's target set and could therefore never carry a
run-2 verdict, which is phase success criterion 1 failing by construction rather
than by oversight. They honor the same two locked decisions the fourth invocation
does and for the same reason: D-01 keeps the three recorded invocation strings
byte-identical, so a new surface is reached by ADDING a named invocation and never
by widening a recorded one, and D-04 is untouched because an explicit-path
invocation changes no default target set. The fourth invocation is the precedent
this follows, not an exception to it. The `.mjs` rows get a targeted per-row pass
rather than a sixth invocation because the three files total 298,480 B to
re-verdict ten rows, and a sweep of that surface to decide ten claims is a trade
this project's token posture refuses; the cited sites are read directly instead.

## Tasks

### Task 1: Open the run-2 half-B report with its surface and invocations pinned

- **Files:** .planning/phases/5/docs-verify-run-2-b.md
- **Action:** Create the report file. Its header states: the sweep date, the
  output of `git rev-parse HEAD`, and the three invocation strings this half runs.
  The third is transcribed byte-identically from `.planning/DOCS-CLAIMS.md:30`
  (`new-project,phase,plan-gaps,plan,progress,spike,task,undo,verify-deep,verify,verify-sweep`).
  The fourth is written in the same shape as the recorded three -
  `/cad-docs-verify cadence-core/workflows/{adopt,minimalism-review,report,suggest}.md`
  - and the header states why it exists as a fourth rather than as a widened
  third: run 1 swept 21 workflows, `cadence-core/workflows/` now holds 25, and
  widening an existing invocation would move the surface run 1's 509/18/20 = 547
  counts were taken over. The fifth is written in that same shape -
  `/cad-docs-verify cadence-core/references/{config-catalog,recall,plan-revision}.md`
  - and the header states why it exists: those three files carry 32 ledgered rows
  and no invocation named them, so every one of those rows would keep a run-1
  verdict whatever this sweep found. The header also names the targeted `.mjs`
  pass task 6 runs and the three files it covers, so the report's surface is the
  whole ledgered set and a reader can see that it is. List the eighteen invocation
  files with each one's `wc -c` byte count and their total, and state that half A
  carries invocations 1 and 2. Include an unticked coverage checklist naming all
  eighteen filenames plus the three `.mjs` files, so a sweep truncated under
  context pressure is visible in the artifact. Do not extract or verify any claim
  in this task.
- **Verify:** The report quotes the invocation-3 string byte-identically to
  `.planning/DOCS-CLAIMS.md:30` with the numbering prefix stripped;
  `for f in new-project phase plan-gaps plan progress spike task undo verify-deep verify verify-sweep adopt minimalism-review report suggest config-catalog recall plan-revision self-verify trace planning; do grep -q "$f" .planning/phases/5/docs-verify-run-2-b.md || echo "MISSING $f"; done`
  prints nothing; and
  `grep -c "^- \[ \]" .planning/phases/5/docs-verify-run-2-b.md` returns 21 (the
  eighteen invocation files plus the three `.mjs` files, all still unticked at the
  end of this task).

### Task 2: Invocation 3 - the eleven N-Z workflow files

- **Files:** .planning/phases/5/docs-verify-run-2-b.md
- **Action:** Run invocation 3 exactly as recorded, following
  `cadence-core/workflows/docs-verify.md` steps 2 through 4 over those eleven
  files: extract the checkable claims (paths, commands, code symbols, CLI flags,
  config keys, env vars, stated structure, defaults, counts), verify each against
  the live tree with the cheapest check that decides it, and classify it
  `accurate`, `stale` or `unverifiable`. Batch the independent checks - path
  existence in one pass, symbol greps in one message, cited-code reads in one
  batch - and serialize only a check that needs a prior result. A false `stale`
  is worse than an `unverifiable`. The decisive check for most of this prose is
  grepping `cadence-core/bin/planning.mjs` and its `lib/` modules for the
  subcommand or flag the prose names, and reading the cited code where the claim
  is about behavior or a default. Three of these eleven moved during this cycle -
  `plan.md`, `new-project.md` and `verify-deep.md` changed since `81bdb5d`, and
  `plan.md` and `verify-deep.md` now call one `trace close` subcommand where they
  used to restate a `trace append --event return/checkpoint` pair - so record what
  the live file states rather than what a prior run recorded. Write one table per
  doc and tick each on the coverage checklist. Edit no document.
- **Verify:** The report carries eleven tables, one per file named in the
  invocation-3 string; every row carries a verdict from the set
  `accurate|stale|unverifiable` and a location cell naming a line or line range;
  and `git status --porcelain` shows no modification under `cadence-core/workflows/`.

### Task 3: Invocation 4 - the four workflow files run 1 never swept

- **Files:** .planning/phases/5/docs-verify-run-2-b.md
- **Action:** Run the new fourth invocation over
  `cadence-core/workflows/adopt.md`, `minimalism-review.md`, `report.md` and
  `suggest.md`, under the same steps 2-4 process and batching discipline. These
  four carry no run-1 row, so everything extracted here is NEW claim surface:
  head the group in the report as new surface and state that its rows are not
  part of run 1's 547, which is what lets plan 3 file them under the ledger's
  post-run-1 section without moving run 1's baseline. Pay particular attention to
  `report.md` and `suggest.md`: both describe the run record that phase 2 of this
  cycle rewrote, so their claims about `corr`, per-role token accounting,
  `recorded` counting and `trace suggest`'s rules are checked against the live
  `cadence-core/bin/lib/trace.mjs` and `cadence-core/bin/lib/trace-suggest.mjs`
  rather than assumed. `report.md` also changed since `81bdb5d`. Write one table
  per doc and tick each on the coverage checklist. Edit no document.
- **Verify:** The report carries four further tables headed `adopt.md`,
  `minimalism-review.md`, `report.md` and `suggest.md`, each marked as new
  surface; every row carries a verdict and a location cell; and
  `git status --porcelain` shows no modification under `cadence-core/workflows/`.

### Task 4: Invocation 5 - the three reference docs no invocation ever named

- **Files:** .planning/phases/5/docs-verify-run-2-b.md
- **Action:** Run the new fifth invocation over
  `cadence-core/references/config-catalog.md` (8,542 B, 29 ledgered rows),
  `cadence-core/references/recall.md` (2,638 B, 2 rows) and
  `cadence-core/references/plan-revision.md` (3,643 B, 1 row), under the same
  steps 2-4 process and batching discipline. Unlike invocation 4's four files,
  these three DO carry run-1 rows - 32 of them - because run 1's extraction
  re-pointed claims here from the docs that cite them, so their claims are NOT new
  surface and must not be headed as such: plan 3 joins them to existing rows on
  `doc` plus claim text. `config-catalog.md` is a config-key catalog, so the
  decisive check for most of its rows is reading the key's live default out of
  `cadence-core/templates/config.json` and its schema, not grepping prose.
  `plan-revision.md` is consumed by `cadence-core/workflows/plan.md`'s
  `check_gate` step, so a claim about when its loop runs is checked against that
  caller. Write one table per doc and tick each on the coverage checklist. Edit no
  document.
- **Verify:** The report carries three further tables headed `config-catalog.md`,
  `recall.md` and `plan-revision.md`, none of them marked as new surface; every
  row carries a verdict from the set `accurate|stale|unverifiable` and a location
  cell naming a line or line range; and `git status --porcelain` shows no
  modification under `cadence-core/references/`.

### Task 5: The targeted pass over the ten rows whose `doc` is a `.mjs` file

- **Files:** .planning/phases/5/docs-verify-run-2-b.md
- **Action:** Ten ledgered rows cite a `.mjs` file rather than a doc:
  `cadence-core/bin/lib/trace.mjs` (5 rows), `cadence-core/bin/planning.mjs` (4)
  and `cadence-core/bin/self-verify.mjs` (1). Verdict each of those ten by reading
  the cited SITE, not by sweeping the file - the three total 298,480 B and a full
  extraction over them to decide ten claims is the trade the Context above
  refuses. This is the one task in either sweep plan that reads
  `.planning/DOCS-CLAIMS.md`, and it reads it for the row list ONLY: take the ten
  rows' `doc`, `line` and claim text, open each cited line, and classify the claim
  `accurate`, `stale` or `unverifiable` against what the code there actually does.
  Where the claim is a docblock assertion about behavior, check the behavior and
  not the docblock - a comment agreeing with itself is the failure this ledger
  exists to catch. Record the results as one further table in the same
  `claim | location | verdict | correct value (if stale)` shape, headed as the
  targeted `.mjs` pass and NOT as new surface, with the live line in the location
  cell so plan 3 can re-pin from it. Edit no `.mjs` file.
- **Verify:** The report carries a table headed for the targeted `.mjs` pass with
  exactly ten rows; every row's location cell names one of the three `.mjs` files
  and a line; every row carries a verdict from the set
  `accurate|stale|unverifiable`; and `git status --porcelain` shows no
  modification under `cadence-core/bin/`.

### Task 6: State half B's counts, separated by invocation, and prove coverage

- **Files:** .planning/phases/5/docs-verify-run-2-b.md
- **Action:** Count the report's claim table ROWS - not any per-group headline -
  and write FOUR closing count lines of the form `N accurate, M stale, K
  unverifiable`: one each for invocation 3, invocation 4, invocation 5 and the
  targeted `.mjs` pass, each with its row total, kept separate so that run 2's
  comparison against run 1's 547 is taken over the re-run invocations alone and
  every surface added this cycle is added visibly rather than silently. Only
  invocation 3's line is comparable to run 1. Run 1's per-group headlines each
  undercounted their own group (`.planning/DOCS-CLAIMS.md:19-23`); the rows are
  the record, so state the row count and say that it is the row count. List the
  stale rows first in a summary block. Tick the coverage checklist to complete and
  assert in prose that all eighteen invocation filenames and all three `.mjs`
  files carry a table; if any does not, stop and report the missing file rather
  than closing the count over a partial surface.
- **Verify:** All four count lines' numbers sum to their group's claim-row count
  in the file; `grep -c "^- \[x\]" .planning/phases/5/docs-verify-run-2-b.md`
  returns 21 and `grep -c "^- \[ \]" .planning/phases/5/docs-verify-run-2-b.md`
  returns 0; and every `doc` value in `.planning/DOCS-CLAIMS.md` whose file is not
  one of half A's fourteen appears in this report, checked by
  `node -e 'const f=require("fs");const L=f.readFileSync(".planning/DOCS-CLAIMS.md","utf8").split("\n");const r=f.readFileSync(".planning/phases/5/docs-verify-run-2-b.md","utf8");const a=f.readFileSync(".planning/phases/5/docs-verify-run-2-a.md","utf8");const s=new Set();for(const l of L){const m=l.match(/^\|\s*[A-Z][A-Z0-9-]*\s*\|\s*([^|]+?)\s*\|/);if(m)s.add(m[1])}for(const d of s){const b=d.split("/").pop();if(!r.includes(b)&&!a.includes(b))console.log("UNREACHED",d)}'`
  printing nothing.

## Notes

This plan and plan 1 are the two halves of one sweep, split on capacity. They
share no files and neither depends on the other's output, so they run in
parallel. Plan 3 consumes both reports.

Task 5 reads `.planning/DOCS-CLAIMS.md` for its ten-row list, which is the one
exception to this plan's "does not read the ledger" rule. It stays a READ: the
plan's declared `files:` is unchanged, plan 3 remains the only writer of the
ledger, and the two plans are still safe to run in their stated order rather than
concurrently against one file.
