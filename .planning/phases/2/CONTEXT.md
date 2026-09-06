# Phase 2: The golden harness - Context

Gathered: 2026-09-05
Feeds: /cad-plan 2

## Scope boundary

In: Fixture `.planning` trees derived from the frozen tag, a committed
recorder script that runs the frozen JavaScript and writes its answers to
recordings, a normalizer for the clock-derived fields, a drift check that
fails when a recording is stale, and the Rust comparison side - including a
machine `code` field on the envelope's non-`ok` arms. It includes the three
operations that need a real git repository.

**The recorded operation set is the WHOLE parity surface, revised 2026-09-05.**
It was scoped here to the ~13 seam invocations
`cadence-core/workflows/execute.md` names, bounded by what the vertical slice
exercises. That bound is removed: 4.0.0 ships at full parity with `v3.7.12`, so
the harness records **72 runtime operations across 40 fixture bundles** - 43
planning subcommands and 29 reached through the entry scripts, plus 4 tooling
selectors, 76 inventoried in total. Recordings are authored here; each one's
comparison assertion ACTIVATES in the port phase that implements its operation,
so the set grows per module phase rather than closing at the slice.

Normalization must cover every source of nondeterminism, not two clock fields:
timestamps, correlation ids, absolute paths, git SHAs, hostname, PID, iteration
order and locale. Read-side failure outputs carry absolute paths.

Out: Any domain module in the binary - phase 2 builds the measuring
instrument, not the thing measured, and the binary implements none of the
recorded operations until phase 3 begins the L0 kernel. Any change to
`cadence-core/` itself, which stays frozen and byte-identical to `v3.7.12`.
The release path, checksum pinning and the SessionStart bootstrap, which are
phase 19. Vendoring excerpt.

**No longer Out: the modules the slice does not call.** That exclusion closed
the recorded operation set at the slice and is withdrawn with the full-parity
decision. What remains out is IMPLEMENTATION, never coverage - phase 2 records
an operation's behavior whether or not any phase has ported it yet.

**This phase cannot establish parity and its close must not be read as doing
so.** Nothing is ported when it ends; it proves the instrument works, and every
parity claim waits on phase 18.

Deferred: None.

Plan shape: multiple plans, same phase. There is a clean seam - the fixtures
and the Node-side recorder carry AC2, AC6 and AC7; the Rust comparison side
and the envelope change carry AC1, AC3, AC4 and AC5.

## Durable decisions

- D-01 (Fixture provenance): `git show v3.7.12:.planning` CANNOT be the
  fixture for the dispatch loop. The frozen tag's own planning tree is a
  CLOSED milestone: `git ls-tree -r v3.7.12 .planning/phases` returns 0
  entries, and `planning.mjs status` against that tree answers
  `{"ok":true,"current":null,"total":0,"cycle":"none","phases":[]}`, which
  `cadence-core/workflows/execute.md:22-26` routes to "The milestone is closed
  - no active cycle." Capturing the tag tree verbatim would make every golden
  record a stop-immediately answer while the harness reported green. Evidence:
  measured 2026-09-05 via `git archive v3.7.12 .planning` (269 files);
  `execute.md:22-26`.
- D-02 (Fixture provenance): Live-cycle fixtures are built by re-rooting the
  tag's own `_archive-v*/<N>/` phase subtrees under `phases/<N>/` and pairing
  them with a synthesized `ROADMAP.md` and `STATE.md`. Those subtrees are real
  planning artifacts frozen at the tag and carry the exact files the slice
  reads. Chosen over hand-authored skeletons, which would prove the binary
  against toy plans - the frontmatter-parse and overlap paths are where that
  bites. Evidence: measured 2026-09-05 - the tag carries 10 archived
  milestones, and copying `_archive-v3.7.3/1` to `phases/1` produced two real
  `PLAN COMPLETE` reports from `replay-check` and a genuine 7-file overlap
  from `plan-overlap`.
