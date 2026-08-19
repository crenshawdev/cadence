# Phase 3: Gates that fire on themselves or cannot be satisfied - Context

Gathered: 2026-08-18
Feeds: /cad-plan 3

## Scope boundary

In: four gates and locators stop answering about something other than what they
were asked - `detect-commands` names a command only when its binary is reachable
(RCH-01), `risk-check run --plan` accepts the whole worker-key grammar its own
`status` derives from lifecycle brackets (RSK-03), `risk-diff` stops matching the
literals that live in its own source and test file (RSK-04), and `## Shipped`
plus every `## Traceability` locator is found fence-aware through `sectionSpan`
(SHP-01).

Out: the eight `CONTENT_SIGNALS` detection patterns themselves - breadth is a
deliberately unpromoted capture item (`.planning/CAPTURE.md:190`) and re-tuning
them changes detection for every project on an unrelated fix. Out: the trace
WRITE face - `trace append`/`trace close --plan` keeps storing the caller's
string unvalidated. Out: `planning.mjs`'s own `--dir`, still the phase 4 gap
phase 2's D-03 recorded.

Deferred: None.

Plan shape: multiple plans, same phase. The four requirements touch disjoint
files and can hold non-overlapping leases - RCH-01 in `planning.mjs` plus a new
`lib/` predicate, RSK-03 in `planning.mjs`'s two risk-check faces plus
`workflows/execute.md`, RSK-04 in `lib/risk-diff.mjs` and `bin/risk-diff.test.mjs`,
SHP-01 in `lib/milestone-prune.mjs` and `lib/planning-files.mjs`.

## Durable decisions

- D-01 (RSK-03 direction): `run --plan` WIDENS to the worker-key grammar;
  `status` does not narrow. `.planning/REQUIREMENTS.md:33-34` states RSK-03 as
  "satisfiable for every worker key `seams.md` permits", and the exclusion arm is
  fail-open on the one trigger that is `blocking` at every stakes level - a real
  `cad-executor` bracket that returned (measured: `1-cut-b`, `corr: 2-fc162e3`)
  would need no risk record at all. This REJECTS the preferred direction the peer
  session recorded in `.planning/CAPTURE.md`'s phase-3 entry ("status EXCLUDES any
  key run would reject"); that note is superseded, not unread. STATED COST: the
  receipt join `rowKey(corr, plan)` (`planning.mjs:3999-4001`) and
  `references/triage-gate.md`'s `trace append --plan <k>` receipts must be written
  with the SAME spelling, or a widened `run` records under a key the receipt
  cannot settle.
- D-02 (RSK-03 mechanism): ONE shared plan-key predicate is consulted by both
  faces, not two independent edits. Evidence: `planning.mjs:3659` and `:3874` each
  call `requireInt(opts.plan)` on their own; the precedent is `answeredSurfaces()`
  at `lib/surface-scan.mjs:79`, whose comment states the rule - "two copies of this
  rule would let the seam that enforces the question disagree with the resolve that
  reports it". Two edits re-enter the RSK-03 state one spelling over.
- D-03 (RSK-03 write face): the trace WRITE face is NOT where this is enforced.
  `planning.mjs:3413` stores `--plan` as any non-empty string, `route.mjs:759`
  takes `--bracket-plan` the same way, and `lib/trace.mjs:390` states plan is "the
  WORKER key - a plan number on either execute path, a role name for a
  role-dispatched worker". Measured on the live trace: 74 `cad-verifier`, 73
  `cad-planner`, 66 `cad-assumptions-analyzer`, 16 `cad-reviewer`, 10
  `cad-plan-checker` role-keyed events. A numeric-only write rule refuses all 239
  and the run record stops attributing work to the worker that caused it.
- D-04 (RCH-01 probe target): the PATH check probes the command's DRIVER (first
  word) AND, for an `npx`-delegated arm, `<root>/node_modules/.bin/<tool>` - which
  is where `npx` actually resolves it. [corrected by plan-1 deviation: `npx` walks
  ANCESTOR directories too, so a root-only probe nulls a command `npx` would run -
  measured 2026-08-19, `npx --no-install tsc --version` prints `Version 7.0.2` from
  a directory two levels under this repo with no local `node_modules`] Measured 2026-08-18: `npm`, `npx`, `cargo`,
  `python3` present; `ruff`, `mypy`, `eslint`, `tsc`, `go` absent from PATH; `tsc`
  present at `node_modules/.bin/tsc` and `npx --no-install tsc --version` prints
  `Version 7.0.2`. Driver-only nulls `npx tsc -p tsconfig.ci.json`, this
  repository's ONLY detected static-analysis command and the one CI runs
  (`tsconfig.ci.json`); tool-only leaves `npx eslint .` naming an eslint nobody has,
  because `npx` itself is present.
