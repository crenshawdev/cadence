---
phase: 2
plan: 1
requirements:
  - PRN-01
  - TRK-01
files:
  - cadence-core/bin/milestone-prune.test.mjs
  - cadence-core/bin/lib/milestone-prune.mjs
  - cadence-core/bin/issue-check.test.mjs
  - cadence-core/bin/lib/issue-decision.mjs
  - cadence-core/bin/issue-decision.test.mjs
  - cadence-core/bin/issue-check.mjs
  - skills/cad-land/SKILL.md
  - cadence-core/bin/weight-budgets.json
  - .planning/DOCS-CLAIMS.md
---

# Phase 2: The seams that fail quietly - Plan

## Goal

Two shipped seams stop degrading silently on the repository they were built in -
a wrapped requirement bullet survives the prune whole, and a Forgejo remote whose
SSH endpoint differs from its web host produces a tracker report.

## Must be true when done

- Pruning a fixture whose `## Active` bullets WRAP removes each completed
  bullet's whole span - lead line plus its indented continuation lines - leaving
  no orphaned prose fragments behind, leaving the section's trailing column-0
  paragraph intact, and treating a `## Active` heading inside a code fence as not
  the section.
- An archived `## Shipped` row's parenthetical is that same span joined on single
  spaces, byte-faithful with no lowercasing, and any `|` inside it is escaped so
  the row still carries exactly five unescaped pipes.
- The same transform run over a copy of this repository's own
  `.planning/REQUIREMENTS.md` produces a file needing no hand repair: none of a
  moved bullet's continuation lines survive anywhere in the text, every row under
  `## Shipped` is five-piped, and every new parenthetical is the whole span.
- `issue-check.mjs` reports for a remote whose SSH host differs from its web host
  but shares a registrable domain with a `tea` login, and still skips - with the
  existing no-login line, and with no forge CLI call beyond the login probe - for
  a remote sharing no registrable domain with any login.
- The five genuine degradations are unchanged and reason-unique: no remote,
  unrecognized host, missing CLI, no login, nonzero exit. `/cad-land` still never
  blocks on the tracker.
- On this repository, `/cad-land`'s tracker step reports the issues this branch
  references instead of printing a skip line (human-verify: needs the live
  git.jcrenshaw.dev tracker).
- `node --test 'cadence-core/bin/*.test.mjs'` and
  `node cadence-core/bin/self-verify.mjs` both run clean.

## Context

CONTEXT.md D-01..D-13 are locked and bind every task below; each task names the
ones it implements. The two requirements touch disjoint files
(`lib/milestone-prune.mjs` versus `issue-check.mjs` + `lib/issue-decision.mjs`),
which is why this is one plan and not two - they share no surface, but the
`Plan shape` directive is one plan and the file-independence test permits it.
Out of scope: the two `## Shipped` rows already broken by unescaped pipes
(`CFG-01`, `RVW-01`) are NOT repaired here; the `tea` 50-row page clamp is worked
around per D-08, not fixed; phase 1's `git.auto_close` work is complete and in
other files.

Tasks 1 and 5 land the regression cover FIRST and it goes red on purpose - that
is ROADMAP criterion 2 ("fails against the current implementation before the
fix") and criterion 4, and it is the shape phase 1 used (`fdc13d2` then
`65dd7ba`). Tasks 2-4 and 6-7 turn it green.

## Tasks

### Task 1: Pin the wrapped-bullet prune, watched to FAIL