- D-03 (Scope): The git-dependent operations ARE recorded in this phase. The
  recorder builds a throwaway repository for `risk-check run|status`,
  `trace close --replay` and `debt-harvest --root .`. Rejected: recording only
  the `.planning`-pure operations, which would leave roughly a third of the
  slice with no measurable target - the exact gap this phase exists to close.
  The JavaScript suite already pays this cost, so the pattern is in-tree to
  copy. Evidence: `execute.md:359`, `:545`;
  `cadence-core/bin/planning-debt-harvest.test.mjs`,
  `planning-audit.test.mjs`, `planning-lease-check.test.mjs`,
  `git-head.test.mjs` each `git init` a temp repo; user decision 2026-09-05.
- D-04 (Envelope): The Rust envelope's three non-`ok` arms gain a MACHINE
  `code` field beside the prose `reason`, and goldens compare the code. The
  JavaScript `reason` is a machine code, not prose - 28 distinct single-quoted
  literals across the four scripts (`no-phase-dir`, `unknown-key`, `bad-args`,
  `usage`, `unresolved-range`). Without a code on the Rust side, comparing
  `refused{reason:"the phase has no CONTEXT.md"}` against a recorded
  `{"reason":"no-phase-dir"}` is a diff with no verdict, and the `refused` arm
  - the whole point of phase 4's validate-and-retry loop - is the arm with no
  golden. Rejected: comparing the arm tag only, which makes any two refusals
  of one operation indistinguishable. Evidence:
  `cadence-core/bin/planning.mjs:9-10`;
  `crates/cadence/src/envelope.rs:37-39`, `:47-63`;
  `docs/rationale/architecture-v4.md:212-232`; user decision 2026-09-05.
- D-05 (Comparison): The Rust test diffs COMMITTED recordings and does not
  shell out to `node` at test time. Rejected: running the JavaScript live
  behind a gate. `.github/workflows/test.yml`'s `cargo-test` job installs the
  pinned toolchain with NO `actions/setup-node` step - the three Node jobs each
  have one - and checks out at the default shallow depth-1 while `node-test`
  needed an explicit `fetch-depth: 0`. Making the Rust arm depend on the
  JavaScript would give it a deletion date the test does not have, since D-02
  of phase 1 keeps `cadence-core/` only until parity. Evidence:
  `.github/workflows/test.yml`; phase 1 CONTEXT D-02.
- D-06 (Comparison): Parity is asserted FIELD-BY-FIELD on the
  decision-bearing keys - `replay`, `dispatch_set`, `overlaps`,
  `frontmatter_issues`, `parallelSafe`, derived phase `status` and
  `cursor.agrees` - and NOT as a byte-diff of the JavaScript
  envelope, whose shape the design has already discarded. The write-side file
  bytes are the exception and ARE byte-diffed (D-08). Pinning the JSON shape
  would make phase 4 delete the goldens rather than pass them; pinning nothing
  sharp turns parity back into a claim. Evidence:
  `docs/rationale/architecture-v4.md:135-156` (3c), `:157-171` (3d item 1),
  `:212-232` (3e item 1).
  **AMENDED 2026-09-06 by John, after the scoped falsification pass over PLAN-3
  checked all nine keys against the 156 committed recordings.** Two of the
  original nine are struck from the list above:
  - `drift` is REMOVED as a mistake. It is not an envelope field anywhere in the
    frozen production tree - every occurrence under `cadence-core/bin` outside a
    `.test.mjs` is prose in a comment ("two answers waiting to drift"). It
    reached this decision from writing ABOUT drift, not from a field, and no
    recording carries it in any spelling.
  - `undeclared` is REMOVED from the seeded table but is a REAL key and stays
    PENDING. It is emitted at `planning/lease-check.mjs:487,500` and
    `route.mjs:728`, but no recorded invocation reaches the arm that emits it -
    `lease-check-ok`'s stdout is `ok, phase, plan, plan_file, staged, declared`,
    carrying `declared` and not `undeclared`. Add it to the projection when a
    later phase ports `lease-check` and records an invocation that emits it.
  So the seeded table is SEVEN keys, not nine. The rule that survives unchanged
  is the one that matters: a projection entry naming no key is refused when the
  table is built, so shrinking the list can never quietly become comparing
  nothing.
