---
phase: 5
plan: 1
requirements: [RME-01]
files:
  - README.md
  - docs/COST.md
  - docs/EXAMPLE.md
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - LINEAGE.md
  - .planning/DOCS-CLAIMS.md
---

# Phase 5: A README that asks for a decision - Plan

## Goal

`README.md` stops being a 24.8 KB reference manual and becomes the document that
asks one decision - whether to install this - with the cost-to-run section and
the worked example relocated to `docs/`, the command list cut, and every
surviving claim verified rather than carried across.

## Must be true when done

- `README.md` states what the run demands before it asks for the install
  decision: the demand section sits above `## Install`, and the whole stretch
  from line 1 to the end of `## Install` reads in plain language, naming no
  gate, seam, rung, dispatch, adversarial, traceability or subagent.
- The landing page carries no reference material: `## The commands`,
  `## A worked example` and `## What it costs to run` are gone, and one line
  points at `/cad-help` and `cadence-core/references/COMMANDS.md` where a
  21-bullet command list used to be.
- `docs/COST.md` and `docs/EXAMPLE.md` carry the relocated material in the three
  sibling pages' shape, are reachable from the landing page, and neither
  re-creates the command list.
- Everything under `docs/` is CI-enforced: `node cadence-core/bin/self-verify.mjs`
  walks `docs/` and returns `ok:true` with an empty `problems` array, so
  `README.md`'s claim that CI fails the build when the prose drifts from the
  code is true of the relocated claims too.
- No figure survives the move unverified: the string `5,397` is gone from
  `README.md` and from every `docs/` file, and `LINEAGE.md`'s Agents and Skills
  counts agree with the tree and with README's own count sentence.
- `.planning/DOCS-CLAIMS.md` still joins on `doc` plus claim text: every
  `README-*` row either names the `docs/` file its claim now lives in, carries a
  `RETIRED - <reason>` resolution because its sentence was cut, or cites a line
  in the current `README.md` that states its claim.
- `node cadence-core/bin/test.mjs` passes, including
  `prose-agreement.test.mjs`'s "27 skills and 6 agent roles across 19 rung
  files" match.

## Context