- **Files:** cadence-core/bin/milestone-prune.test.mjs
- **Action:** Add regression cover for the defect PRN-01 names, red against the
  tree as it stands. Three additions, all beside the existing `REQUIREMENTS`,
  `HELD` and `twoBullets` fixtures rather than replacing them: (a) a new fixture
  whose `## Active` bullets WRAP - a lead `- **ID**:` line plus indented
  continuation lines, at least one bullet carrying a `|` in its text, and the
  section closing with a column-0 prose paragraph after a blank line, which is
  the exact shape `.planning/REQUIREMENTS.md` lines 18-65 has; (b) a fixture
  carrying a fenced `## Active` example ABOVE the real one, so the bound can be
  proved fence-aware; (c) a corpus test that reads this repository's own
  `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` through a repo root
  computed the way `prose-agreement.test.mjs` computes its `REPO`, takes
  `completedPhases` off the roadmap, calls `archiveRequirements` with a label,
  and asserts three properties over the result: no line of a moved bullet's
  original span survives anywhere in the text, every row under `## Shipped`
  carries exactly five UNESCAPED pipes, and each moved id's new parenthetical
  equals that id's whole span joined on single spaces with `|` escaped as `\|`.
  Assert the byte-faithful direction explicitly (D-05): the archived text keeps
  the span's first letter as authored, so an assertion may not expect a
  lowercased leading word. The fixture assertions must also pin what survives -
  the trailing column-0 paragraph, an unshipped id's whole wrapped bullet, and a
  bullet inside the fenced example - because a span reader that overshoots is the
  failure D-01 names. Do not touch the existing tests or `lib/milestone-prune.mjs`
  in this task.
- **Verify:** `node --test cadence-core/bin/milestone-prune.test.mjs` FAILS, and
  the failures are only the new arms: the orphaned-continuation assertion, the
  truncated-parenthetical assertion, the fenced-`## Active` assertion and the
  corpus assertions. Every pre-existing test in the file still passes.

### Task 2: Read the whole bullet span in both halves of archiveRequirements

- **Files:** cadence-core/bin/lib/milestone-prune.mjs
- **Action:** In `archiveRequirements`, make both halves of the transform read a
  bullet SPAN instead of one physical line (D-01, PRN-01, and the CAPTURE.md
  promotion note that recorded three consecutive hand repairs). The span is the
  lead line matching the existing narrow `- **<ID>**:` form plus every following
  non-blank line that begins with whitespace; a blank line or a column-0 line
  ends it. The `## Active` removal drops the whole span, so no continuation line
  is left behind; the summary captured into `summaries` is that same span with
  each line trimmed and joined on single spaces, with no length cap (D-09) and no
  lowercasing of the first letter (D-05) - the archived text is byte-faithful to
  the bullet apart from that whitespace join. Keep the lead-line match exactly as
  it is today, built from `escId` and anchored as `- **<ID>**:` (D-03): do NOT
  reach for `ACTIVE_BULLET` from `lib/planning-files.mjs`, which reads any bold
  span as an id and would delete a `- **Note**:` prose bullet whose span happens
  to collide. Leave `pruneRoadmap` and the Traceability-row removal untouched -
  neither reads a bullet.
- **Verify:** `node --test cadence-core/bin/milestone-prune.test.mjs` shows the
  wrapped-fixture arms passing - no orphaned continuation line survives, the
  trailing column-0 paragraph and the unshipped id's whole bullet do survive, and
  the archived parenthetical is the whole joined span with its first letter as
  authored. The fenced-`## Active` and pipe-escaping arms are still red (tasks 3
  and 4).

### Task 3: Bound `## Active` with the fence-aware sectionSpan

- **Files:** cadence-core/bin/lib/milestone-prune.mjs
- **Action:** Replace `archiveRequirements`' hand-rolled `## Active` bound - the
  fence-blind `findIndex` start and the `/^## /` end that follows it - with the
  exported `sectionSpan` from `lib/planning-files.mjs`, taking both ends from
  that one call (D-02). The `## Shipped` creation point below, which currently
  re-derives `## Active`'s end with a second scan, must come from the same
  reader, so the two cannot disagree about where the section is. Reason to hold
  to: `classifyActiveSection` already reads this section through `sectionSpan`
  because "a start found fence-blind cannot be repaired by a fence-aware end",
  and a fenced `## Active` in the shipped `templates/REQUIREMENTS.md` is exactly
  the shape that made a fence-blind reader operate on a template's own example.
  Preserve today's behaviour for a file with no `## Active` heading at all - no
  bullet removed, no summary captured, the row still ships - which the existing
  test pins.