- D-05 (RCH-01 fallback): an unreachable winning arm NULLS its slot and names the
  tool in `warnings[]`; it does NOT fall through to a lower arm. Evidence:
  `.planning/CAPTURE.md:41` ("both-slots-null was already a clean answer");
  `planning.mjs:2529-2544`'s ladder comment states the ordering rule a fall-through
  would break ("A project's OWN script beats a tool config in the same tree"). With
  fall-through, a tree carrying `pyproject.toml` `[tool.ruff]` and `go.mod` with
  ruff absent is told to run `go vet ./...` - a linter the maintainers did not
  choose, over a language the change may not touch. `source` keeps its shape
  whatever the verdict, per `planning.mjs:2570-2578` ("a caller has to be able to
  tell 'found nothing' from 'did not look'").
- D-06 (RSK-04 mechanism): the fix SPLITS the self-matching literals in both files
  and is PINNED by a census test; it is not a path rule and not a filename rule.
  `README.md:60` states the ban directly - "A test file called
  `ingest_concurrency.rs` was enough to put six roles on their top rung for the rest
  of the phase, so that detector is gone as of v2.7.0. What the code does decides;
  what the file is called does not." Measured blast radius of a path-based rule
  2026-08-18: of 520 tracked files with a readable diff, 90 match at least one
  category and 32 of those are `*.test.mjs` or under `fixtures/`. The pin is
  load-bearing on its own: phase 1's D-07 recorded that a fix nothing tests is
  reverted by the next edit with a green self-verify.
- D-07 (RSK-04 reach): the self-match is NOT confined to the test file - the
  DETECTOR'S OWN SOURCE matches. Measured 2026-08-18, a whole-file add of
  `cadence-core/bin/lib/risk-diff.mjs` scanned against this repo's configured
  surfaces (`.planning/config.json`: `secrets`, `destructive`, `untrusted_input`)
  returns `destructive` and `untrusted_input`, from its own `:127`
  (`label: 'an \`rm -rf\`'`) and `:148`
  (`/\b(bodyParser|body-parser|multer|formidable)\b/`). A fix scoped to
  `risk-diff.test.mjs` alone leaves phase 3's own edit firing the blocking gate.
- D-08 (SHP-01 scope): every `## Traceability` locator routes through `sectionSpan`
  alongside the `## Shipped` fix - `lib/milestone-prune.mjs`'s own line-based
  filter plus `lib/planning-files.mjs:214`, `:267` and `:699`. Closing `## Shipped`
  alone satisfies the requirement's wording while leaving four sibling locators for
  the ADJACENT section fence-blind in the same files, which is the defect class
  rather than the defect.
- D-09 (platform): the reachability predicate handles `PATHEXT` on win32, so
  `npm`/`npx`/`tsc` - which ship as `.cmd`/`.ps1` shims there - resolve. This
  SETTLES the analyzer's one research flag rather than leaving it open:
  `issue-check.mjs:139-147`'s `onPath` checks a bare `join(dir, bin)` with `X_OK`
  and no `PATHEXT`, and no file in the tree states a supported-platform set.

## Decisions

- D-10 (RCH-01 form): the predicate is extracted to `lib/` and imported by BOTH
  `issue-check.mjs` and `planning.mjs` - one predicate, two callers, pure `fs`,
  no subprocess. Evidence: `issue-check.mjs:139-147` already carries the shape and
  calls itself "one resolution site"; `planning.mjs:2488-2570` has no
  `execFileSync` anywhere in `cmdDetectCommands`, and its header calls it "a seam
  and not executor judgment... testable on fixture trees". Spawning `command -v`
  per arm makes it up to six subprocesses on the path the executor runs before
  every commit.
- D-11 (RCH-01 tests): reachability goes behind a `CADENCE_*` env override the
  fixtures set, because the 23 existing `detect-commands` assertions otherwise
  become machine-dependent. Measured: with driver semantics the `ruff`, `mypy` and
  two `go` assertions fail on this machine today; with the `node_modules/.bin`
  half added, the `npx eslint`/`npx tsc` assertions fail too, since a
  `mkdtempSync` fixture tree has no `node_modules`. Harness pattern exists at
  `planning.test.mjs:144` and `:5408` (`env: { ...process.env, ...env }`);
  override precedent at `lib/config-merge.mjs:27` and `route.mjs:105`.
- D-12 (RSK-03 doc gap): `workflows/execute.md` gains the missing statement of
  what worker key a fix-pass or continuation dispatch takes. `:204-205` states
  "the worker key is the plan NUMBER here"; `:241` and `:245-247` tell the
  coordinator to "dispatch a fresh continuation" and never say what key it
  carries. That omission is what minted `1-fix`, `1-cut` and `1-cut-b`; making the
  seam consistent without writing the rule down invites a fourth spelling.
- D-13 (SHP-01 reach): the append-after-last-row loop inside an existing
  `## Shipped` is bounded fence-aware too, not just the heading lookup. The loop
  scans `headingAt + 1` forward breaking on `/^## /` with no fence scanner, unlike
  the `## Active` removal five lines above it that takes both ends from
  `sectionSpan`. The governing rule is stated in the file's own header at
  `lib/milestone-prune.mjs:154-158` - "a start found fence-aware cannot be repaired
  by a fence-blind end".
- D-14 (SHP-01 accepted widening): moving to `sectionSpan` changes the match rule
  from `/^## Shipped\s*$/` to TRIMMED equality, so an indented `  ## Shipped`
  begins counting as the section. Accepted, and already named as such:
  `lib/planning-files.mjs:1504` matches on `lines[i].trim() === heading` and `:79`
  states "One accepted widening: `sectionSpan` matches a heading by TRIMMED
  equality".
- D-15 (SHP-01 evidence): this is a latent defect closed by symmetry, not a live
  reproduction - the phase builds its own fixture. `templates/REQUIREMENTS.md`
  puts its whole body inside a ```markdown fence (lines 9-54) carrying `## Active`,
  `## v2 Requirements`, `## Out of Scope` and `## Traceability`, and no
  `## Shipped`; `.planning/REQUIREMENTS.md` has all five headings at column 0 with
  no fences. Mirror the existing `## Active` fenced fixture at
  `milestone-prune.test.mjs:364-408`.
- D-16 (RSK-04 constraint): `parseDiff` returns a FLAT `changed` array with no
  per-file attribution (`lib/risk-diff.mjs:194-266`; `:293-302` and `:315-317` test
  every content pattern against that one array). Recorded so the planner does not
  reach for a per-path content filter as a small addition - it is a parser rewrite,
  and D-06 does not need it.
- D-17 (RSK-04 boundary): the eight `CONTENT_SIGNALS` patterns are out of scope.
  `.planning/CAPTURE.md:190` holds the breadth item (`untrusted_input` misses
  `request.get_json()`, `destructive` misses `rm --recursive --force`) as an
  unpromoted note moved out of Todos at the 2026-08-18 triage. Widening them
  re-tunes eight heuristics every existing `risk-diff.test.mjs` row pins, and
  changes the gate's detection for every project on an unrelated fix.

## Acceptance criteria

- [ ] AC1: On a fixture tree configuring `ruff` (or `mypy`, or `eslint`) with that
      binary absent from `PATH` and from `node_modules/.bin`, `detect-commands`
      returns that slot as `null` and names the unreachable tool in `warnings[]`,
      and does not fall through to a lower matching arm.
- [ ] AC2: Run in this repository, `detect-commands` returns
      `npx tsc -p tsconfig.ci.json` for the typecheck slot, with `tsc` absent from
      `PATH` and present at `node_modules/.bin/tsc`.
- [ ] AC3: The full `detect-commands` test set passes on a machine with `ruff`,
      `mypy`, `eslint`, `tsc` and `go` all absent, and passes again with a stub for
      each made reachable.
- [ ] AC4: `risk-check run --phase 3 --plan 1-fix --base <ref> --head <ref>`
      returns `ok:true` and records a risk row, and `risk-check status` for a range
      whose brackets carry `1-fix` returns `ok:false` before a receipt exists under
      that `corr`+`1-fix` and `ok:true` after one does.
- [ ] AC5: `risk-check run` and `risk-check status` reach the plan-key grammar
      through one exported predicate, and a test asserts that a key accepted by
      either face is accepted by both.
- [ ] AC6: `scanDiff` over a whole-file add of `cadence-core/bin/lib/risk-diff.mjs`
      returns zero matches, and over a whole-file add of
      `cadence-core/bin/risk-diff.test.mjs` returns zero matches, under both this
      repository's configured surfaces and the full eight-surface set; a committed
      test asserts both and was watched failing against the pre-fix tree.
- [ ] AC7: On a fixture whose `## Shipped` and `## Traceability` headings appear
      only inside a fenced block, `milestone-prune` leaves the fenced content
      unedited and reports no section found; on the same fixture with real headings
      below the fence, it archives rows under the real `## Shipped`.

## Flagged assumptions

None - all assumptions confirmed or corrected. The analyzer's one research topic
(Windows `PATHEXT` resolution) was settled as D-09 rather than left flagged.