- D-07 (Regeneration): Recordings are regenerated by a COMMITTED recorder
  script, and drift is detected by re-running it and failing on a dirty
  working tree. `cadence-core/` is frozen byte-identical to `v3.7.12` on this
  branch, so a changed recording means the frozen reference was edited, which
  is worth a red build. Rejected: record-once-immutable, which notices nothing
  if the JavaScript is touched; and an `UPDATE_GOLDEN=1` in-place rewrite,
  whose convenience makes "regenerate" the reflex fix for a failing golden and
  launders a real divergence into the baseline. The repo has no precedent
  either way - every existing JavaScript fixture is fabricated in `mkdtemp` at
  test time (`cadence-core/bin/planning.test.mjs:58-67`). Evidence: user
  decision 2026-09-05.

## Decisions

- D-08 (Recorded surface): For a WRITE operation the recording captures the
  stdout envelope AND the resulting file bytes. Three of the slice's
  operations mutate the tree and their envelopes hide the mutation:
  `trace append --phase 2 --family lifecycle --event phase_start --sha abc123`
  answered `{"ok":true,"written":true,"corr":"2-abc123"}` while writing a full
  record into `trace.jsonl`, and `cursor set` rewrote `STATE.md`. Envelope-only
  recording would pass a binary that writes a differently-shaped `trace.jsonl`,
  and the drift would surface only when `/cad-progress` read it. Evidence:
  measured 2026-09-05; contract at `cadence-core/bin/planning.mjs:8-14`.
- D-09 (Recorded set): The set is the ~13 seam invocations
  `cadence-core/workflows/execute.md` literally names, spanning four scripts -
  `planning.mjs`, `config.mjs`, `route.mjs`, `worktree-base.mjs` - and not the
  33 modules under `cadence-core/bin/planning/`. `planning.mjs phase-done`
  appears at `:539` only as a forward reference to the close
  (`workflows/verify.md`) and is OUT. Evidence: `execute.md:16`, `:35`, `:97`,
  `:150`, `:170`, `:186`, `:221`, `:261`, `:346`, `:359`, `:401`, `:545`,
  `:556`, `:564`.
- D-10 (Fixture contents): The fixture supplies `trace.jsonl`, `reads.jsonl`
  and `CAPTURE.md` itself. They are gitignored at the repo root and therefore
  absent from any tag capture, yet three slice operations read or append to
  them. The ignore rules are root-anchored, so a copy under
  `crates/cadence/tests/fixtures/` IS trackable. Without seeded files every
  trace golden records a first-write-to-absent-file case and never the
  append-to-existing case, where the correlation-id join and the size cap
  live. Evidence: `.gitignore:26,32,41`.
- D-11 (Fixture location): Fixture trees live under `crates/`, where no
  repo-wide check reaches them. `cadence-core/bin/self-verify.mjs:370-385`
  walks exactly `cadence-core/{workflows,references,templates}`, `skills/`,
  `agents/` and `docs/`, so fixture markdown naming retired config keys and old
  script paths will not fail the `self-verify` CI job; `tsconfig.ci.json:14`
  scopes the typecheck to `cadence-core/bin/**/*.mjs`. Evidence: those two
  files.
- D-12 (Determinism): The read-side operations need NO normalization. Each was
  run twice against `/code/cadence/.planning` and byte-compared - `status`,
  `replay-check --phase 1`, `plan-overlap --phase 4`, `cursor get` and two
  usage-error arms were identical, with zero occurrences of `/home/` or
  `/code/cadence` in any output. A normalizer nothing needs becomes the thing
  that hides a real divergence. Evidence: measured 2026-09-05; the seam states
  it at `cadence-core/bin/planning.mjs:13-14`, with `--dir <path>` the
  documented hermetic hook at `:12`.
- D-13 (Determinism): Three environment overrides pin the machine-dependent
  operations and none needs a test sentinel, so the harness sets them without
  opening `CADENCE_TEST_SEAM`. Unpinned, `worktree-base.mjs resolve` answered
  `"source":"/home/john/.claude/settings.json"` with `baseRef:"head"`; with
  `CADENCE_MANAGED_SETTINGS` and `CADENCE_USER_SETTINGS` pointed at an empty
  JSON file it answered `"source":"default"`, `baseRef:"fresh"`,
  `parallelSafe:false`. Unpinned, `route.mjs resolve --role cad-executor`
  answered `reviewers.plan:["openai"]`; with `CADENCE_GLOBAL_CONFIG` pinned it
  answered `["claude-subagent"]`. Evidence:
  `cadence-core/bin/lib/test-seam.mjs:34-38` states all three are deliberately
  ungated, while `config.mjs:46` and `route.mjs:160` show
  `CADENCE_CONFIG_SCHEMA` IS gated.