CONTEXT.md's decisions are locked and bind every task here: D-01 (plain-language
register through `## Install`), D-02 (demand wording, above Install), D-03
(`## The commands` is CUT, no `docs/` command page), D-04 (`docs/` page
conventions and an ~80-column re-wrap), D-05 (`docs/` joins the self-verify walk
in THIS phase), D-06 (`README.md`'s CI-drift claim is not softened), D-07 (the
ledger split and a re-derived pin on every `README-*` row), D-10 (the `5,397`
figure is cut, not re-measured), D-11 (`LINEAGE.md`'s published counts) and D-12
(the test badge stays).

The three `docs/` siblings to match are `docs/DISCOVERY.md`, `docs/WORKFLOW.md`
and `docs/EVIDENCE.md`. Section sizes at HEAD, measured 2026-08-19: the worked
example is 2,795 B (lines 84-101), `## The commands` 3,128 B (103-133), the
cost-to-run section 3,763 B (134-145), `## How it works` 5,913 B (24-40), the
demand section 687 B (18-23); the file is 24,850 B over 152 lines.

Out of scope and not to be touched: any `docs/` command page,
`cadence-core/references/COMMANDS.md`, `/cad-docs-verify`'s default sweep set
(already `README.md` plus `docs/**`), a doc-size or heading-structure CI check,
`.planning/PROJECT.md:77`'s stale "badge removed" line, and the four network- or
billing-bound claims CONTEXT flags as permanently unverifiable.

## Tasks

### Task 1: Put `docs/` on self-verify's markdown walk

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** Add the repo's `docs` directory to the `dirs` array inside the
  `mdFiles` generator in `cadence-core/bin/self-verify.mjs`, so every `.md` file
  under `docs/` is read by the same checks that already read `README.md`,
  `INTERNALS.md` and `METHOD.md`. This lands FIRST, before any prose moves,
  because it is the seam every later task depends on: without it, every config
  key, script invocation and repo path that leaves README stops being
  CI-enforced the moment it moves (D-05). Update the two comments in that file
  that enumerate the walked surface set - the module header comment near the top
  and the comment directly above the
  `['README.md', 'INTERNALS.md', 'METHOD.md']` loop at the end of `mdFiles` -
  since both state a set the code would no longer have. `mdFiles` already guards
  each entry with an `existsSync` skip, so a fixture root with no `docs/`
  directory needs no change. Do NOT add `docs/` to the weighed-surface walk in
  `cadence-core/bin/lib/surface-weight.mjs` or to
  `cadence-core/bin/weight-budgets.json`: measured 2026-08-19, `docs/` is on
  neither, `cadence-core/bin/weight.test.mjs` pins that separation for
  `README.md` already, and adding it there would report all three existing pages
  as `unbudgeted-surface`. D-05 also asks that whatever the walk surfaces in the
  three existing pages be fixed here; measured 2026-08-19 on a copy of this tree
  with the one-line change applied, it surfaces nothing - self-verify returns
  `ok:true` with an empty `problems` array and the two `weight.mjs` invocations
  at `docs/EVIDENCE.md:52,59` both satisfy the `CONTRACTS` table - so there is
  nothing to fix and none should be invented. Add a test to
  `cadence-core/bin/self-verify.test.mjs` that builds a fixture root carrying a
  `docs/` page with one out-of-contract script flag and asserts the returned
  problem names that `docs/` path, so a future edit that drops the directory
  from the walk reddens instead of going quiet.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with an
  empty `problems` array; ``grep -n "'docs'" cadence-core/bin/self-verify.mjs``
  shows it inside the `mdFiles` `dirs` array; the new test is watched failing
  against the unpatched walk by temporarily reverting that one-line addition and
  re-running it, then passing with it back in; `node cadence-core/bin/test.mjs`
  passes.

### Task 2: Relocate the cost-to-run section to `docs/COST.md`

- **Files:** docs/COST.md, README.md
- **Action:** Create `docs/COST.md` carrying `README.md`'s
  `## What it costs to run` (HEAD lines 134-145, three paragraphs, 3,763 B), and
  delete that heading and its body from `README.md`. Match the three sibling
  pages exactly (D-04): an `# Title` H1, a bold one-line subtitle under it, no
  front matter, no back-link to `../README.md` - a link class no existing
  `docs/` page has and no check validates - and re-wrap every relocated
  paragraph to about 80 columns. README wraps at up to 1,635 columns today, so a
  byte-for-byte move would hide which words the accuracy pass changed; the
  re-wrap is what makes the diff readable. Cut the closing clause of the v2.3.0
  paragraph, "And the skill and agent descriptions, which ride the system prompt
  of every session in every project whether or not you ever run a Cadence
  command, went from 8,550 bytes to 5,397" (D-10): it is the section's one
  measurably-false figure, the live value being 6,034 B across 52 skill and
  agent frontmatter blocks measured 2026-08-19, and it is the only figure in the
  section carrying no historical frame, since commit `1154790`'s "measured at
  v2.3.0" sentence is scoped to the preceding sentence only. Cut rather than
  re-measure: a re-measured byte count is stale again next cycle, and
  `docs/EVIDENCE.md` already argues for pointing at checked-in derived data.
  Keep the `node cadence-core/bin/weight.mjs resident --root .` pointer and the
  `docs/EVIDENCE.md` link in that same paragraph - they are what replaces the
  cut figure. Move the four network- and billing-bound figures unchanged: the
  7,548-request account-usage line and the v2.3.0 turn-one byte figures are
  recorded permanently unverifiable at `.planning/DOCS-CLAIMS.md:510,516,1179`,
  nothing in-tree can settle them, and softening them is not this phase. Add a
  link to the new page from README's pointer paragraph (HEAD line 40, the one
  that already links `METHOD.md`, `INTERNALS.md`, `docs/WORKFLOW.md` and
  `docs/EVIDENCE.md`) so the relocated material stays reachable from the landing
  page. Write no `/cad-*` command list on this page.
