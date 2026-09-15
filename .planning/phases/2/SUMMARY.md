---
phase: 2
status: complete
completed: 2026-09-06
---

# Phase 2: The golden harness - Summary

A deterministic recorder for the frozen `v3.7.12` surface, seventeen fixture
bundles built from the tag, and a Rust comparison test that diffed the binary's
answers against 156 recordings over 74 operations. The recorder and the
recordings were then **deliberately removed** at phase close, because the
rearchitecture ruling landed the same day and they pin a unit 4.0.0 does not
keep. The fixture corpus survives and is what every later phase builds on.

**Written by hand after the fact.** All three plans were dispatched through
`mcp__codex__codex` rather than `cad-executor`, so `/cad-execute` never ran and
nothing wrote this file at the time. The commits, the trace brackets and this
summary are the receipts that were kept on the orchestrator's side; the
dispatch mechanism is what changed. See the standing rule on circumventing
Cadence where it does not fit the Codex-driven cycle.

## What shipped

- **Seventeen fixture bundles** built from the `v3.7.12` tag via `fixtures.json`'s `tag_paths`, covering the archived, closed, deferred, incomplete, malformed, multi-phase, unreadable, protected, publish-authorized, forge-configured and plugin shapes - `crates/cadence/tests/golden/fixtures/`, `crates/cadence/tests/golden/build-fixtures.mjs`, `crates/cadence/tests/golden/fixtures.json`
- **A full operation inventory**: `operations.json` as a flat array of 156 invocations over 74 distinct operations, 47 of them `git: true`, one recording file per invocation
- **Refusal-source classification** on every operation - 61 `handler`, 10 `door`, 3 `none`, with proof required for `none`
- **Six normalization rules** shared as data: trace `ts`, reads `ts`, `cursor.updated` on stdout, `STATE.md` `Updated:`, and UAT `started` / `updated`
- **A `golden-drift` CI job**, green on run 34041291596, five jobs total beside `cargo-test`, `typecheck`, `self-verify` and the Node matrix
- **Negative controls that fail on wrong answers**, proving the instrument by disagreement rather than by agreement

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 11054d2c | Build frozen live-cycle golden fixture |
| 1 | 2 | c8041775 | Record frozen slice operations hermetically |
| 1 | 3 | 36eca1c4 | Inventory all planning operations |
| 1 | 4 | 5487e27c | Cover entry scripts and classify refusal sources |
| 1 | 5 | 0b7e7d87 | Build archived and closed planning fixtures |
| 1 | 6 | 1a3950b1 | Build project plugin and refusal fixtures |
| 2 | 1 | ac1f7df4 | Record deterministic git fixture operations |
| 2 | 2 | d88dc0f1 | Capture all fixture mutations in recordings |
| 2 | 3 | c2376bdb | Share named clock normalization as data |
| 2 | 4 | e571d9c3 | Record the full deterministic parity surface |
| 2 | 5 | 0f0fa9a0 | Enforce golden drift and interpreter pin in CI |
| 3 | 1 | 74268389 | Keep golden comparison tools out of the shipped binary |
| 3 | 2 | 9dc8b48c | Distinguish refusal verdicts with machine codes |
| 3 | 3 | 3e35298b | Reject golden contract drift before comparison |
| 3 | 4 | 43bf5610 | Give operation drivers intact disposable fixtures |
| 3 | 5 | cd0c18bd | Prove wrong golden answers fail on decision fields |
| 3 | 6 | a4fa407e | Account for every recording without implying agreement |

Non-task commits in the phase window: `434c56da` (context), `b06ac106` (plan),
`8921f148` (the enum-spine scope ruling), `fb502d7e` / `fa82602e` / `6c920588` /
`e8416c26` (falsification corrections to the plans and to D-06), `460c9e43`
(the authoring-path fix below), and `7d64c4c9` (dropping the goldens).

## Deviations

- [deviation] **The goldens were deleted at phase close, in `7d64c4c9`.** The
  plans built a recorder, 156 recordings, `normalization.json`,
  `operations.json`, a Rust comparison test and the `golden-drift` CI job; all
  of those were removed. Cause: John's rearchitecture ruling the same day made
  parity owed only at the user-facing skill surface, and each recording pins one
  CLI invocation - an internal operation the redesign may delete outright. A
  green harness would have been asserting agreement with an implementation being
  replaced. Kept: the seventeen fixture bundles, `build-fixtures.mjs` and
  `fixtures.json`, because those are INPUTS rather than expectations and
  rebuilding them is the expensive part. The dev-dependencies only `golden.rs`
  used went with it and no package they pulled remains in the lock.
  `cadence-core/` stayed byte-identical to `v3.7.12` throughout.