- D-14 (Determinism): The normalizer is TWO rules, not a general scrubber. The
  only genuine non-determinism in the slice is clock-derived and lives in two
  named fields: `cursor set`'s `"updated"` day stamp and `trace append`'s
  `"ts"`. Git shas appear only where the CALLER supplies them (`--sha`,
  `--base`, `--head`), so they are fixture inputs rather than generated values.
  No session ids and no ordering instability were observed. Evidence: measured
  2026-09-05; `cadence-core/bin/planning.test.mjs:192-194` names midnight
  straddle as why it computes the day stamp per assertion.
- D-15 (Dependencies): `insta` and `tempfile` are added as DEV-dependencies
  only. They never reach the shipped binary, so phase 19's checksum
  reproducibility and the `rust-toolchain.toml` pin at 1.98.1 are untouched,
  and the harness gets a real diff renderer instead of a hand-written one.
  Rejected: `serde_json::Value` equality plus a hand-rolled key-path diff,
  which keeps the lockfile still at the cost of failure output nobody
  maintains. Evidence: `crates/cadence/Cargo.toml` declares no
  `[dev-dependencies]`; `Cargo.lock` holds 123 packages and none of `insta`,
  `assert_cmd`, `tempfile`, `predicates` or `similar`; user decision
  2026-09-05.

## Acceptance criteria

- [ ] AC1: `cargo test --locked` at the repo root passes.
- [ ] AC2: Running the committed recorder script twice in a row produces
      byte-identical recordings for all ~13 operations, including the three
      that need a throwaway git repository.
- [ ] AC3: Changing one byte in one recording and running the drift check
      reports a failure that names the changed file.
- [ ] AC4: A test that feeds the comparison a deliberately wrong answer fails,
      and its output names the field that differed.
- [ ] AC5: For an operation the JavaScript refuses, the recording carries that
      refusal's machine code, and `cargo test` proves the Rust envelope's
      non-`ok` arms serialize a `code` field alongside `reason`.
- [ ] AC6: A search over every recording finds no absolute filesystem path and
      no clock-derived value outside the two normalized fields.
- [ ] AC7: Running the recorder with the three environment overrides pointed
      at empty files changes no recorded byte.

## Flagged assumptions

- The binary implements none of the recorded operations until phase 4, so this
  phase cannot literally satisfy the roadmap's "a Rust test that diffs the
  binary against recorded JavaScript output" - Confident; `crates/cadence/`
  holds only `main.rs`, `server.rs`, `envelope.rs` and `tests/mcp.rs`. The
  criteria above prove the harness can FAIL rather than that the binary
  agrees, because a harness that is green while comparing nothing is the false
  green this phase exists to prevent. If wrong: the phase closes green on
  plumbing that was never exercised against a real answer.
- Re-rooted `_archive-v*/<N>/` subtrees are representative of a LIVE cycle -
  Likely; they are real artifacts frozen at the tag, but they were written by
  a milestone that has since closed and archived, so a field a live phase
  carries and an archived one drops would go unrecorded. If wrong, the
  fallback is capturing from `76e260ec`, the last commit reachable from the
  tag where `.planning/phases` was live.
- ~~`ROADMAP.md:119` is STALE and was not corrected by this pass~~ - **FIXED
  2026-09-05.** It said the harness records "the operations phase 4 will
  implement", which the 2026-09-05 reorder had already falsified. The roadmap
  rewrite to nineteen phases corrected it to "the operations phases 3 through
  16 will implement" and moved the release path to phase 19.
- The recorder's throwaway git repository reproduces byte-identically across
  machines - Unclear; commit hashes depend on author, committer and timestamp,
  and the three git-dependent operations take `--base`/`--head` as caller
  inputs. If wrong, AC2 fails on the second machine and the recorder needs
  pinned `GIT_AUTHOR_DATE`, `GIT_COMMITTER_DATE` and a fixed identity.