- **Verify:** `node --test cadence-core/bin/milestone-prune.test.mjs` shows the
  fenced-`## Active` fixture passing: the bullet inside the code fence is
  untouched and the real section's bullet is the one removed. The
  no-`## Active`-heading test and both `twoBullets` placement tests still pass.

### Task 4: Escape a pipe before it reaches the Shipped table cell

- **Files:** cadence-core/bin/lib/milestone-prune.mjs
- **Action:** Escape every `|` in the captured summary as `\|` before it is
  interpolated into the `| ID (summary) | phase | Complete | label |` row, so the
  row keeps exactly five unescaped pipes and the cell still renders the character
  (D-04). This is the guard `planning.mjs cmdMilestonePrune` already applies on
  the `--label` side for the identical stated reason, one interpolation over. The
  escape belongs at the point the row is built, not at capture time, so
  `summaries` keeps the bullet's own bytes. Do not repair the two rows already
  broken in `.planning/REQUIREMENTS.md` (`CFG-01`, `RVW-01`) - this phase stops
  the bleeding and leaves the existing scars.
- **Verify:** `node --test cadence-core/bin/milestone-prune.test.mjs` passes
  WHOLE, including the corpus test: over a copy of this repository's
  `.planning/REQUIREMENTS.md` every row under `## Shipped` carries exactly five
  unescaped pipes and each moved id's parenthetical equals its whole joined span.
  `node --test 'cadence-core/bin/*.test.mjs'` shows no new failure elsewhere.

### Task 5: Pin the differing-host tracker resolution, watched to FAIL

- **Files:** cadence-core/bin/issue-check.test.mjs
- **Action:** Add two cases to the PATH-injected stub harness, red against the
  tree as it stands (D-12, TRK-01, and the phase-1 CAPTURE.md note recording that
  this repository's origin is `ssh://git@ssh.jcrenshaw.dev:2222/...` while
  `tea login list` names `git.jcrenshaw.dev`). First: a repo whose origin names
  an SSH host that DIFFERS from the login's host but shares its registrable
  domain - build it off the existing `TEA_BODY`/`TEA_LOGINS` constants with the
  login's `name`, `url` host and `ssh_host` all on one host and the origin on a
  different subdomain of the same two-label domain - asserting `action: 'report'`,
  the referenced numbers with their states, the open list, and the origin's own
  host on the envelope. This is the shape the current `HOSTS` table cannot cover,
  because all three of its forgejo login fields equal the origin host, which is
  why the suite is green while this repository skips. Second, as its own test
  BESIDE the `DEGRADATIONS` matrix rather than as a new row in it (the matrix
  keeps one row per degradation class, AC5): an origin sharing NO registrable
  domain with any configured login, asserting the existing
  `tea holds no login for <host>` line, `ok: true`, exit status 0, empty
  `referenced` and `open`, and - through `CAD_SPAWN_MARKER` and `CAD_ARGV_LOG` -
  that the only `tea` argv recorded is the `login list` probe, so no issue query
  was made against a forge that shares nothing with the remote. Use `seamRun`,
  `repo` and `stub` as they exist; do not change `stub`'s exported signature here,
  because `git-publish.test.mjs` imports it.
- **Verify:** `node --test cadence-core/bin/issue-check.test.mjs` FAILS on the
  differing-host case only - it reports `action: 'skip'` with the no-login line
  where the test expects `report` - while the no-shared-domain case and every
  pre-existing case in the file pass.

### Task 6: Match a tea login by registrable domain, not host equality