- [deviation] **A determinism defect was found by the harness on its first CI
  run and fixed in `460c9e43`.** `golden-drift` went red on one recording,
  `milestone-prune-ok`. Ten committed fixture files carried the literal string
  `/code/cadence` in their PROSE, inherited from the real `.planning/` history
  at the tag (19 occurrences), and `record.mjs:285` does an unconditional
  `text.replaceAll(repo, '<REPO>')` where `repo` is
  `realpathSync(resolve(here, '../../../..'))`, applied to the whole serialized
  recording, so it reached captured file bytes. **The committed goldens only
  reproduced on a machine rooted at `/code/cadence`.** Fixed by sanitizing the
  path to `/srv/example-project` in `build-fixtures.mjs` rather than in the
  fixture tree, because the fixtures are built from the tag and a sed over the
  tree would be undone by the next rebuild. 11 of 156 recordings changed: 9 are
  `git: true` (changed bytes mean changed blob and commit SHAs in the throwaway
  repo), plus `milestone-prune-ok` and `recall-ok`.

- [deviation] **`golden.rs:618` calls `std::process::Command` and this is not a
  D-05 violation.** It re-invokes the TEST binary in an isolated worker to pin
  insta's process-wide `INSTA_UPDATE` env, which `Settings` cannot reach. It
  never spawns `node`. Recorded because it reads as a violation on a casual
  check; the file is gone now, but the pattern will recur.

- [deviation] **Two acceptance criteria were replaced mid-plan on John's
  ruling**, both applied across the remaining tasks without a further stop: a
  refusal may be recorded from the argument-contract DOOR where the handler's
  own `fail()` is unreachable, and `refusal_source` takes exactly one of
  `handler` / `door` / `none` with proof required for `none`.

- [deviation] **`CONTEXT.md`'s locked D-06 was amended, not just the plans.**
  It named nine decision-bearing parity keys and two do not exist: `drift` is
  not an envelope field anywhere in the frozen production tree (every occurrence
  under `cadence-core/bin` outside a test is prose in a comment), and
  `undeclared` is real but no recorded invocation reaches its emitting arm. John
  ruled: strike `drift` as a mistake, hold `undeclared` PENDING until a phase
  ports `lease-check`. The seeded table is seven keys.

## Open items

- **The phase proved the instrument and proved no parity.** The honest number at
  close was `compared=0 pending=156`: the binary implemented no recorded
  operation, so the harness was proven by its negative controls and never by
  agreement. Nothing here is a parity claim, and this phase's close must not be
  read as one.
- **Acceptance moves to phase 16 and has to be rebuilt at a different
  boundary.** The scenario-bounded workflow episode replaces the CLI invocation
  as the unit. For each assertion carried forward from this phase, name its
  public consumer and translate it into a domain or scenario invariant; drop the
  ones that only pinned obsolete transport.
- **`HAR-01` through `HAR-07` are still `Pending` in `## Traceability`.** No UAT
  ran for this phase, so no verifier advanced them. They cannot be advanced by
  this summary - only `/cad-verify` sets a Status beyond Pending - and several
  of them describe the deleted harness, so the verification pass has to rule on
  each: satisfied, retired with the goldens, or carried to phase 16.
- **`ARCHIVE.md` appears in the fixture corpus and 4.0.0 drops it.** The
  bundles are repo states at the frozen tag, so they legitimately contain
  artifacts the rewrite retires. That is correct for an input corpus and wrong
  for an expectation, and a later phase must not read fixture presence as a
  requirement to keep the artifact.
- **The determinism lesson generalizes and is now roadmap-level.** Four local
  determinism checks missed the authoring-path defect because they varied
  `TMPDIR`, `TZ`, `LC_ALL` and `HOME` but never the REPO PATH. Any determinism
  criterion from here on must relocate the repository - `git archive HEAD | tar
  -x` into a scratch dir, `git init`, run the check there.

## Goal check

The phase goal - parity against `v3.7.12` is a test that runs rather than a
claim - was delivered and then deliberately unwound, and both halves are real.

Delivered: the recorder ran hermetically, `record.mjs --check` exited 0 on a
fresh run, the hostname / GPG / absolute-path leak greps were all empty,
`<NOW>` appeared in 7 files and `<TODAY>` in 6, and `golden-drift` went green on
CI at `460c9e43` beside four other jobs. I audited those claims independently
rather than taking the executor's report, and every one held. The harness also
caught a genuine defect on its first real run, which is the strongest evidence
available that the instrument worked.

Unwound: `7d64c4c9` removed the recordings, the recorder, the comparison test
and the CI job, on the ruling that they measure the wrong unit. What remains on
disk is the seventeen-bundle fixture corpus, `build-fixtures.mjs` and
`fixtures.json` - verified present at HEAD - and `cadence-core/` still diffs
empty against `v3.7.12`.

So the honest close is: **the measuring instrument was built, validated, used to
find one real defect, and then retired along with the parity model it served.**
The fixtures are the durable output. Phase 16 owns rebuilding acceptance at the
scenario boundary, and phase 2's contribution to it is the corpus and the
determinism rule above, not the recordings.
