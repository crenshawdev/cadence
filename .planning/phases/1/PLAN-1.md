---
phase: 1
plan: 1
requirements:
  - WHY-01
files:
  - cadence-core/bin/lib/why-query.mjs
  - cadence-core/bin/lib/why-render.mjs
  - cadence-core/bin/why.mjs
  - cadence-core/bin/why-query.test.mjs
  - cadence-core/bin/why-render.test.mjs
  - cadence-core/bin/why.test.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - skills/cad-why/SKILL.md
  - cadence-core/references/COMMANDS.md
  - cadence-core/bin/weight-budgets.json
  - README.md
---

# Phase 1: The corpus, read back at a file and line - Plan 1

## Goal

`/cad-why <path>[:<line>]` answers "why is this code like this" from the record
already on disk, so the corpus is READ for the first time and it becomes visible
whether the write-side care has been worth it. This plan delivers the chain
itself: a `git log` walk over the queried path, newest first, with its two
stated-result arms and its registered command surface.

## Must be true when done

- Running the seam against a path in this repository emits one JSON object whose
  `text` field lists the commits touching that path, newest first, with no
  model-authored prose in it.
- `<path>:<line>` returns only the commits whose diff touched that line, and a
  bare path returns the full chain; neither exits non-zero on a path present at
  HEAD.
- A path git has never seen returns a stated not-in-history result, and a line
  number past the file's end returns a stated result - neither an empty chain,
  nor a crash, nor a raw git `fatal:` on stdout.
- Two runs of the seam over an unchanged tree write byte-identical stdout, and
  the answer is unchanged whether `.planning/trace.jsonl` is present or absent.