- **Files:** cadence-core/bin/lib/issue-decision.mjs, cadence-core/bin/issue-decision.test.mjs
- **Action:** Widen `classifyOrigin`'s tea-host test from exact lowercase host
  equality to: exact equality, OR the origin host and some login host share a
  registrable domain (D-07). Registrable domain is the last two labels of each
  host; a host with fewer than two labels matches only by exact equality. A
  shared two-label domain that is itself a public suffix must NOT count - carry a
  small frozen denylist in this file covering the hosting suffixes and common
  two-label registry suffixes that would otherwise collide (`github.io`,
  `gitlab.io`, `pages.dev`, `co.uk`, `org.uk`, `com.au`, `co.jp`, `co.nz`,
  `com.br`), each denied pair falling back to today's `no-login` answer. That is
  the planner's pick between the two options CONTEXT flagged as unchosen, and it
  fails toward the SKIP that ships today rather than toward querying a stranger's
  tracker. Nothing else about the verdict set moves (D-10): an empty login array
  is still `no-login`, `null`/`undefined` is still `unrecognized`, `github.com`
  and `gitlab.com` are still hostname answers decided before any tea reading, and
  `splitOrigin`'s `NOT_ONE_LINE` rejection is untouched. Update `classifyOrigin`'s
  own doc comment, which states the login-name rule this task replaces, and say
  there why the shared domain is guarded. Add unit cases in
  `issue-decision.test.mjs` beside the existing `classifyOrigin` block: the
  differing-subdomain pair reads `forgejo`; a pair sharing only a denylisted
  suffix reads `no-login`; a pair sharing nothing reads `no-login`; the exact-
  equality pairs and the `no-login`/`unrecognized` discrimination already pinned
  there still hold.
- **Verify:** `node --test cadence-core/bin/issue-decision.test.mjs` passes
  including the new cases, and `node --test cadence-core/bin/issue-check.test.mjs`
  now passes the differing-host case from task 5 with the no-shared-domain case
  still skipping on the existing line.

### Task 7: Read forgejo's tracker as the open list plus a bounded per-issue resolve

- **Files:** cadence-core/bin/lib/issue-decision.mjs, cadence-core/bin/issue-check.mjs, cadence-core/bin/issue-decision.test.mjs, cadence-core/bin/issue-check.test.mjs
- **Action:** Make the forgejo arm answer on a tracker larger than one `tea` page
  (D-08): the server clamps `tea issues list` at 50 rows whatever `--limit` asks
  for, so today's `--state all` call on this repository fills its page,
  `normalizeList` correctly reports the read incomplete, and the seam skips.
  Change the `forgejo` row of `HOST_TABLE` to ask `--state open` (limit 50
  unchanged, so 50+ OPEN issues still degrades honestly), and give that row - and
  only that row - a per-issue resolve: `tea` is invoked as `issues <index>
  --repo <slug> --fields index,state --output json` (all four flags exist on the
  installed `tea`, confirmed from `tea issues --help`), and its reader accepts
  either a single object or a one-element array, normalizing an `index` that
  arrives as a string OR a number the way `normalizeList` already normalizes one.
  The `github` and `gitlab` rows keep `--state all` and get no resolve: their
  paging is not clamped, and inventing argv for a `glab` that is absent from this
  machine would ship an untestable change. Paging the list was rejected: it
  widens the seam past its stated one bounded call per land. In `issue-check.mjs`,
  after `partitionIssues`, resolve each referenced number the open list did not
  answer, at most a named constant's worth - declare it beside
  `DEFAULT_TIMEOUT_MS` (D-11 forbids a config key here) with the value 5 - and
  stop the loop at the first resolve killed at the call bound, so a hung CLI
  cannot multiply the bound. A resolve that returns a readable record for that
  number gives its state; anything else - nonzero exit, unreadable body,
  mismatched index, over the cap - reports the number as `unresolved`, a state
  the envelope's `referenced` entries did not carry before. It may NOT report
  `not-found`: `tea` exits nonzero both for an absent issue and for a failed read
  and this seam discards child stderr by contract, so a not-found there would be
  an affirmative answer about input it could not read. Hosts with no resolve keep
  emitting `not-found` exactly as today. Nothing about the skip arms, the reason
  lines, `detail: null` or the no-third-party-bytes rule changes. Extend the
  exported `stub` in `issue-check.test.mjs` with an OPTIONAL field answering the
  per-issue argv shape, leaving its existing parameters and behaviour intact for
  `git-publish.test.mjs`, and add seam cases: a list body carrying only open rows
  plus a resolve answering closed for one referenced number and failing for a
  number that does not exist, asserting the reported states and asserting from
  `CAD_ARGV_LOG` that the list call carried `--state open` and that exactly one
  resolve ran per unanswered number; and a case referencing more unanswered
  numbers than the constant, asserting the recorded resolve count stops at it and
  the remainder report `unresolved`.