- **Verify:** `grep -c '## What it costs to run' README.md` returns 0;
  `grep -c '5,397' README.md docs/*.md` returns 0 for every file listed;
  `grep -c '8,550' docs/COST.md` returns 0;
  `grep -c 'weight.mjs resident' docs/COST.md` returns at least 1;
  `head -3 docs/COST.md` shows an H1, a blank line, then a bold one-line
  subtitle, the same shape `head -3 docs/EVIDENCE.md` shows;
  `awk 'length>97' docs/COST.md` prints nothing and `awk 'length>80' docs/COST.md | wc -l`
  is at most 2, matching `docs/EVIDENCE.md`'s own maxima;
  `grep -c 'docs/COST.md' README.md` is at least 1;
  `node cadence-core/bin/self-verify.mjs` returns `"ok":true` with an empty
  `problems` array.

### Task 3: Relocate the worked example to `docs/EXAMPLE.md`

- **Files:** docs/EXAMPLE.md, README.md
- **Action:** Create `docs/EXAMPLE.md` carrying `README.md`'s
  `## A worked example` (HEAD lines 84-101, 2,795 B, including its fenced
  four-command block), and delete that heading and its body from `README.md`.
  Same conventions as task 2 (D-04): `# Title`, a bold one-line subtitle, no
  front matter, no `../README.md` back-link, prose re-wrapped to about 80
  columns, and the fenced block left as a fence. This is an accuracy pass, not a
  move: re-read each claim against the tree as it is re-wrapped, in particular
  the `/cad-milestone` and `/cad-land` sentence (HEAD line 99), which names
  `/cad-suggest`'s retune output and `git.issue_check`. Phases 1-4 of this cycle
  invalidated nothing here - checked 2026-08-19, the only seam README names is
  `planning.mjs risk-check run` at HEAD line 60 in a section that is not moving
  (D-09) - so a correction found here is a real one and must be recorded in the
  ledger by task 8 rather than made silently. Add a link to the new page from
  README's pointer paragraph beside task 2's, so the relocated material stays
  reachable. Write no `/cad-*` command list on this page: naming the commands
  the narrative walks through is what the worked example is, and that is not a
  list.
- **Verify:** `grep -c '## A worked example' README.md` returns 0;
  `ls docs/EXAMPLE.md` resolves; `head -3 docs/EXAMPLE.md` shows an H1, a blank
  line, then a bold one-line subtitle; `awk 'length>97' docs/EXAMPLE.md` prints
  nothing and `awk 'length>80' docs/EXAMPLE.md | wc -l` is at most 2;
  `grep -c 'docs/EXAMPLE.md' README.md` is at least 1;
  ``grep -c '^- \*\*`/cad-' docs/EXAMPLE.md`` returns 0;
  `node cadence-core/bin/self-verify.mjs` returns `"ok":true` with an empty
  `problems` array.

### Task 4: Cut `## The commands` and fold its three sharpest arguments into How it works

