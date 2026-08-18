---
phase: 1
plan: 2
requirements: [SCR-01]
files:
  - cadence-core/references/conventions.md
  - cadence-core/references/triage-gate.md
  - cadence-core/references/review-triggers.md
  - cadence-core/workflows/progress.md
  - cadence-core/workflows/report.md
  - cadence-core/workflows/task.md
  - cadence-core/bin/lib/scratch-path.mjs
  - cadence-core/bin/scratch-path.test.mjs
  - cadence-core/bin/scratch-readback.test.mjs
  - cadence-core/bin/bulk-output.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/weight-budgets.json
  - .planning/DOCS-CLAIMS.md
---

# Phase 1: The guards that remove a protection - Plan 2

## Goal

The bulk-output scratch transport is per-run at all six sites, so one
repository's run cannot answer another's blocking `risk_surface` re-arm cap, and
every read-back refuses a truncated, absent or wrong-shaped scratch file by name
instead of throwing or printing an empty object as a success.

## Must be true when done

- Every one of the six scratch sites writes under a directory created for THAT
  run by `mktemp -d`, and two runs started concurrently in two repositories get
  two different directories: `rg 'TMPDIR:-/tmp' cadence-core skills agents hooks`
  shows a `mktemp` template at every remaining occurrence and no fixed shared
  filename at any of the six.
- Putting a fixed shared scratch path back at any one of the six sites makes
  `node cadence-core/bin/self-verify.mjs` exit non-zero and name that file and
  the offending code; on the tree as shipped the same command exits 0.
- Feeding a truncated file, and separately a well-formed file of the wrong
  shape, to each read-back produces a named reason on stderr and a non-zero
  exit; none throws an unhandled parse error and none prints `{}` as an answer.
- On the blocking re-arm cap, a read-back that refuses lands on the STOP-and-ask
  arm rather than on a number, and the prose says so at the site.
- `cadence-core/references/conventions.md`'s stated bulk-output rule shows the
  per-run form, and the `.planning/DOCS-CLAIMS.md` TASK-17 row cites
  `workflows/task.md`'s current line and its current text.
- `node cadence-core/bin/self-verify.mjs` and
  `node --test cadence-core/bin/*.test.mjs` both pass.

## Context