- `/cad-why` is a discoverable skill that relays the seam's `text` field and
  reformats nothing.
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []`, and `node cadence-core/bin/test.mjs` reports 0 failures.

## Context

Locked by `phases/1/CONTEXT.md`: D-01 puts this in a NEW top-level
`cadence-core/bin/` script rather than a `planning.mjs` subcommand, because
`planning.mjs`'s dispatcher passes `--dir <planning-root>` and all 16 of its git
calls are `-C <root>` against `.planning`. D-02 puts the rendered chain inside
the seam as a `text` field the skill relays verbatim, so AC6's byte assertion can
live in a test. D-13 requires a bounded response; D-15/D-16/D-17 fix the git
invocations, the stated-result arms and the determinism discipline. D-07 forbids
`.planning/trace.jsonl` becoming a required input. This plan writes nothing to
the record, gates nothing and dispatches no subagent. The joins themselves
(AC2) are plan 2 and the pruned-milestone recovery (AC4) is plan 3; both extend
files this plan creates, so they run after it.

## Tasks

### Task 1: The query grammar and the two git invocations

- **Files:** cadence-core/bin/lib/why-query.mjs, cadence-core/bin/why-query.test.mjs
- **Action:** A new pure module in the mold `lib/lease-grammar.mjs` and
  `lib/plan-key.mjs` state - no disk, no emit, no exit, no `Date`, no
  randomness, and the caller owns every refusal sentence. It answers three
  questions. First, the argument grammar: split the positional argument into a
  repository-relative path and an optional 1-based line. Disambiguation is TWO
  steps, and stating them separately is what makes every refusal below
  reachable: first CLASSIFY the suffix after the LAST colon as a line attempt
  when that suffix is empty, or when its first character is a digit, `-` or
  `+`; any other first character (a letter, a `/`) leaves the colon inside the
  path, so `C:/src/a.rs` and `a/b:name.rs` stay paths. Then VALIDATE a line
  attempt: everything after the colon must be digits and greater than zero, so
  `a.rs:-1` refuses as a negative line, `a.rs:4x` as a non-integer line,
  `a.rs:0` as a zero line and `a.rs:` as a trailing colon with nothing after
  it - each naming which of those it is, and none of them silently re-reading
  as a path, which is the failure a one-step digits-only classifier produces.
  Refuse an empty argument and an empty path the same way. Line values
  go through `requireInt` from `lib/require-int.mjs` rather than a fresh
  `Number()`, which is the hazard `lib/require-int.mjs`'s own header names.
  Second, the git argument vectors: the bare-path arm and the line arm are
  DIFFERENT invocations because `--follow` and `-L` are mutually exclusive
  (`fatal: --follow requires exactly one pathspec`) and `--follow` also reorders
  the answer on a bare path (D-15); the bare arm carries `--follow` and passes
  the path after a `--` separator so a path that looks like a revision cannot be
  read as one, the line arm carries `-L <line>,<line>:<path>` with `-s`, and
  BOTH pin `-M` explicitly and a fixed `--format` rather than inheriting a
  user's `log.follow`/`diff.renames` configuration (D-17: 173 rename records in
  the last 400 commits of the surface this command reads). Third, the failure
  classification: given a git exit status and its stderr, return one of the
  stated outcomes the seam will emit, carrying NO third-party bytes onward -
  `lib/redact-url.mjs` exists because git stderr on an envelope is how a
  credential leaked (EXP-01), and the same rule applies to a `fatal:` reaching
  stdout. Two failure shapes measured against this repository on 2026-08-22 and
  both load-bearing: a line past end of file exits 128 with
  `fatal: file <path> has only <n> lines`, and a path git has never seen exits 0
  printing nothing on the bare arm - so this module also supplies the argv for
  an EXPLICIT not-in-history probe, because an empty chain and an unknown path
  are observably identical otherwise (D-16).
- **Verify:** `node --test cadence-core/bin/why-query.test.mjs` passes with:
  `a/b.rs` parsing to that path and no line; `a/b.rs:42` parsing to line 42;
  `a/b:c.rs` parsing as a path with no line; `a/b.rs:0`, `a/b.rs:-1`,
  `a/b.rs:4x`, `a/b.rs:` and the empty string each refused with a distinct
  named reason; the bare and line argv arrays each containing `-M`, only the
  bare one containing `--follow` and a `--` separator, and only the line one
  containing a `-L` term; and a classification test mapping exit 128 with
  `fatal: file cadence-core/bin/lib/seam-io.mjs has only 28 lines` and exit 0
  with empty stdout to two distinct stated outcomes, asserting neither returned
  string contains `fatal:` or the input path's stderr text.

### Task 2: The deterministic renderer and the entry cap

- **Files:** cadence-core/bin/lib/why-render.mjs, cadence-core/bin/why-render.test.mjs
- **Action:** A second pure module that turns an array of chain entries into the
  one `text` string the seam emits (D-02) plus the counts the envelope carries.
  Ordering is explicit, never inherited: sort by commit date then by full
  40-character sha, newest first, so the output does not depend on git's own
  ordering or on a filesystem listing (D-17). Emit full 40-character shas in
  the entry data and let the rendered line carry both the full sha and the
  abbreviation a reader types. Every join field that later plans will fill -
  phase, plan task, decision, deviation, surviving review finding - renders as
  an explicitly STATED absence rather than being omitted, because AC5 requires a
  path with a record but no `.planning/` join to come back as a chain with each
  field stated absent rather than as an empty chain; this task ships those five
  stated-absent lines and plans 2 and 3 replace them with quoted record text.
  Nothing here composes prose about the commits: the rendered bytes are the
  record's own words plus fixed labels, which is what makes criterion 6
  assertable at all. A default entry cap bounds the response - this is D-13's
  second arm, taken instead of a `lib/bulk-output.mjs` register row because the
  cap bounds the bytes rather than relocating them, and because that module's
  `BULK_SHAPES` watches exactly three call shapes (`trace render`, `recall`,
  `git diff`), none of which is this seam, so a register row alone would be data
  no check reads. Copy `cmdRecall`'s `--top` shape exactly: a stated default,
  and the untruncated total riding the envelope beside the shown count so a
  truncated answer stays legible as truncated. The default is 10, chosen here
  and recorded in the module header with its reason - raw `git log` on
  `cadence-core/bin/planning.mjs` is 21,684 B over 144 commits (CONTEXT D-13),
  which is twice the 10,000-byte threshold `references/conventions.md` states,
  and ten entries is the band that stays under it once each entry carries its
  joins.
- **Verify:** `node --test cadence-core/bin/why-render.test.mjs` passes with:
  two entries handed in ascending date order rendering newest-first; two entries
  sharing one commit date rendering in descending full-sha order, and reversing
  the input array producing byte-identical output; a 25-entry chain rendering
  exactly 10 entries while the returned total reads 25; and an entry carrying no
  join data rendering one stated-absent line per join field rather than dropping
  the field.

### Task 3: The seam

- **Files:** cadence-core/bin/why.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/why.test.mjs
- **Action:** A new top-level script under `cadence-core/bin/`, taking the query
  as a POSITIONAL argument the way `skim.mjs` does, plus `--dir` for the
  repository root (absent means `process.cwd()`, the disposition
  `issue-check.mjs` states in its own header) and `--top` for task 2's cap. It
  emits through `emit` from `./lib/seam-io.mjs`: exactly one JSON object
  carrying `ok`, the resolved path and line, the chain entries and the
  pre-rendered `text` (D-02). Git runs through `execFileSync` with an argv
  ARRAY and `-C <dir>` - never a shell string - the form `lib/git-head.mjs`
  uses. Add the `why.mjs` row to `CONTRACTS` in `lib/arg-contract.mjs` or
  self-verify check 14 files `uncontracted-script` (D-01); it is a
  no-subcommand script, so it needs the bare `''` row `skim.mjs` and
  `self-verify.mjs` carry, and every flag the skill's prescribed invocation
  writes must be declared there because check 2 lints the bare form against the
  union of the `''` and `'*'` rows. Read each flag through `requireFlag` off
  its declared row and hold the `e.seam` catch arm `issue-check.mjs` ends with,
  so a valueless `--dir` refuses by name instead of emitting
  `[object Object]`. A declared `refuse` must actually be carried out or
  `arg-contract-adoption.test.mjs` reddens: that census spawns the REAL binary
  once per refusing axis and requires exit 1, one JSON line, `ok:false`, and the
  FLAG NAMED in it. That forces an ordering this tree has no precedent for,
  since this is its first bin taking both a positional argument and a refusing
  flag - the flag door must run BEFORE the missing-positional refusal, or the
  census invocation, which passes no path at all, gets an answer about the
  missing path and never names the flag. Both stated-result arms land here: run
  task 1's explicit
  not-in-history probe BEFORE reporting an empty chain, and convert the line
  arm's non-zero exit through task 1's classifier so no `fatal:` and no other
  third-party byte ever reaches stdout.
- **Verify:** `node --test cadence-core/bin/why.test.mjs` passes over a temp git
  repository the test builds, with: a tracked path returning `ok:true`, a
  non-empty `text` and the newest commit first; `<path>:<line>` on a line that
  only one of two commits touched returning a strict subset of the bare chain;
  a path git never saw returning `ok:true` with a stated not-in-history result
  and stdout containing no `fatal:`; a line past end of file returning a stated
  result rather than a non-zero exit or a crash; a valueless `--dir` returning
  `ok:false` naming `--dir`; every run's stdout parsing as exactly one JSON
  object. `node --test cadence-core/bin/arg-contract-adoption.test.mjs` passes
  with the new row in the table. Separately
  `node cadence-core/bin/self-verify.mjs --root .` reports no
  `uncontracted-script` and no `unknown-flag` entry naming `why.mjs`.

### Task 4: Determinism, and the record that is not an input

- **Files:** cadence-core/bin/why.test.mjs
- **Action:** Pin AC6 and D-07 as tests rather than as claims. Three
  properties. First, running the seam twice over an unchanged tree writes
  byte-identical stdout - the property D-17's sorting discipline exists for,
  and the one a later join can silently break by iterating a `readdirSync`
  result. Second, the answer does not move when `.planning/trace.jsonl` appears
  or disappears: that file is gitignored under `.gitignore`'s "Joined run
  record" block, so a clone and CI never have it, and anything read from it can
  only be local enrichment that degrades to absent (D-07) - anchoring the join
  on its `corr` would work on this machine and return an empty chain everywhere
  else. Third, the run dispatches no subagent, proved structurally rather than
  asserted: scan `cadence-core/bin/why.mjs` and require that every child-process
  call it makes names `git`.
- **Verify:** `node --test cadence-core/bin/why.test.mjs` passes with a test
  that invokes the seam twice on one fixture repository and asserts the two
  stdout strings are equal; a test that writes a `.planning/trace.jsonl` into
  that fixture, re-invokes and asserts stdout is unchanged from the run without
  it; and a test that reads `cadence-core/bin/why.mjs` and asserts every
  `execFileSync`/`spawnSync`/`spawn`/`exec` occurrence in it takes `'git'` as
  its command argument.

### Task 5: Register the command surface

- **Files:** skills/cad-why/SKILL.md, cadence-core/references/COMMANDS.md, cadence-core/bin/weight-budgets.json, README.md
- **Action:** Ship `/cad-why` as a discoverable skill (D-14). The SKILL.md is
  SELF-CONTAINED with no `cadence-core/workflows/why.md`: D-14 leaves that file
  optional and `skills/cad-health/SKILL.md` is the self-contained precedent that
  passes today - the choice is recorded here, and it is cheap because D-02 makes
  this skill a relay. Its body runs the seam and prints the returned `text`
  field VERBATIM, reformatting nothing, adding no prose of its own, summarizing
  nothing and re-ordering nothing; that instruction is the whole reason AC1's
  byte-identity claim is about a field a test can hold rather than about
  model-authored text. `allowed-tools` is Bash alone - no `Task`, no `Write`,
  no `Edit`: this phase writes nothing and dispatches nothing, and a `Task`
  grant here would contradict criterion 6 in the frontmatter. Add a `/cad-why`
  row to the Support cluster of `cadence-core/references/COMMANDS.md`, the file
  `skills/cad-help` renders. Add a `skills/cad-why/SKILL.md` entry to
  `cadence-core/bin/weight-budgets.json` - a SKILL.md with no budget row makes
  self-verify return `unbudgeted-surface` - and RE-PIN the existing
  `cadence-core/references/COMMANDS.md` entry in the same file, because the new
  row grows that surface past its current 5196-byte ceiling and
  `budget-overrun` fires on growth. Move README.md's sentence "Today it is 27
  skills and 6 agent roles across 19 rung files" to 28 skills:
  `prose-agreement.test.mjs` counts the user-invocable skills on disk against
  that sentence and reddens on disagreement (27 measured on disk today, 28 once
  this skill lands).
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns
  `ok:true` with `problems: []`, and `node cadence-core/bin/test.mjs` reports 0
  failures - which together cover `unbudgeted-surface`, `budget-overrun`,
  `missing-path` on the skill's `${CLAUDE_PLUGIN_ROOT}` invocation, and the
  README count test. Additionally, reading `skills/cad-why/SKILL.md` shows an
  `allowed-tools` list containing neither `Task` nor `Write` nor `Edit`, and a
  sentence instructing that the seam's `text` field is printed verbatim.
  human-verify: run `/cad-why cadence-core/bin/lib/seam-io.mjs` in a session and
  confirm the printed chain is byte-identical to the `text` field the seam
  returns for the same path.

## Notes

- Plans 2 and 3 extend `cadence-core/bin/why.mjs`, `lib/why-render.mjs` and
  `why.test.mjs`, so the three plans of this phase share declared files by
  design and `plan-overlap` will report overlaps. That routes the phase to the
  sequential execute path, which is the intent: this plan must land first
  because it creates the seam the other two wire into.
- D-13's stated mechanism does not hold as written and the decision is met by
  its other arm. Check 20 cannot report an unregistered `/cad-why` site,
  because `lib/bulk-output.mjs`'s `BULK_SHAPES` watches only `trace render`,
  `recall` and `git diff`; the default entry cap in task 2 is what actually
  bounds the response, so no `lib/bulk-output.mjs` edit is planned.
- CONTEXT's flagged assumption about `-L` resolving its pathspec against a
  commit is settled for the in-range case and partly settled for the rest: a
  line past end of file was measured to exit 128 with a `fatal:` on
  2026-08-22, and task 1 classifies it. A path that existed in history but not
  at HEAD is the residual unknown, and it lands on the same classifier arm
  rather than on a new one.
