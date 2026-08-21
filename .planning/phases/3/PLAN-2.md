---
phase: 3
plan: 2
requirements:
  - CER-01
files:
  - cadence-core/bin/lib/risk-diff.mjs
  - cadence-core/bin/risk-diff.test.mjs
  - cadence-core/bin/lib/phase-plans.mjs
  - cadence-core/bin/phase-plans.test.mjs
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
---

# Phase 3: Ceremony the change pays for - Plan 2 (the detector stops raising on a mention)

## Goal

The plan-time floor raises on what a phase's declared files ARE rather than on
what they talk about, so a phase touching nothing on a risk surface actually
resolves below the project floor - the discount PLAN-1 built is reachable, and a
scope that declared or read nothing never takes it.

## Must be true when done

- A declared DOCUMENT that mentions a construct raises nothing: the same
  `rm -rf` or `JSON.parse` text raises `destructive` / `untrusted_input` from a
  source file and raises nothing from a `.md` body (UAT item 13).
- Replayed live on this repository, no raise cites a documentation file any
  more: `route.mjs resolve --role cad-executor --phase 2 --plan 3`, which today
  answers `METHOD.md touches destructive`, names a source file or nothing.
- No plan-time reason claims a line changed: nothing `scanDeclared` returns
  contains "changed line", while `scanDiff`'s own signal strings are unmoved
  (UAT item 14).
- A scope whose plans declare NO files is never discounted: the resolve holds
  the configured stakes, `warnings[]` names the plan file, and the reason says
  the discount was withheld because nothing was declared - never "read clean,
  declaring nothing that touches [...]" (UAT item 11).
- A declared path that resolves outside the repository - through a symlinked
  PARENT directory, not only a symlinked final component - is reported unread
  and withholds the discount, and its bytes are never read.
- `node cadence-core/bin/test.mjs routing prose` passes and
  `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
  empty `problems` array.

## Context

Closes the four gap items whose home was the AC1/AC2/AC5 grouping PLAN-1 already
shipped: UAT items 13 (mention-level raises), 14 (diff-time reason vocabulary at
plan time), 11 (an empty `files:` list takes the discount) and PLAN-1 SUMMARY's
open item on `declaredBodies` following a symlinked parent.

The locked decisions that bind it: D-01 (the detector is path signals plus a
content pass over the declared bodies, answered surfaces only), D-04 (the
discount is earned only by a scope that was READ), D-05 (frontmatter `files:`
alone), D-13 (this is not the deleted name-keyed matcher returning). The waiver
key, the effort clamp and the replay are PLAN-3; the narrative documents and the
claims ledger are PLAN-4.

Sequential, not parallel: this plan shares `route.mjs`, `route.test.mjs` and
`lib/phase-plans.mjs` with PLAN-3, and PLAN-3's replay is what measures the
result of this one.

## Tasks

### Task 1: A document body is prose, not code

- **Files:** cadence-core/bin/lib/risk-diff.mjs (`scanDeclared`, beside
  `SIGNAL_TABLE_FILES`), cadence-core/bin/risk-diff.test.mjs
- **Action:** Stop the whole-body content pass from reading documentation as
  code. `scanDeclared` currently pushes every readable body's lines into one
  pool and runs `CONTENT_SIGNALS` over it, so a document that QUOTES a construct
  evidences the category: measured on this repository, `METHOD.md` alone raised
  five phases on `an rm -rf` it describes and `references/review-triggers.md`
  raised five more. Give this face the rule that a declared path whose final
  extension names a DOCUMENT - `.md`, `.markdown`, `.mdx`, `.txt`, `.rst`,
  `.adoc`, lowercased, off the extension `baseAndExt` already computes -
  contributes its PATH signals and no content signals, skipping its body exactly
  the way `isSignalTable` already skips one. A document cannot execute the call
  it prints, and a fenced example is a quotation, not a call site; a file with no
  extension is NOT a document, which fails toward raising and is the safe
  direction. The PATH signals still run over a document's path, so
  `docs/auth/session.md` still evidences `auth` by segment and a declaration is
  never ignored. Keep the rule SCOPED to this face and say so in the doc comment
  beside the existing exemption's scoping paragraph: `scanDiff` reads a HUNK - a
  line ADDED to a document is a change someone actually made in this range - so
  its header's rule, fix at the MENTION and never a path or filename exemption,
  stays in force unedited and its behaviour does not move. Do not add a
  comment-line stripper for source files beside this: it was measured on all 30
  phase directories of this repository and changed nothing at all (27 raised
  either way), because every file whose only evidence was a comment carries real
  construct evidence too, and machinery with no measured effect is what this
  tree deletes.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` passes with
  cases pinning: a body carrying both an `rm -rf` line and a `JSON.parse` call
  returns no match under a `.md` path and returns `destructive` and
  `untrusted_input` under a `.mjs` path and a `.sh` path; a `docs/auth/note.md`
  path still matches `auth` by path segment with no body at all; an
  extensionless declared path is scanned as code; and every pre-existing
  `scanDiff` case still passes unchanged, including one whose changed line sits
  in a `.md` file and still matches. Live: `node cadence-core/bin/route.mjs
  resolve --role cad-executor --phase 2 --plan 3` no longer carries
  `METHOD.md touches destructive` in `reason` and instead names
  `cadence-core/bin/git-guard.test.mjs`.