CONTEXT.md D-04 (the rule in `conventions.md` changes with the sites, or the next
conversion re-creates a seventh site from the rule itself), D-05 (the per-run path
must survive BETWEEN Bash invocations - the tool persists the working directory
and not shell state, and two sites split their write and their read across
different fenced blocks - so `&&`-coupling alone cannot serve all six), D-06 (the
run's `corr` is NOT usable as the key: no seam face prints it alone), D-07
(self-verify check 20 tests redirect SYNTAX only and cannot hold this - something
else must, or the next prose edit reverts it green), D-08 (a read-back's refusal
lands on the STOP-and-ask arm, never on a numeric answer), D-11 (the six sites and
their exact lines), D-12 (the slug-keyed task diff is IN scope and costs one
`DOCS-CLAIMS.md` edit), D-13 (a shell redirect plus a targeted read-back - no new
seam, flag or subcommand).

**The mechanism, decided here within D-05 and D-06 and binding on tasks 2-6.**
The run's scratch directory is created by `mktemp -d` with an explicit template
rooted at `${TMPDIR:-/tmp}` (an explicit template, because `mktemp -d` with no
argument is a GNU-only spelling). Two arms, one rule: when a site's write and its
read-back run in ONE Bash invocation, the directory is captured in a shell
variable and the write and the read are chained with `&&`, so a read-back can
never run on a write that failed; when they are split across invocations, the
first block ECHOES the directory once and the later block carries that literal
path - a path and never a `$(...)`, which is the caller-derived-text rule
`conventions.md` already states. Two constraints bind every site edit: the call
text to the LEFT of the `>` stays byte-identical to its row in
`cadence-core/bin/lib/bulk-output.mjs` (check 20 keys on it, and four of these
sites have a `redirect` row), and every line that carries `TMPDIR` also carries
`mktemp`.

**The two named refusals, binding on tasks 2-6.** A read-back that cannot read or
parse its scratch file writes a line naming `scratch-unreadable` to stderr and
exits non-zero; one whose parse succeeded but whose expected field is absent
writes a line naming `scratch-shape` and exits non-zero. Neither writes an answer
to stdout.

## Tasks

### Task 1: The per-run scratch rule becomes a check

- **Files:** cadence-core/references/conventions.md (the `## Bulk tool output` section), cadence-core/bin/lib/scratch-path.mjs, cadence-core/bin/scratch-path.test.mjs, cadence-core/bin/bulk-output.test.mjs, cadence-core/bin/weight-budgets.json (its `conventions.md` entry)
- **Action:** `conventions.md`'s bulk-output rule states the transport in
  fixed-shared-path form and is therefore the source of the defect as much as the
  six sites are (D-04). Rewrite it to the per-run form described in this plan's
  Context: the scratch directory is this RUN's, made by `mktemp -d`; the
  read-back is chained to the write with `&&` when they share an invocation and
  reads a directory the earlier block echoed when they do not; a SPLIT read-back
  additionally proves the file is this run's, because a carried literal path is
  the one arm where a well-formed file from an EARLIER run still resolves - the
  writing block generates a run token, writes it into the run directory and
  echoes it beside the path, and the later block carries that token as its own
  literal and refuses as `scratch-stale` when the directory's token does not
  match the one it was handed (comparing the file against an id carried
  independently of it, never against its own, which is the self-consistency
  D-08 names); a read-back refuses a file it could not read, parse or recognise
  rather than answering from it; and the run directory is left for the operating system's tmp reaping rather
  than removed by the step, since a step that `rm -rf`s a path it computed is a
  worse failure than a stale directory. Name
  `cadence-core/bin/lib/scratch-path.mjs` as the module that classifies a site,
  in the same sentence shape the section already uses for
  `lib/bulk-output.mjs` - no site decides this for itself. Then write that
  module: pure, zero-dep, `// @ts-check`, no fs and no process, exporting a
  frozen `CODES` object and one issues function in the `bulkOutputIssues(surface,
  text)` mold that returns `{kind, file, detail}` objects, so self-verify can
  wrap them without knowing what any code means. Three line-local rules, each
  reported under its own code: `scratch-shared-path` for a line mentioning
  `TMPDIR` that does not also call `mktemp`; `scratch-fixed-target` for a `>` or
  `>>` redirect whose target is an absolute literal under `/tmp` or `/var/tmp`;
  and `scratch-unguarded-readback` for a `node -e` script that reads a file named
  by `process.argv` without both a non-zero exit and a reason written to stderr.
  State the accepted gap in the module header rather than growing a fourth rule:
  a scratch path assembled through an intermediate shell variable assigned from
  a literal is not caught, and the regression this check is built against is a
  copy of the old rule, not a novel spelling. `cadence-core/references/acceptance-criteria.md`
  carries `/tmp/cadence-phase5-fixture` paths that are UAT fixtures rather than
  transports and are not redirect targets - the second rule must not fire on
  them, and a row in the test asserts it does not. Cover the module with per-row
  fixtures in `scratch-path.test.mjs`: the six current site lines, quoted
  verbatim, must each be reported by name, and the intended converted form of
  each must be clean - that pairing is what stops tasks 2-6 from writing prose
  the checker cannot read. Finally re-point `bulk-output.test.mjs`'s
  `${TMPDIR:-/tmp}/t.json` fixture at the per-run form so the tree holds no
  illustration of the shape this phase is removing, and re-pin
  `conventions.md`'s entry in `weight-budgets.json` in the same commit.
- **Verify:** `node --test cadence-core/bin/scratch-path.test.mjs` passes with a
  row per site line and per converted form; `node --test cadence-core/bin/bulk-output.test.mjs`
  passes; a `node -e` call running the new issues function over the current text
  of all six surfaces reports at least one problem for each of the six;
  `node cadence-core/bin/self-verify.mjs` exits 0 with no `budget-overrun`.

### Task 2: The blocking re-arm cap reads this run's own count

- **Files:** cadence-core/references/triage-gate.md (the round-count block), cadence-core/bin/weight-budgets.json
- **Action:** This is the site where a wrong answer costs the most: the fixed
  `cad-rearm.json` is the `risk_surface` gate's one-round re-arm cap, and the
  read-back filters on the FILE's own `corr`, so another repository's file
  answers self-consistently and spends or refunds a budget it knows nothing
  about (D-08). Convert the two-line block to the same-invocation arm of the
  mechanism: create the run directory with `mktemp -d`, chain the `trace render`
  redirect and the `node -e` read-back to it with `&&`, and keep the rendered
  call's text left of the `>` exactly `trace render --phase <N>` so its
  `bulk-output.mjs` row still matches. Guard the read-back: wrap the read and
  parse so a failure writes `scratch-unreadable` to stderr and exits non-zero,
  and replace the `(r.outcomes||[])` default - which is what lets a truncated or
  foreign file answer zero - with an explicit assertion that `outcomes` is an
  array, refusing as `scratch-shape` when it is not. The `corr` comparison stays
  as it is: with a per-run file it is now comparing the run's own id against its
  own events, which is what it was always meant to be. Then say in the prose what
  a refusal MEANS, because this is a blocking gate: a non-zero exit from the
  read-back is neither the zero arm nor the non-zero arm - the cap could not be
  evaluated, so it goes to the STOP-and-ask arm the `blocking` bullet already
  describes for a reviewer that could not run (D-08). Re-pin this surface in
  `weight-budgets.json`.
- **Verify:** Running the block's own commands twice in two shells creates two
  different `mktemp` directories and each read-back answers from its own file;
  pointing the read-back at a file truncated mid-object prints a line naming
  `scratch-unreadable` on stderr, prints nothing on stdout and exits non-zero;
  pointing it at `{}` does the same naming `scratch-shape`; `node -e` running
  task 1's issues function over `cadence-core/references/triage-gate.md` reports
  nothing; `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 3: `/cad-progress --trace` stops printing `{}` as a success

- **Files:** cadence-core/workflows/progress.md (its `trace` step), cadence-core/bin/weight-budgets.json
- **Action:** This site's read-back has no parse guard at all, so a truncated
  `cad-trace.json` throws, and a file whose shape is wrong stringifies four
  `undefined` fields into `{}` - which prints as a clean, empty, successful
  answer. Convert the two-line block to the same-invocation arm: `mktemp -d`, the
  `trace render` redirect and the `node -e` field read chained with `&&`, the
  call text left of the `>` left exactly `trace render --phase <current>` so its
  register row still matches. Guard the read-back on both failures: a read or
  parse failure refuses as `scratch-unreadable`, and a parse that succeeded
  without the four fields this step prints - `counts`, `roles`, `unpaired`,
  `capped` - refuses as `scratch-shape` naming the field that was missing rather
  than stringifying `undefined`. Keep the step's stated reason for reading four
  fields instead of the whole envelope: `brackets` and `outcomes` stay in the
  file, and widening the read is the transport not happening. Re-pin this surface
  in `weight-budgets.json`.
- **Verify:** The step's read-back against a truncated file prints
  `scratch-unreadable` on stderr, nothing on stdout, and exits non-zero; against
  a file containing `{}` it prints `scratch-shape` naming a missing field and
  exits non-zero, and `{}` never reaches stdout; `node -e` running task 1's
  issues function over `cadence-core/workflows/progress.md` reports nothing;
  `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 4: `/cad-report` carries its run directory between its two steps

- **Files:** cadence-core/workflows/report.md (its `read_record` and `compose` steps), cadence-core/bin/weight-budgets.json
- **Action:** This is the first of the two split sites: the redirect is in
  `read_record` and the field read-back is in `compose`, in a different fenced
  block and therefore a different Bash invocation, where a shell variable is
  empty (D-05). Convert it to the split arm: `read_record` creates the run
  directory with `mktemp -d`, generates a run token, writes the token into the
  run directory and echoes the directory and the token once so both reach the
  transcript, and redirects the render into it with `&&`; `compose`'s read-back
  takes that echoed directory and that echoed token as literals, and refuses as
  `scratch-stale` when the directory's token file is absent or does not match
  the token it was handed - this is the arm where a previous run's well-formed
  record is still readable at a carried path, so the shape guard alone does not
  satisfy SCR-01's refusal of a STALE file. Say in the prose that the later block
  carries the printed path rather than re-deriving it, so a reader does not
  substitute a fresh `mktemp`. Keep the call text left of the `>` exactly
  `trace render [--phase <N>]` so its register row still matches, and keep the
  step's read-back BOUND rule intact - one field read at the line that needs it,
  never a whole-file read, which is the transport not happening. Guard the
  read-back: a read or parse failure refuses as `scratch-unreadable`, and a
  parse that succeeded without `brackets` as an array refuses as `scratch-shape`
  rather than throwing on the iteration. Re-pin this surface in
  `weight-budgets.json`.
- **Verify:** Running `read_record`'s block prints a `mktemp` directory and
  writes the render inside it and prints a run token; `compose`'s read-back run
  against that literal path and that token prints the bracket rows, against a
  truncated copy prints `scratch-unreadable` on stderr and exits non-zero,
  against `{}` prints `scratch-shape` and exits non-zero, and run against a
  SECOND run's directory carrying the FIRST run's token prints `scratch-stale`
  on stderr and exits non-zero while that directory's record is complete and
  well-formed; `node -e` running task 1's issues function
  over `cadence-core/workflows/report.md` reports nothing;
  `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 5: The cross-model payload rides this run's own artifact

- **Files:** cadence-core/references/review-triggers.md (its cross-model provider bullet), cadence-core/bin/weight-budgets.json
- **Action:** Two fixed shared paths here, and the second is the worse one: the
  payload file is written to a hardcoded name derived inside the `node -e` script
  from `process.env.TMPDIR`, and it is consumed by `--payload` in a LATER fenced
  block, so a concurrent review in another repository can be the one whose diff
  is sent to the provider under this run's instruction. Convert both to the split
  arm: the composition block creates the run directory with `mktemp -d`,
  generates a run token, writes the token into that directory and echoes the
  directory and the token once, redirects `git diff <base_ref>..<head_ref>` into
  an artifact file inside it, and composes the payload into that same directory;
  the `review-provider.mjs review` block passes the echoed directory's payload
  path as a literal to `--payload`, and the prose instructs the caller to check
  the directory's token against the echoed one first, refusing as
  `scratch-stale` on a mismatch rather than sending it. A previous run's payload
  is well-formed by construction, so at a BLOCKING gate the shape guard cannot
  tell it from this run's - the token is what does. The composer must stop computing its own output
  path from `process.env.TMPDIR`: the payload path becomes an explicit argument
  like the artifact path already is, and the surrounding sentence that says which
  argument the artifact is must be corrected to match wherever the new argument
  lands. Keep the diff call's text left of the `>` exactly
  `git diff <base_ref>..<head_ref>` so its register row still matches, keep shape
  (b)'s redirect of `git diff --cached` pointed at the same run directory, and
  keep shape (c) passing its OWN absolute diff path - shape (c) is why the
  artifact path is an argument at all, and the paragraph that explains this is
  the one that must not be lost in the edit. Guard the composer: a brief or
  artifact it cannot read, and an artifact that is empty, refuse as
  `scratch-unreadable` on stderr with a non-zero exit rather than composing a
  payload with an empty `artifact` field, since an empty artifact is exactly what
  a failed or colliding redirect leaves behind. Do not hand-assemble the JSON and
  do not move the composition into `review-provider.mjs`: the existing paragraphs
  give both reasons and `assertUnderCap` depends on the second. Re-pin this
  surface in `weight-budgets.json`.
- **Verify:** Running the composition block writes both files inside one
  `mktemp` directory and the `--payload` line resolves against the echoed literal
  with its echoed token; the composer run with an unreadable brief path, and
  again with an empty artifact file, each print `scratch-unreadable` on stderr
  and exit non-zero writing no payload; the token check run against a second
  run's directory holding a complete, well-formed payload and the first run's
  token refuses as `scratch-stale` and exits non-zero; `node -e` running task 1's issues function over
  `cadence-core/references/review-triggers.md` reports nothing;
  `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 6: The inline task's risk diff is this run's own

- **Files:** cadence-core/workflows/task.md (its inline-path bullet), .planning/DOCS-CLAIMS.md (the TASK-17 row), cadence-core/bin/weight-budgets.json
- **Action:** The inline arm writes `cadence-risk-task-{slug}.diff` to a fixed
  shared path, so two inline runs of the same-slugged task collide - and what
  collides feeds a `risk_surface` fire that blocks at every stakes level, which
  is the shape v2.3.0 already closed once as "a stale diff reached a blocking
  gate" (D-12). Convert it to the mechanism: the inline arm creates the run
  directory with `mktemp -d` and writes the diff inside it, then fires shape (c)
  with THAT path. Keep both existing constraints the bullet exists for - the
  inline path still creates no `.planning/` directory, since
  `Zero planning artifacts for inline tasks` is this workflow's own success
  criterion, and the diff is still deleted once the trigger returns. Leave the
  PLANNED path alone: it writes beside its own plan file and shares nothing. Then
  fix the `.planning/DOCS-CLAIMS.md` TASK-17 row, which cites `task.md:103-105`
  for a bullet that now lives further down and quotes the fixed shared path as
  the claim - re-point the line span at the bullet's current location and restate
  the claim as the per-run form, so the docs ledger stops asserting the shape this
  task removed. Re-pin this surface in `weight-budgets.json`.
- **Verify:** `grep -n 'cadence-risk-task' cadence-core/workflows/task.md` shows
  the diff written under a `mktemp` directory and no fixed shared filename;
  `node -e` running task 1's issues function over `cadence-core/workflows/task.md`
  reports nothing; the TASK-17 row's cited line span contains the bullet it
  describes; `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 7: Prove each read-back refuses by running it

- **Files:** cadence-core/bin/scratch-readback.test.mjs
- **Action:** A static rule that a read-back "carries a guard" is a claim about
  text; this task makes it a claim about behaviour. Write a test that reads the
  four surfaces carrying a `node -e` read-back -
  `cadence-core/references/triage-gate.md`, `cadence-core/workflows/progress.md`,
  `cadence-core/workflows/report.md` and
  `cadence-core/references/review-triggers.md` - extracts each single-quoted
  `node -e` script from their prose, and EXECUTES each one as a child process
  against fixtures it writes to a temp directory: a file truncated mid-object and
  a well-formed file of the wrong shape. Assert per script that the exit code is
  non-zero, that stderr names `scratch-unreadable` or `scratch-shape`
  respectively, and that stdout is empty - specifically that `{}` is never
  printed, which is the shape the progress site printed as a success. Pin the
  number of extracted scripts the way `bulk-output.test.mjs` pins its row count,
  so a site that loses its read-back turns this file red rather than shrinking
  the set it proves. Do not copy the scripts into the test as literals: a
  fixture-only test is a green test that cannot go red, which this repository has
  already named as a defect class. The two remaining read-backs need nothing new
  here and the header should say why: the payload file's reader is
  `review-provider.mjs --payload`, whose `bad-payload` refusal before any network
  call is already proved by
  `cadence-core/bin/review-provider.test.mjs`'s malformed-payload row, and the
  inline task diff is read by the same composer script this test already
  executes.
- **Verify:** `node --test cadence-core/bin/scratch-readback.test.mjs` passes and
  reports the pinned number of extracted scripts; deleting the guard from any one
  of the four prose read-backs turns it red naming that surface.

### Task 8: Wire the check into self-verify

- **Files:** cadence-core/bin/self-verify.mjs (the per-surface walk beside the check-19 and check-20 calls), cadence-core/bin/self-verify.test.mjs
- **Action:** Check 20 asserts a redirect EXISTS and cannot see what it points
  at, so a fixed shared name and `> /dev/stdout` both pass it - which is why
  nothing in the tree holds this fix in place today (D-07). Call task 1's issues
  function from the same per-surface walk that already runs
  `textTransportIssues` and `bulkOutputIssues`, over every surface that walk
  yields for the reason those two state about their own scope: a step in
  `skills/` pays for a collision exactly as a workflow does. Add its entry to the
  numbered header comment saying what it holds and why check 20 cannot, and add
  its name to the `checked` string on the emitted envelope. It takes no CONTRACTS
  row, for the reason check 14 already states about `lib/*.mjs`. Add a wiring row
  to `self-verify.test.mjs` in the mold of the check-16 and check-18 rows: the
  issues reach `problems`, and `checked` names the check - the rule itself is
  already covered per row by `scratch-path.test.mjs` and is not re-proved here.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 and its `checked`
  field names the new check; re-introducing a fixed shared scratch path at
  `cadence-core/references/triage-gate.md` makes it exit 1 with a problem whose
  `file` is that surface and whose `kind` is the new code, and reverting that
  edit restores exit 0; `node --test cadence-core/bin/*.test.mjs` passes.

## Notes

### Blocking `plan` review, 2026-08-18

The cross-model `plan` gate (openai, `gpt-5.6-terra`, effort medium) returned
three findings against these plans. Two were `high` and are FIXED above; the
`medium` went to the capture queue rather than being folded in, because the
blocking arm fixes blockers and highs and is not a triage arm.

- **FIXED (high): a well-formed STALE file passed the split-site read-backs.**
  Tasks 4 and 5 guarded unreadable, unparseable and wrong-shaped files, and
  nothing asserted the file at the carried literal path belonged to THIS run.
  SCR-01's text refuses "a truncated or stale file" and only the first half was
  planned. The same-invocation arm (tasks 2, 3, 6) is structurally safe - a
  fresh `mktemp -d` is empty and the read-back is `&&`-chained to the write -
  so the gap was exactly the two split sites, where the path is carried across
  Bash invocations as prose. The run token added to task 1's rule and to both
  split tasks closes it, and it compares the file against an id carried
  INDEPENDENTLY of the file, which is the property D-08 says the old `corr`
  filter lacked. D-06 is untouched: `corr` is still not the scratch filename,
  and the token is a fresh nonce rather than `corr`.

- **RESOLVED (high) by John, 2026-08-18: AC6 vs the seam convention.** AC6 asked
  for a named refusal on stderr at each of the six read-backs. The sixth,
  `review-provider.mjs --payload`, answers
  `{"ok":false,"reason":"bad-payload"}` on STDOUT with exit 1, because
  `lib/seam-io.mjs`'s one-JSON-line-on-stdout convention is shared by every
  seam, and the property AC6 exists for already holds there and is already
  tested (`review-provider.test.mjs:685`). AC6 is AMENDED in CONTEXT.md to
  require a named refusal and a non-zero exit at all six, on stderr for the five
  prose read-backs and in the stdout seam envelope for `--payload`. No code
  change and no added task: the criterion stopped asking one seam to break a
  convention it does not own, for a property that already holds there.

- This plan and PLAN-1 share exactly one declared file,
  `cadence-core/bin/weight-budgets.json`: every budgeted prose surface in this
  repository sits at its exact byte budget, so both slices must re-pin it. They
  are therefore SEQUENTIAL, not parallel - the CONTEXT `Plan shape` directive's
  "share no code" holds for the source, and the budget register is the one file
  it does not cover. Nothing else is shared.
- AC6 asks for a named refusal on stderr at all six read-backs. Five of them are
  prose this plan authors and they answer on stderr. The sixth is
  `review-provider.mjs --payload`, whose refusal is the named `bad-payload`
  envelope on STDOUT with a non-zero exit, because the seam convention in
  `cadence-core/bin/lib/seam-io.mjs` is one JSON line on stdout with the exit
  code mirroring `ok`. Moving that one to stderr would break the convention every
  seam shares, so it is not planned; the property AC6 exists for - a named
  refusal, a non-zero exit, no unhandled throw and no empty object read as
  success - already holds there and is already tested.
- `mktemp -d` is called with an explicit `${TMPDIR:-/tmp}` template at every
  site: the template-less spelling is GNU-only and fails on BSD `mktemp`, and the
  explicit form is also what keeps AC4's `rg 'TMPDIR:-/tmp'` sweep able to see
  all six sites.