- **Verify:** `node --test 'cadence-core/bin/*.test.mjs'` passes whole, and the
  new seam cases show a forgejo report whose referenced list carries a `closed`
  state that came from a resolve and an `unresolved` state that came from a failed
  one, with `CAD_ARGV_LOG` recording one `--state open` list call and no more
  resolves than the constant allows.

### Task 8: State the shipped host rule in cad-land's prose

- **Files:** skills/cad-land/SKILL.md, cadence-core/bin/weight-budgets.json, .planning/DOCS-CLAIMS.md
- **Action:** `skills/cad-land/SKILL.md` states host detection as login-name
  equality in two places and both must now describe what the seam does (D-13):
  step 1's detected-host sentence, which says "any other host where the `tea` CLI
  has a matching login ... (`tea login list` names the host)", and step 3a's
  Open MR/PR bullet, which makes the option absent for "an unrecognized host with
  no `tea` login" - today that sentence costs this repository its publish option
  for the same reason it cost it the tracker report. Both must say that a login
  matches when it names the origin host or shares its registrable domain. In the
  same file, step 1's `report` branch must say how to render a number the seam
  could not resolve: named as unresolved, never as closed and never as not found,
  in the same one sentence. Add no new claim and restate no mechanism the seam
  does not implement. This surface's `weight-budgets.json` entry is exactly its
  current size, so any growth fails self-verify check 4: keep the edit at or under
  that byte count by replacing wording rather than appending, and if the corrected
  sentences genuinely cannot fit, re-pin that one budget row in the same change
  and say so in the commit. In `.planning/DOCS-CLAIMS.md`, update only the rows
  whose quoted claim or cited line range no longer matches the file after this
  edit (`CAD-LAND-01` cites `skills/cad-land/SKILL.md` 32-54, `README-85` cites
  the tracker sentence) - never a new claim row, and never a verdict change on a
  claim this phase did not touch.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok: true` with no
  `budget-overrun` for `skills/cad-land/SKILL.md`, `node --test
  'cadence-core/bin/*.test.mjs'` passes whole (including
  `prose-agreement.test.mjs`), and grepping `skills/cad-land/SKILL.md` for
  "matching login" shows no surviving sentence that makes a login match by name
  alone.

## Notes

- Human-verify (AC6): after task 8, run `/cad-land` on this repository and read
  step 1's tracker line. It must name the issues this branch's commits reference
  with their states instead of printing
  `tea holds no login for ssh.jcrenshaw.dev: no tracker report`. It needs the live
  `git.jcrenshaw.dev` tracker, so no committed test can stand in for it.
- D-08's mechanism is applied to the `forgejo` row ONLY. The decision names its
  mechanism in `tea` vocabulary and its evidence is the 50-row clamp measured on
  two Gitea/Forgejo instances; `gh` pages internally to its `--limit` and `glab`
  is absent from this machine, so widening the change to them would trade a
  working arm for an untestable one.
- The `unresolved` referenced-state is new envelope surface that D-08 forces and
  CONTEXT does not name: with `--state open`, a referenced number that is not open
  is either closed or absent, and `tea`'s nonzero exit cannot tell those apart
  through a seam that discards child stderr. Reporting `not-found` there would be
  the affirmative-answer-about-unread-input failure `partitionIssues` was written
  to refuse, so the seam names it unresolved and task 8 makes the skill print it
  that way.
- The public-suffix guard CONTEXT flagged as unchosen is picked in task 6: a
  last-two-labels registrable domain plus a small frozen denylist, refusing the
  match (and so keeping today's skip) whenever the shared domain is itself a
  public suffix. A vendored PSL is out of proportion for a zero-dep repo.
- Tasks 1 and 5 commit red cover on purpose. The repo is committable at each of
  them; the suite goes green at task 4 for the prune half and task 7 for the
  tracker half.