### Task 2: A plan-time reason says what it actually read

- **Files:** cadence-core/bin/lib/risk-diff.mjs (`signalIn` and its two
  callers), cadence-core/bin/risk-diff.test.mjs
- **Action:** `signalIn` returns `changed line: <label>` for a content match and
  both faces quote it verbatim, so every plan-time raise on this repository
  reads `cadence-core/bin/config-seams.test.mjs touches secrets (changed line: a
  credential-named assignment)` at a moment when no diff exists and no line
  changed - the whole current body was scanned. Give the declared face its own
  prefix, `body line: <label>`, and leave the LABEL bytes identical so one
  vocabulary serves both faces and a reader comparing a plan-time reason with a
  commit-time `risk_surface` finding sees the same construct named the same way.
  `scanDiff`'s strings do not move - its own tests pin them and a commit-time
  record that changed wording would look like a different detector. The PATH
  signal strings (`path segment <name>`, `file <name>`, `<ext> file`) are already
  face-neutral and stay exactly as they are. Keep `signalIn` as THE one signal
  ordering both faces walk: pass the prefix in rather than forking the table, a
  second copy of that ordering being the drift this file's header exists to
  refuse. `route.mjs` interpolates `hit.signal` and needs no edit for this.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` passes with
  cases pinning: no string `scanDeclared` returns contains "changed line"; a body
  match reads `body line: a JSON.parse call` while the same construct through
  `scanDiff` still reads `changed line: a JSON.parse call`; and the label bytes
  after the prefix are byte-identical between the two faces for one shared
  signal. Live: `node cadence-core/bin/route.mjs resolve --role cad-executor
  --phase 3` prints a `reason` in which no entry contains "changed line".

### Task 3: A scope that declared nothing proves nothing

- **Files:** cadence-core/bin/lib/phase-plans.mjs (`readOnePlan`,
  `declaredPhaseFiles`, `declaredPlanFiles`), cadence-core/bin/phase-plans.test.mjs,
  cadence-core/bin/route.mjs (`riskFloor`'s `read` predicate and the withheld
  `why` chain under it), cadence-core/bin/route.test.mjs
- **Action:** A plan declaring an empty `files:` list is scored today as `1 plan
  read clean, declaring nothing that touches [...]` and takes the `solo`
  discount - absence of evidence reported as absence of surface, reproduced with
  the shipped `cadence-core/templates/PLAN.md`'s own frontmatter, which ships
  `files:` with no items. Make the reader report it: beside `found` and `clean`,
  name the conforming plan files that read CLEAN and declared no path at all, so
  the caller can apply the same argument D-04 already applies one level up
  without re-reading a byte. In `riskFloor`, a scope with any such plan is NOT
  discountable - it joins `found > 0`, `clean === found` and the `unread` term in
  the one predicate - and each one gets a `risk floor: `-prefixed warning naming
  the plan file, on the vocabulary `route.mjs` already relays verbatim. The
  withheld `why` chain gains its own arm for this cause: a scope that declared
  nothing says so, because "no surface" and "nothing was declared" are the two
  sentences this seam already exists to keep apart and the second must never be
  spelled as the first. Do NOT edit `lib/planning-files.mjs`: `items: []` is a
  correct answer for a missing block, a missing key and an empty list alike, and
  what zero declared paths MEAN is the floor's judgement, not the grammar's -
  making the frontmatter reader mint an issue here would change every consumer of
  that grammar for one caller's question. An explicitly configured `stakes` is
  unaffected: this arm withholds a DISCOUNT and never raises anything.
- **Verify:** `node --test cadence-core/bin/phase-plans.test.mjs
  cadence-core/bin/route.test.mjs` passes with cases pinning: a plan whose
  frontmatter carries `files:` with no items counts found and clean and is named
  as declaring nothing, while a plan declaring one path is not; a plan with no
  `files:` key at all takes the same arm; with `stakes` unset, a phase whose one
  plan declares nothing returns `ok:true` at `shipped` with a `risk floor:`
  warning naming that plan file and a reason stating the discount was withheld
  because it declared no files, never `declaring nothing that touches`; the UAT
  probe reproduced verbatim - the shipped template's frontmatter plus a
  `- **Files:**` task line naming a surface file - returns `shipped` rather than
  `solo`; a two-plan phase where one plan declares files and the other declares
  none is not discounted; and the existing clean-and-surfaceless cases still
  return `solo`.

### Task 4: A declared body outside the repository is not evidence

- **Files:** cadence-core/bin/route.mjs (`declaredBodies`),
  cadence-core/bin/route.test.mjs
- **Action:** `declaredBodies` guards the FINAL declared path component with
  `lstatSync` and `isFile()`, and still follows a symlinked PARENT directory, so
  a declared body outside the repository can be read as evidence and the
  docstring's boundary claim - a `--file` pointed at another tree cannot read
  this one's files - is not true for a repository whose own layout carries such a
  link (raised by the `risk_surface` re-arm round, adjudicated medium). Close it
  where the docstring makes its claim: resolve the declared path with
  `realpathSync` and require the result to sit inside the resolved repository
  root before any read, so containment is judged on what the path RESOLVES to and
  not only on how it is spelled. Resolve the repo root the same way, once, or a
  root that is itself reached through a link (a temp dir on a linked `/tmp`)
  would refuse every legitimate path. Keep the arms distinct and keep the
  existing order of judgement: a path that does not exist stays THE one arm that
  is not `unread`, because at plan time a declared file frequently does not exist
  yet; a path that exists and resolves outside the root is `unread` with a cause
  naming the boundary, which withholds the discount exactly as the oversized and
  non-regular arms already do. Every call in its own try, nothing throws, and the
  body is never echoed - a refused path may hold the very evidence a discount
  would claim is absent, and saying which file was skipped is the whole report.
  Update the docstring paragraph that states what this function refuses to open
  so the boundary it claims is the boundary it enforces.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes with cases
  pinning: a fixture repo holding a directory symlink that points OUTSIDE the
  repo root, with a plan declaring a path through it, returns `ok:true` at the
  configured stakes, a `risk floor:` warning naming that path as unread with the
  boundary as the cause, a reason recording the withheld discount, and no
  category raised from the outside file's contents (proved by giving that
  outside file a body on an answered surface); a plan declaring an ordinary
  nested path still reads its body and still raises; and the pre-existing
  not-a-regular-file, oversized-body and climbing-`..` cases still pass with
  their current warning strings.

## Notes

- Plan mapping for this round, as the dispatch requires: PLAN-2 closes UAT items
  13, 14 and 11 plus PLAN-1 SUMMARY's `declaredBodies` symlink open item; PLAN-3
  closes items 3 (AC3) and 4 (AC4) and implements D-08; PLAN-4 closes item 12 and
  carries AC6/AC7.
- STRUCTURE DEVIATION, recorded rather than silent. CONTEXT.md's `Plan shape`
  declared three plans - the detector + floor resolve (AC1/AC2/AC5), the replay +
  override rail (AC3/AC4), the prose + measurement close (AC6/AC7). Four of this
  round's six gap items belong to the FIRST grouping, whose plan (PLAN-1) is
  executed and committed and may not be rewritten, so they land here as a fourth
  plan rather than inside the declared three. The plan COUNT therefore departs
  from the directive; the groupings do not. And all four plans share declared
  files (`route.mjs`, `route.test.mjs`, `lib/phase-plans.mjs`,
  `weight-budgets.json` among them), so they are SEQUENTIAL in number order,
  never parallel - the independence test forbids the parallel reading of a
  multi-plan shape here, exactly as PLAN-1's own Notes already recorded.
- MEASURED, on all 30 phase directories this repository holds (`.planning/phases`
  plus every `_archive-*`), through the shipped `scanDeclared` with this
  project's answered set [secrets, destructive, untrusted_input]. Today: 29 of 30
  phases and 40 of 46 conforming plans raise. With task 1's rule: 27 of 30 phases
  and 36 of 46 plans, and every phase whose only evidence was a documentation
  mention stops raising - the 13 disappearing evidences are `METHOD.md` (5),
  `references/review-triggers.md` (5), `CHANGELOG.md`, `.planning/CAPTURE.md` and
  `references/triage-gate.md`. This reproduces the verifier's own 29/30 figure
  and supersedes PLAN-1's unreproducible "39/48 body pass" note.
- THE RESIDUAL, stated rather than papered over. The raises that survive are real
  constructs in declared SOURCE files: `JSON.parse(` in this repo's seams,
  `rmSync`/`unlinkSync`, and identifiers like `RECORD_TOKEN` that satisfy the
  credential-assignment pattern. A whole-body read of a large multi-concern seam
  will keep matching, because the file genuinely does the thing; that is inherent
  to D-01's plan-time design, where no diff exists to narrow the read. The
  answer for a project whose answered surface is everywhere is PLAN-3's waiver
  key, which lowers the floor per NAMED surface with the waiver stated in
  `reason` - not a further narrowing of the detector here.