- **Files:** README.md
- **Action:** Delete `## The commands` (HEAD lines 103-133, 21 bullets, 3,128 B)
  entirely and write no `docs/` command page (D-03). It is not a table but 21
  bullets in argument voice that deliberately omit the six build-spine commands
  The loop already covers narratively, `cadence-core/references/COMMANDS.md`
  already publishes all 27 in reference voice where a browser can read them, and
  a section that fails the staying test does not belong in `docs/` either.
  Fold the arguments of exactly three bullets into `## How it works` - chosen
  2026-08-19 as the three that argue rather than list and whose point is made
  nowhere else on the page (CONTEXT leaves this choice to the planner):
  `/cad-audit`'s catch of silently-dropped work, where every requirement traces
  to a phase, a plan and a verification and every acceptance criterion to the
  check that tested it; `/cad-minimalism-review`'s ranked delete-list over code
  that works and should not exist, which applies none of it; and `/cad-report`'s
  trace pricing every subagent Cadence runs, which is where you read the bill -
  the last one matters more now that the cost section has left the page. Fold
  them as prose in the section's own voice, never as a bullet list: the bullet
  form is the reference shape being removed, and re-creating it under another
  heading defeats the cut. Add exactly one line naming both `/cad-help` and
  `cadence-core/references/COMMANDS.md` as where the full command reference
  lives, placed at the end of `## The loop`, which is where the page has just
  named the five spine commands (CONTEXT fixes no location; this is the
  planner's choice). This cut removes accurate prose rather than wrong prose -
  measured 2026-08-19, all 21 commands in the section exist and README's 27
  named `/cad-*` commands match the 27 user-invocable skills exactly (D-08) - so
  nothing here is a correction and task 8 retires the affected ledger rows
  rather than rewriting their claims.
- **Verify:** `grep -c '## The commands' README.md` returns 0;
  ``grep -c '^- \*\*`/cad-' README.md docs/*.md`` returns 0 for every file
  listed, against 21 in `README.md` and 0 in all three `docs/` pages at HEAD, so
  this pins both that the list is gone and that it was not re-created elsewhere;
  ``grep -c '/cad-help' README.md`` finds a line that also matches
  `cadence-core/references/COMMANDS.md`, and exactly one line matches both;
  `grep -c '/cad-audit\|/cad-minimalism-review\|/cad-report' README.md` is at
  least 3; `node cadence-core/bin/self-verify.mjs` returns `"ok":true` with an
  empty `problems` array and `node cadence-core/bin/test.mjs` passes.

### Task 5: Move the demand section above Install and hold the plain-language register

- **Files:** README.md
- **Action:** Rewrite `## What it costs you` (HEAD lines 18-23, 687 B) into the
  demand section and move it to sit between the opening paragraph and
  `## Install`. The current order asks for the install decision before
  disclosing the price; this reverses that. It must name the moments the run
  stops and waits for a decision - before it plans, at every check it runs, and
  before it pushes anything - and state NO count (D-02).
  `docs/WORKFLOW.md:32-50` counts fifteen decision points of which most are
  system-answered, so fifteen overstates the felt interruption while omitting
  the push stop; and the count of unconditional stops drifts as the gates move.
  The push stop is the one worth naming and is unconditional:
  `cadence-core/bin/git-guard.mjs` states in its own header that EVERY Bash
  `git push` the hook sees asks, with no exemption living there. Carry the
  sentence "if you want to describe a feature and come back to a merged PR, this
  is the wrong tool" verbatim. State the DEMAND and never a label - a label
  invites a reader to self-identify into the flattering box, a demand makes them
  do the arithmetic about their own habits. From line 1 through the end of
  `## Install` the page must contain none of the words gate, seam, rung,
  dispatch, adversarial, traceability or subagent (D-01): today "gates" on line
  20 and "gate" on line 22 are the only two occurrences in that stretch and both
  sit in the text being rewritten, so the rewrite is what removes them. Cadence's
  own vocabulary resumes at `## The loop`, on the reasoning that a reader who has
  installed it has bought in. Leave the test badge on line 3 exactly as it is -
  `.planning/PROJECT.md:77` still records it as removed, which is the stale half
  and is not this phase's to correct (D-12) - and do not touch the opening
  paragraph or the `## Install` body.
- **Verify:** `awk '/^## /&&seen{exit} /^## Install$/{seen=1} {print}' README.md`
  emits the stretch from line 1 through the end of `## Install`; piping it to
  `grep -Eic 'gate|seam|rung|dispatch|adversarial|traceabilit|subagent'` returns
  0, and piping it to `grep -n '^## '` shows the demand section's heading on a
  lower line number than `## Install`;
  `grep -c 'if you want to describe a feature and come back to a merged PR, this is the wrong tool' README.md`
  returns 1; piping that same awk output to
  `grep -Eic '(fifteen|[0-9]+) (times|stops|decision|gates)'` returns 0 and a
  read of the stretch confirms it states no count of stops or gates in any other
  spelling; `sed -n '3p' README.md` is byte-identical to
  `git show HEAD:README.md | sed -n '3p'`;
  `node cadence-core/bin/self-verify.mjs` returns `"ok":true` with an empty
  `problems` array.

### Task 6: Order the staying sections and compress How it works

- **Files:** README.md
- **Action:** Move `## The loop` above `## How it works` so the staying sections
  read in exactly this order: the opening paragraph, the demand section,
  `## Install`, `## The loop`, `## How it works`, `## What a break costs`,
  `## Where it came from`. Then compress `## How it works` (5,913 B across seven
  paragraphs at HEAD) to the argument only. Four claims are load-bearing and
  stay: that nothing important lives in the conversation and every command
  rebuilds what it needs from `.planning/` and git; that a check which could not
  run never passes and uncertain counts toward neither side; that the git rails
  are a PreToolUse hook rather than a paragraph, because a model will talk
  itself around a paragraph; and the reviewer posture, where every backend
  returns the same shape so the adjudicator cannot discount a finding for being
  cheap, convergence is the one strong signal, and what survives comes back as a
  numbered list defaulting to none. The three arguments task 4 folded in stay
  too, as does the pointer paragraph that links `METHOD.md`, `INTERNALS.md`,
  `docs/WORKFLOW.md`, `docs/EVIDENCE.md` and the two pages tasks 2 and 3
  created. The bytes are in the two war-story paragraphs at HEAD lines 34 and
  36, the `isPlainPush` rounds and the 2,251-line tokenizer deletion: compress
  those into the rule they teach - do not try to out-parse an attacker, delete
  the thing you would have had to parse - rather than deleting the lesson, which
  is the section's strongest argument for why the rails are shaped the way they
  are. Do not touch `## What a break costs` or `## Where it came from`: checked
  2026-08-19, phases 1-4 of this cycle invalidated no claim in either, the
  changed reason codes and the `detect-commands` PATH check appear nowhere in
  the file, and `README.md:150`'s CI-drift sentence stays true as written and is
  NOT softened (D-06, D-09).
- **Verify:** `grep -n '^## ' README.md` lists the headings in exactly this
  order - the demand heading, `## Install`, `## The loop`, `## How it works`,
  `## What a break costs`, `## Where it came from` - and lists no
  `## The commands`, `## A worked example` or `## What it costs to run`;
  `awk '/^## How it works$/{f=1;print;next} f&&/^## /{exit} f' README.md | wc -c`
  returns under 4,500, against 5,914 at HEAD, while a read of that same output
  confirms all four load-bearing claims and the three folded command arguments
  are still stated; `wc -c README.md` returns under 15,000, against 24,850 at
  HEAD; `grep -c 'CI fails the build when the prose drifts from the code' README.md`
  returns 1; `node cadence-core/bin/self-verify.mjs` returns `"ok":true` with an
  empty `problems` array and `node cadence-core/bin/test.mjs` passes, including
  `prose-agreement.test.mjs`'s "27 skills and 6 agent roles across 19 rung
  files" match.

### Task 7: Re-measure `LINEAGE.md`'s Agents and Skills counts

- **Files:** LINEAGE.md
- **Action:** `LINEAGE.md`'s distance table still publishes `| Agents | 34 | 7 |`
  and `| Skills | 71 | 22 |` in its Cadence column, while line 34 of the same
  file already reads "Cadence's 6 agent roles, materialized as 19 rung files"
  and `README.md`'s `## Where it came from` says "Today it is 27 skills and 6
  agent roles across 19 rung files" and points at this file as the one that
  publishes the counts. Shipping a landing page that points at a file
  contradicting the sentence above the pointer is not acceptable (D-11).
  Re-measure both Cadence-column cells by the method the file's own Provenance
  paragraph names, `find`/`wc` over `agents/` and `skills/`, which gives 19
  agent files and 33 skill directories at 2026-08-19, and state the
  decomposition beside each number so the row agrees with README rather than
  reading as a third figure: 19 rung files materializing 6 roles, and 33 skills
  of which 27 are user-invocable and 6 are preloaded contract skills carrying
  `user-invocable: false`. Recompute the Retained cell on those two rows from
  the new numerators. Change no other row - documentary mass, Workflows,
  References, Commands, Capabilities and the `src/` row all keep their
  2026-07-10 figures - and amend the Provenance paragraph so the file does not
  claim a 2026-07-10 measurement date for the two cells that were re-measured
  today. Nothing in CI will catch a mistake here: `self-verify.mjs` deliberately
  excludes `LINEAGE.md` as a historical doc, and
  `cadence-core/bin/prose-agreement.test.mjs` says in its own comment that its
  count test is scoped to `README.md` only and that `LINEAGE.md`'s duplicate
  counts stay a queue item. That exclusion is not being changed here; the
  numbers have to be read against the tree by hand.
- **Verify:** `ls agents/*.md | wc -l` returns 19 and `ls -d skills/*/ | wc -l`
  returns 33 and `grep -L 'user-invocable: false' skills/*/SKILL.md | wc -l`
  returns 27, and the Agents and Skills rows of `LINEAGE.md`'s distance table
  name those numbers with those decompositions;
  ``grep -c '| 34 | 7 |' LINEAGE.md`` and ``grep -c '| 71 | 22 |' LINEAGE.md``
  both return 0; `diff <(git show HEAD:LINEAGE.md | grep '^| ') <(grep '^| ' LINEAGE.md)`
  shows changes on the Agents and Skills rows and on no other table row;
  `node cadence-core/bin/test.mjs` passes.

### Task 8: Re-point, retire and re-pin every `README-*` ledger row

- **Files:** .planning/DOCS-CLAIMS.md
- **Action:** The ledger joins on `doc` plus claim text, so a bare move breaks
  the join and the next sweep reports vanished claims plus new extractions
  instead of a diff (D-07). There are 86 `README-*` rows, ids README-01 through
  README-86, across two tables. RE-POINT the six worked-example rows README-35,
  -36, -37, -73, -74 and -85 to `docs/EXAMPLE.md`, and the eight cost-to-run
  rows README-41, -48, -49, -51, -79, -80, -81 and -82 to `docs/COST.md`, in
  each case changing only the `doc` and `line` cells and preserving the claim
  text. RETIRE seven rows under the ledger's existing convention, which is a
  `RETIRED - <reason>` value in the RESOLUTION cell with the `line` cell set to
  an em dash, exactly as `PLAN-03` carries it: the six command-list rows
  README-39, -40, -76, -77, -78 and -86, whose sentences task 4 cut rather than
  moved, and README-50, whose sentence is the `8,550 bytes to 5,397` clause task
  2 cut under D-10 - README-50 is listed among D-07's nine re-pointing rows, but
  D-07's own stated basis for retiring is that the sentence was cut rather than
  moved, and re-pointing it would leave a row citing a claim that exists in no
  file. Note in the return that this departs from D-07's literal list.
  README-38 and README-75 each straddle - each cites two lines, one in the
  worked example and one in the cut command list - and are judged individually:
  record for each which cited statement survives and where it now lives, and if
  half the claim was cut so the claim TEXT has to change, call that rewrite out
  in a narrative paragraph the way the ledger already does for README-44, since
  a silently rewritten claim joins to nothing in the next sweep. Then RE-DERIVE
  every surviving row's `line` cell from the post-change files rather than
  shifting the existing pins. A blanket shift is wrong in both directions:
  commit `c99b778` inserted two lines for the test badge on 2026-08-17, so rows
  pinned before that date are stale by two, but rows written after it - README-74
  among them, blamed to 2026-08-18 and already citing the correct line 99 - are
  not, and shifting those would break rows that are currently right. Add a dated
  narrative paragraph recording this split, following the convention the
  existing paragraphs use for the v3.1.0 phase-2, phase-3 and phase-5 re-pins.
  Change no `verdict` cell: the command list was NOT stale, so its rows retire
  rather than being recorded as corrections (D-08).
- **Verify:** Every `README-*` row's `doc` cell is one of `README.md`,
  `docs/EXAMPLE.md` or `docs/COST.md`, with at least six naming `docs/EXAMPLE.md`
  and at least eight naming `docs/COST.md`;
  `grep -c 'RETIRED' .planning/DOCS-CLAIMS.md` accounts for seven new
  `README-*` rows plus the one pre-existing `PLAN-03` row, and each of
  README-39, -40, -50, -76, -77, -78 and -86 carries `RETIRED - ` in its
  resolution cell with an em dash in its `line` cell; a throwaway script - kept
  out of the repo - that reads each `README-*` row whose `doc` is `README.md`,
  extracts the backticked literals from its claim text, and asserts at least one
  of them appears on the pinned line or inside the pinned range of the
  post-change `README.md` reports zero misses, against 47 misses when the same
  script is run against HEAD, and the same script run with the `doc` cell
  pointing at each new `docs/` page reports zero misses there too; the rows whose
  claim carries no backticked literal (33 of the 86 at HEAD) and the rows whose
  only literals are generic words like `solo`, `shipped`, `high`, `node` or
  `git` are confirmed by reading, because the script can pass those by
  coincidence - `README-21` does exactly that at HEAD - and any row that cannot
  be resolved is named in the return rather than re-pinned by guess.

## Notes

- Plan shape follows the CONTEXT directive: one plan. Every task writes
  `README.md` or a file another task also writes, so no independent slice
  exists and a split would violate the shared-file test.
- Task 1 lands the enforcement seam before any prose moves, so tasks 2-6 are
  each written under the lint rather than checked by it at the end. That is
  deliberate: `docs/EVIDENCE.md:52,59` already carried two unchecked
  `weight.mjs` invocations as the live precedent for what happens when a
  key-and-path-dense page is off the walk.
- Two `docs/` filenames were left to the planner. `docs/COST.md` and
  `docs/EXAMPLE.md` match the siblings' single-noun uppercase convention
  (`DISCOVERY.md`, `EVIDENCE.md`, `WORKFLOW.md`); each page's H1 disambiguates
  `COST.md` from the landing page's surviving `What a break costs` section.
- Which two or three command bullets survive was also left to the planner. Task
  4 names three and the reason for each. `/cad-coverage`'s bullet was the
  strongest rejected candidate: `## How it works` already states that a test
  which would still pass if the behavior were wrong is not coverage.
- D-07 lists README-50 among the nine cost-to-run rows that re-point, while
  D-10 cuts the sentence that row cites. Task 8 retires it instead, which
  applies D-07's own stated retirement rule; flagged here and in the return
  marker rather than resolved silently.
- The `docs/` walk addition was measured on a copy of this tree on 2026-08-19:
  `self-verify` stays `ok:true` with `docs/` on the walk, and stays `ok:true`
  after the two sections are relocated into `docs/` pages, with the full suite
  at 2,379 passing. So no pre-existing `docs/` defect is hiding behind task 1,
  and the executor should treat a problem appearing there as new.
- AC6 in CONTEXT says the six command-list rows "each carry a `RETIRED`
  verdict"; the ledger's convention puts `RETIRED - <reason>` in the RESOLUTION
  cell and leaves the verdict as the sweep recorded it (`PLAN-03` is the
  precedent). Task 8 follows the ledger's convention.
