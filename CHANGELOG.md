# Changelog

All notable changes to Cadence are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Cadence follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.7.5] - 2026-08-27

This cycle had no subject, it had a standard. Every open issue got re-triaged
against one question, would a user running Cadence on their own project ever
feel this, or does it only bite while Cadence is being developed on Cadence.
Eight answered the first way and those eight are the release.

The hard block was the forge. `git.forge_host` only ever accepted a bare
hostname, so anyone whose Forgejo lives on `forge.example:3001` could not state
that at all, and Cadence would happily wire an origin at the default port and
then fail to talk to it. The key now takes `host[:port]`, the grammar is
enforced at the config write face rather than at the first call that trips over
it, and the port is carried whole into the `tea` login match and into
`forge.mjs create`. `create` also refuses a `--remote-url` whose port the
configured instance does not serve, instead of wiring a wrong-port origin
silently, and it refuses a `--remote-url` on a row whose create wires `origin`
itself rather than letting the two fight.

`/cad-execute` could pay for the same work twice. If a session died between the
last task's commit and the SUMMARY write, the phase derived as `planned` again
and the next run re-dispatched every plan on top of committed work.
`/cad-execute` now reads each plan's `reports/plan-<k>.md` first line before it
spends anything, refuses a phase whose every plan already reports
`PLAN COMPLETE`, and dispatches only the plans that do not.

The risk gate was tripping on its own paperwork. A `risk_surface` finding that
quoted a destructive command got stored verbatim in the adjudication record, and
committing that record re-tripped the very gate that produced it, so reviewing
your own work meant overriding a blocking gate to file what the gate had told
you. `risk-check run` now withholds the four stored-reviewer-text artifacts
under `.planning/phases/` from the range it reads. The withholding is by path,
so every category and every signal still fires exactly as before.

A killed rotation used to disable rotation forever. `trace.jsonl` claims a
rotation with a lock, and a SIGKILL or a host timeout mid-rotation left that
claim behind with nobody to release it, so the record stopped rotating and every
later append paid about 266 ms for the privilege. The claim now dates itself
with a sidecar, a claim older than 30 s is evicted and rotated by the next
append, and the stamp is written private and published only by an arm that owns
the claim so a losing append never restarts the clock. One rotation lost instead
of all of them.

Last, `recall` did not fold suffixes, so a query for `seam` missed every
document that said `seams` and `close` missed `closes`. Porter steps 1a and 1b
now run inside `tokenize`, which is the one site both indexing and querying
already pass through, so index time and query time are identical because there
is one code path rather than two that agree. A 30 document fixture corpus and a
16 query named-hits baseline are committed under `cadence-core/bin/fixtures/`
and run in the suite, and 14 of the 16 queries return the same top hits they did
before the fold. The fold is steps 1a and 1b only: `verifies` and `verify` are
still two terms, and nothing here claims otherwise.

Five phases, 53 commits off `main`, 8 feat against 7 fix. Eight requirement ids,
all traced to a verified phase: `FRG-03`, `FRG-04`, `FRG-05`, `FRG-06`,
`EXP-03`, `RSK-06`, `TRC-09`, `RCL-08`. `/cad-audit` PASS on both arms, 8 of 8
requirements traced with 0 broken, 23 of 23 acceptance criteria covered with 0
breaks. UAT 38 passed, 0 failed.

Two items from the recall issue did not ship and are recorded rather than
dropped: the multi-query union, which changes the `recall` seam signature three
callers pin, and the failure records sitting outside the corpus, which needs a
scope decision this cycle did not take.

## [3.7.4] - 2026-08-27

`v3.7.3` fixed the instruments. This cycle spent what they measure, and the
honest result is that the one number it existed to take came back inconclusive.

A dispatch is priced by what it is handed, so the cycle started there. A plan's
declared read set is now a measured number with a reported ceiling
(`workflow.max_plan_bytes`, default 675,000), and the plan-time risk floor stops
reading an import statement or a constant declaration as evidence that a file
touches a risk surface, which is what was quietly escalating plans into
expensive routing cells. Then the rung sentence came out of all 19 agent bodies
so a role's rung files share one byte-identical prefix, and the record grew the
prompt-cache figures that would show what that recovers.

It does not show it yet. The after side is two `cad-verifier` dispatches at
1,952,026 cache reads and 89,744 cache creations each, against a before side of
33 dispatches averaging 1,635,645 and 83,790. Both moved UP, +19.3% and +7.1%,
which is not the shape of a prefix-reuse win. The two populations are not
comparable: the after side ran back to back in one session against a byte
identical prompt and the before side is spread across many sessions with
different prompts and different lengths. The figures now accumulate
automatically on every dispatch, so the real comparison costs nothing to take
later, and this release does not claim a win it has not measured.

The cycle also closed a defect that would have taken the record with it.
`.planning/trace.jsonl` was 604,183 bytes, 57.6% of a 1,048,576 byte cap that
refused every append past it, forever, with no rotation. At the recent rate that
was about eleven days out.

Four phases, five requirement ids all traced to a verified phase: `BUD-03`,
`RSK-05`, `RNG-03`, `TRC-07`, `TRC-08`. UAT 29 passed, 0 failed, 1 skipped.
16 feat against 6 fix, where `v3.7.3` ran 7 against 7.

### Added

- **A plan's read set is a measured number** (`BUD-03`). `workflow.max_plan_bytes`
  (int, default 675,000) and `plan-size --max-bytes` report what a plan's `files:`
  declares, with an `absent` count beside the total, at `/cad-plan`'s size check.
  A crossing is reported as `plan-too-many-bytes`, never a refusal.

- **Every routing replay row carries the bytes it read.** 29 rows,
  `regressions: []`, and a row whose evidence changed says so in the floor's own
  words rather than silently scoring differently.

- **CI refuses a rung file that drifts from its siblings.** A new self-verify
  check, `rung-prefix`, fails the build when a role's rung bodies stop being
  byte-identical, so the shared prefix cannot be foreclosed again by an edit
  nobody noticed.

- **The record carries prompt-cache traffic for every worker that stopped**
  (`TRC-07`). A `worker_cache` fact is written on all three of the
  `SubagentStop` hook's withholding gates and folded onto its bracket at render
  time by `corr` plus `agent_id`. A gate that refuses to close a bracket can now
  still state a fact, which is what made the figures unreachable before.

- **The run record rotates instead of dying** (`TRC-08`). At the size bound
  `.planning/trace.jsonl` rotates and the append lands, carrying the in-flight
  run's tail from the newest phase anchor so a run keeps its correlation id and
  its brackets across the cut. One generation is kept, the rotated sibling is
  gitignored, and `trace render` and `trace suggest` both name the record they
  read and report that a rotation happened.

### Fixed

- **The risk floor stops counting an import as a risk surface** (`RSK-05`).
  Import statements and literal-bound constant declarations no longer evidence a
  surface at plan time, and a file whose only evidence sat on a withheld line is
  named in `withheld` rather than dropped without a word.

- **The hook reads the stopped worker's own transcript.** It was reading
  `transcript_path`, which names the orchestrator's session and is a different
  actor's traffic entirely. It now reads `agent_transcript_path` with no
  fallback, so a payload naming no worker file supplies no evidence instead of
  the wrong one's.

- **A stop arriving after its own bracket closed stops adopting a dead run.**
  It states its figures against the bracket it belongs to rather than claiming a
  stranded dispatch from a run that ended days ago.

- **The larger cache read wins at all three folding sites**, replacing a
  first-wins rule and a last-wins rule that disagreed with each other.

### Changed

- **Six roles, one body each.** The rung sentence is gone from all 19 agent
  files (`RNG-03`), so each of the six roles carries exactly one distinct body
  across its rung files and they can share a cached prefix. The plan checker's
  rung arrives in its dispatch prompt instead. Routing is unmoved: all 18
  (level, role) cells still pinned, 160 of 160 route tests green.

- **`/cad-progress`, `/cad-report` and `/cad-suggest` state the retention rule**
  beside `capped`, and say where the dropped events went, so a reader of a
  rotated record is not left to infer it.

### Known issues

- **An abandoned rotation claim disables rotation permanently**
  ([GH-146](https://github.com/crenshawdev/cadence/issues/146)). The claim is a
  hard link released only by its own `finally`, so a kill between the link and
  the swap leaves the sibling as a second name for the live record. Every later
  writer then reads a rotation as in flight forever: appends still land and
  nothing write-deads, but the record never rotates again and each append pays
  about 266 ms. Clearing it means deleting the sibling by hand.

- **`.planning/reads.jsonl` still write-deads exactly as the trace did.** It
  refuses at its own 8 MiB bound with no rotation and shares none of this code.
  Measured 2026-08-26 on this repository: 7,293,864 bytes, 86.9% of the bound,
  where the trace was at 58.1% when this cycle opened it. It is the same defect,
  closer to firing.


## [3.7.3] - 2026-08-26

The figures this repository argues about its own cost with were wrong, and the
cycle opened to fix the instruments before spending anything on the cost. Three
of them could not be trusted. `renderTrace`'s close dedup paired a delayed
repeat close with the NEXT dispatch of the same worker key, so on a retry the
bracket carried the wrong figures and the role was billed for all three
terminals. `duration_ms` was written onto every bracket and read by nothing. No
cache figures were recorded at all.

The cycle closed at phase 1 rather than running the three phases planned after
it. Half its code commits were fixing the other half, 7 fix against 7 feat where
`v3.7.1` ran 27% and `v3.7.2` 22%, four of those seven were four passes at one
question - which in-flight dispatch an async `SubagentStop` callback belongs to
- and one real defect landed after the phase's UAT reported 8 passed and 0
failed. All three remaining phases sat on that same subsystem. Their five ids
are deferred intact with their promote conditions, and phase 2's gathered
context is recoverable from git rather than re-gathered.

One phase, four requirement ids all traced to a verified phase: `TRC-04`,
`TRC-06`, `MSR-05`, `TRC-05`. UAT 8 passed, 0 failed, 2 skipped.

### Added

- **A bracket records cache traffic** (`TRC-05`). The prompt-cache read and
  creation figures land on the bracket row and not on the roles bill, so a
  caching claim can be measured before and after a change. A close carrying no
  figures omits the keys rather than writing zeros, and `roles.tokens` is
  byte-identical whether they are present or not.

- **The worker's own wall clock has a reader** (`MSR-05`). `/cad-report` and
  `/cad-suggest` price a dispatch with `duration_ms`, printed beside the step's
  own elapsed time so the orchestrator's share is visible rather than folded in.

### Fixed

- **A delayed repeat close stops stealing the next dispatch** (`TRC-04`).
  `renderTrace`'s dedup now pairs a repeat close with the dispatch it belongs
  to. Reproduced before the fix on a six-line fixture: brackets `[1000, 9999]`
  where the second should have been 2222, and `roles.tokens` 13221 for two
  dispatches.

- **The stop close lands on the worker that actually stopped** (`TRC-06`), bound
  by `agent_id` rather than inferred from clocks, and it writes nothing at all
  for a worker whose own transcript says it has not terminated. Refusing is a
  delivered outcome and not a shortfall: the `dispatch` event is written before
  the subagent exists, so it carries no id to match against, and no ordering of
  dispatch instants separates two workers dispatched in one message.

- **A bracket spans to the later close, not the first.** Found after the phase's
  UAT passed clean, which is why the remaining phases on this subsystem were
  deferred rather than planned.

### Changed

- **Workflow prose keeps the instruction; the rationale moves out of the runtime
  path.** The four most-read workflows were carrying two jobs, telling the model
  what to do and defending each step to a reader who is not there at runtime.
  The defence now lives in `docs/rationale/`, which nothing loads:
  `plan.md` 33,848 to 28,764 B, `execute.md` 33,385 to 29,001 B, `context.md`
  20,196 to 19,378 B, `verify.md` 18,292 to 17,626 B. No step was removed and no
  gate weakened. Justification that is load-bearing on the model stayed inline,
  and `prose-agreement.test.mjs` is what decides which that is: it caught a
  sentence moved out of `execute.md`'s `state` step that had to stay.

- **The weight manifest says what it enforces.** `weight-budgets.json` has been
  a CEILING since exactness was abandoned for taxing shrinking at the same rate
  as growth, but the census marker, the registry row and the manifest comment
  all still described it as an exact byte size. The comment now also states the
  convention the ceiling cannot enforce on its own: lower the entry in the same
  commit as a deliberate cut, or the surface grows back into headroom it no
  longer needs.

## [3.7.2] - 2026-08-26

Two reference files were loaded on every run whether or not the branch they
held was the one in play. `references/seams.md` was 25,068 B and
`references/review-triggers.md` was 40,413 B, and between them they carried
nine seams and triggers of which a given command needs one. This cycle splits
both behind a router and pins every branch with a check, so a router that loses
a cold file or stops Reading one reddens instead of quietly serving a stale
index.

The other half is the trace record. A lifecycle bracket was opened by the
orchestrator and closed by the orchestrator, so a session that died between the
two halves left the dispatch open forever, and an open bracket read the same
whether the worker was still running or the session had gone. `SubagentStop`
now writes the close. The hand-written one is kept rather than replaced,
because it is the only writer that carries the figures, and whichever close
arrives second folds into the first's row.

Three phases, 40 commits off `v3.7.1`, seven requirement ids all traced to a
verified phase: `LOD-06`, `HOK-01`, `HOK-02`, `TRC-02`, `TRC-03`, `CEN-03`,
`DOC-04`. `/cad-audit` PASS on both arms, 14 of 14 acceptance criteria covered.

### Added

- **A reference router, so a run loads the branch it selected.**
  `references/seams.md` is now 2,323 B over `seam-ask-user.md`,
  `seam-spawn-agent.md` and `seam-review-provider.md`;
  `references/review-triggers.md` is 20,153 B over `risk-surface.md`,
  `review-cross-model.md` and `review-record.md`. Down from 25,068 and 40,413.
  `cadence-core/bin/lib/reference-routers.mjs` registers all seven branches and
  self-verify check `reference-routers` fails when a branch loses its cold file
  or the router stops Reading it. 42 citations across 18 surfaces were
  re-pointed at the file that holds the rule, so no prose surface cites the seam
  family where it means one seam.

- **The host closes the bracket.** A `SubagentStop` hook runs
  `cadence-core/bin/subagent-trace.mjs` and writes the lifecycle close for a
  dispatch that returned, so a bracket survives the session that opened it. The
  hand-written `trace close` is kept, not replaced: it is the only writer that
  carries the token, turn and duration figures, because the stop payload holds
  none. Two closes of one dispatch render as one bracket, deduped on
  `(corr, phase, plan)`, with no second `unpaired` row and no double coordinator
  span.

- **`--duration-ms` on `trace append` and `trace close`.** It takes the host's
  own spelling (`1m 23s`, `450ms`) or a plain millisecond count, so the figure
  is copied rather than converted, and a mistyped spelling is refused with
  nothing appended. Every bracket whose close reported one now carries
  `duration_ms`, which is the only figure for how long the WORKER ran; the `ms`
  on a bracket row is dispatch-to-close wall clock and includes the
  orchestrator's own time between the two writes.

- **self-verify pins the hook event names Cadence registers.** Check 25 reads a
  hand-maintained `HOOK_EVENTS` register, so a host that renames `SubagentStop`
  fails a check instead of going silently quiet.

- **A census over the `planning` test group.**
  `cadence-core/bin/test-groups.test.mjs` compares `GROUPS.planning` against the
  `planning-*.test.mjs` files on disk in both directions: a file no entry names
  fails, and an entry with no file fails. No stem count is written down, so a
  new planning test costs one list edit rather than two. It found its first
  drift immediately, `planning-capture-check` was on disk and running under
  `other`.

### Changed

- **The plugin's home is GitHub again.**
  `https://github.com/crenshawdev/cadence.git` is the published source and the
  install URL. This reverses the move recorded in v2.0.0, which made the
  self-hosted Forgejo remote the only published source; Forgejo is now the
  mirror. The README badge, the README and DESIGN install commands, and the
  plugin manifest's `homepage` all follow it, and the release link references
  below resolve to GitHub releases, which exist for every tag from v1.1.0-rc.1
  forward. An existing Forgejo-installed user follows it with three commands:

  ```
  /plugin uninstall cadence@cadence
  /plugin marketplace add https://github.com/crenshawdev/cadence.git
  /plugin install cadence@cadence
  ```

  Nothing about the plugin itself changes with the move.

- **The host-return dependency is stated where a reader finds it.**
  `references/seam-spawn-agent.md` now says which three figures Cadence reads
  off a subagent return, that every one of them is copied by hand out of the
  host's own rendering of `Done (N tool uses - X tokens - Ys)`, what each funds,
  and that the rendering can change in any release with no deprecation window.
  Nothing in Cadence can fix that. The mitigation already in force is that a
  return carrying no figure omits the flag rather than sending `0`, so the
  record degrades to "this run was not measured" instead of a fabricated zero
  that reads as a measurement.

- **`role` on every `unpaired[]` row**, so an open dispatch names the role it
  was opened under instead of leaving you to guess from the worker key.

- **`CADENCE-CENSUS` has a prose home.** `references/conventions.md`'s
  `## Deliberate shortcuts` describes the marker grammar, the token, the
  immediate colon, the id, the ` | ` separator and the `asserts:` clause, states
  the one rule that a marked site with no registry row fails the suite, and
  points at `cadence-core/bin/lib/census-registry.mjs` for the rest.
  `CADENCE-DEBT` already had one.

### Fixed

- **Two headers argued against the check sitting beside them.**
  `cadence-core/bin/test.mjs:11-15` said there was deliberately no coverage
  check over the test manifest, and `census-registry.test.mjs:19-21` cited that
  as settled rationale. The check exists now, so both headers describe what is
  on disk.

- **The seam-call header named a plan no reader can locate.**
  `cadence-core/bin/seam-calls.test.mjs` cited a phase 5 plan as the source of
  the 5-for-`context.md` figure it argues against. It came from v3.3.0 phase 4's
  `PLAN-2` task 6. The header names the archive path now, so the claim is
  checkable rather than taken on trust.

- **The router's own Read check had a hole in it.**
  `lib/reference-routers.mjs` tested the raw router text where the neighbouring
  arm read prose only, so a cold path appearing solely inside a fenced example
  satisfied the check. This cycle's own blocking `risk_surface` gate found it,
  and the narrowed re-arm round came back clean (`caa07bfb`).

### Known gaps

- Nine literal `trace close` command lines under `cadence-core/workflows/` and
  `cadence-core/references/` still spell `--tokens ... --turns ...` with no
  `--duration-ms`, so an orchestrator copying one verbatim records no wall clock
  for that role. Deliberately out of scope this cycle.

## [3.7.1] - 2026-08-25

`.planning/CAPTURE.md` was a queue nothing drained. Measured at the open: 276
walked bullets across 584 lines and 251,968 bytes, read by `/cad-plan` on every
planning pass, most of it long settled. It had been swept by hand once already,
185 open items archived as a single block on 2026-08-08 after accumulating
across nine milestones, and it regrew to 276 in sixteen days. The cause was the
item grammar. It had two states, `- [ ]` and `- [x]`, and `[x]` meant done, so a
decision NOT to do something had no representation and stayed indistinguishable
from live work. Rejections got written into the bullets instead, so adjudicating
an item made it longer rather than making it go away.

This cycle makes the repository's own issue tracker the record. A gate that
declines to fix a finding asks once, in the step that made the decision, and
files the result on the tracker at that moment. CAPTURE holds the phase in
flight and nothing else, and phase close now ASSERTS it is empty rather than
performing a roll-out. Three more phases rode along: the census registry and the
plan-time lease check that were costing half of all executor checkpoints, the
`planning.mjs` split, and the phase-directory spelling fix.

Six phases, 135 commits off `v3.7.0`, ten requirement ids all traced to a
verified phase: `FRG-01`, `FRG-02`, `CEN-01`, `CEN-02`, `CAP-01`, `CAP-02`,
`CAP-03`, `SPL-01`, `SPL-02`, `LOD-02`. `/cad-audit` PASS on both arms, 33 of 33
acceptance criteria covered across five phases.

### Added

- **A finding this run will not fix goes to the tracker, not to a file.** When a
  gate produces findings it declines to act on, the blocking arm's
  below-blocker remainder, the adjudicated arm's non-survivors, any
  `recorded not fixed` disposition, you are asked ONCE for that fire with the
  whole set listed, and nothing is written to CAPTURE either way. Accepted
  findings become issues immediately. A declined one is filed too, carrying the
  `cadence-declined` label, because that labelled issue is the only thing that
  stops a later fire asking about the same finding again. The set that reaches
  the ask is read off the structured adjudication payload rather than re-parsed
  out of review prose. `cadence-core/bin/issue-filing.mjs` over the pure
  `lib/filing-decision.mjs`, with one pinned create and lookup argv per forge
  (`CAP-01`, `CAP-02`).
- **`.planning/FILED.md` keeps a filed finding reachable by recall.** An issue
  number on a tracker is not searchable from inside the planning corpus, so each
  filed finding leaves a row that `recall` walks last, ranked below live
  material rather than absent from it (`CAP-02`).
- **Phase close asserts the queue is empty.** `phase-done` now returns a
  `capture` field counting SUBSTANTIVE bullets across `Todos`, `Seeds` and
  `Notes`, and names each survivor with its section, line and text. It does not
  count the `- None.` placeholder, so a freshly created queue reads as empty
  rather than as three items. `/cad-health` prints the same verdict, both faces
  reading one command (`planning.mjs capture-check`), and
  `planning.max_capture_bullets` (default 40) is a bound that reports loudly and
  refuses nothing (`CAP-03`).
- **An item is resolved by REMOVAL, never by annotation.** The rule is stated in
  the triage reference and enforced by a check that fails when a walked bullet
  carries a re-verification annotation. Self-verify check 23
  (`capture-writers`) is the other half: it names every code path permitted to
  write the file, so a future workflow cannot quietly start routing durable
  records back into it (`CAP-03`).
- **Cadence resolves a forge when it sets a project up.** `/cad-new-project` and
  `/cad-adopt` both detect which forge CLIs are installed, `tea`, `gh`, `glab`,
  through the existing `lib/on-path.mjs`, ask which provider to use and what the
  repository is called, and persist the answer in `git.forge_provider`,
  `git.forge_repo` and `git.forge_host`. An already-configured repository is not
  re-asked. Where `origin` resolves, it supplies the default and you confirm
  rather than retype, and it guesses a provider only for hostnames the existing
  classifier recognizes. Repository creation runs through the selected CLI
  behind an explicit confirmation naming the provider, the owner and the name,
  private on all three arms. No provider detected, or none selected, refuses
  with a reason naming what was looked for and a hint naming the install. No
  third-party stdout or stderr reaches the envelope (`FRG-01`, `FRG-02`).
- **Every hand-maintained census in the repository is registered.** A census is
  a count a human wrote down that the code must keep true, and nothing knew they
  existed as a class, which is why a plan could omit one without noticing.
  `lib/census-registry.mjs` carries twelve deeply frozen rows naming the file
  holding each count, what it counts, the site that asserts it and its narrow
  subject paths. A site carrying the `CADENCE-CENSUS` marker with no registry
  row reddens the suite naming the file and the assertion, proved by a fixture
  pair differing only in the id, so the registry cannot silently fall behind the
  tree (`CEN-01`).
- **A plan that will invalidate a census is refused BEFORE an executor starts.**
  `lease-check --plan-time` reads a PLAN's `files:` lease against the registry
  and names every registered census file the declared work would invalidate but
  the lease does not declare. It reads the lease and the registry only. It
  spawns no `git` and executes nothing from the plan. `/cad-plan` fires it after
  PLAN.md is written and before any dispatch, so the fix is to amend the lease
  rather than to discover the problem 150,000 tokens into a halted execution.
  This was the single largest source of wasted executor spend on this project:
  20 of 39 checkpoints in one phase (51%), 7 of 15 on a second repository (47%),
  worth 14.8% and 17.4% of executor tokens respectively. Replayed against the
  lease that halted at 0 of 8 tasks, the arm names both missing files before any
  execution (`CEN-02`).
- **A census refusal is distinguishable from ordinary lease noise.** The
  commit-time arm now returns `undeclared-census-files`, carrying the
  `census_files` list and its own trace event, beside the byte-identical
  `undeclared-files`, so a plan-time arm that stopped firing surfaces as its own
  signal (`CEN-02`).

### Changed

- **`planning.mjs` is 30 per-command modules behind a 360-line entry file.** The
  32 `cmd*` handlers moved to `cadence-core/bin/planning/`, leaving dispatch and
  the `COMMANDS` table, with 28 shared symbols in `planning/core.mjs`. A
  dispatch touching one command stops paying a whole-file read. The test file
  split the same way into 21 per-command stems, all named in the runner's
  `GROUPS.planning`, and a new `citation-census.test.mjs` fails by name when one
  of the seven pinned citations goes stale rather than pointing at moved code
  (`LOD-02`).
- **One spelling per phase, enforced at every face that resolves `--phase`.**
  `PHASE_DIR_NAME` tightened to `/^[1-9]\d*(?:\.[1-9]\d*)?$/` and moved to one
  home, so `1.00`, `1.01` and `2.0` are drift while `1.1`, `1.10` and `8` stay
  legal. `phaseSpellingCollision` is wired into `fireIdentity` ahead of the
  token rails, which reaches all 21 census-pinned callsites instead of each one
  wiring the check by hand, and `phase-spelling.test.mjs` registers those
  callsites as a census so an unguarded path-resolving callsite fails the suite
  naming itself (`SPL-01`).
- **Two legal names that parse to one number are reported rather than
  resolved.** `phase-dir-collision` is its own drift kind in `planning/status.mjs`:
  picking a winner silently is what makes the second directory invisible
  (`SPL-02`).
- **`## Archive` left the capture contract.** Moving settled items to a heading
  in the same file keeps the recall walk clean and changes nothing about the
  bytes, which this repository's own 185 archived bullets had already proved.
  The phase close also stops filing open items into the transient queue.

### Fixed

- **`lease-check --plan-time` failed OPEN on a lease it could not read.** An
  empty or unparsed declared set produced an empty at-risk list, which was
  indistinguishable from a lease that genuinely puts nothing at risk, so the
  gate passed exactly the case it was built to catch. The commit-time arm on the
  same file failed CLOSED on the same signal. Two fail-closed arms now sit above
  `censusesAtRisk`, `unparsed-lease` and `empty-lease`, each carrying its own
  hint. Two signals rather than one because a misspelled key such as `filez:` is
  a structurally valid key line producing zero `frontmatter_issues`. A lease
  declaring one real path still passes, so this is fail-closed and not a blanket
  refusal.
- **The census registry left out the one file that had already stopped a
  phase.** `seam-calls.test.mjs` was excluded as "derived, never baselined",
  which is true of its header arithmetic and false of its assertion. Its
  `seam-call-counts` row and marker are in, and the pre-correction worked
  example is out of the registry header so it cannot be read as guidance.

## [3.7.0] - 2026-08-24

Cadence stated its failures in its own vocabulary and never stated the remedy.
A seam that refused handed you a kebab-case token, so the token WAS the error
message. At the open this was measured across `cadence-core/bin/` with tests
excluded: 186 sites set a literal `reason` and 13 set a literal `hint`, and all
13 of those lived in two files. The ratio had also been getting worse rather
than better, 130 against 10 when the issue was filed, which is why this cycle
ships a check and not only a sweep.

Two phases, 34 commits off `v3.6.1`, three requirement ids seeded at the open
and all three traced to a verified phase: `HNT-01`, `HNT-02` and `SCP-01`.
`/cad-audit` PASS on both arms, 13 of 13 acceptance criteria covered.

### Added

- **A hintless refusal is now a build failure.** `self-verify.mjs` check 22
  (`refusal-hints`) walks every refusal site under `cadence-core/bin/` and
  reports any in-scope one carrying no `hint`, naming the file and the reason
  token. The rule and its exclusion register live in
  `cadence-core/bin/lib/refusal-hints.mjs`, and the register is a PARAMETER
  rather than a constant, so a test hands the check a substitute register and
  the reported set changes with it. A sweep fixes a count once; this is what
  stops the 187th refusal shipping without a next step (`HNT-02`).
- **A repo-scoped config key refuses at the layer that cannot honour it.**
  `config.mjs set git.auto_close=true --global` now returns `ok:false` at WRITE
  time, naming the key's scope and telling you to use `--file <repo config>`
  instead. Previously it applied silently and the repository, which never opted
  in, only complained when the close refused at land time. The rule reads a new
  `repo_only` schema marker rather than a list of key names, proved by a test
  that substitutes a schema fixture marking a different key and shows it refused
  with no line of the rule changed. It resolves the layer from the target FILE
  rather than the flag, so `--file $CADENCE_GLOBAL_CONFIG` and the same path
  spelled with `/./` refuse identically, and it runs inside `checkPairs` ahead
  of every read and write, so a multi-pair set carrying one marked key leaves
  the target byte-identical (`SCP-01`).
- **`config.mjs check --global`** reports the same per-pair scope error the
  write face refuses on, so the inspect face can answer what `set` will do
  before you run it (`SCP-01`).

### Fixed

- **Every in-scope refusal names its next step.** 243 in-scope refusal sites
  under `cadence-core/bin/` now carry a plain-language hint, down from 215
  hintless when check 22 first went in. `planning.mjs` alone accounts for 154 of
  them, the largest user-facing refusal surface in the plugin. The `fail`
  wrappers in `config.mjs`, `route.mjs` and `review-provider.mjs` widened from
  `(reason, detail)` to `(reason, detail, hint)` to carry them. No reason token
  string changed: they are matched by tests and by callers, and renaming one is
  a breaking change dressed as a wording fix (`HNT-01`).

### Known

- **The new scope check is not bound to the file it clears.** `config.mjs`
  resolves the layer identity from a pathname, then re-resolves that same
  pathname for the read and again for the atomic write, so a directory or
  symlink swap landing in that window writes through a path the check already
  cleared. This is not a regression, since before this release `set` applied the
  pair with no layer check at all, but it does mean the refusal is defeatable by
  a local attacker who can win the race. It was raised by the blocking
  risk-surface gate, confirmed against the code by the phase verifier, and
  accepted deliberately rather than missed. Binding the check to an opened
  descriptor through a temp-and-rename write is its own piece of work.

## [3.6.1] - 2026-08-23

`v3.6.0` shipped `/cad-why` and then wrote down three things wrong with it. This
patch cycle closes those three and nothing else: no new command, no new surface.
All three were measured before the fix and re-measured after, which is the only
reason the third one changed the number it was supposed to defend.

One phase, 19 commits off `v3.6.0`, three requirement ids seeded at the open and
all three traced to a verified phase: `WHY-02`, `WHY-03` and `WHY-04`.
`/cad-audit` PASS on both arms, 6 of 6 acceptance criteria covered.

### Fixed

- **The chain says what its own history simplification dropped.** The bare-path
  arm inherits git's default simplification, so `/cad-why` was returning 7 of the
  10 commits `--full-history` reports for `lib/release-decision.mjs` and saying
  nothing about the other three. It now measures the excluded set and states it
  in the rendered text: the count, how many are merges, the shas, and the
  `git log --full-history` invocation that shows them. A path with nothing
  excluded renders no block at all, so the statement is about a real gap rather
  than a line every chain carries. `--follow` and `--full-history` do not
  compose, so the simplification is kept and named instead of dropped
  (`cadence-core/bin/lib/why-corpus.mjs`, `lib/why-render.mjs`, `WHY-02`).
- **The entry cap carries a claim measurement supports.** `DEFAULT_TOP` was 10
  with a comment asserting ten entries stayed under the 10,000-byte line in
  `references/conventions.md`. Measured, it did not: `planning.mjs` rendered
  15,637 B. The cap is now 6, re-measured after the exclusion block landed rather
  than inherited from the plan, and `why-render.test.mjs` reads a parseable
  `// MEASURED CAP:` line out of the module source and asserts it equals
  `DEFAULT_TOP`, so the number and its stated reason cannot drift apart again
  without a red test (`lib/why-render.mjs`, `WHY-03`).
- **`closeOver` orders by instant, not by string.** It compared `%cI` timestamps
  as strings, and ISO-8601 values under different UTC offsets do not string-sort
  chronologically, so a mixed-offset pair straddling a prune could attach to the
  wrong close. It now parses both sides and guards an unparseable date by
  returning null rather than throwing. The pinning test was proved to fail
  against the string-compare implementation (`lib/why-corpus.mjs`, `WHY-04`).

### Changed

- **The cap's header no longer claims to bound bytes.** It opened with "the
  response is bounded by truncating the entry count" and supported that with a
  three-path table. The phase's own verify pass swept every tracked path: 63 of
  548 render at or over the 10,000-byte line at the shipped cap, worst 30,825 B.
  The cap bounds entry COUNT; per-entry join bytes are unbounded, and no cap that
  still shows useful history changes that. The header says so, names the measured
  range instead of three samples, and points at relocating the bytes the way
  `lib/bulk-output.mjs` does as the fix that would actually bound it
  (`lib/why-render.mjs`).
- **The `WHY-02` account is corrected at all three sites it was stated.**
  `ROADMAP.md` and `PROJECT.md` recorded the three missing commits as
  `_archive-v2.2.0/3` phase commits collapsed into merge `0bf62847`. Measured
  three times independently, that is false in both halves: `0bf62847` is
  single-parent and is already one of the reachable 7, and the three
  `--full-history` adds are the merges `b86fc25c`, `051f0df1` and `9237a539`.
  The five `_archive-v2.2.0/3` commits are not ancestors of `HEAD`, so no
  `git log` flag reaches them.

## [3.6.0] - 2026-08-23

The Core Value at the top of `PROJECT.md` claims that what Cadence writes down
comes back on its own at the moment it matters, and until this cycle that was
the one claim in this project with no evidence behind it. Everything the gates
write was written by a gate and read by nobody. Recall shipped as a BM25
subcommand injected into `cad-context`, `cad-planner` and `cad-debug`, and
nothing anywhere checked that it landed (#190). The `.planning/` corpus could
already answer "why is this code like this" and there was no command that walked
the join (#192). And the path most real work actually takes left the corpus a
hole exactly where the work went: `/cad-task` produced commits recall could not
find, ran no risk check on its committed range, and opened no trace bracket, so
per-role accounting missed the path most runs use (#191).

Three phases, 66 commits off `v3.5.9`, five requirement ids seeded at the open
and all five traced to a verified phase: `WHY-01`, `RBK-01`, `FST-01`, `FST-02`
and `FST-03`. `/cad-audit` PASS on both arms, 21 of 21 acceptance criteria
covered.

### Added

- **`/cad-why <path>[:<line>]` walks the record join.** It takes a path, or a
  path narrowed to a line, and joins the commits that touched it to six record
  edges: the phase, the plan task, the numbered decision, the deviation, the
  surviving review finding and the declaring task. It reads four tiers, the live
  `phases/<N>/` directories, the `_archive-v<ver>/` directories, task records,
  and milestones already pruned out of the live tree and recovered from git
  history, and where no tier answers it names the gap in words rather than
  returning an empty chain (`cadence-core/bin/why.mjs`, WHY-01).
- **`planning.mjs cite-count` measures whether recall was read.** Per item it
  counts what the recall pass surfaced against what the produced plan actually
  cites. `/cad-plan` runs it at both of its points, `count_planned` and
  `count_committed`, including the under-threshold inline arm, and the `done`
  report carries a `Citations:` line that names a plan citing none of a
  non-empty surfaced set. It reports and does nothing about it, by design
  (RBK-01).
- **The three readings a bare count cannot separate are distinct on the
  record.** Backend off, surfaced nothing, and cited nothing were one number
  before; `cite-count` now tells them apart on the envelope and in its own
  `outcome`-family `cite_count` trace event, which carries `{written, reason}`
  (RBK-01).
- **`/cad-task` leaves a record.** The fast path now writes
  `.planning/tasks/<slug>/RECORD.md` through a `task-record` seam that derives
  every figure from the committed range. The recall corpus reads it as a tier,
  `/cad-why` merges it as a commit tier and renders a resolved task as a task
  rather than as a phase, and the run brackets itself under a per-run phase-0
  correlation anchor so `cad-task` finally appears in per-role accounting
  (FST-01, FST-02, FST-03).

### Fixed

- **A symlinked planning artifact could put bytes from outside the tree onto a
  seam's stdout.** `readArtifact` in `lib/why-corpus.mjs` followed a joined
  name's own symlink, which put the escape that `phaseDirsIn` guards per
  directory back one level down: a `SUMMARY.md` symlinked out of the tree passed
  `isFile()` and was read. The resolved path must now stay inside the resolved
  directory it was joined onto, which closes the check-to-use race on the same
  line (`b5f49bad`).
- **The task-record writer is now contained the way the reader is.** The reader
  checked containment and the writer did not, so the two disagreed about what
  counted as inside `.planning/tasks/` (`71234385`).
- **An echoed `mktemp` scratch directory was pasted into later shell commands as
  a literal.** Injectable through `$TMPDIR`, at three prose sites, two of which
  predate this cycle. Raised `high` by the phase-2 `risk_surface` gate, ruled
  survived rather than downgraded, and fixed across all three
  (`cadence-core/workflows/plan.md`,
  `cadence-core/references/review-triggers.md`,
  `cadence-core/references/triage-gate.md`, `054fa9a0`).

### Known gaps

- **`/cad-why`'s bare-path arm inherits git's default history simplification.**
  Measured on `lib/release-decision.mjs`: 7 commits reachable against 10 with
  `--full-history`, the three missing being `_archive-v2.2.0/3` phase commits
  collapsed into a merge. The join is correct, the history it reaches is short.
  The prune search already passes `--full-history`, which is why it recovers 25
  closes instead of 4.
- **The renderer's entry cap of 10 has a stated reason that is measured false.**
  It claims ten entries stays under the 10,000-byte line in
  `references/conventions.md`; with all edges filled, `planning.mjs` renders
  15,637 B. The measurement is in the comment. The number was not lowered
  because the test that pins it sat outside the touching plans' leases.
- **`closeOver` compares `%cI` timestamps as strings**, and ISO-8601 values
  under different UTC offsets do not string-sort chronologically, so an
  unresolved commit can attach to the wrong close. Ruled low on reachability: it
  needs mixed-offset commits, a `--mode delete` close, and a pair straddling a
  prune.

## [3.5.9] - 2026-08-23

Ten defects sat in `.planning/CAPTURE.md` between 2026-08-05 and 2026-08-08 and
nobody read them. The archive triage on 2026-08-22 reproduced every one against
the current tree and filed them as #231 and #232, and the theme turned out to be
one sentence: the release seam and the frontmatter reader both return a clean
answer over a case they did not actually handle. Two phases, 38 commits off
`v3.5.8`, five requirement ids seeded at the open and all five traced to a
verified phase: `REL-01`, `REL-02`, `REL-03`, `FRM-01` and `FRM-02`.
`/cad-audit` PASS on both arms, fourteen of fourteen acceptance criteria
covered.

Six of the ten were in the release/changelog seam, the seam `v3.5.8` rewrote.
Item 6 of #231 and the open item `v3.5.8`'s own phase 2 filed against
`release-decision.mjs` were the same defect class in the same subsystem, filed
two weeks apart, neither aware of the other. That is the argument for reading
the capture queue, and it is why this cycle led with it.

### Fixed

- **A `## ` inside a fenced code block no longer ends a changelog section.**
  `sectionEnd`, all four `prependChangelogEntry` anchors, `promoteUnreleased`'s
  locators and `releaseSectionEmpty` now scan headings fence-aware, so a
  release section whose body quotes markdown keeps its real bounds
  (`cadence-core/bin/lib/release-decision.mjs`, REL-01).
- **A heading-only release section reports empty.** `releaseSectionEmpty` was
  counting a bare `### Added` as content, so a scaffolded section with no
  bullets under it passed the close's own emptiness halt. A prose-only body is
  still not empty, which is the distinction that check exists to make
  (REL-01).
- **The trailing link-reference block is bounded by what its keys name.** A key
  that names no `## [key]` heading is not part of the block, rather than the
  block running to whatever the previous heuristic happened to stop on
  (REL-01).
- **A primary manifest carrying no `version` field halts the close.**
  `release-bump.mjs` returned a benign `skip` over it, so a close continued and
  shipped a manifest still at the previous number. It now returns `ok:false`,
  `action:"refuse"`, `reason:"no-version-field"` at exit 1 (REL-02).
- **An unparseable `--version` refuses by naming the raw argument.** Passing
  `--version v` reported `no-target-version` over an empty target, which reads
  as "you forgot the flag" when the flag was right there. It now reports
  `reason:"unparseable-version"` with `target:"v"` (REL-03).
- **Value-level frontmatter issues stop leaking across keys.**
  `readFrontmatterList` returned the whole document's issues array whatever key
  the caller asked for, so a backtick in `goal:` surfaced on a `files:` read and
  the risk floor bailed on a plan's entire declared file list over a defect in a
  scalar nothing reads as a list. The four value-level codes are now scoped to
  `requirements:` and `files:`, the two keys the seams read as lists. The five
  structural codes still cross keys on purpose: a `requirements:` block
  truncated by a stray line has to reach a `files:` read too, or `plan-overlap`
  clears a half-parsed plan as proved independence
  (`cadence-core/bin/lib/planning-files.mjs`, FRM-01).
- **A markdown-decorated path in a plan's `files:` list no longer parses
  clean.** `plan-overlap` compares exact strings, so `**src/shared.rs**` in one
  plan did not match `src/shared.rs` in another and two plans that genuinely
  collide were cleared into separate parallel worktrees on the same file. This
  is the failure that decides whether parallel dispatch is safe, and the safety
  check for this cycle's own parallelism was the thing under repair (FRM-02).
- **`item-without-key` fires on the early-continue path.** Scoping the
  value-level codes exposed a line that then reported nothing at all: a block
  item under no open key returned early on a `scanValue` failure, before the
  no-block-key diagnosis, so `goal: something` followed by `- "unbalanced` went
  fully silent. A frontmatter line that reports nothing is the one outcome that
  gate exists to prevent.
- **The live-corpus prune test no longer depends on how a bullet was typed.**
  Pre-existing, found blocking a phase's own acceptance criterion rather than by
  the suite (`cadence-core/bin/milestone-prune.test.mjs`).

### Added

- **`markdown-decorated-path`, a new grammar code.** Raised in `parsePlanFiles`'
  frontmatter loop for a matched wrap on `*`, `_`, `<>` or a bare `[]`, the link
  form `[path](path)`, and a matched interior backtick pair. It reports and
  never repairs: the declaration comes back in `files` with its bytes untouched,
  so `overlaps` keeps meaning "these two declarations intersect" and never
  "intersect after repair". A non-empty `frontmatter_issues` is what routes the
  phase sequential, which is the refusal to trust the comparison rather than a
  corrected comparison.

  A wrap is matched or it is nothing, because `_`, `[` and `*` are legal path
  bytes: `_private/a.rs`, `src/a_`, `src/__init__.py` and `[src/a.rs` stay
  diagnostic-free. All 597 frontmatter `files:` entries under `.planning` were
  measured before the rule widened and none opens or closes on any wrap byte.
- **`changelog.state` on every emitting envelope.** `not-examined`, `absent`,
  `unreadable` or `ok`, so an absent `CHANGELOG.md` is named rather than read as
  a clean run. `workflows/milestone.md` step 2 halts on it beside
  `section_empty: true` (REL-02).
- **`decideManifestBump`'s JSDoc names all nine codes the seam owns**, pinned by
  a test that derives the verdict-code set from executable source and reddens
  when a code misses either document (REL-01).
- **A code-set guard for the frontmatter grammar.** A grammar code literal added
  to `planning-files.mjs` without its row in
  `references/plan-frontmatter.md`'s code table reddens
  `prose-agreement.test.mjs`, derived from the source rather than from a
  prose-to-prose comparison that passes when both lists are stale together.

### Known gaps

- `plan-overlap` still reports `overlaps: []` for two plans declaring the same
  file when one declaration is decorated. The strings genuinely compare unequal,
  and `frontmatter_issues` is what routes the phase sequential. Worth revisiting
  if a caller ever wants the intersection itself rather than a refusal to trust
  it.
- The residual over-fire on the decoration rule is a path that legitimately
  opens and closes on the same emphasis byte, `__main__`. It reports and is
  still returned byte-exact. A phantom diagnostic costs a sequential dispatch;
  a missed shape costs two plans writing one file.
- `.planning/DOCS-CLAIMS.md` rows `MILESTONE-04` and `MILESTONE-05` cite stale
  line ranges against `milestone.md`. Pre-existing, and no mechanical check
  enforces those ranges.

## [3.5.8] - 2026-08-22

Four operations in this codebase wrote several files and reported the result as
if they had written one. An atomic rename protects a single file from torn bytes
and cannot make a transaction across two, so each of them could leave a
half-applied tree inside an `ok:true` envelope with nothing saying so. Two phases,
33 commits off `v3.5.7`, three requirement ids seeded at the open and all three
traced to a verified phase: `JRN-01`, `JRN-02` and `JRN-03`. `/cad-audit` PASS on
both arms, thirteen of thirteen acceptance criteria covered.

The shape of the fix was decided on evidence rather than on the issue text.
`renumber` and `milestone-prune` already refused whole and reported what had
completed, by hand, because someone remembered to. That is a refusal protocol,
not a journal: it needs no on-disk state, no resume path and no reader in
`/cad-health`. Generalizing the two implementations that already worked was the
work, and the two operations that claimed atomicity without having it were moved
onto the result.

### Added

- **`cadence-core/bin/lib/file-transition.mjs`, one home for an ordered
  multi-file write.** `runTransition({steps, discipline, preflight})` returns
  `{ok, refused, completed, failures}` and owns the idiom four call sites were
  each spelling for themselves. Two disciplines, both drawn from behaviour that
  already shipped: `stop-at-first-failure` for `renumber` and
  `continue-past-failure` for `milestone-prune`. A lazy pre-flight stage returns
  on its first unsatisfied condition before any thunk runs, so a refusal writes
  nothing.

  A ninth `HELPERS` census row reddens if the module's body is copied under any
  name, which is what makes "one, not four" mechanical instead of asserted. The
  probe run confirming it exits 1 naming both copies.

- **`phase-done`'s success envelope names which documents it wrote.** A `wrote`
  field beside the unchanged `roadmap.{line,now}` and `reqs[]`, so a caller can
  tell a two-document flip from the roadmap-only write that an absent
  REQUIREMENTS.md still produces.

- **Three refusal codes with their own identities**, where the failure used to
  arrive as an undifferentiated `internal`: `unreadable-sibling-manifest`,
  `unreadable-changelog` and `unreadable-requirements`, plus `partial-bump` and
  `partial-flip` for a write that fails past the pre-flight and needs to report
  what landed.

### Changed

- **`cmdPhaseDone` is one ordered transition, and its comment is gone rather than
  qualified.** It carried "Both edits validated before either write -
  all-or-nothing" directly above two separate renames of ROADMAP.md and
  REQUIREMENTS.md. Every edit is now validated before the first write, and
  REQUIREMENTS.md is read as a three-state fact: absent keeps the roadmap-only
  `ok:true` write, present-but-unreadable refuses before ROADMAP.md is touched.
  `grep -c "all-or-nothing"` inside the function prints `0`.

- **`release-bump` reads and decides its whole write set before the first write.**
  It used to write the primary manifest before the sibling had been read or
  validated, so a malformed sibling shipped a partially bumped release tree under
  a success envelope. The first `atomicWrite(` now sits at line 361 against the
  last `readManifest(` at 280 and the changelog read at 329, which makes the
  ordering structural rather than conventional. The existing `siblings[]` refusal
  arm still works for a sibling that is readable but not upgradeable, so two
  different outcomes are not collapsed into one refusal.

- **`renumber` and `milestone-prune` run their partial-state refusals through the
  primitive** instead of each keeping its own try/catch loop. Neither observable
  envelope moved: `partial-apply` and `partial-prune` keep their reason strings,
  their `completed`/`failed` lists and their hint text, pinned by tests that
  redden on a paraphrase.

### Fixed

- **A non-regular `CHANGELOG.md` refuses instead of hanging or scaffolding over
  history.** `readChangelog` promised a readable regular file and checked only
  that reading did not throw. A FIFO there would block the CLI forever, and
  `/dev/null` would read as an empty changelog and scaffold a release heading over
  the file's entire history. Now a `statSync().isFile()` check routes both to
  `unreadable-changelog`, with a symlink-to-`/dev/null` regression test. Raised by
  the blocking `risk_surface` review on the phase-2 range and fixed before the
  phase closed.

### Known gaps

- The `partial-flip` and `partial-bump` arms ship probe-proven only, with no
  committed regression test. Every uid-independent way to force a write to fail
  past the pre-flight was converted into a pre-write refusal by the work above,
  and the phase's own decisions forbid `chmodSync`. Both executors recorded the
  exact envelopes they observed; treat those two arms as untested in CI rather
  than as verified behaviour.

- `planning.mjs`'s `read(reqFile)` still accepts any existing filesystem object,
  so a FIFO at `.planning/REQUIREMENTS.md` hangs `phase-done` before its refusal
  can run. Same class as the `CHANGELOG.md` blocker above, one seam over, raised
  medium and downgraded at adjudication.

## [3.5.7] - 2026-08-22

Cadence has been measuring its own cost for several releases and then handing you
nothing to spend the measurement with. That is the whole theme here. Four phases,
83 commits off `v3.5.6`, four requirement ids seeded at the open and all four
traced to a verified phase: `RDX-01`, `CER-01`, `IVW-01` and `HLT-01`. A fifth,
`BCH-01`, was killed by its own spike before a line of it was written.

Two spikes ran before any phase was planned, which is why this cycle is one phase
shorter than it was scoped to be.

### Added

- **`stakes` is now the minimum a project accepts, not the level every phase
  pays.** `route.mjs resolve` reads the phase's own declared `files:` at plan
  time, scans them against the surfaces the project answered, and raises from the
  configured floor: per plan for an executor, per phase for everyone else. A
  phase touching nothing on an answered surface routes BELOW the old project
  default. Every move is stated in `reason` (the phase, the surface, the file
  that evidenced it) and every unreadable input lands in `warnings`.

  `node cadence-core/bin/route.mjs replay` shows what it does to this repository's
  own history: 30 phases, 27 of them raise back to `shipped` on real evidence, 2
  take the discount to `solo`, and 1 has its discount withheld because a declared
  path was not a readable file. It fails closed, so one unreadable plan holds the
  whole scope at the configured level rather than quietly discounting it.

  `review.triggers.risk_surface.waive_routing_floor` is the one way to route below
  the computed floor. It waives the LEVEL for the surfaces you name in it and
  never the blocking review, and every waiver applied is named in `reason`.

- **A fifth gate mode, `deferred`, one ladder position between `advisory` and
  `blocking`.** It runs its reviewer, stores what it found VERBATIM as a
  committed `DEFERRED-*.json`, and lets the phase finish. Blocking used to block
  the RUN, which is the thing that stops Cadence working while nobody is watching.
  Now the guarantee moves to the land: `/cad-land` refuses on BOTH publish arms
  while any queue member is unadjudicated, at the top of step 3, ahead of both
  arms and independent of `git.auto_close`.

  `planning.mjs deferred record` writes the queue and `deferred list` reads it as
  one derivation over two homes, so a queue carried out of a pruned phase is still
  one list. An unreadable directory is reported rather than counted as empty. The
  count rides the `planning.mjs status` envelope always, so a caller can tell
  "nothing deferred" from "this seam does not know about deferrals". `deferred
  carry` moves the queue out of `.planning/phases/<N>/` before `/cad-milestone`
  prunes the directory, and it stays adjudicable and re-armable from its carried
  home.

- **`/cad-config --surfaces`, a way back to the one question Cadence asks on its
  own.** The risk-surface interview had exactly one entry point, at first fire,
  and no way to reach it again after the repository changed shape. It now opens on
  demand against a fresh scan and shows the answered set beside what the scan
  evidences today, writing only on an explicit pick.

- **`trace suggest` reads `.planning/reads.jsonl`.** It never opened the reads
  record at all, so the one seam that turns the record into a retune could not see
  the read redundancy the record was measuring. A role over its floor now produces
  an entry naming the worst single file inside one dispatch, in the form "read
  `<path>` N times". On this repository that is `cad-executor` at 3.64 opens per
  distinct file inside one dispatch, worst case `cadence-core/bin/planning.mjs`
  read 29 times inside one bracket.

  The floors are per role and the MAP is the gate, not the number:
  `IN_DISPATCH_FLOORS` names `cad-executor` at 3.00 and `cad-verifier` at 2.00,
  and a role the map does not name stays silent at any ratio. `cad-planner` at
  1.88, `cad-assumptions-analyzer` at 1.78 and `cad-reviewer` at 1.74 sit in a
  band where a suggestion would be noise, and a single global ratio would have
  fired on all five to save nothing.

  The entry states what it does not cover, in its own evidence string rather than
  only in workflow prose: the file-carrying share of the joined reads it was
  computed over, the fact that nothing prunes `reads.jsonl` at a milestone close
  so an unscoped run spans every milestone in the file, and the count of
  `coordinator` reads it excluded because the main thread has no dispatch bracket
  by construction and its re-reading cannot be attributed to one.

  It names NO config key, and a test fails if it ever points at one. No key in
  `config.schema.json` expresses the remedy, so the entry says so and names the
  discipline instead: symbol or line anchors on a plan's `files:` entries, and
  targeted reads over whole-file ones.

- **`route.mjs replay`** reports what the computed floor does to every phase this
  project has ever run, live and archived, off `levelFor`, the single
  scope-to-level implementation `resolve` shares. `.planning/phases/3/MEASUREMENT.md`
  carries the run, the before/after distribution, the token baseline and a
  falsifiable prediction.

### Changed

- **The risk-surface interview's options come out of `lib/surface-scan.mjs`
  now, not out of model-composed prose.** `interviewOptions()` builds the ordered
  choices and the ask RENDERS them. On the demo tree from #206 the old menu put
  all eight categories in two slots and offered the same set twice; the two
  recommendation arms are collapsed into one and it renders two distinct sets.
  Pinned by two `prose-agreement.test.mjs` arms, both falsified live in both
  directions.

- **A declared DOCUMENT contributes its path and not its prose to the risk
  scan.** Documentation that merely MENTIONS a construct stopped raising the
  phase that declared it. Plan-time reasons read `body line:` where no diff
  exists; `scanDiff` keeps `changed line:`.

- **`/cad-report` and `trace suggest` read the same fold.** The per-role
  in-dispatch figure lives on the `reads --join` envelope as `inDispatch` and
  neither prose surface recomputes it.

### Fixed

- **A scope that declared NO files is no longer discounted.** "Nothing was
  declared" and "nothing touches a surface" were the same sentence and are now
  two, so an empty scope cannot buy a level discount it never evidenced.

- **A malformed `--phase` is refused, not answered about another phase.** It used
  to fall back to the cursor's phase, which means the answer was about a phase you
  did not ask about.

- **Declared bodies and the phase locator stay inside the repository.** Both are
  contained by `realpathSync`, and a PLAN file is bounded before it is opened.

- **`deferred carry` checks the parent it creates, not only the leaf**, and a
  carried queue member stays adjudicable and re-armable from its new home.

- **The evidenced choice states its evidence when nothing was answered.**

### Deferred

- **`BCH-01` (#174) left this cycle on an invalidating spike**, before the
  fidelity question it was really about was ever tested. Batching N security
  reviews into one process saves **1.91%** of reviewer spend: a 1,676-token fixed
  prefix against six observed dispatches totalling 438,080 tokens. It does not
  flip at the 61 invocations the issue cites, because both sides of the ratio
  scale with N, and 61 gets you 2.09%. The bill is PAYLOAD, and those six
  dispatches span 25,753 to 125,100 tokens, a 4.9x spread around a fixed cost of
  1,676. Two limits are recorded rather than assumed: the 61 figure is not
  reproducible from `trace.jsonl`, and the verdict excludes the host harness
  prefix, which batching would also collapse. It flips only if that prefix exceeds
  roughly 7,100 tokens, and the spike names the one measurement that would settle
  it. `.planning/spikes/batched-review-fidelity/SPIKE.md`

- The **7.0x** read redundancy #167 carries is historical. It was measured over
  DECLARED read-sets in `trace.jsonl`; the observed in-dispatch figure for the
  heaviest role is 3.64, about half it, and nowhere near the 1.0 that would have
  closed the issue with a note. `.planning/spikes/read-set-redundancy/SPIKE.md`

## [3.5.6] - 2026-08-20

Last release fixed readers that accepted input they had a rule against. This one
fixes the machinery that recorded what happened afterward, because a run that
destroys the record of the run before it has no evidence to audit. Three phases,
45 commits off `v3.5.5`, no requirement ids seeded: this cycle was planned
against acceptance criteria alone, 20 of them, all 20 traced to a UAT item.

### Added

- **Executor reports rotate instead of overwriting.** A re-run used to write
  `reports/plan-<k>.md` over the previous run's copy on its first task commit, so
  the most detailed per-task record in the tree was the only one that was not
  run-scoped. `cadence-core/bin/lib/report-rotation.mjs` answers a free suffix
  from the directory listing, the executor rotates `plan-<k>.md` aside to
  `plan-<k>.<n>.md` before its first write, and two runs now leave two readable
  records. 7 tests in `report-rotation.test.mjs`.

- **A gate fire writes an adjudication record you can recount.**
  `ADJUDICATION-<trigger>-<discriminator>.json` lands beside the REVIEW file with
  one entry per finding raised, per raising voice: the model, the severity as
  raised, `file` and `line`, the claim and the failure scenario stored
  byte-for-byte, and `base_id`/`head_id` as full 40-character SHAs. The ruling is
  `survived`, `downgraded` or `refuted`, a refutation carries the code that
  contradicts the claim, and a survivor carries its fix commit. Every citation is
  grounded with `git cat-file -e <head_id>:<file>` before the record is accepted.
  The seam refuses to overwrite an existing record and refuses a paraphrased
  ruling.

  The point is the auditor walk: `git checkout <head_id>`, open the cited
  `file:line`, read the verbatim claim, decide for yourself whether the
  adjudication was right. Before this, the outcome survived as one sentence on a
  trace event.

- **`trace append` takes `--survivors`, `--downgraded` and `--refuted`**, and
  `recountReceipt` re-derives all three from the stored rulings before it lets
  the receipt onto the trace. A count that disagrees with the record is refused
  as `count-disagreement` and nothing is appended. The survivor count is now
  derived, not asserted.

### Changed

- **`/cad-report` renders the Gates line from the record** rather than narrating
  a figure out of a `detail` string, names a disagreement when it finds one, and
  reads a fire with no record as `unrecorded`. Nothing is synthesized for phases
  that predate the format.

### Fixed

- **`/cad-execute` refuses a phase that already executed.** The locate step
  stopped on unplanned and on missing plan files and nothing else, so a phase
  whose derived status was `executed` was dispatched again from task 1 against a
  plan whose tasks were already committed. It now refuses on derived status
  `executed` or `complete`, names `/cad-undo <N>` then `/cad-execute <N>` as the
  supported path, and `--rerun` is the deliberate override.

- **The risk gate no longer deadlocks on an empty range.** A range with zero
  commits answered `checked:false, inconclusive:true`, `execute.md` reads
  inconclusive as a fire, and `risk-check status` then refuses
  `risk-record-missing`, so a blocking cross-model review was demanded of a diff
  with nothing in it and the run needed a user override to finish. An empty range
  is now `checked:true, inconclusive:false, empty:true` and `status` admits it
  through the existing `recorded` arm. A range that contains commits but cannot
  be judged still fires, unchanged. Emptiness is decided from the diff body, not
  from `base_id === head_id`, so a revert pair with a zero net diff takes the
  empty arm too.

- **The risk range is read with `--no-ext-diff --no-textconv`.** The gate's own
  review caught this one and it was real: a `diff=<driver>` attribute in a
  checked-in `.gitattributes` binds to a `diff.<driver>.command` or `.textconv`
  in the reader's own git config, so `git diff <base> <head>` can emit zero bytes
  for a range that changed a file. No attacker needed, a `textconv` for pdf or
  docx in your own `~/.gitconfig` does it. Confirmed in a scratch repo before it
  was ruled: the driver emitted 0 bytes across a commit whose changed line was a
  recursive delete, `--no-ext-diff` emitted 109. Without this the new empty arm
  would have been a silent clear on the one trigger that blocks at every stakes
  level.

- **`lease-check` exempts a rotated report.** The exemption was byte equality
  against `<pdir>/reports/plan-<k>.md`, which was correct while a plan had
  exactly one report and wrong the moment rotation shipped, so an executor
  staging `plan-<k>.<n>.md` during a task commit was blocked with
  `undeclared-files` for obeying its own contract. `isReportName(k, name)` states
  the grammar once in the rotation module and `lease-check` imports it. The
  exemption stays bounded: `plan-<k>-risk.diff`, `plan-<k>-risk-task-<n>.diff`,
  another plan's report, a case variant and a nested path are all still refused,
  so a blocking gate's flagged evidence cannot ride into a task commit.

### Known issues

- `cadence-core/bin/milestone-prune.test.mjs:557` fails against this repository's
  own `.planning/`, because the corpus row expects `## Active` to carry the
  current cycle's requirement rows and this cycle seeded none. Full suite is
  2464/2465 with that as the only failure. It is a fixture-state mismatch, not a
  defect in `milestone-prune`.

- `lib/trace-suggest.mjs` still parses survivor counts out of the `--detail`
  string and ignores the three structured flags, so one reader in the tree
  continues to trust the prose this cycle set out to replace.

## [3.5.5] - 2026-08-19

Last release closed controls that ran and answered wrong. This one closes
readers that accept input they have a rule against, and it does it by giving
every seam CLI one argument table instead of nine hand-rolled parsers. Five
phases, thirteen requirements, 121 commits off `v3.5.4`. The landing page got
rewritten in the same cycle, because a tool about evidence should not ask you to
take its README on faith.

### Added

- **One declarative argument contract for every seam CLI.**
  `cadence-core/bin/lib/arg-contract.mjs` carries 16 scripts, 77 subcommand rows
  and 145 flag entries, each declaring `required`, `type`, `value` and `bare`,
  and `self-verify` now checks documented invocations against that same table. A
  flag with no row is a flag no prose may spell. `optionalFlag` is gone from
  source.

- **A census that proves the table is read, not just written.**
  `arg-contract-adoption.test.mjs` spawns the owning script for all 231 declared
  refusals across 145 entries, twice: the flag alone, and the same refusal
  preceded by a well-formed occurrence of itself. The phase's own UAT caught why
  this was needed. The table stated 145 rules and `planning.mjs` read two of
  them, so `cursor set --name` with no value answered `ok:true` and wrote
  `Phase: 1 of 5 (true)` into STATE.md.

- **`docs/` joins self-verify's markdown walk**, so a config key or repo path
  named on a `docs/` page has to exist, the same as on the README. Two pages
  moved there: `docs/COST.md` and `docs/EXAMPLE.md`.

### Changed

- **The README is a landing page now, not a reference manual.** 24,850 bytes
  down to 14,433. The cost-to-run section and the worked example moved to
  `docs/`, the 21-bullet command list is one line pointing at `/cad-help` and
  `cadence-core/references/COMMANDS.md`, and the page states what it asks of you
  before it asks you to install it. `LINEAGE.md`'s counts were re-measured
  against the tree: 19 rung files across 6 roles, 33 skills of which 27 are
  user-invocable.

- **Every bulk-output scratch file is written inside a `mktemp -d` made for that
  run**, at all six sites, and each read-back refuses a truncated or
  wrong-shaped file by name rather than parsing `{}` and calling it success.
  This is now check 21 (`scratch-path`) in self-verify. The blocking re-arm cap
  in `triage-gate.md` read a shared path before, which meant a render taken in
  another repository on the same machine could spend or refund the one round
  that gate has.

### Fixed

- **A string `""` in `git.protected_branches` protected nothing.** It coerced to
  an empty list, so `main` was unprotected and the commit guard said nothing.
  One non-empty resolver now sits behind all five readers, and the tests reach
  the guard DECISION rather than the helper: `git-guard` returns a
  protected-branch decision naming `main` under a string `""`, and
  `land-cleanup` reports `base: "main"` where it reported `''`.

- **`--dir ''` was read as "use the current directory" at six seams.**
  `git-branch.mjs tags --dir ''` printed this repository's 33 tags when it was
  asked about a project that does not exist. It answers
  `{"ok":false,"reason":"missing-flag-value","detail":"--dir"}` now. An absent
  `--dir` still resolves to the cwd, which is the behaviour that was actually
  intended.

- **A bare trailing `--date` on `release-bump` dated the release today.**
  `bump --version 1.1.0 --date` wrote the manifest and a `## [1.1.0] - <today>`
  heading at `ok:true`. Validated at the dispatch now, newline arm first,
  because a `--date` can carry a forged release section.

- **Numeric flags accepted values outside the safe-integer range**, so a
  400-digit argument or `9007199254740993` was rounded or yielded `Infinity`
  instead of refused. And a phase spelling that cannot round-trip is refused at
  the two write faces that would otherwise merge it into another phase.

- **`config.mjs` reported `__proto__` as a retirement that never happened.**
  `check '__proto__=1'` answered `retired in v2.0.0: undefined`. Every bare
  index read goes through `Object.hasOwn` now, and prototype members report as
  the unknown keys they are.

- **`detect-commands` named binaries that are not on PATH.** It now probes
  reachability before naming a command, nulls an unreachable winning arm and
  says so in `warnings[]`, with no fall-through to a lower arm. 402 planning
  rows pass both with `ruff`/`mypy`/`eslint`/`tsc`/`go` absent and with all five
  stubbed on, so the answer is pinned by fixtures and not by whichever machine
  ran it.

- **`risk-check status` could not be satisfied for a non-numeric worker key.**
  Both `risk-check` faces read one 16-row grammar now, and a refused bracket key
  lands in `malformed[]` instead of being dropped into `missing[]`.

- **The `risk_surface` detector matched its own source and fixtures.** 29
  literal sites split, reach proven unchanged, pinned by a census row watched
  failing against the old blob.

- **`## Shipped` and `## Traceability` lookups read inside fenced code blocks.**
  All four locators plus `## Shipped`'s start and end route through
  `sectionSpan`. The falsifier was observed by hand: the pre-change libraries
  wrote a real traceability row inside a fenced example table.

- **The argument door judged only a flag's first occurrence** while
  `planning.mjs` keeps the last, so `--name valid --name` passed on `valid`.
  Found by the blocking review on the very plan that existed to close this
  class, at a spelling the census had never typed.


## [3.5.4] - 2026-08-18

Every check in here already ran and already answered, and answered wrong in a
way its own output could not show. `v3.5.3` closed the shape for controls that
never reached their path; this one closes it for controls that reach the path
and mis-answer once they are there. Three phases, eight requirements, each fix
backed by a check watched failing against the unpatched tree first.

### Added

- **The stakes level moves both halves of a cross-model review panel.**
  `route-table.json` now carries level-keyed `tiers` and a new `efforts` grid
  beside it, and `route.mjs resolve` returns `reviewer_tiers` and
  `reviewer_efforts` per trigger alongside `reviewers`. At `solo` / `shipped` /
  `critical` the `plan` trigger resolves `cheap/low`, `balanced/medium`,
  `flagship/high`. Both grids are dense and self-verify walks each one per level
  in both directions, so a level silently inheriting another level's tier is a
  `missing-cell` failure rather than a surprise at review time.

- **A read-only `tags` arm on the git-branch seam.** `git-branch.mjs tags --dir
  <root>` exposes phase 2's bounded tag read to prose, so a workflow asking what
  a project has published gets an answer bounded to that project root instead of
  a bare `git tag`.

### Changed

- **All eight per-trigger `.tier` and `.effort` schema defaults sit on the
  `null` unset sentinel**, the shape `.gate` has carried since GAT-02. An unset
  key now answers `null` plus a warning naming `route.mjs resolve` as the seam
  that answers it for a level, rather than a hard `flagship` or `balanced` that
  nothing resolved. Upgrade note: if your provider config only defines a
  `flagship` model, a `shipped` project now resolves `balanced` for most
  triggers and loses its cross-model reviewer until you add that tier. Each
  resolve warns when it happens.

- **`git.create_tag` governs the land-time tag cut and nothing else.**
  `grep -rn create_tag` over `cadence-core/` and `skills/` now finds exactly one
  reader, `/cad-land`'s tag step. The milestone close decides release mode from
  a confirmed version plus the bounded tags probe, which means a project that
  turns tagging off still gets its manifest bumped instead of a close that skips
  the bump for a reason nobody wrote down.

### Fixed

- **A credential at the sanitize window's edge reached the review provider in
  clear text.** `redactUrl`'s userinfo rules both required a terminating `@`, so
  a URL whose userinfo span was cut by the 4096-byte `bodyExcerpt` window passed
  through unredacted. Two end-of-input alternatives now run after the terminated
  rules. Measured against the unpatched tree at `ae73dd6`: 73 bytes of planted
  secret surviving the excerpt on the reported shape and 985 bytes on the
  high-magnitude case, both zero now. `redactUrl('https://example.com:8080/path')`
  is byte-identical mid-body and at end-of-input, so a port is still not read as
  userinfo.

- **`cad-phase remove` deleted a phase directory it could not prove was clean.**
  `uncommittedUnder` collapsed "no uncommitted paths" and "I could not read the
  git state" into the same answer, and the caller deleted recursively on both.
  It now returns three states and refuses the third with `unreadable-git-state`.
  The blocking review found three more fail-open paths in the delete guard, all
  closed with their own falsifiers, plus a case-sensitive name comparison where
  the `.git` probe belonged.

- **The ship gate FAILed a healthy repository on three separate counts.**
  `activeVersion` was a first-token line scan, so a `### Active` section
  mentioning the predecessor on a wrapped continuation line reported the
  predecessor and hard-FAILed `/cad-audit`; it now scans the whole body twice and
  admits a line-anchored token only on agreement or a sentence opening.
  `version_drift` fired on the rolled-forward phase the workflow already declared
  exempt. And `readTags` let `git -C` discover upward from `.planning`, so a
  project that is not itself a repository inherited an enclosing repository's
  tags and could be failed by a version an unrelated umbrella repo published.

- **`issue-check`'s resolve loop could multiply its own bound by the call cap.**
  The loop's only exit was a SIGKILL timeout, so five issue lookups each
  answering at 9.9 seconds with exit 1 cost fifty seconds and never tripped it.
  The loop now takes one `Date.now()` deadline at start and derives each call's
  timeout from what is left. Against a stubbed `tea` that sleeps and exits
  non-zero: 5 resolves in 5.07s before, 2 in 2.06s after. Budget exhaustion still
  exits 0 with `action: "report"` and reports the unreached numbers `unresolved`,
  and a fast non-zero resolve still does not stop the loop, because an absent
  issue is a legitimate answer.

## [3.5.3] - 2026-08-18

Cadence asserted controls it did not hold. The review path stated bounds it
never enforced, the run record claimed to price a run it could not see, and
three controls that already existed and were already correct never reached the
path that needed them. Five phases, thirteen requirements, all of it argued off
this repo's own trace rather than off a guess.

### Added

- **Turns on the record, and a spend figure that names what it excludes.**
  `trace close` now persists the tool-call count its return already carried, and
  `trace render` reports turns per dispatch and per role beside a
  `turns_unrecorded` counter of their own, so a dispatch that reported tokens but
  no turns stays distinguishable from one that reported the reverse. The three
  surfaces that priced a run from worker-return tokens (`/cad-report`,
  `trace suggest`, `/cad-progress --trace`) now name the three sources that
  figure leaves out - the orchestrator's own turns, cross-model provider calls,
  and figureless returns - instead of presenting it as the run's cost.
  `SPEND_EXCLUDES` is a frozen export, so the list cannot drift into three
  versions of itself.

- **A dispatch window budgeted off the run record.** Six
  `workflow.max_dispatch_tokens.<role>` ceilings, each defaulted to that role's
  75th-percentile terminal window on this repo's own record rounded up to the
  next 25,000, plus `planning.mjs trace window [--phase <N>]` to apply them. The
  ceiling is READ after the fact and never enforced at dispatch time, because
  nothing can resize or cancel a dispatch already running, and the report says so
  rather than implying a bound that does not exist.

- **A direction and a target on every retune suggestion.** `trace suggest` used
  to return a bare config key, so `/cad-suggest` could print
  `workflow.max_plan_tasks` and no more. Each keyed suggestion now carries the
  direction to move it, the value it holds now, and a target where one can be
  READ - stepped down the gate ladder `route-table.json` states, or taken off the
  rung the record shows a role's escalated resolves landing on. A rule that
  cannot price a target omits it rather than guessing, and a target that would
  name no actual change is omitted too. `/cad-suggest` presents the tweaks in a
  heading of their own with the receipts below, and ends by offering to route the
  change to `/cad-config` rather than by declining to have an apply arm.

- **A bulk-output transport, and a register that holds it.** Bulk tool output
  rides a scratch file at the five sites that prescribed it inline, the rule is
  stated once in `references/conventions.md`, and a 17-row register plus
  self-verify check 20 refuses an eighteenth inline site.

### Fixed

- **The coordinator figure counted hours that were not the coordinator's.** The
  residue accumulators were keyed on phase number, so one run's last marker
  closed at a different run's last event whenever a phase number spanned several
  runs. Keyed on `corr` instead, phase 2's reported residue over the live record
  falls from 366,716,303 ms to 3,508,747 ms, and the largest single window from
  280,613,472 ms to 1,081,370 ms. The name stays: a corr-scoped gap between
  worker brackets is time this coordinator held the run.

- **The provider response had no ceiling Cadence owned.** `request()` now
  enforces a 4 MiB response limit with its own `over-response` reason, distinct
  from `transport`, on `review`, `consult` and `detect-models` alike; the failure
  envelope carries a sanitized 1024-byte excerpt rather than the whole body. A
  credential sanitizer sits beside the URL one, covering `Bearer` echoes,
  `name=value` pairs in four spellings, quoted multi-word values and camelCase
  keys.

- **Local validation admitted findings the canonical schema refuses.**
  `FINDING_SCHEMA` now carries the constraints `validateFindings` enforces -
  `minimum`, `minLength`, `maxLength`, `maxItems` - and an 18-fixture agreement
  table runs both sides and compares verdicts, so the schema and the validator
  cannot disagree silently. `cadence-core/bin/lib/schema-eval.mjs` is a
  keyword-limited, zero-dep evaluator.

- **The recovery arm named a timeout the dispatch path cannot produce.**
  `execute.md` now says `turn cap or unusable return`, in those words, held
  there by a standing prose-agreement check. `maxTurns: 200` is named where the
  default reviewer claims exemption, checked against the rung files' own
  frontmatter rather than a literal.

- **Three controls that existed, were correct, and never reached their path.**
  A milestone close now distills its pruned phases into `.planning/ARCHIVE.md`
  before the directories go, so the recall corpus survives the close.
  `risk-check status` gains an `unfired` row state and refuses a fired range
  carrying no receipt for that range, and every blocking fire writes
  `--plan --base --sha` so a receipt names the range it settles rather than
  clearing every later one. `references/execute-parallel.md` reaches the
  sequential branch's detector, fire and status sequence by pointing at it
  instead of copying it.

- **The plan-task ceiling re-decided, and left where it was.**
  `workflow.max_plan_tasks` was argued against both of its forces - cold-prefix
  cost and context risk - and lands on 8 unchanged, with the arithmetic written
  down in `design-notes/dd-plan-task-ceiling.md` where a milestone close cannot
  prune it.


## [3.5.2] - 2026-08-16

Two surfaces where the tree already conceded the correct rule in one place and
prescribed the wrong one somewhere else. Neither is a bug anyone hit yet. Both
came out of an external deep dive against `v3.3.0`.

### Fixed

- **The pre-flight overlap gate could admit a plan pair the commit-time
  enforcement would then refuse to separate.** `plan-overlap` and `lease-check`
  each carried their own comparison over declared paths, so they disagreed about
  what a directory lease covers. Plan 1 declaring `files: [src/]` beside plan 2
  declaring `files: [src/auth.js]` passed the parallel-safety check, and then the
  executor's own lease gate refused the commit. Same for `src/` against
  `src/auth/`.

  Containment now has exactly one definition. `cadence-core/bin/lib/lease-grammar.mjs`
  exports `covers`, `intersects` and `isRefusedSpelling`, and both readers ask it.
  A census test in `helper-census.test.mjs` goes red if the comparison is pasted
  back anywhere under `cadence-core/bin/`, test files included, which is the live
  failure mode in this tree rather than a hypothetical one.

  `cadence-core/references/plan-frontmatter.md` now states the trailing-slash
  directory-prefix form and says outright that `src/auth` does not license
  `src/authority.js`.

### Added

- **A file-path transport for every seam flag that carries caller-derived free
  text.** A capture item, a UAT reply or a milestone label holding `$(...)` or a
  backtick could not ride safely in a double-quoted shell word. `planning.mjs`
  already said so in one place and eleven other sites did it anyway.

  Five new flags, one reader behind all of them
  (`cadence-core/bin/lib/text-flag-file.mjs`, four refusals: valueless flag,
  unreadable path, empty file, both forms given):

  - `trace append|close --detail-file`
  - `trace append --read-file`
  - `uat record --fields-file`
  - `milestone-prune --label-file`
  - `cursor set --next-file`

  The rule is stated once, in `cadence-core/references/conventions.md` under
  `## Caller-derived text`, and a committed 36-row register
  (`cadence-core/bin/lib/text-transport.mjs`) records every site with its verdict,
  20 caller-derived and 16 out of scope with a reason each. `self-verify` check 19
  `text-transport` reads that register, so a seventeenth inline site is refused
  rather than noticed later. 13 prose surfaces across `workflows/`, `references/`
  and `skills/` moved onto the transport, and the tag site now uses
  `git tag -a <version> -F <path>`.

- **`./a.txt` and `src//a.txt` are refused with a named `redundant-path-segment`
  diagnostic at both declaration doors**, the frontmatter `files:` list and a
  `- **Files:**` task line. The diagnostic reaches `plan-overlap`'s
  `frontmatter_issues` and the spelling reaches neither reader. Note that a
  refused declaration drops out of the set, so `lease-check`'s `declared` count
  falls by one for each, with the diagnostic beside it naming why.

## [3.5.1] - 2026-08-16

### Fixed

- **A `git.auto_close` set once in your global config authorized an unattended
  merge in every repository you own.** The key is documented repo-local, and the
  close gate enforced it by reading the repository layer, but the GitLab arm of
  `/cad-land` read the merged value instead. Set it globally and any repo with a
  GitLab remote would open an MR and merge it with nothing asked. It now resolves
  as two separate answers, `autoCloseRequested` from the merged config and
  `autoCloseAuthorized` from the repository layer alone, and the new
  `git-publish.mjs authorized` subcommand is what every host consults before it
  touches a remote. Requesting it globally and never authorizing it here now
  refuses in wording that says which of the two is missing.

  The GitLab consult also moved ahead of the reuse probe rather than sitting
  beside the create. `glab mr create` publishes the source branch itself, and the
  reuse arm hands an already-open MR straight to the merge with no create at all,
  so a check placed at the create left that path ungated.

- **`milestone-prune` read only the first physical line of a requirement
  bullet, and both halves of the transform were wrong for it.** A bullet that
  wrapped lost its lead line and left every continuation behind as orphaned
  prose, and the archived `## Shipped` row got a parenthetical truncated at the
  first newline. Three consecutive milestone closes were repaired by hand. It now
  reads the whole span, takes both ends of `## Active` from the fence-aware
  `sectionSpan` so a fenced example in a template is not mistaken for the
  section, and escapes any `|` in the summary before it reaches the table cell,
  so the row keeps its five columns.

- **`/cad-land` never once reported the tracker on the repository it was built
  in.** Host detection compared the origin URL's hostname against the `tea` login
  list, and a forge whose SSH endpoint is a different name from its web host
  matched nothing, which is an ordinary deployment shape rather than a
  misconfiguration. The seam now hands the binding to `tea` itself with
  `--remote origin`, and guards the call rather than the pick: unless some login
  NAMES the origin host through its name, API url or `ssh_host`, it declines to
  ask and prints the `no-login` line it always printed. `tea` does not refuse an
  unmatched remote, it falls back to config order and answers exit 0, so an
  unguarded call would report another server's issues as yours.

  If your forge has a split endpoint, put the SSH host in the login's `ssh_host`
  and the report will bind to it.

### Changed

- The Forgejo tracker read asks for `--state open` instead of `--state all`. The
  server clamps a page at 50 rows whatever `--limit` requests, so on any real
  tracker the read was honestly incomplete and the whole report degraded to a
  skip line. What that costs is that a referenced number missing from the list is
  closed or absent rather than absent, so each unanswered number gets one bounded
  `tea issues <index>` resolve, capped at five per land. A number that neither
  the list nor a resolve answered is reported as `unresolved`, never as closed
  and never as not found: `tea` exits nonzero both for an absent issue and for a
  failed read, and this seam discards child stderr, so naming it would be an
  affirmative answer about input it could not read.

## [3.5.0] - 2026-08-15

### Added

- **The only gate live on a default install fired on a model reading a prose
  list, and left no record either way.** `risk_surface` is `blocking` at every
  stakes level and, at the shipped default, it is the sole review trigger that
  fires at all. Its entire firing condition was prose: `workflows/execute.md`
  told the orchestrator to check a diff range against the eight categories in
  `references/review-triggers.md`, and `workflows/task.md` said the same thing a
  second time for the task path. A match fired the trigger and wrote a lifecycle
  event. A non-match wrote nothing at all. Those two states left identical bytes,
  so the run record could not tell "the detection step was skipped" from "it ran
  and matched nothing", and an omitted check was indistinguishable from a clean
  one.

  `planning.mjs risk-check` is the seam that closes it. `risk-check run` answers
  a resolved commit range with `{checked, categories, matches, inconclusive}` and
  appends one `{"family":"outcome","event":"risk_check"}` line to `trace.jsonl`
  on EVERY invocation, the clean range included, so silence stops being evidence
  of anything. `matches` names the category and the signal that found it.
  `categories` uses exactly the eight tokens `route-table.json` and
  `config.schema.json` already carry - no new vocabulary was introduced, and the
  detector takes the list from its caller rather than restating one.

  `inconclusive` is the honest third answer and is not collapsed into
  `matches: []`. A binary file, a body with no readable hunk and a
  gitlink/submodule bump all read `inconclusive: true`, distinguishable by the
  caller from a range judged clean.

- **Completion now requires the record.** `risk-check status` is the enforcement
  half, and it is the load-bearing one: a seam that plan completion never
  consults leaves the gate exactly as skippable as it was, just with a script
  beside it. Both `workflows/execute.md`'s post-plan step and
  `workflows/task.md`'s `risk_check` step call the seam instead of instructing a
  model to read a list, and neither reports done while the record is absent -
  including a run that answered `ok:true` while its append came back
  `written:false`. Range identity is the RESOLVED commit pair, so a record left
  by an earlier or narrower range of the same plan reports `stale` rather than
  satisfying a later one.

  The enforcement was watched to fail before the wiring landed: run against the
  unpatched tree, it exited 1 and named plans 1 and 2 by number.

  `lib/surface-scan.mjs` did not become a detector and keeps its scoping role -
  it still answers "which categories does this project SCOPE" and still returns
  all eight unconditionally. `lib/risk-diff.mjs` answers "did this RANGE touch
  one". The header of each names the other.

  Detection stays heuristic on purpose. This release does not claim to find risky
  diffs more accurately. It claims that whether the finding step ran is now a
  fact in the record rather than an inference from silence.

### Known issues

- **The detector matches its own test fixtures.** `cadence-core/bin/risk-diff.test.mjs`
  necessarily holds, as literal fixture text, the very signals the detector hunts -
  a fixture proving the `auth` signal fires has to contain something that fires it.
  So `risk-check run` over any range touching that file self-matches on six of the
  eight categories: `auth`, `migrations`, `billing`, `concurrency`, `destructive`
  and `untrusted_input`. The gate's first live firing on this repository was a
  false positive on itself. It breaches no criterion this release set, since
  detection is heuristic by design, but `risk_surface` is blocking at every stakes
  level, so the false positive lands on the one gate that always fires. Prose that
  QUOTES a signal trips it the same way, which is why this note names categories
  instead.

- `inconclusive` is a bare boolean and does not say WHICH half made it true: a
  binary file, an unreadable hunk, or a gitlink.

- A risk record written before this release carries no `base_id`/`head_id` and can
  never satisfy a NAMED range, reporting `stale`. A phase holding one needs a
  single `risk-check run` to re-record before its status call passes.

- `risk-check status`'s range arm resolves the refs it is given, so it must run
  inside the repository that carries them. A caller elsewhere gets
  `unresolved-range` rather than a wrong answer.

## [3.4.1] - 2026-08-15

### Fixed

- **The schema said one gate, the route table fired another.** Three surfaces
  described the review gates and nothing had ever compared them.
  `config.schema.json:81` gave `review.triggers.phase_diff.gate` a default of
  `advisory` and its purpose string said "advisory at shipped", while
  `route-table.json`'s `review.shipped.phase_diff` fired `off`. That one cell
  was the visible half. The invisible half is that a `config.mjs get` of any
  gate no layer had set answered with the SCHEMA DEFAULT rather than with what
  the stakes level actually fires, so all four triggers could disagree and
  nothing said so.

  All four `review.triggers.*.gate` defaults are now the `null` sentinel, and
  each purpose string names the gate for `solo`, `shipped` and `critical` read
  straight off `route-table.json`. `risk_surface` moved with them even though
  its three cells agree today: a scalar default that is legal only while every
  level's cell equals it passes quietly right up to the first cell that moves.
  The `review` grid did not move at all - it is the authority, and this release
  is the other two surfaces catching up to it.

  The workaround came out with the defect. `workflows/execute.md` carried a
  paragraph telling a caller not to pre-fetch a gate through `config.mjs get`
  because the answer would be the schema default rather than the level's;
  `workflows/plan.md` carried the same one. Both now state the shipped
  behaviour, and `references/config-catalog.md`'s gate row stops publishing a
  per-key scalar default that routing never fires.

### Added

- **`self-verify.mjs` check 18, `gate-agreement`.** The check that makes the
  fix above stay fixed, and the reason one visible cell was worth a release.
  `self-verify.mjs` already failed in both directions on rung files and on the
  three routing grids, and it already read `config.schema.json` for the gate and
  stakes vocabularies - it had both files open and had never compared a trigger's
  gate across them, so the drift was invisible to the one check whose job is
  catching exactly this.

  It compares every `review.triggers.<t>.gate` schema default AND its `purpose`
  prose against `route-table.json`'s `review[level][trigger]`, over six codes
  (`gate-default-drift`, `gate-default-invalid`, `gate-prose-missing`,
  `gate-prose-drift`, `gate-grid-missing`, `gate-row-malformed`). The rule is a
  pure lib at `cadence-core/bin/lib/gate-agreement.mjs`, unit-tested from frozen
  fixtures rather than from the live files, so the tests do not move when the
  grid does.

  It was watched to FAIL before the fix landed, not inspected: run against the
  unpatched tree it reported `plan`, `diff` and `phase_diff`, naming
  `phase_diff` together with `shipped` by name.

### Changed

- **`config.mjs get` reports an unset gate as unset.** A gate no layer pinned
  now answers `null` with one `warnings[]` entry naming `route.mjs resolve` as
  what decides it for a level, so a reader can tell "no layer set this, the
  stakes level decides" from "this project pinned it". A pinned gate still reads
  back byte-identical with no warning, a keyless `get` carries no gate warning at
  all, and `config.mjs check review.triggers.diff.gate=null` still refuses with
  `must be one of: off, advisory, blocking, adjudicated` - the `values` arrays
  stayed four-membered, so `set` and `check` behave exactly as before.

  Known gap, filed rather than papered over: `gate-agreement` compares the
  default against the cells, not against the `null` sentinel, so a gate whose
  three cells happen to be identical could regress its default and stay green.
  `risk_surface` is that case today.

## [3.4.0] - 2026-08-15

### Added

- **`/cad-land` step 1 reads the issue tracker.** Cadence audited its own
  requirements, its own plans and its own run record, then landed work without
  ever asking whether that work answered something the tracker had open. Step 1
  now scans `git log <base>..HEAD` for `#N`, `closes #N` and `fixes #N` and
  names each referenced issue with its state ("your branch references #42 and
  #47; #42 is still open"). Reference nothing and it lists the open issues
  instead, as the fallback rather than the headline.

  It reads, it never writes. Landing closes no issue, and closing one stays an
  explicit ask you make at publish time.

  The host comes off the origin URL the same way step 1 already picked the PR
  mechanism: `gh` for github, `glab` for gitlab, `tea` for a host your
  `tea login list` names. Every path that cannot answer prints exactly ONE line
  saying why and the land carries on: no remote, an unrecognized host, no
  login, the CLI missing from `PATH`, a nonzero exit, a response that came back
  truncated or unreadable. A forge CLI that never returns is killed at 10
  seconds, so it cannot stall a land. The call is bound to the repository
  `--dir` names by an explicit `owner/name` selector, not by the process cwd,
  and a referenced issue is never reported as closed when what actually
  happened is that the fetch could not be read.

  `git.issue_check` (bool, default `true`) turns it off. False and step 1 says
  nothing about the tracker and spawns no forge CLI at all.

  Known limits, both one-line degradations rather than wrong answers: `tea`
  clamps a page at 50 server-side, so a Gitea or Forgejo repo with 50 or more
  issues reports the truncation line instead of a list, and a self-hosted
  GitLab or GitHub Enterprise host with no matching `tea` login reads as
  unrecognized.

### Changed

- **The `plan` review is `blocking` at `shipped`, where it was `off`.** At the
  default stakes level a plan had no second opinion of any kind, and the two
  decisions that produced that each named the other as the remaining net:
  `e0b5448` cut the gate to advisory because "a plan at `shipped` has already
  passed cad-plan-checker, a blocking gate ... on by default", `b20fd14` took
  it to `off`, and `70007f7` - one day later, same cycle - flipped
  `workflow.plan_check` to `default: false` because "the plan review trigger
  remains the default second opinion". Both cuts shipped, and neither re-read
  the other's justification.

  `blocking` rather than a return to `advisory`, because the measurement behind
  the original cut (CST-01: findings files referenced by no SUMMARY and no
  CONTEXT) condemned the advisory GATE and not the review. A plan is the
  cheapest artifact in the pipeline to halt on - no code exists yet, the
  payload is one file, and the fix is an edit - and `blocking` adds no
  user-triage turn, which is what `adjudicated` costs at `critical`.
  `workflow.plan_check` stays `default: false`: one net, on, before code.

  `config.schema.json`'s purpose string for `workflow.plan_check` stops
  claiming a second opinion that was not running. `solo` (advisory) and
  `critical` (adjudicated) are unchanged.

## [3.3.1] - 2026-08-15

### Fixed

- **`milestone-prune` stops reporting a half-finished close as a finished one.**
  A phase whose directory could not be moved or deleted was collected as a
  warning, after which ROADMAP.md and REQUIREMENTS.md were pruned for every
  completed phase anyway and the envelope answered `ok:true, action:"pruned"` -
  contradicting the comment above it, which promised a failed rename left both
  documents untouched. The directory pass now runs first and only the phases it
  actually cleared reach the documents, so the tree and the docs still agree; a
  partial application returns `ok:false, reason:"partial-prune"` naming the
  phases that did not clear, and `/cad-milestone` halts on it instead of
  committing the disagreement. Re-running picks up only what is left.

- **An `_archive-<label>` that is a symlink can no longer redirect the archive
  out of the planning root.** The containment check was lexical, so a
  pre-existing link resolved inside the tree, `mkdirSync` succeeded against it
  and `renameSync` followed it. The path is now classified with `lstat` before
  anything moves, and a per-phase destination left by an interrupted close is
  refused rather than clobbered.

## [3.3.0] - 2026-08-15

The evidence Cadence plans and reports from is itself checked this cycle: the
capture queue that silently dropped filed work, the run record that could not
join a provider call to the fire that made it, and the claims the docs make
about the code.

### Fixed

- **`/cad-capture` no longer writes where recall cannot see it.** Five items
  filed after the 2026-08-08 archive block landed below a heading the corpus
  walk does not visit and were invisible to `/cad-plan`'s recall until they
  were lifted by hand, one of them a `[high]` finding that a tuning rule can
  never fire. The writer lands inside the walk, the tag reader admits every
  shape the writer emits, `/cad-health` reports any bullet outside the walk,
  and a concurrent append can no longer lose an update.

- **The run record joins.** `corr` is fire-scoped rather than phase-scoped, so
  a provider call attributes to the fire that made it; a terminal event's
  `--role` is validated against its paired dispatch, so a role with zero
  dispatches can no longer render carrying a token total; and `recorded` counts
  matched dispatches rather than token-bearing events, so a replayed terminal
  stops hiding a missing report.

- **String-form `protected_branches` is honored by all four readers**, the
  fence-blind `## Phases` and `## Active` scanners are guarded, and a blank
  `--root` is refused consistently rather than linting the cwd and returning
  `ok:true`.

- **Fourteen stale claims are corrected at their source.** `README.md`,
  `METHOD.md` and `cadence-core/workflows/plan.md` stated a `plan` review as
  advisory at `shipped` where `route-table.json` resolves `off`;
  `/cad-new-project` and `/cad-adopt` reported the config they had just copied
  as turning plan check on when the template ships it off;
  `config-catalog.md` published a `Risk` knob category with zero rows behind
  it; `recall.md` named two callers where the code makes three; and
  `METHOD.md` and `INTERNALS.md` still described the dispatch-time risk floor
  and its per-surface waivers, both retired in v2.7.0.

### Added

- **A second `/cad-docs-verify` sweep, transcribed and dated.**
  `.planning/DOCS-CLAIMS.md` now carries 933 rows over 32 files, each with a
  generated `run` column and a live line cite, 373 line re-pins, and the seven
  rows phase 4's `trace close` invalidated rewritten to the live call rather
  than silently re-pinned.

- **Two prose assertions that derive both sides from the tree**, in
  `cadence-core/bin/prose-agreement.test.mjs`: README's skill, role and
  rung-file counts measured against `skills/` and `agents/`, and a check that
  `PROJECT.md`'s `### Active` declares its milestone before naming any other
  version. Both were shown to redden on a pre-fix input.

- **`planning.mjs criteria-size`**, so the 3-7 acceptance-criteria ceiling
  `/cad-context` states is counted rather than merely written down.

### Changed

- **One `trace close` subcommand replaces eight workflow files' restated close
  prose**, `trace render` is bounded by default, and the round-trips measured
  as unbatched now issue as one call.

- **The `REQ_ID` documentation states the asymmetry that is live** rather than
  the head-anchored limit `PRS-02` removed: `REQ_ID_EXACT` admits a
  digit-leading category while `REQ_ID_TOKEN` keeps its letter head, so an
  unbolded `2FA-01` remains invisible to the prose scan.


## [3.2.0] - 2026-08-14

### Fixed

- **A `.planning/config.json` arriving with a clone can no longer reparent the
  merged config.** `deepMerge` assigned instead of defining, so `__proto__`,
  `constructor` and `prototype` in a repo layer reached every enforcement
  surface that reads the merge. The hostile fixture that allowed a commit on
  `main` with no output at all from `git-guard.mjs` now produces
  `permissionDecision: "ask"`, identical to the benign control. Those keys
  store inertly.

- **Inspection and enforcement can no longer disagree about the same file.**
  `config.mjs validate` returned `{"ok":true,"checked":0,"errors":[]}` on that
  same hostile fixture, so the tool you would reach for to check a config was
  the one thing that could not see the attack. `flatten`'s `_`-prefix skip is
  narrowed to exactly `_meta`, the `SCHEMA[path]` lookup is `Object.hasOwn`
  guarded, and a test pins the two surfaces together.

- **`workflow.test_command`, `workflow.lint_command` and `review.key_file` are
  global-layer only.** A repo layer that sets one is ignored AND warns, naming
  the key and the file it came from, because silence there hides an honest
  mistake as readily as an attack. A repo layer holding `{"workflow": "x"}`
  replaced the whole user-global section without setting a key at all; that
  ancestor is stripped and warned too.

- **`atomicWrite` refuses a symlinked temp path instead of writing through
  it.** The proof case wrote `PWNED CONTENT` to a file outside the repo and
  left `ROADMAP.md` as a symlink. Temp paths are now per-writer
  (`<file>.<pid>.<n>.tmp`), so two concurrent writers under
  `parallelization.enabled` cannot share one, and `appendEvent` returns
  `{written:false, reason:'symlinked-trace'}` rather than following.

- **No git failure detail can carry credentials.** A remote with userinfo in
  its URL used to land in the envelope verbatim. `redactUrl()` strips it at all
  four emit sites, each with its own test.

- **The unattended-close gate tells "no findings" apart from "could not read
  the findings".** Unreadable stdin, malformed JSON and a valid non-findings
  envelope each halt under `git.auto_close` with a reason naming the failure,
  where all three previously returned `proceed` claiming no surviving finding.

- **A valueless flag can no longer become the integer 1.** `phase-done`,
  `uat record` and `renumber` each validate through `requireInt`, and each
  carries the valueless-form test it lacked.

- **An unreadable CONTEXT.md is a break, not an exemption.** `criteria-coverage`
  under `chmod 000` returned `{"ok":true,"phases":[]}` over two uncovered
  criteria: the exemption was written for an ABSENT context and was silently
  granting itself to an unreadable one.

- **`milestone-prune` never ships a `Deferred` requirement as `Complete`,** and
  never deletes a `## Deferred` bullet while pruning.

- **A `--label` that escapes the tree is refused before any mkdir or rename.**

### Added

- **`review.triggers.risk_surface.surfaces` - the surfaces your project
  actually has.** `risk_surface` is blocking at every stakes level and fires
  once per plan on a detection match, so on a security-shaped phase it is the
  dominant review cost. Naming the subset of the eight categories your project
  contains cuts the fires that were never going to find anything. Absent means
  all eight, so nobody's coverage shrinks on upgrade. Populated by a structural
  scan (`planning.mjs detect-surfaces`) over manifests, directories and file
  types, never keyword greps: the grep approach false-positived `auth` on 16
  matches of `session` meaning Claude sessions, and `money/billing` on prose
  about token cost.

- **`cadence-core/references/reviewer-brief.md`, composed into the cross-model
  payload.** An external reviewer was handed a one-line model-authored
  `instruction` as its entire system prompt, so it never saw the stance, the
  severity definitions, "approach differences are NOT findings", or that an
  empty `findings: []` is valid. At a blocking gate that uncalibrated output
  could FAIL the gate. The brief costs about 670 tokens, 0.56% of the default
  cap.

- **Reviewer identity on the lifecycle event.** The seam resolved the gate but
  not the reviewer SET, so a cross-model review that never happened was
  indistinguishable afterwards from one that did. Observed on 2026-08-13:
  `review.reviewers` was `["openai"]`, the fire went to the Claude subagent,
  and nothing in the record could have caught it. The seam now returns the
  reviewer set beside the gate with its fallback and cause stated, and a
  cross-model fire leaves an event of its own.

- **Adjudication records what it killed.** `<n> of <m> raised` replaces
  `<n> survivors`, so `/cad-suggest` can tell 0-of-0 (the gate is unnecessary)
  from 0-of-9 (the reviewer is miscalibrated and the gate is doing real work).
  It proposed turning the gate off in both cases.

### Changed

- **`plan` and `phase_diff` resolve `off` at `shipped`, and `pre_ship` is
  deleted outright.** An advisory gate blocks nothing by definition: it writes
  a findings file and execution continues. On a reporting user's 3.1.0 run
  `cad-reviewer` was 711,636 of 3,450,628 processed tokens, about 20.6%, while
  the trace recorded it as 0. In this repo's own history two advisory review
  files sat untracked and referenced by nothing. The `adjudicated` arm at
  `critical` is untouched, and a user who does read those files can turn them
  back on.

- **Every dispatch is bounded at `maxTurns: 200` rather than a nominal 400.**
  Measured billed tool calls on single dispatches ran 55, 81 and 106, each a
  lower bound since Edit, Write and Task turns are not billed. One uniform
  value across all 19 rung files, and `references/seams.md` states the bound
  instead of claiming there is none. A test holds the two against each other in
  both directions.

- **A truncated reviewer return stops reading as "nothing survived".** Both
  triage-gate arms gained a third reading keyed on the return's contract SHAPE,
  not on a host stop signal: a return that is not the expected payload reads as
  "the gate could not be evaluated" and asks, and neither arm can reach resume
  from it.

- **`/cad-report` no longer labels an unmeasured figure `Spend:`.** The heading
  names it as the host's own per-dispatch return figure, and the report states
  what it cannot see: advisory fires and cross-model provider calls both record
  none. No new field is captured.

- **Environment overrides commented "test injection only" are gated behind
  `CADENCE_TEST_SEAM=1`.** `CADENCE_ROUTE_TABLE`, `CADENCE_CONFIG_SCHEMA` and
  `CADENCE_PLUGIN_MANIFEST` each did what the comment said they should not.

### Removed

- **The `pre_ship` review trigger, in every direction at once.** By the time a
  land runs, every phase has already been through `plan`, `diff` and the
  `/cad-verify` walk, so it reviewed work that had already been reviewed. Its
  config key, its wiring-table row, `/cad-land` step 3 and its deferred-reads
  register row are gone, and so is the gate it drew in
  `docs/figures/milestone-land.svg`: the milestone exit has one gate now rather
  than two. `README.md`, `docs/WORKFLOW.md` and `METHOD.md` no longer describe
  it as a live gate, and the unattended close is documented as what it actually
  reads, the `risk_surface` findings this branch already settled.

## [3.1.0] - 2026-08-13

### Added

- **`/cad-adopt` - an entrance for a repo that already exists.** Cadence's
  front door assumed a blank page: a brownfield project had no way in short of
  answering `/cad-new-project`'s interview about code already written. Adopt
  derives PROJECT.md, REQUIREMENTS.md and a REMAINING-work ROADMAP.md from the
  code, the manifest and the git history, seeds Traceability through the
  existing seams, and asks only what the repo cannot answer. It refuses a
  subdirectory of a repo - git discovers upward, so `/repo/subdir` would
  otherwise answer from `/repo`'s log while writing `.planning/` into the
  subdirectory. No subagent: the brownfield read is paid in the coordinator's
  own context.

- **`/cad-new-project --brief <file>`.** A design brief settles most of what
  the interview asks. The brief is read whole - no parser, no schema, no marker
  convention - and suppression keys off what it SAYS. Replayed against
  verbatim's own `DESIGN-BRIEF.md`, the settled decisions are not re-asked.
  `docs/DISCOVERY.md` documents the sequence (freeform conversation, then
  brief, then `--brief`) and what a good brief answers; it stays guidance, never
  a scripted interview, because the discovery works BECAUSE it is freeform.

- **The coordinator's own spend reaches the run record.** Every subagent was
  priced and the orchestrating session - half the original cost spiral - was
  invisible. A `--step` marker on `trace append` carries only what the
  coordinator can actually know and never a fabricated token figure;
  `renderTrace` grows a `coordinator` block (`wall_ms`, `bracket_ms`,
  `residue_ms`, time-ordered `steps[]`, overlaps unioned before subtraction,
  residue floored at zero) that is absent entirely on a trace written before
  this release. `trace suggest` reads those figures rather than recomputing
  them, and `/cad-report`'s record-health line reports the residue and its
  heaviest step. Verbatim's phase-1 record ships as a byte-for-byte fixture
  with both readers pinned against it.

- **A spend gate in `/cad-context`.** The assumptions analyzer is the spine's
  most expensive dispatch (75k on verbatim phase 1, 132k on phase 2), and
  nothing asked whether a given phase was worth buying it for. A gate between
  `load_priors` and `analyze` settles phase scope cheaply first and falls back
  to a conversational pass when the phase is small or its ground was already
  settled by a prior phase's deviations - which `load_priors` now reads from
  those phases' SUMMARY `## Deviations`. The size question and the spend
  question are stated as two distinct questions, pinned by a prose-agreement
  test.

- **`/cad-minimalism-review` - a ranked delete-list.** An adversarial
  CORRECTNESS review structurally cannot catch over-building: a hand-rolled
  helper the stdlib already ships, a base class with one subclass, a hook
  nothing calls and a key nothing reads all pass it, because nothing they do is
  wrong. This pass hunts those four species and returns the list in the review
  subsystem's shared findings schema with `severity` carrying the rank. It
  dispatches the existing `cad-reviewer` with a retargeting instruction - no
  seventh role, no sixth trigger, no gate - and it applies NOTHING: the skill
  grants neither `Write` nor `Edit`, so that is structural rather than a
  promise.

- **`/cad-suggest` - the tuner gets a front door.** The retune the run record
  supports was reachable only as a footnote at the end of `/cad-report`. It is
  now a command: every suggestion carries the trace figures behind it and names
  the `/cad-config` key it concerns, and it writes no config itself. A trace
  too thin to clear the evidence floors gets a one-line refusal rather than an
  invented suggestion, discriminated on `events_read` alone - "no record" and
  "below the floors" are different sentences.

- **`/cad-capture --cadence`.** Friction with Cadence noticed while using
  Cadence on somebody else's project had nowhere to go: the note either became
  noise the host project's triage archived as out of scope, or was never
  written. Ten projects of field use produced five lines of Cadence feedback
  total. `--cadence` writes to Cadence's own queue beside the global config
  layer - `~/.claude/cadence/CAPTURE.md`, or `CADENCE_GLOBAL_CONFIG`'s
  directory - carrying the host project and the command that provoked it, and
  never `${CLAUDE_PLUGIN_ROOT}`, which the next upgrade orphans. It makes no
  commit in the host repo, transmits nothing, and has no `.planning/` fallback:
  a note landing in the host repo is the failure the arm exists to close.

### Changed

- **`cad-executor` ships the lean shape and says so once.** Where a task's
  `Verify:` admits two shapes, the executor builds the leaner one and records
  the declined fuller option as an `Open items:` line in its report - not as a
  deviation, whose narrowness is the signal, and not as a sixth field on the
  return digest. The posture rides behind a `Read` at the step that needs it,
  anchored by a `lib/deferred-reads.mjs` register row, so it costs the dispatch
  path nothing until it is wanted and CI fails if the read is dropped.

- **Two surfaces state their mechanic once.** `skills/cad-land/SKILL.md`'s
  guardrails stopped re-deriving the `git.auto_close` mechanic and
  `cad-executor-contract`'s static-analysis carve-out is stated once with a
  pointer, each surface re-pinned in `weight-budgets.json` in the same commit -
  both sat exactly at their pins, so the cut was invisible to CI and the re-pin
  is the only thing stopping the bytes coming back. The named keeps stand: the
  no-preselected-default block and the not-scoped-to-GitHub clause.

- **The suggest presentation rules live in one place.** `workflows/suggest.md`
  is now their only statement; `/cad-milestone`'s retune step and
  `/cad-report`'s closing pointer route there instead of restating them.


## [3.0.0] - 2026-08-12

### Added

- **`/cad-report` - the run record as receipts.** Renders a phase's
  trace.jsonl and artifacts as the story of what the tokens bought: every
  dispatch priced from its own bracket (role, rung, tokens, minutes), every
  gate's outcome named, every deviation that refuted a D-NN cited, plus
  record health (unpaired brackets, malformed lines). Read-only, no subagent,
  and a number absent from the record is reported absent, never estimated.
  `--all` gives the milestone view.

- **Self-tuning suggestions at the milestone close.** `planning.mjs trace
  suggest` reads the joined run record and returns evidence-backed config
  suggestions - a review trigger whose adjudicated fires kept coming back
  empty names its gate key, escalation pressure on a role names its effort
  key, repeated executor checkpoints name `workflow.max_plan_tasks`, a
  re-armed gate becomes a keep-it receipt, and the top spend gets a one-line
  receipt. Every rule has an evidence floor below which it stays silent, and
  `/cad-milestone`'s new retune check presents the list and applies nothing -
  the user names what changes, same discipline as review triage.

### Changed

- **The execute report leads with its verdict.** The done step ordered its
  report by production sequence with the goal-check verdict last - the one
  line the reader came for. Verdict first now. Taken from declined issue #69,
  whose second observation this was.

- **`/cad-decision-review` joins the run record.** Its `cad-reviewer` dispatch
  was the one paid worker in the spine with no lifecycle bracket - the cost
  never reached the trace. It now brackets like every other site (dispatch /
  return / checkpoint), keyed to the decision's phase, or the STATE cursor's
  phase for a PROJECT.md row. The reviewer contract also now admits this
  caller's inlined artifact: decision text arrives in the prompt, and the
  resolve-or-blocker rule binds only when the artifact is a reference - a
  literal reading could previously bail with a bogus "reference does not
  resolve" blocker instead of reviewing.

- **An advisory review persists its own findings.** The advisory arms fire
  overlapped - the `plan` trigger beside the docs commit, per-plan `diff`
  beside the next dispatch - and nothing waits for the return, so a session
  that ends first lost the findings and the trace return entirely: a full
  reviewer dispatch reporting to nobody (the first external dogfood run
  recorded exactly that). On an advisory gate the dispatch prompt now carries
  a persistence tail: the reviewer writes its findings JSON to
  `.planning/phases/<N>/REVIEW-<trigger>.md` and appends its own figureless
  return before returning, and the fire site stops closing that bracket. The
  reporting step reads the file; not-yet-on-disk is reported as in flight,
  never as a clean pass. The trade is explicit: advisory reviewer returns
  carry no token figure - findings durability over pricing fidelity.

- **A deviation that refutes a D-NN corrects the CONTEXT record.** An executor
  deviation can prove a numbered context decision's claim false against ground
  truth, but the correction lived only in the plan report while later phases
  inherit prior decisions summarized from CONTEXT.md - the falsified claim
  propagated to every planner after it. The execute summary step now appends a
  one-line `[corrected by plan-<k> deviation: <the true fact>]` annotation to
  the refuted decision's line, and the docs commit stages CONTEXT.md when it
  does.

- **The release tag moves to `/cad-land`, after the merge.** `/cad-milestone`
  cut the annotated tag at HEAD on the integration branch, before any merge -
  so a non-fast-forward land left the milestone tag naming a commit base does
  not contain, which is why this repo ran `create_tag: false` and tagged by
  hand. The close now ends at the bump commit; land cuts the tag in its
  cleanup step, on the pulled base, after the merge confirms, and still asks
  before pushing it.

- **`/cad-land` learns Forgejo/Gitea.** Host detection knew gitlab and github;
  any other remote silently lost the PR option and the unattended close.
  A remote where the `tea` CLI has a matching login now gets the full arm:
  create (via the git-publish seam first - `tea pr create` never pushes),
  merge by index, confirm merged before any cleanup.

- **The mechanical half of a milestone close is a seam.** Pruning completed
  phases from ROADMAP.md, archiving their directories, and moving shipped
  requirements into `## Shipped` rows were three orchestrator hand-surgeries
  with a recorded failure (a close that left the tree failing its own audit).
  `planning.mjs milestone-prune --label <l> --mode <delete|archive>` now does
  all three deterministically, tested, leaving PROJECT.md evolution and
  next-milestone seeding - the judgment - as prose.

- **`workflow.plan_check` defaults to false.** The checker loop and the `plan`
  review trigger are the same question asked twice - this repo's own measured
  run said so when it turned the key off for itself (~25 minutes across two
  review pipelines for one `/cad-plan`), and the shipped default never
  followed. The checker remains one key away; the `plan` trigger stays the
  standing second opinion.

- **The assumptions analyzer stops re-reading every prior phase.** Its contract
  sent it to "any context files left by prior phases", which is N-1 files by
  phase N, on the most expensive dispatch in the spine (~150k tokens each,
  measured). Prior decisions now reach it as the `<prior_decisions>` summary
  the coordinator already builds from the 3 most recent CONTEXT files; it opens
  a prior file itself only when the code contradicts a cited decision.

- **The advisory plan review overlaps the docs commit.** `/cad-plan` fired the
  `plan` trigger and waited before committing; at `advisory` the findings gate
  nothing and the commit alters no PLAN file, so the fire now rides the same
  message as the commit step and folds into the final report - the same
  overlap the per-plan `diff` review already runs. Blocking and adjudicated
  still fire-and-wait, because applied survivors edit the files the commit
  stages.

- **The dispatch bracket rides `route.mjs resolve`.** Every dispatch site paid
  a separate `trace append` Bash call to open its worker's lifecycle bracket,
  plus a copy of the omit-tokens rule; `resolve --bracket-read <csv>
  [--bracket-plan <key>]` now writes the dispatch event itself - before
  resolution, so a degraded resolve's base-agent fallback is still billed -
  and the rule is stated once in seams.md. Five sites fold; the reviewer's
  stays a standalone append because its resolve fires for backends that
  dispatch no subagent. The census counts both spellings, so a folded site
  cannot read as an unbracketed worker.

- **The shipped reviewer starts at `high`, not `xhigh`.** Four days of trace on
  this repo show 14 reviewer dispatches, every one at the top opus rung, on a
  role that fires more often than any other; several of those fires adjudicated
  to zero survivors. The top rung is what a RETRY climbs to now, which is what
  a retry rung is for. `critical` still starts at `xhigh` and retries at `max`.

- **`pre_ship` is advisory at `shipped`.** Adjudicated pre-ship at flagship
  tier was the most expensive gate in the table, firing on every land, and this
  repo had already switched it off by hand to stay usable. A break at `shipped`
  is a bug report; the branch-wide adversarial adjudication belongs at
  `critical`, where it remains.

- **`model.escalate_on_failure` defaults to false.** Both retries a measured
  `/cad-plan` run paid for were narrower jobs than the pass they followed - a
  minimal-edit revision (opus/high -> opus/xhigh) and a diff-only re-check
  (sonnet/medium -> sonnet/high). Escalation is for a dispatch that failed, not
  a scoped follow-up with less to do; it is one key away for projects that want
  it back.

- **The blocking re-arm count survives a `/clear`.** The one-round cap was
  orchestrator-context state, so a compaction between rounds handed the next
  fix a fresh re-arm - the unbounded loop, back through the window it was
  capped to close. The round is now recorded as a `rearm` outcome in the trace
  and checked against the current correlation id before the narrowed round
  fires; a genuine re-run derives a new id and gets a fresh round, and an
  unwritable trace falls back to in-context counting rather than blocking.

- **A plan no longer asserts what it cannot know.** A task's `Action` stated
  "identifiers, signatures, config keys, behavior" for code that did not exist
  yet. The planner cannot know those, so each guess reached the executor as an
  instruction that reality then contradicted. Measured on this repo's own
  history: one archived plan report carries 36 deviations, another 19, and a
  downstream project's 9 - a guessed field name (`warnings`, really
  `warning_count`), a construction that cannot work (`ENOTDIR` is not
  `ENOENT`), a call path that is not reachable, line numbers moved by earlier
  tasks in the same plan. `Action` now states what must become true and its
  constraints, names symbols that ALREADY EXIST, and never invents an
  identifier, signature, field name or call path for code the task has yet to
  write. `Verify` carries the task's authority: any implementation that
  satisfies it is authorized.
- **A deviation is one thing, not two buckets.** Departures were sorted by how
  architectural they looked - "trivial" fixed inline, "structural" stopped -
  and the trivial bucket explicitly licensed "input validation, error handling,
  security pieces". That is the clause an invented pre-parse repair pass was
  written under, in a phase where the executor's own report said no task
  described it. A deviation is now exactly one thing: an acceptance criterion
  or a locked decision turned out wrong or unachievable. Choosing a shape the
  `Action` did not picture is ordinary engineering, and is not recorded.
- **`risk_surface` fires once per plan, on the committed range.** It fired per
  risky commit, mid-plan, against a staged index. Every match halted the
  executor and cost a fresh-context continuation whose only job was writing
  code no task authorized - itself new risk surface, and the next halt. One
  measured phase spent three executor dispatches (198K, 492K, 337K tokens) on
  a single plan that way. The gate is unchanged and still blocking at every
  level; only its timing moved, so the reviewer now judges a complete change
  instead of a half-built index. `/cad-debug` and `/cad-verify` keep shape (b)
  for their single staged fix.
- The executor's `<commit_protocol>` drops its per-commit risk gate, and
  `risk_surface` is no longer one of its checkpoint types. It stops for a
  structural reason only: a `Verify` that cannot be met, a contradicted locked
  decision, or a fix needing a file outside the plan's lease.
- `cad-plan-checker` weighs `Verify` hardest, since it is now the task's whole
  authority, and treats an invented identifier in `Action` as a BLOCKER.
- `cad-assumptions-analyzer` measures an out-of-repo assumption with the
  operation the code will actually perform, and records the command, date and
  sample size beside the claim. Counting a field across a corpus is not parsing
  it, and the parse is what fails.

## [2.7.0] - 2026-08-11

The dispatch-time risk floor is gone, and with it several pieces of machinery
that cost more to maintain than they caught. The pattern under most of this
release is one thing: a mechanism firing on a measurable proxy instead of on
the property it cares about. Filenames instead of what the code does. A number
instead of a control that exists. Task count instead of task size, which is why
a count ceiling pushed toward fatter tasks. Byte counts checked into the tree
instead of measured on demand. Each was defensible alone; together they are why
the tool got slow, because every proxy brings its own config key, CI check and
prose surface.

The floor read the paths a phase's PLAN declared, matched them against ~100
common lowercase tokens, and raised the WHOLE phase to `critical` on one hit -
all six roles to opus at `xhigh`, and `plan`, `phase_diff` and `pre_ship` all
adjudicated at once. It judged a file by its name. Measured on a
transcript-recall project: `src/store/session.rs` floored phase 1 on `auth`,
`src/store/lock.rs` and `src/ingest/mod.rs` floored phase 2 on `concurrency`
and `untrusted_input`, and no phase of that project could ever route below
`critical`. 15 of 16 resolves ran opus, 9 of 16 at `xhigh`, against a README
claim of ~27% routed down to Sonnet. `tests/ingest_concurrency.rs` - a test
file - floored its phase on two surfaces at once.

Cadence already had a better detector for the same question. The commit-time
`risk_surface` check reads the actual staged diff, and it stays, blocking at
every level. What the code does decides; what the file is called does not.

### Changed

- **The `shipped` review row: `plan` adjudicated -> advisory, `diff` advisory ->
  off.** A plan at `shipped` has already passed `cad-plan-checker`, a blocking
  gate on by default, so `fire(plan)` was a second adversarial pass over the
  same artifact and adjudicated added a user-triage turn on top. Measured:
  checker 8.8 min, reviewer 12.5 min, then a 13-survivor menu. And
  `workflows/execute.md` states the `diff` cost itself - at advisory the fire is
  overlapped with the next plan's dispatch and costs nothing, but "the last plan
  has no next dispatch, so it fires and waits." On a single-plan phase every
  fire is the last one: 32 minutes of serial tail for findings that gate
  nothing. Coverage at `shipped` is now `risk_surface` blocking per risky commit
  and `pre_ship` adjudicated over the whole branch. `critical` is untouched.
  `phase_diff` was NOT changed: it fires on the parallel path only, so turning
  it off would have saved a sequential phase nothing.

- **The task ceiling is PER PLAN, and it is counted.** `max_plan_tasks` is named
  per plan while `plan.md` said "delivering this PHASE"; one tree read it both
  ways, shipping 8 tasks in one plan and then 4+4+4 across three. Per-plan is
  the reading that makes the remedy obvious. `planning.mjs plan-size` counts the
  written plan against it at a new `check_size` step, and counts the
  requirements a phase's ROADMAP block names at `parse`, BEFORE a planner is
  dispatched - learning a phase is too big cost 10-14 minutes of planner and now
  costs a count. The measured case: a phase naming 25 of 46 requirements was
  planned as 8 tasks against a ceiling of 4, by a planner handed the ceiling and
  a checker told to flag the overrun. Both passed it.

- **The PHASE TOO BIG prompt has three options, and the recommended one was
  previously forbidden.** Splitting into sequential plans inside the phase was
  ruled out on the grounds that `plan-overlap` refuses two plans declaring the
  same path. It does not; it reports the shared path so the caller knows the
  plans are sequential, and the tree that hit this had already shipped a
  sequential three-plan phase.

- **`docs/EVIDENCE.md` keeps the definitions and drops the numbers.** About two
  hundred measured figures across six asserted tables were derived data carried
  in the tree. One byte changed in any of 99 surfaces could stale five tables at
  once. Falsified after the cut: one appended sentence now yields ONE
  `budget-overrun` naming the file that grew, against six signals across four
  untouched tables before. `prose-agreement.test.mjs` falls 455 -> 246 lines.
  No check weakened - the byte ceiling and `unbudgeted-surface` both stand, and
  `weight.mjs` still measures on demand.

- **The weight budget is a ceiling, not an equality.** `budget-undershoot` fired
  on any shrink, so every prose cut turned CI red until its row was re-pinned in
  the same commit, taxing a removal at the rate it taxed growth.

- **Prose no longer restates measured byte figures.** Eleven deferral sites
  across eight files carried a hardcoded size that a test then verified against
  the live tree. The consult-site count stays inline - that is what the deferral
  rule turns on. Cite the file, not its size.

### Removed

- **The `surfaces` block, `lib/risk-surfaces.mjs`, and `riskFloor()`.** With
  them: the `floor_surfaces` trace field, `PRE_PLAN_ROLES` (which existed only
  to exempt the two pre-plan roles from a floor computed off the wrong phase),
  `declaredPhaseFiles`, the repo-scope write guard and its `fsIdentity` helper,
  and `route-cells.mjs`'s `floor-below-required` arm. `surfaceIssues` narrows
  to `vocabularyIssues`: its two drift checks are about `stakes_order` and
  `gates`, which outlive the block they were filed under. Net -2,260 lines.

- **The eight `risk.override.<surface>` config keys**, moved to
  `lib/retired-keys.mjs`, which grows a per-key `since` because the map now
  spans two milestones. A config still carrying one resolves at its configured
  stakes level and names the key in `warnings` - it warns, it does not break.

- **`budget-undershoot`.** The weight budget is a CEILING now, not an equality.
  Exactness was tried in 2.6.1 and taxed a cut at the rate it taxed growth:
  every prose removal, however obviously good, turned CI red until its
  `weight-budgets.json` row was re-pinned in the same commit. `budget-overrun`
  catches the direction that is actually a risk and does the whole job.

- **Byte figures restated in prose.** Eleven deferral sites across eight files
  carried a hardcoded size that `prose-agreement.test.mjs` then verified against
  the live tree, so editing one reference dragged four unrelated files and a
  doc regeneration behind it. The consult-site count stays inline - that is the
  number the deferral rule actually turns on. `weight.mjs` reports the size on
  demand. `references/seams.md`'s mandate now says: cite the file, not its size.

### Added

- **`cadence-core/bin/test.mjs`, the suite by group.** 1,367 tests in one arm
  meant a routing change re-ran the git-publish seams.
  `node cadence-core/bin/test.mjs routing` is ~2.5s against ~11.5s for the
  tree, and CI runs one job per group so a red arm names the seam that broke.
  Groups are declared in the runner rather than a manifest beside it, because
  nothing else reads them. There is deliberately no coverage check: a stem no
  group names lands in `other`, which the default run and the CI matrix both
  execute, so a new test file runs from the moment it exists.

### Fixed

- **`review-provider.test.mjs` wrote into Cadence's own run record.** The seam
  resolves its trace root as the cwd-relative `.planning`, which is correct in
  production, where cwd IS the project - but the test harness spawned without a
  `cwd`, so it inherited the runner's. The live `.planning/trace.jsonl` held
  1,443 fixture rows against 33 real ones, which is what made it useless for
  reading real provider latency out of. Both spawn sites now run in the temp
  dir the rest of the file already used.

## [2.6.2] - 2026-08-10

What the plugin carries on turn one, and what it can wait to read. Three
phases, 21 commits, 269,045 B of eager prose down to 252,653 B summed across
the 23 user-invocable commands. `/cad-config` alone falls from 20,547 B to
12,770 B.

The sweep that scoped this cycle also falsified the obvious hypothesis, and
that is why the cycle looks the way it does. Skill frontmatter `description:`
fields, the suspected bloat, total 3,730 B across all 29 skills, against
27,940 B for `workflows/execute.md` alone. One command's eager include
outweighed the entire description surface by 7x, and descriptions are what
make the model select the right command at all. Nothing here touches them.

The ordering was the design. This tree had shipped a 5,792 B eager include
that nothing ever read, defended in a `CHANGELOG` entry by a comparison that
was false on inspection. Cutting prose before closing the CI holes that let
that happen would have meant cutting on exactly the evidence that produced the
defect, so the checks came first and the cuts came second.

### Added

- **Two self-verify checks that make a deferral watchable.** Check 13 can now
  anchor a deferral whose `Read` sentence lives in a `cadence-core/workflows/*.md`
  `<step name="...">` region or inside a `skills/cad-*-contract/SKILL.md`, not
  only in a top-level numbered step of a user-invocable skill. Check 16 fails an
  `@`-include whose surface nothing in that command's reachable prose ever names,
  which is the class the dead include belonged to. `cad-help`'s `COMMANDS.md`
  include passes, because the workflow IS the surface there - the legitimate
  shape the dead one was wrongly compared to.

- **Six on-demand references, each read at the step that needs it.**
  `references/config-catalog.md` (the knob catalog, read at the interactive
  walk), `references/plan-revision.md` (read only when the plan checker returns
  a BLOCKER), `references/execute-parallel.md` (read only on the opt-in parallel
  path), `references/worktree-executor.md` (read only by a worktree executor),
  `references/recall.md` (read from `context.md` and `debug.md`), and
  `templates/CONTEXT.md`. Each carries a `weight-budgets.json` row and a register
  row whose falsifier was watched to fail: delete the one `Read` sentence and
  `self-verify` names that row.

### Changed

- **The register now covers promotion, not only re-deferral.** All four rows it
  shipped with pointed at prose that had once been an `@`-include, so the
  `stillEager` arm did the work. The seven rows added here anchor prose that was
  never an include at all, and their protection is the anchor alone.

- **`prose-agreement.test.mjs` scans instead of asserting one site.** The
  measured-bytes check was a single hardcoded figure; it now scans every skill,
  workflow and reference for a `\d{1,3}(,\d{3})* B` figure and holds each to
  `weight-budgets.json`. A coverage arm additionally requires each register row's
  `Read` sentence to state its reference's bytes and consult-site count, with the
  three `cad-land` rows `seams.md` grandfathers named explicitly rather than
  silently skipped.

- **Rationale addressed to a human maintainer moved to `.mjs` headers and
  design-notes; rationale bound to a rule the model applies at runtime stayed
  put.** `self-verify` structurally cannot tell those apart, so each surface got
  its own commit and its own UAT walk rather than one bulk edit.

- **Decision fidelity in `cad-planner`'s contract now binds in both
  directions.** Delivering MORE than a locked decision states is scope
  invention, not thoroughness: one locked check licenses no second check beside
  it, and a rule locked for new work is never widened to what already shipped.
  Extra work that looks necessary goes in the return marker for the human.

### Fixed

- **Four drifts the sweep found in passing:** the nonexistent `start` step cited
  in `execute.md`, `workflow.test_command` resolved on the sequential path but
  read only on the parallel one, `config-reach.md`'s wrong reach site for the
  three `parallelization.*` keys, and `seams.md`'s claim of a git-guard consult
  in `cad-land` guardrails that cite none.

- **The dead `@`-include is gone.** `skills/cad-verify/SKILL.md` no longer
  includes `templates/UAT.md`; the template stays on disk as the seam's spec.
  Check 16 was proved against that live instance before it was deleted, rather
  than against a synthetic one.

### Known gaps

- The register anchors a `Read` in a skill, workflow or contract, never one
  nested inside a reference. `references/execute-parallel.md` now holds the only
  "re-read the triage gate" instruction for the parallel path's adjudicated
  arms, and deleting those two sentences is invisible to CI. The sequential
  path's copies are unaffected.

- The new coverage arm requires the word `site` in a `Read` sentence but never
  parses the count, so a wrong consult-site number would pass.

- Five walk items proving each deferred reference is actually read at its step
  need a live run against an installed build and were skipped at the verify
  gate, not passed. They are recorded in `.planning/phases/3/UAT.md`.

## [2.6.1] - 2026-08-09

The four defects `2.6.0`'s own doc sweep found and filed rather than reworded
away, plus what the pre-ship review caught on the way out. One phase and a
review pass, 14 commits. Every fix here ships with a check that was watched to
fail against the unpatched code first, because a check nobody has seen fail is
a guess wearing a verdict.

The review pass is why this is 14 commits and not six. A cross-model reviewer
over the branch diff returned eight findings and every one of them held up
against the tree, including a blocking review gate that could not fire at all
and a harvester reporting itself as technical debt. Two of them were defects in
the fixes for the other six, caught by re-firing the same gate against the tree
that actually ships.

### Fixed

- **`cadence-core/bin/lib/trace.mjs` no longer contains two literal NUL bytes.**
  They were typed into the worker key's template string instead of the `\0`
  escape, so `file(1)` called the source `data` and every `grep` or `rg` over
  `cadence-core/bin/**` silently skipped that whole file without `-a`. It cost me
  a debugging detour during 2.6.0's UAT and it would have cost the next one too.
  The separator is still U+0000 at runtime, only the source bytes changed.
  `self-verify` gained check 15, `nul-byte-in-source`, over every regular file
  under `cadence-core/bin` including the test files, so it cannot come back.

- **The `phase_diff` gate row said `off / off / adjudicated` while the resolver
  returned `off / advisory / adjudicated`.** Wrong in
  `cadence-core/references/review-triggers.md` and in `docs/WORKFLOW.md`'s copy
  of it, and four of 2.6.0's eighteen stale doc rows were that one row copied.
  A new `prose-agreement.test.mjs` drives `route.mjs resolve` at all three stakes
  levels and compares both prose sites to what actually comes back, so the copy
  cannot drift from the code again.

- **The plan checker's contract contradicted itself about its own size.** `:42`
  said "Check six dimensions" and listed six, while `:113`'s success criterion
  still said "All five dimensions checked." A checker whose completion
  criterion names five of six can report success having skipped the
  dimension 2.5.0 shipped a cycle early to bound plan size. The count is now
  pinned three ways: the number in each block, and the number of dimensions
  actually enumerated between them.

- **The `risk_surface` wiring row admitted shape (c) only as "the flagged-diff
  FILE path the checkpoint returned."** `/cad-task` is the one fire site with no
  executor and no checkpoint, so it produced a shape-(c) path the row did not
  describe. The qualifier is gone; `cadence-core/workflows/task.md` keeps its
  named transient path, its never-stage rule and its delete-on-return cleanup.

- **`/cad-task`'s `risk_surface` fire could not run at all on the inline path.**
  The step told the model to write the flagged diff to
  `.planning/tasks/{slug}/risk-task-{slug}.diff`, but `{slug}` and that
  directory are created only by the PLANNED path, which itself declines to
  create them when `.planning/` is absent. On an inline task, or in any repo
  with no `.planning/`, the redirect failed `No such file or directory` and the
  trigger is `blocking` at every level, so this was a blocking gate that could
  not fire rather than one that passed. The planned path keeps the named path
  it already owns; inline writes to `${TMPDIR:-/tmp}` and leaves no directory
  behind.

- **`trace append --tokens 146,405` no longer throws the whole append away.**
  A malformed `--tokens` appends nothing by design, so that the caller cannot
  believe a figure was recorded when it was dropped. But this plugin prints
  token figures comma-grouped three lines above the order that copies them, so
  the grouped form is the transcription its own prose models. Refusing it left
  the `dispatch` half of the bracket open and the worker stranded `unpaired`
  forever, which escalates a recording error into loss of the bracket it was
  recording. Grouping is stripped only in the strict 3-digit shape, so `1,2,3`
  and `146,40` are still refused.

- **The technical-debt harvester stopped reporting itself as technical debt.**
  `markerSegments`' doc comment spelled the marker token followed by a colon,
  so `debt-harvest` found exactly one marker in the whole tree and it was the
  file doing the finding: a corner-cut that does not exist, landing in the
  queue a human triages. Both the note above `DEBT_TOKEN` and
  `conventions.md` already stated that documentation never writes a literal
  marker line.

- **The four `docs/EVIDENCE.md` tables nothing was checking are now pinned.**
  The byte checks above covered the twelve-largest table and the per-directory
  subtotals. The turn-one table, eager-vs-reachable, zero-resident and dispatch
  are measured by a different seam and were asserted against nothing, so adding
  a sentence to any workflow and re-pinning its budget left `/cad-execute`'s
  turn-one and reachable figures both silently wrong. The file also stops
  naming a provenance commit, which is the same staleness one level up.

- **The planning docs agree on which milestone is open.** The `v2.6.1` close
  ran the manifest bump and the phase prune and stopped, leaving `DFC-01..04`
  pointing at a phase the prune had removed: `/cad-audit` returned 4/4 broken,
  a hard FAIL, so the next milestone would have halted at its own gate before
  it could tag. `PROJECT.md` separately still called `v2.5.0` the current
  release, two releases behind the manifest, and `CONTRIBUTING.md` still
  described the byte-budget check as failing only on growth.

### Changed

- **A budgeted surface now fails `self-verify` when it SHRINKS, not just when it
  grows.** `docs/EVIDENCE.md` published "93 surfaces at exactly their byte count,
  total slack 0" as if that were enforced. It was a maintenance convention: the
  check read `bytes > budget`, so any deletion sailed through and the entry went
  stale in silence. That is how `review-triggers.md` came to be quoted at
  17,733 B in four places at once. The new `budget-undershoot` kind names the
  direction, and the four sites quoting that file's size moved together to 17,714
  with a `weighAll`-backed test over every row of the twelve-largest table.

## [2.6.0] - 2026-08-09

The reconciliation cycle. `2.5.0` closed early and handed this release its
deferred half, so nothing here is new construction: it is the queue nobody could
read, the friction you hit by hand every session, the defects Cadence's own
seams hit on other people's projects, and the first honest measurement of what a
phase costs. 73 commits across five phases.

Three of the five phases were scoped by running Cadence against real projects
rather than by reading its own source. A parser pass planned from reading
`planning-files.mjs` was cut when running that parser over every plan file in
five live projects produced zero issues, and the two things the same survey found
actually broken took its place.

### Added

- **Per-role token accounting.** `trace append` takes `--tokens`, `--role` and
  `--read` on lifecycle events, and `planning.mjs trace render` and
  `/cad-progress --trace` print what each role cost and how many dispatches it
  took. A role that ran without a token figure reports an `unrecorded` dispatch
  count beside its total rather than a zero, because those are different claims.
  All five phase-scoped dispatch sites now bracket their workers, held in place
  by a per-file census in the test suite. Before this, 71% of subagent spend
  happened at sites nothing was measuring: 206,901 tokens for the assumptions
  analyzer, 346,882 for planner plus checker plus revision, 219,068 for two
  reviewers, against 310,503 for the only two sites that were bracketed.

- **A runaway-loop bound on every dispatched agent.** All 19 rung files carry
  `maxTurns: 400`. A spike ran first to establish what the host actually returns
  at the cap, because shipping a value that converts a long executor run into a
  failed dispatch would have been worse than no bound at all.

- **`CADENCE-DEBT` markers and a harvest seam.** A deliberate corner-cut carries
  a marker at its location naming its ceiling and the trigger that should prompt
  revisiting it, and `planning.mjs debt-harvest` collects them into
  `.planning/CAPTURE.md`. Idempotent, with its own regression test, because the
  queue is a regenerable view and the marker in tracked code is the record.

- **A committed doc-claim ledger.** `.planning/DOCS-CLAIMS.md` holds every claim
  a `/cad-docs-verify` sweep raised with its verdict and its resolution, so the
  next cycle re-verifies a fixed set of ids instead of re-extracting from scratch
  and calling the difference progress.

- **`docs/EVIDENCE.md`.** Turn-one bytes for all 23 commands, eager against
  reachable for the ten heaviest, dispatch bytes for all 19 rung agents, each
  table printed beside the exact `weight.mjs` command that regenerates it.

### Changed

- **The verify walk runs what it can before it asks you anything.** `/cad-verify`
  now states the bar out loud: an item is a human check only when the model
  cannot execute it, meaning irreversible against real data, or outside its reach
  (credentials, a GUI, hardware, another machine). Everything else is executed
  and cited as a results table. A walk of nine read-only commands and one
  destructive one ends the turn asking about one item, not ten. Model-executed
  results carry their own provenance, distinct from a user's answer and from a
  verifier's.

- **The capture queue stops being append-only.** 213 open items became 28
  current-cycle items each carrying a dated, tree-backed verdict, with the 185
  historical ones moved under a single dated `## Archive` block that
  `planning.mjs recall` cannot see. That file is the input to every planning
  dispatch's recall, so its noise was being paid for on every one.

- **Phase directories are numeric-only, and Cadence says so.** `08-meteogram-legend`
  is not a phase directory, `/cad-health` reports one as a violation, and a
  numeric-prefix collision produces a named diagnostic instead of one directory
  silently shadowing the other. This is a breaking change for a project using
  named directories, taken deliberately: the seams were already unusable there,
  and an honest refusal beats a clean wrong answer.

### Fixed

- **A blocking review can no longer re-arm without bound on its own fix.** The
  cap is one round, written once in the consequence gate every fire site shares,
  so it reaches `/cad-execute`, `/cad-task`, `/cad-debug`, `/cad-verify` and the
  git guard rather than one of them. Exceeding it hands the remainder to you with
  a named reason.

- **A planning-doc version the project already published is caught at the ship
  gate.** `/cad-audit` emits a verdict-moving `version_drift` break, compared
  against the repo's own git tags rather than the plugin manifest, which resolves
  relative to the script and would have compared your milestone against Cadence's
  version in any project that is not this one. That is issue #87's failure mode,
  which happened on this repo in July.

- **A project Cadence creates keeps its run record out of git.**
  `execute.md` asserted `.planning/trace.jsonl` "is gitignored" as the reason a
  worktree's trace cannot ride a merge back, and nothing in Cadence wrote that
  line. It held here only because it was added by hand. Every other Cadence
  project was committing its routing, provider and worker events on the next
  `git add .planning`.

- **`--phase` carries the string you typed, at every seam that takes it.**
  `--phase 1.10` was reading `phases/1.1` and answering about a different phase.

- **`REQ_ID_EXACT` admits `2FA-01`.** A requirement id whose category does not
  start with a letter was refused, a regression from `1.4.0`.

- **18 stale claims across `README.md`, `METHOD.md`, `INTERNALS.md`,
  `CONTRIBUTING.md` and six workflow files.** A full sweep of the doc surface
  checked 547 claims against the live code: 509 accurate, 18 stale, 20 that
  cannot be settled mechanically. Every stale one is corrected against its own
  evidence or recorded as a divergence with the reason it stands. Four turned out
  to describe real defects rather than stale prose and are filed as their own
  requirements instead of being reworded away, including a wiring-table row that
  was the single source of four separate wrong claims, and two literal NUL bytes
  in `lib/trace.mjs` that make `grep` skip that file without `-a`.

## [2.5.0] - 2026-08-08

Scoped down at the close. This release ships the benchmark quick wins and the
context-reduction pass; queue triage, live friction, parser defects and the doc
sweep move to `2.6.0` whole. The reason is the last item below: a plan-size
ceiling cannot bound anything until it ships, and four more phases planned
without it would have been planned by the gates that made it necessary.

### Added

- **A static-analysis path that works unconfigured.** `workflow.lint_command`
  exists across all five config surfaces, but when it is unset the executor now
  detects the project's own lint and typecheck commands from its manifests
  (`planning.mjs detect-commands`) instead of skipping the step. The contract
  runs it after a task's edits and before its commit, and treats a failure as a
  blocker with the same three bounded attempts as anything else. Both
  `cad-executor` rungs also carry the `LSP` tool grant, inert rather than
  erroring where no code-intelligence plugin is installed.

- **One joined trace per phase.** A gitignored, bounded `.planning/trace.jsonl`
  records routing decisions, provider requests, worker lifecycle and accepted
  outcomes against a single correlation id, so a worker, a retry and a
  verification branch each attribute to the task that caused them.
  `planning.mjs trace` renders it and `/cad-progress --trace` displays it.
  Writing to it cannot change a seam's envelope or block the spine - proved by
  running the resolve path with `.planning/` unwritable and diffing the envelope
  byte for byte.

- **File leases are enforced, not just compared.** `plan-overlap` checked
  declared `files:` lists once before dispatch and nothing held a worker to its
  own declaration afterward. `planning.mjs lease-check` now refuses a staged
  path outside the plan's list and names it, and the executor contract turns
  that refusal into a blocked checkpoint rather than a commit.

- **`weight.mjs resident`** composes what a flat per-file list could not: eager
  bytes, reachable bytes per command, and dispatch bytes per role. The ranking
  inverts between definitions, so it reports both.

- **`workflow.max_plan_tasks`**, default 8. See Changed.

### Changed

- **The plan gates ask about size.** Nothing bounded plan size, and nothing
  noticed: this cycle's own phase 3 was planned at 10 tasks, cut, replanned at
  15, and passed every gate both times. Two causes, both fixed.
  `cad-plan-checker`'s dimension 5 asked for scope fidelity and "roughly <= 10
  tasks" in one sentence, and those pull opposite ways, so the size half lost
  every time - it is now a separate dimension asked independently of whether the
  plan achieves the goal, defaulting to WARNING because an oversized plan still
  ships. And `cad-planner` now receives the ceiling in its dispatch and must
  return `## PHASE TOO BIG` rather than exceed it, which resolves the standing
  contradiction between that marker and the contract's prohibition on reducing
  scope: reporting an overrun is not a cut. A `## PHASE TOO BIG` now routes to
  `/cad-phase add` for small independent phases rather than more plans inside
  one phase, because `plan-overlap` correctly refuses two plans sharing a path,
  so plans cannot run concurrently where phases can.

- **`cad-land` and `cad-plan-review` stop eagerly preloading references they
  read at one step**, dropping `cad-land` below the workhorse mean. Self-verify
  now fails when a de-preloaded reference has no `Read` anchored to the arm that
  needs it, so the saving cannot silently become a missing read.

### Fixed

- **A version the repo already published no longer passes as current.**
  `git-branch.mjs decide` refused by sort order against the highest tag, which
  refused strictly more milestones than it should: an untagged maintenance
  version that merely sorted low was rejected with a reason asserting a tag that
  did not exist. It now tests tag membership. `/cad-health` reports a
  `PROJECT.md ### Active` version that does not sort above the shipped manifest,
  naming both numbers - the failure mode that renamed this very cycle from
  `2.4.0` mid-flight.

- **Worker brackets pair within a correlation id, never across runs.** Trace
  pairing keyed on `(phase, plan)` and ignored `corr`, so a re-run closed the
  previous run's dangling dispatch with the new run's terminal event and named
  the wrong worker unpaired.

- **A torn config layer is named, not silently defaulted.** The git-guard path
  reverted to default `protected_branches` when a layer failed to parse; it now
  asks, naming whichever layer tore, on any branch.

- **Provider drop-outs are recorded before the wire, not only past it**, so a
  reviewer that never reached the request is still named rather than quietly
  reducing a panel to one voice while the gate reports clean.

- **Dependency lockfiles stop matching the `concurrency` risk surface**, which
  had been pinning every Rust, Node, Python and Ruby phase to `critical` on the
  presence of a lockfile. Matching is by an allowlist of names now.
  `phase_diff` also resolves the same through all three surfaces that decide it,
  so a scaffolded repo config no longer overrides `critical`'s `adjudicated`
  with `off`.

- **Smaller seam corrections:** the staged set is read so renames and non-ASCII
  paths are seen; the starting index is checked once upstream rather than per
  named path; `weight.mjs` fails a valueless flag instead of silently measuring
  the plugin tree; and a missing `CONTRACTS` row is a self-verify problem rather
  than a silent opt-out of the flag lint.

## [2.4.0] - 2026-08-07

### Changed

- **`parallelization.enabled` now defaults to true.** Off becomes the
  intentional switch. The template ships it on, and the schema records that it
  engages only when the plans are provably independent AND the host's
  `worktree.baseRef` is `"head"` - `choose_path` already falls back to
  sequential otherwise, so the new default is safe on a host that cannot honour
  it.

- **The plan-checker re-check after a revision is now narrow.** It takes the
  revision's own diff plus the blocker list it is confirming, and asks whether
  each blocker closed and whether the fix introduced anything new - instead of a
  second full cold pass over ROADMAP, REQUIREMENTS, CONTEXT and the sources it
  had already read. Measured, that full second pass was ten minutes to convert
  two blockers into one. What it gives up is stated where it is specified: a fix
  that is locally right and wrong against CONTEXT can survive a narrow pass, and
  the `plan` review trigger remains the full-artifact second opinion.

### Fixed

- **Parallel execution could never be switched on by hand, and said nothing.**
  The `worktree.baseRef` step in `/cad-config` - the only thing in Cadence that
  sets the host precondition the parallel `/cad-execute` path depends on - was
  gated on `parallelization.enabled` already being true, and `enabled` defaulted
  to false. So a fresh project skipped the step silently, and a user who then
  turned parallelization on by editing `config.json` directly never reached the
  step that would make it work. `choose_path` correctly resolved
  `parallelSafe: false` and fell back to sequential, once per run, forever. Two
  projects here carried `enabled: true` and had never once run a plan in
  parallel.

  Three changes close the loop. The `/cad-config` step now runs whenever
  `use_worktrees` is true, without also requiring `enabled` - the circular half.
  `choose_path` now OFFERS the one-key fix inline through the ask-user seam at
  the moment the user is demonstrably affected, and continues on the parallel
  path when they accept, instead of naming another command to go run. And
  `/cad-health` reports the dead combination up front.

- **`/cad-health` now reports config that is ON but inert.** A setting the user
  believes they have, which cannot take effect, is worse than one they know is
  off - they never see the behaviour missing.

  The case that prompted this: `parallelization.enabled` true while
  `worktree-base.mjs resolve` returns `parallelSafe: false`. `baseRef` is unset
  by default, unset resolves to `"fresh"`, and `fresh` means a worktree forks
  from the remote default branch without the phase's unpushed CONTEXT and PLAN
  files - so every executor would halt `blocked` and `choose_path` correctly
  falls back to sequential. Correct, and silent unless you happened to be
  reading closely mid-run. Two projects here carried `enabled: true` and had never
  once run a plan in parallel.

  Health now also flags `enabled` true with `use_worktrees` false, a
  `review.reviewers` provider with no resolvable credential (presence only, a
  key's value is never read or printed), and a config block the schema declares
  as an object that is not one - `"parallelization": true` silently reads every
  key inside it as its default, which two configs here were doing.

- **An advisory `diff` review no longer blocks the next plan's executor.** On
  `/cad-execute`'s sequential path the per-plan `diff` trigger now fires in the
  same message as the next plan's dispatch instead of being waited on first.

  The artifact is already a pair of refs, so the reviewer diffs two immutable
  commits and reads nothing the next executor writes, and `advisory` continues
  whatever the review returns - so nothing downstream was ever waiting on the
  answer. Serializing them bought no safety and cost the review's full wall time
  once per plan. Measured on a three-plan phase: 15.7 minutes of execution
  carried 16.4 minutes of advisory review behind it, which is to say the reviews
  cost more than the work they reviewed, and about half of that was recoverable.

  The overlap is `advisory`-only and deliberately so. At `adjudicated` the fire
  still blocks before the next dispatch, because triage can change what ships and
  a user answering about plan 1 while plan 2 is already committing is answering
  about a tree that no longer exists. The `risk_surface` arm is untouched: a
  matched surface still halts at commit time. The last plan in a phase has no
  next dispatch to ride along with, so it fires and waits as before.

## [2.3.0] - 2026-08-05

### Changed

- **A subagent's full output no longer stays resident in the context that
  dispatched it.** The content is identical; only where the bytes live and when
  they load changed.

  `cad-executor` now writes its report to `<plandir>/reports/plan-<k>.md` after
  every task commit and returns a five-field digest - status, task count, commit
  range, deviation count, open-item count. No task table, no deviation text and
  no open-item text rides any return, checkpoints included. The path is derived
  from the plan file's own directory, so `/cad-execute` writes under
  `.planning/phases/<N>/` and `/cad-task` beside its own plan. A `PLAN PARTIAL`,
  timeout or checkpoint continuation is built from that file, so a re-run cannot
  re-execute a task the file already lists complete. In worktree mode the
  executor commits the report itself, by pathspec, which is what carries it
  across the merge without sweeping in a `risk_surface` checkpoint's
  deliberately-uncommitted staged files.

  `cad-verifier` writes exactly one file, `.planning/phases/<N>/verifier-findings.json`,
  in the `uat merge` payload shape, and returns a digest plus that path. It is
  deliberately NOT named `FINDINGS.json`: the seam owns that name and overwrites
  it on every successful merge, so a verifier writing it would destroy its own
  input. `/cad-verify --deep` pipes the file straight in, and the
  hand-transcription step between the two is gone.

  Reviewers receive a reference, never artifact bytes: a `{base_ref, head_ref}`
  pair, a staged-diff scope to re-run in the cwd it inherits, or a path. Every
  fire site - `diff`, `risk_surface`, `phase_diff`, `pre_ship`, `plan` - names
  the shape it uses. Cross-model reviewers, which can run nothing themselves,
  get a composed `--payload <file>`.

  `cadence-core/references/seams.md` now states the break-even rule the pattern
  rests on, so the judgment is written down rather than re-derived per site: a
  file round-trip costs one extra turn and pays only when the read-back folds
  into a turn the parent was taking anyway AND the artifact lands late enough
  that the bytes would otherwise ride every remaining turn.

- **`cad-verifier` gains `Write`, narrowly, and self-verify asserts the
  boundary.** `Write` is on all four rungs; `Edit` and `MultiEdit` stay in
  `disallowedTools`. Agent frontmatter exposes no path-scoped tool permission,
  so a blocking self-verify check (`verifier-write-grant`) asserts the grant and
  both denials on every rung, in both directions. Without it the milestone's one
  deliberate exception could widen silently in a later edit.

- **`planning.mjs uat merge` takes `--payload <file>` and refuses a bad
  envelope.** Two live holes are closed. A literal `null` payload used to exit 0
  printing nothing at all, from a seam whose entire contract is one JSON line;
  and any parseable non-payload JSON, `"hello"` or `{}` included, used to merge
  as an all-zero `ok:true` success, so a truncated findings file reported a
  clean deep pass instead of falling through to the human walk. Both now refuse
  with a named reason (`no-payload` / `bad-payload`) and exit 1, before
  `loadUat` and before any write, leaving UAT.md and FINDINGS.json
  byte-identical. `uat init` and `uat refresh` share the reader and gain the
  same refusal. Stdin still works unchanged when the flag is absent.

  `assertUnderCap` is deliberately UNCHANGED. It still measures the parsed
  string fields, which under `--payload <file>` already ARE the file's
  contents, so a payload's contents are bounded exactly as before. Measuring
  raw bytes instead would count JSON escaping and the `{instruction, artifact}`
  envelope, and a payload that passes today would newly refuse `over-cap` at
  the same `review.max_prompt_tokens` - a behaviour change inside a
  transport-only cycle.

- **Every eager `@`-include in `skills/` carries a stated keep-or-move
  reason.** The break-even rule in `cadence-core/references/seams.md` now covers
  any deferred read rather than a subagent round-trip alone, so each call below
  cites it exactly instead of by analogy: deferring pays when the read folds
  into a turn the command was taking anyway AND only some branches reach it, and
  an extra tool call inside a turn already being taken counts as folded while a
  read that forces a new turn does not.

  The tree carries 26 include lines across 21 skills. The 17 workflow includes
  all stay eager - a skill's own workflow is its entire body, consulted on every
  path - and so do `cad-help`'s `COMMANDS.md` and `cad-verify`'s
  `templates/UAT.md`, for the same reason. `cad-plan-review` and `cad-land` keep
  `references/review-triggers.md` eager as an explicit KEEP rather than an
  oversight: `cad-plan-review`'s whole body is one `fire('plan')`, and every
  `/cad-land` run fires `pre_ship`. What moved: the four guard-only skills
  (`/cad-phase`, `/cad-pause`, `/cad-undo`, `/cad-milestone`) and `/cad-land`
  swapped `references/git.md` for `references/git-guard.md`, with the publish
  half deferred to the `/cad-land` step that acts on it, and `cad-pause`'s
  `references/conventions.md` include is gone, leaving `conventions.md` eager
  nowhere in the plugin.

  Measured turn-one totals the calls were made against (SKILL.md plus every
  `@`-included file, before this cycle's edits): `cad-land` 36,235 ·
  `cad-milestone` 20,855 · `cad-verify` 19,834 · `cad-config` 19,601 ·
  `cad-pause` 18,523 · `cad-execute` 18,452 · `cad-plan-review` 18,182 ·
  `cad-context` 17,233 · `cad-phase` 15,941 · `cad-undo` 15,633 · `cad-plan`
  15,584 · `cad-new-project` 15,349.

  Two things a reader should keep an eye on. The `/cad-land` guard include
  stays eager only while every run reaches rails 1-2 through its steps 1, 2 and
  triage commits; a `/cad-land` path that commits nothing would make that
  include a candidate in its own right. And the two new reference files got no
  `weight-budgets.json` entry when they were created, because
  `cadence-core/bin/lib/surface-weight.mjs` walked only `agents/*.md`,
  `skills/**/SKILL.md` and `cadence-core/workflows/*.md` at the time; the last
  entry in these notes closes that gap and budgets them along with the rest of
  `references/`.

- **The adjudicated review triage gate is now a tapped multi-select, and it
  lives in its own reference.** The gate used to mandate "open-ended prose, not
  `AskUserQuestion`", which turned every adjudicated review into a wall of
  findings to read and answer in free text. It is now `AskUserQuestion` with
  `multiSelect: true`, NONE still first and still the default, and the turn
  still ends on the question. The batch arithmetic is stated as two caps rather
  than one, because collapsing them is what produces a malformed prompt:
  survivors are OPTIONS inside a question and NONE occupies one of the four
  option slots, so N survivors become `ceil(N/3)` questions, and those questions
  batch four per call. An answer that comes back with NONE selected alongside
  survivors is contradictory and re-asks that one question rather than guessing
  which half was meant.

  `§ 6 Consequence` moved out of the 15.7 KB `references/review-triggers.md`
  into a 3.0 KB `references/triage-gate.md`, so the five sites that consult it -
  three in `execute.md`, one each in `plan.md` and `verify.md` - read the gate
  instead of the whole trigger file; `review-triggers.md` keeps a pointer.

  One behavior fix rode along. The `git.auto_close` carve-out that suppresses
  the triage prompt sat in the generic adjudicated arm, so a repo opting into
  the unattended land close suppressed the prompt at EVERY adjudicated gate -
  including `plan` and `diff`, where `land-cleanup.mjs gate` does not run and so
  nothing was left to halt on the discarded survivors. It is now scoped to
  `pre_ship` inside `/cad-land`, which is what the decision always said.

- **The 17 `conventions.md` citations in `cadence-core/workflows/` read at their
  own sites.** Each was a bare parenthetical pointing at a file the workflow
  does not load, so the rule it named was unreachable at the moment it applied.
  The operative clause is now inlined at all 17 - 13 Parallel-work, 3
  batch-asks, 1 lazy-create - rather than the 611-byte source paragraph pasted
  17 times, which would have added ~8 KB to workflows in a byte-cutting cycle.
  `grep -rn "conventions.md" cadence-core/workflows/` returns nothing.
  `references/conventions.md` itself is unchanged and stays the on-demand
  reference it says it is.

- **`references/git.md` is split into `git-guard.md` and `git-publish.md`.**
  Rails 1, 2 and 4 (the protected-branch guard, atomic commits, risk surfaces)
  plus the shared "what the guard sees" prose go to the guard file; rail 3
  (never auto-push) and the `git.auto_close` policy go to the publish file. The
  four guard-only skills stop carrying 11,330 B to reach a guard that is 6,166,
  and `/cad-land` reads the publish half at each step that actually publishes -
  both the manual mechanism answers and the unattended-close arm, GitLab's
  `glab mr create` included.

- **`/cad-config`'s catalog stays transcribed rather than derived, and
  `config.md` now says so.** The candidate change was to generate the catalog
  table from `config.mjs keys` instead of maintaining the copy by hand. Two
  independent grounds refuse it.

  The measurement: parsing every slash-command invocation across the local
  transcript corpus yields 5 `/cad-config` runs in total, none carrying
  `--review` or a `<key>=<value>` token, so by `config.md`'s Route rule all
  five reached the interactive menu. Non-menu runs are not a minority here,
  they are zero of five - for scale, `cad-verify` 46, `cad-plan` 44,
  `cad-execute` 39.

  The arithmetic: `node cadence-core/bin/config.mjs keys` emits 20,769 B on one
  JSON line against a 6,827 B catalog table, and the schema's field union
  (`type`, `values`, `default`, `src`, `purpose`, `min`, `max`) carries no
  per-value explanation field, while the walk requires each option to carry its
  Explanation as the option `description`. Deriving would cost three times the
  bytes AND drop required copy, or force re-authoring that copy into the schema
  - a schema change, not a transport change.

  The stated limit: n=5 is thin enough that the smallness is itself the
  finding, which is why the decision rests primarily on the arithmetic. That
  half is independent of run mix, so a wider window showing non-menu runs
  dominating still refuses the derivation.

- **Every skill and agent description is one routing line.** The 29
  `skills/cad-*/SKILL.md` descriptions, which ride the system prompt of every
  session in every project, fall from 5,078 B to 3,759 B, and the 19
  `agents/*.md` descriptions from 3,472 B to 1,638 B - each agent line now
  states its rung and that `bin/route.mjs` picks it rather than the user. What
  came out is positioning, design rationale, implementation detail nobody routes
  on, and flag lists `argument-hint:` already carries verbatim. What stayed is
  every trigger word a user would type, plus the three negative clauses that
  disambiguate confusable commands at selection time (`/cad-health` is not
  `/cad-audit`, `/cad-docs-verify` reports rather than rewrites, `/cad-land`
  never decides how you publish). The six `cad-*-contract` descriptions and all
  `effort:`, `tools:`, `disallowedTools:` and `skills:` frontmatter are
  byte-identical. Per-skill before/after text with the trigger-word check is in
  `.planning/phases/3/MEASUREMENTS.md`.

- **`cadence-core/references/**` and `cadence-core/templates/**` come under the
  weight budget.** 23 files and 162,186 B that five workflows name and no ceiling
  watched are now weighed surfaces with exact per-file budgets, so a reference
  that grows fails CI the same way a workflow does. The walk covers every file,
  not just `.md`, so `references/model-hints.json` and `templates/config.json`
  are budgeted too - which means editing either now requires regenerating the
  manifest.

  The measurement was fixed first, because it was not honest. Both walkers -
  `lib/surface-weight.mjs` and self-verify's `mdFiles` - wrapped one
  `recursive: true` `readdirSync` per branch, so a single unreadable descendant
  returned nothing for the WHOLE subtree: with `skills/private/` at mode 000,
  `weight.mjs` reported zero surfaces and self-verify reported
  `{"kind":"unreadable-surface","file":"skills","detail":"EISDIR"}` - naming a
  directory that reads fine, with the errno of a failed `readFileSync` rather
  than the EACCES that occurred, while every readable sibling went unlinted.
  Both now recurse per entry: one unreadable directory hides only its own
  children, is named by its own path with its own errno, and its siblings are
  still weighed and still linted.

  Deliberate behavior change in the same fix: descent is decided on the dirent,
  so a symlinked DIRECTORY met during a walk is no longer descended. A
  `skills/a/loop -> ..` cycle measured 41 surfaces of one file before and
  measures 1 now, which makes `surface-weight.mjs`'s long-standing "a symlink
  cycle is silently skipped" claim true for directory links for the first time.
  An explicitly named branch root that is itself a symlink IS still descended -
  the dirent test only ever sees descendants - and a test row pins each half.

## [2.2.0] - 2026-08-04

The six requirements v2.1.0 opened with and never picked up, carried forward
whole and closed. The cycle also produced the first end-to-end proof of the
documented install path: from a fully cold state - plugin uninstalled,
marketplace removed, cache deleted - `/plugin marketplace add
https://git.jcrenshaw.dev/crenshawdev/cadence.git` and
`/plugin install cadence@cadence` were walked live against the Forgejo remote,
and the fresh install matched the published manifest exactly (version, commit
sha, install timestamp). Nothing beyond the two documented commands was
needed; the transcripts are committed in the phase record.

### Changed

- **Two routing cells now START where they used to climb.**
  `critical`/`cad-plan-checker` and `shipped`/`cad-reviewer` move their `effort`
  to `xhigh`, which each cell's `retry` already was. Nothing else in
  `cadence-core/route-table.json` moves.

  The measurement behind it: a retry rewrites the whole subagent prompt at the
  2x cache-write tier and re-runs every turn of the work, while effort costs
  output tokens alone - so winning on attempt one is cheaper than climbing to
  it. The plan checker is the case that matters most, because it is one gate
  turn, and a plan waved through costs dozens of executor turns plus a revert.

  This is a forward correction to `[2.0.0]`'s "Escalate-on-failure is
  unconditional, and the rung ladder is reachable" entry: where that entry says
  "the two cells whose retry deliberately equals their starting rung", it now
  reads four. A live resolve over all 18 cells returns 14 that escalate and 4
  that hold. Every rung file stays cell-reachable -
  `agents/cad-plan-checker-high.md` through solo's and shipped's retry, and the
  unsuffixed `agents/cad-reviewer.md` (its `high` rung) through solo's.

- **The release seam can no longer ship a number, or notes, it never got from
  the close.** Three changes to `release-bump.mjs` and its pure core, all
  breaking for anyone scripting the seam directly:

  `bump` now REQUIRES `--version`. The shipping number is the one
  `/cad-milestone` already confirmed with the user; the seam reads no planning
  prose at all, where it used to fall back to `PROJECT.md`'s `### Active`
  section and then the roadmap title - prose no path keeps current between
  cycles, and which the shipped project template carries no version token for.

  Every refusal emits `ok:false` and exits 1 with a named `reason`
  (`no-target-version`, `unparseable-version`, `unreadable-manifest`,
  `downgrade`, `not-an-upgrade`), replacing the `ok:true, action:"error"` shape
  a scripted caller could read as success. A target that is not a strict semver
  upgrade over the manifest's current version is now one of those refusals: a
  downgrade used to pass, because any `from !== to` counted as a bump.

  Content staged under `## [Unreleased]` is PROMOTED into the dated
  `## [<version>]` section rather than left above it, so a release stops
  shipping a dated heading over an empty section while its notes sit in
  Unreleased. `## [Unreleased]` survives as an empty stub, and a run whose
  dated section ends up with no body reports `changelog.section_empty` so the
  close authors the notes before the bump commit.

### Removed

- **The git guard's shell parser, 2,251 lines of it.**
  `cadence-core/bin/lib/shell-tokens.mjs` (the quote-state tokenizer),
  `cadence-core/bin/lib/destructive-git.mjs` (a model of git's option grammar)
  and both their test files are deleted, along with `references/git.md`'s
  rail-3 evasion grammar and out-of-grammar table. This supersedes **TOK-01**
  on both halves: the six push-hole closures v1.4.0 shipped, and the
  command-position deny gate that v2.0.0 added on top of them.

  Both rails now read `cadence-core/bin/lib/git-segments.mjs`, about thirty
  lines: a segment counts only when its command word is `git`, and the verb is
  its first non-flag word. `git.on_protected` keeps its `refuse` hard block on
  `git commit`, which remains the guard's only deny surface.

  Why, since the tokenizer was closing real holes. A detection widener is safe
  to get wrong (being wrong costs a prompt, not a bypass), which turned out not
  to mean cheap to get wrong. The escape surface behind `bash -c`, `$(...)`,
  `${...}`, aliases and `ssh` is unbounded, so it billed as an open-ended review
  debt: three consecutive blocking `risk_surface` panels in a single phase, each
  finding new holes, each answered with more grammar, and `git switch -f main`
  still silent at the end of it. Then the measurement that settled it - the scan
  was O(K x N) in memory (3.1GB at 224KB of input, a V8 abort at 280KB) inside a
  hook that runs on every Bash call and **fails open**, so a long enough command
  line switched the guard off and let the push inside it run unprompted. The
  replacement is total and linear; a test pins the same input deciding in
  milliseconds, above the measured abort point.

  Deleting the wide reader also retired a second rule. Detection had been
  any-position, so `rg -t sh "git commit"` was read as a commit, so refusal had
  to be narrowed back to command position by an enumerated prefix set that three
  review rounds kept finding new members of. Anchoring detection to the command
  word makes those silent up front, so `denyable` and `unplaced` are gone with
  nothing replacing them.

  **The accepted cost.** These shapes can really run git and are now silent, by
  construction rather than by oversight. Each is a pinned test row in
  `git-segments.test.mjs` and `git-guard.test.mjs`, and `references/git.md`
  rail 3 carries the same list: `bash -c` / `sh -c` / `zsh` / `dash` / `eval`
  wrappers; `$(...)`, backticks and subshells; transparent prefixes (`sudo`,
  `timeout`, `nice`, `xargs`, `VAR=x`); `env -S`; a quoted path with a space
  (`git -C "my repo" push`); line continuation; and `ssh host "git push"`.
  Heredocs, `${...}`, brace expansion, `$'...'` escapes, aliases and variable
  indirection were out of grammar before and remain so.

- **`git.on_destructive`**, removed outright. The key shipped across the schema,
  the template, `references/config-reach.md` and `workflows/config.md` on the
  premise that a destructive rail would follow it. That rail was the parser's
  reason to exist, so it does not follow. The key reached no hook on any commit,
  which made its reach row a claim nothing honoured: `ask` and `off` did the
  same nothing. Git's own reflog and `ORIG_HEAD` remain the recovery path for
  `reset --hard` and friends, as they were before the key existed.

### Fixed

- **The config read face merges a layer once, whatever its spelling.**
  `mergeLayers` computes file identity before either read
  (`cadence-core/bin/lib/config-merge.mjs`), so a symlinked or
  relative-vs-absolute spelling of one file reports a single layer instead of
  `global+repo`, and a broken such file earns one parse warning instead of
  two. Six of the seven config-reach and risk-waiver defects deferred from the
  v2.0.0 cycle closed in the same pass, each pinned by its own test; the
  seventh (`validate --global` blessing a file `set --global` refuses) is
  named open rather than silently dropped.

- **`route.mjs`'s warnings reach the caller on every shape.** `warnings[]` now
  rides the `unknown-role` and `unresolved` `ok:false` shapes too, and a held
  risk floor is audible in both `reason` and `warnings` - a workflow relaying
  the bundle relays the disagreement instead of swallowing it with the error.

## [2.1.0] - 2026-07-30

Two gates that were meant to protect the work after them, and did not. An
adjudicated review used to hand its survivor list back as something that read
like a work order, so the model went straight to fixing all of it; and the
coverage gate exempted the exact checklists it existed to check. Both close
here, along with the paid seam's missing payload bound.

Backfilled 2026-08-03: this milestone closed in the planning docs at `e457e47`
but its release section was never written, so the notes below are reconstructed
from the phase summaries at `643663e~1` and the commit range
`fe2310f..e457e47`. The gap is itself an instance of what REL-03 exists to fix.

### Added

- **`review.max_prompt_tokens`** (default 120000 estimated tokens), refusing an
  over-cap payload on both paid commands BEFORE any request is made
  (`review-provider.mjs`: `resolveMaxPromptTokens`, `estimatePromptTokens`,
  `assertUnderCap`). Present on all four config surfaces (REV-03).
- **self-verify check 10, `dispatch-phrasing`** - a new pure lib
  (`bin/lib/dispatch-phrasing.mjs`) that FAILS a concurrent dispatch whose prose
  does not say ONE message, run over `workflows/` and `references/` (REV-03).
- **A persisted findings envelope** at `phases/<N>/FINDINGS.json`, carrying
  `rejected_entries` and `skipped_entries`, so a discarded verifier entry
  outlives the dispatch that produced it (COV-01).
- **`uat record --criterion`**, which repairs a dropped criterion link after the
  fact rather than requiring the checklist be rebuilt (COV-01).
- **Provenance in the coverage envelope** - `version: {plugin, uat_fields}`, so a
  coverage result states which seam version produced it (COV-01).

### Changed

- **An adjudicated review ends at a triage gate, not a queue.** Survivors are
  presented as a numbered list with severity and `file:line`, NONE listed first
  and taken as the default, and the turn ends on that question. Authored once in
  `references/review-triggers.md` § 6 and reached from five firing sites by
  pointer rather than by copy: `cad-land` step 3, `workflows/plan.md`,
  `workflows/verify.md` `route_failures`, and `workflows/execute.md`'s
  sequential-diff and parallel fires (TRI-02).
- **A trigger's reviewers dispatch concurrently in one message**, stated as an
  instruction with the hedge removed, and one route resolve per set rather than
  per reviewer (REV-03).

### Removed

- **The reviewer contract's anti-padding clause**
  (`skills/cad-reviewer-contract/SKILL.md`). Anti-inflation is kept. The clause
  was pre-filtering findings the user never got to see, which is the same defect
  the triage gate closes from the other end (TRI-02).

### Fixed

- **The coverage gate exempted the checklists it existed to check.**
  `criteria-coverage` treated a fieldless checklist as legacy and passed it
  silently; it now reports a `fieldless-checklist` break. The legacy exemption is
  decided on ids DECLARED (a `declaresIds: none | some | unknown` signal computed
  from raw source lines) rather than on ids successfully parsed, so an unreadable
  criteria section can no longer buy an exemption (COV-01).

## [2.0.0] - 2026-07-30

The routing question changes. Cadence used to ask how much a dispatch should
cost; it now asks what it costs if the work is wrong. The config key carrying
that question is renamed rather than revalued, with no back-compat alias, and
that is the one reason this release is major: a config you already wrote stops
validating.

### Removed

- **`model.profile`**, replaced by the top-level **`stakes`** key. Its values
  go with it: `fast`, `balanced`, `quality` and `auto` are gone, and `stakes`
  takes `solo`, `shipped` or `critical`.
- **`model.auto.escalate_on_failure`**, replaced by
  **`model.escalate_on_failure`**, which is honoured at every stakes level
  rather than only inside the retired `auto` mode.
- **`model.auto.ceiling`**, removed outright. Escalation no longer steps a
  spend ladder, so there is no ceiling left for it to stop at.
- **`model.auto.max_escalations`**, removed outright. A role escalates to
  exactly one rung, the retry rung its own routing cell names, so there is no
  second step to cap.
- The `auto` mode's difficulty signals go with it, so `route.mjs resolve` no
  longer accepts `--files` or `--ambiguity`. No workflow or skill ever passed
  them.

None of these has a back-compat alias, and the break is on the KEY, not merely
on the value it holds. `model.profile: "solo"` is exactly as invalid as
`model.profile: "balanced"`. `/cad-config` refuses to write the retired name
and names `stakes` in the refusal; `config.mjs validate` reports it as an
unknown key; and both live read faces, `config.mjs get` and
`route.mjs resolve`, emit a warning saying the key is present and ignored
instead of resolving silently at the default and reporting that result as
configured.

### Changed

- **The routing axis asks what a break costs, not what a dispatch costs.**
  `stakes: solo` means nobody else runs this and a break costs only your own
  time. `stakes: shipped` means other people run this and a break comes back
  as a bug report. `stakes: critical` means a break is not a bug report. The
  default is `shipped`. "How much should this dispatch cost" was answerable but
  useless, and on a flat-rate plan it is not a question you have at all, while
  "what happens if this is wrong" is answerable in about a second and is the
  only form of the question a risk signal can ever set on your behalf.
- **Escalate-on-failure is unconditional, and the rung ladder is reachable.**
  It used to be gated behind `model.profile: "auto"`, a mode the shipped
  default never selected, so a failed attempt was re-dispatched at the rung it
  had just failed at. A retry now climbs to the retry rung its own routing cell
  names, at every stakes level, and `model.escalate_on_failure` set to `false`
  is how you turn that off. Every role climbs: the fixed per-role escalation
  target that made five of six retries a no-op is gone, and the two cells whose
  retry deliberately equals their starting rung report the rung as held rather
  than claiming an escalation.
- **A routing cell yields four knobs, not a model.** One question in - what
  does a break cost - and out comes the model, the effort rung to start at, the
  rung a failed attempt climbs to, the gate each review trigger fires at, and
  whether the deep verify pass runs. Quality is not one dial, and no amount of
  effort expresses "fire a blocking cross-model review before this ships".
- **Review gates come from the stakes level.** `plan` is advisory on a solo
  project and adjudicated once other people run it; `diff` is off, then
  advisory, then blocking; `phase_diff` is opt-in until critical; `pre_ship`
  is advisory, then adjudicated. `risk_surface` is blocking at every level,
  because it fires only on a detection match. A
  `review.triggers.<t>.gate` you set still WINS over the level's, and the
  disagreement is reported rather than resolved silently - a key you set must
  not quietly stop doing anything.
- **The deep verify pass is level-driven.** It is off at `solo` and on above,
  still once per phase, and `--deep` forces it at any level.
  `workflow.verifier: false` remains the off switch.
- **Models come from the cell, not from a role's tier.** The `(stakes, tier)`
  matrix and the whole `tier` vocabulary are gone: a role's model was being
  decided by a field named after something else. The routed vocabulary is
  `sonnet` and `opus`; `haiku` and `fable` are reachable only by an explicit
  `model.overrides.<role>` pin.
- **`/cad-audit` proves criterion coverage in both directions, and FAILs on a
  criterion that reached no UAT item**, naming the id and the phase with a
  concrete next action. Requirement tracing already caught work nobody committed
  to deliver; this catches a criterion that never reached the checklist, which
  is a weaker claim than proof of delivery and the honest one: an item counts as
  coverage once it exists, whatever its result. Nothing structural connected the
  two before - the checklist was worded from the criteria by hand, so the link
  was model judgment and no later pass could recover it. Upgrading costs
  nothing: a checklist written before the field existed is read as pre-field
  legacy, reported and never broken, and new checklists carry the link from the
  next `/cad-verify` onward.

### Added

- **Six more rung agent files, 19 in total**: `cad-planner-max`,
  `cad-verifier-medium`, `cad-verifier-max`, `cad-reviewer-max`,
  `cad-plan-checker-medium` and `cad-plan-checker-xhigh`. Each is the same
  contract at a different depth, and CI fails a rung file that carries any
  instruction of its own.
- **Cell validation in `self-verify`**, every problem naming the offending cell:
  a (level, role) pair with no cell, a rung with no agent file, a rung file no
  cell reaches, a model outside `model_aliases`, a rung outside `rung_order`, a
  gate outside the four gate values, a trigger name the schema does not define,
  and a retry rung that sits BELOW the rung it started on - which no membership
  check can see and which would otherwise let a retry think less while
  reporting that it thought more.
- **A computed risk floor: detection raises the stakes level by itself.** The
  eight risk surfaces Cadence already recognized in prose are now declared data
  - a `surfaces` block in `cadence-core/route-table.json`, each row a list of
  path tokens and the level it floors to. `route.mjs resolve` reads the phase's
  declared PLAN `files:` list, matches it against those rows, and raises the
  level to the highest floor it hits, so all four knobs come from the raised
  row through the one cell grid. It only ever raises: a baseline already at or
  above the floor changes nothing and says so in `reason`.
- **`route.mjs resolve --phase <N>`, with a cursor fallback.** The phase comes
  from the flag, or from `.planning/STATE.md` when the flag is absent, so an
  existing call site keeps working. Every unresolvable input - no phase, no
  PLAN, an unreadable PLAN, a `--phase` that is not a phase number - resolves at
  the baseline with `ok:true` and a warning where there is something to say. A
  refusal would route a possibly-risky phase LOWER than its own baseline, so
  there is none. `cad-planner` and `cad-assumptions-analyzer` are never floored:
  they run before the phase they are about has a plan.
- **`risk.override.<surface>`, the per-surface waiver.** One boolean per surface,
  DECLARED repo-scoped (`src: repo`). The level drops back to the baseline only
  when EVERY detected surface is named, the waived names stay in `reason`, and a
  value that is not strictly `true` waives nothing and says so. A misspelled
  surface is refused at the write face with the accepted names listed, and
  `--global` is refused there too. That refusal is airtight in both directions:
  the resolver reads waivers from the REPO layer alone and names an ignored
  global one in `warnings`, with the repo-scope rule and the file it belongs in,
  and the write face compares paths by filesystem identity rather than as
  strings, so an alias for the global file (`<dir>/./config.json`, a symlink, a
  relative path) is refused like the plain spelling.
- **A `surfaces` walk in `self-verify`, both directions**, every problem naming
  the offending row: a floor that is not a stakes level, a floor below the level
  every shipped row is required to carry, a pattern list that is empty or holds
  a token no path can ever produce, a surface with no `risk.override` key to
  waive it, a `risk.override` key naming no surface row, and drift in either the
  `stakes_order` or `gates` vocabulary the resolver reads by index.
- **Every config key's reach is stated where the key is set, and the sweep that
  proves it is re-runnable.** Six `tier` keys - the five
  `review.triggers.<t>.tier` and `review.decision_review.tier` - resolved as a
  universal per-trigger model dial while only a cross-model reviewer can honour
  one: `review.providers.<name>.tiers[trigger.tier]` is the only bridge from a
  trigger to a provider model id, and the `claude-subagent` reviewer's model
  comes from the routing cell instead. They now say `cross-model reviewers only`
  in their own `purpose`, the same phrase per-trigger `effort` already carried.
  Three more purposes stopped overstating what reads them: `granularity` sets a
  roadmap phase count and splits no phase into tasks, `workflow.research` is
  read by the new-project research step alone, and `workflow.skip_discuss`
  selects which command `/cad-progress` suggests for an unplanned phase rather
  than skipping any step. `cadence-core/references/config-reach.md` now carries
  a reach row for every schema key, with the human test for a new one stated,
  and `self-verify` check 9 fails a key with no row, a row naming no key, and a
  reach narrower than `universal` that the key's own `purpose` never states -
  so a key added later cannot arrive with its reach unanswered.
- **The plugin's home moved to
  `https://git.jcrenshaw.dev/crenshawdev/cadence.git`.** The GitHub repository
  stops moving; the self-hosted Forgejo remote is the only published source
  from this release on. An existing GitHub-installed user follows it with three
  commands:

  ```
  /plugin uninstall cadence@cadence
  /plugin marketplace add https://git.jcrenshaw.dev/crenshawdev/cadence.git
  /plugin install cadence@cadence
  ```

  Nothing about the plugin changes with the move. `/plugin update
  cadence@cadence` follows the manifest's `repository` field, so an install
  that predates this release keeps pointing at a repository that no longer
  receives commits until those three commands are run.
- **Acceptance criteria carry ids.** Every criterion in a phase's CONTEXT.md now
  starts with a phase-local `AC<N>` token (`- [ ] AC1: ...`), which `/cad-context`
  writes from now on. The grammar is stated in full at
  `cadence-core/references/acceptance-criteria.md` and read by one function, with
  a named diagnostic for each of eleven shapes outside it - the central one being
  a bullet carrying no id at all, and the section-level one a near-miss
  `## Acceptance criteria` heading, which used to drop a whole phase's criteria
  out of the coverage domain in silence. A fenced code block declares nothing, so
  a documentation example cannot mint a phantom id. The id never renumbers:
  `/cad-phase` insert and remove move a phase directory whole and rewrite
  nothing inside it, which is why the id is not phase-prefixed and not a path.
- **`planning.mjs criteria-coverage`**, a new seam subcommand that traces every
  criterion to the UAT item that tested it, in both directions. A criterion that
  reached no item is verdict-breaking and named by its id; an item that traces to
  no criterion is reported and moves nothing. A checked phase that declared
  criteria and has no UAT.md at all breaks the same way, as `missing-uat` - the
  total drop is the case the gate most has to see.
- **Two UAT item fields, `criterion` and `origin`.** `criterion` names the
  `AC<N>` an item was built from, written by `/cad-verify` and carried through
  every later rewrite of the file. `origin` (`criterion | verifier | smoke`)
  declares an item that legitimately has no criterion - a gap the deep verifier
  appended, or the cold-start smoke check - so it is exempt rather than merely
  unlinked, and `uat record --origin` can set it after the fact. Every new
  checklist also carries a `fields_version` frontmatter marker, which is what
  the legacy exemption reads: a file the seam wrote is never mistaken for a
  pre-field one, however few links its items hold.

### Fixed

- **A `review.triggers.<t>.gate` outside `off|advisory|blocking|adjudicated` no
  longer reaches the bundle.** A value a config layer set used to win over the
  level's gate without ever being checked, so `"blockign"` silently replaced
  `critical`'s deliberately-blocking `risk_surface` gate - a one-character typo
  disabling a review, on the axis the new risk floor rides on. An invalid or
  non-string gate now loses to the level's gate and is named in `warnings`, the
  same treatment an unknown model alias already got. A VALID gate that disagrees
  still wins and still reports the disagreement: this is a validity check in
  front of that precedence, not a change to it.

### Closed on the way past

The last sweep for keys that are resolved and then thrown away found most of
them already closed by the work above, each carrying its own dated marker in
`DESIGN.md` section 6 - recorded here rather than fixed a second time:

- the `(stakes, tier)` model matrix, deleted with the routing cells;
- per-trigger `review.triggers.<t>.effort`, scoped to the cross-model arm by
  `#64` in `v1.5.0`;
- the `escalate_effort_variant` shim, retired with the rung ladder;
- `model.profile` and the `model.auto.*` keys, retired with the axis.

### Upgrading

`config.mjs set` writes keys and never removes them, and the seam refuses the
retired names outright, so the stale block has to come out of the file by hand:

1. Open `.planning/config.json`, and `~/.claude/cadence/config.json` as well if
   you set a global layer.
2. Delete `profile` and the whole `auto` block from the `model` object. If
   `auto.escalate_on_failure` was set, keep that value as
   `"escalate_on_failure"` directly under `model`; it defaults to `true`.
3. Run `/cad-config stakes=shipped`, or `solo`, or `critical`, to set the new
   key.

### Known issues, deferred to 2.0.1

Found by this cycle's own goal-backward verification and recorded rather than
quietly shipped. Full evidence per item is in `.planning/phases/6/UAT.md`.

- `config.mjs get` still returns a `risk.override.<surface>` set in the
  user-global layer as an effective value, with no warning, while `route.mjs`
  correctly ignores it. `/cad-config`'s menu reads `get`, so it shows `true`
  for a waiver that waives nothing.
- A duplicate row in `references/config-reach.md` is dropped without an issue,
  so a stale row can mask a corrected one inside the check whose purpose is
  that no key's reach is skipped silently.
- Five smaller ones: the `https?://` URL mask does not cover SSH clone forms,
  `fsIdentity` throws outside its guard on a non-string path, the reach-cell
  parser does not case-fold, and the global-waiver warning misfires when both
  config layers resolve to one file or the surface name is misspelled.

## [1.5.0] - 2026-07-28

Four corrections to things Cadence said about itself, and one structural
change so there are fewer places left to say them.

### Added

- **Self-verify asserts every preloaded agent contract resolves.** A `skills:`
  entry naming a skill that does not exist is skipped by the host *silently*,
  with only a debug-log warning, which leaves an agent running with no contract
  at all - a failure that reads as an agent ignoring its instructions rather
  than as a typo. The new `agent-skills` check fails loudly instead, and also
  flags a resolved skill that sets `disable-model-invocation: true`, which
  cannot be preloaded and produces the same end state by a different route.
  The tools lint now scans preloaded contracts as agent prose, so moving the
  contracts out of the agent bodies did not silently empty its input.

### Changed

- **Each agent's contract is stored once, as a skill preloaded through the
  `skills:` frontmatter field.** The seven files in `agents/` are now
  frontmatter plus a pointer, between 464 and 592 bytes each, down from as
  much as 8786. Six contract skills hold the prose, one per role rather than
  per file: `cad-plan-checker` and `cad-plan-checker-high` share one, which is
  what that pair always claimed to be. They carry `user-invocable: false`, so
  they never appear in the slash-command menu. Behaviour is unchanged; five of
  the six moved byte-identical. The exception is the plan-checker pair, whose
  high variant carried real behaviour of its own - shipping behaviour in a file
  whose only job is to name a rung is the failure this design exists to
  prevent, so it moved into the shared contract as a `<rung>` section and both
  files now state only which rung they are.
- **`cad-plan-checker-high` no longer reads another agent file at runtime.**
  The `@`-include workaround is retired. The file itself stays, because it
  exists to carry `effort: high` - frozen in frontmatter, and named by string
  in `route-table.json`'s `escalate_effort_variant` - and retiring it needs a
  rung ladder that does not exist yet.

### Fixed

- **The worktree fork point is selectable, and v1.4.0 said it was not.**
  `seams.md` called it host-owned and NOT caller-controllable, and five other
  surfaces restated that binding on the strength of it. The host's
  `worktree.baseRef` setting decides it: `fresh` (the default) forks from the
  remote default branch, `head` forks from the local HEAD and carries the
  integration branch's unpushed work - which is the documented use case for
  isolating subagents on in-progress work. The `fresh` default is the whole
  cause of the phase-4 failure the false claim was written to explain. Every
  surface now states the setting, the version it holds for (Claude Code
  >= 2.1.208), and the nuance that inside a worktree `head` is that
  worktree's own HEAD.
- **/cad-execute no longer parallelizes into worktrees that lack its plans.**
  `choose_path` runs a new read-only seam, `cadence-core/bin/worktree-base.mjs`,
  which resolves the effective `worktree.baseRef` through the Claude Code
  settings cascade; under `fresh`, unset, or an unreadable answer the phase
  runs sequentially and names the fix. `/cad-config` offers to set `"head"` in
  the project's or the user's settings file - offers, and never writes a
  user's settings without being told to. The executor's `<worktree_mode>`
  assertion stays either way: a setting the user can change back, and a
  session CLI override no script can see, are not guarantees.
- **Per-trigger `effort` no longer claims to apply where it cannot reach.**
  `fire(trigger)` resolved `{gate, tier, effort}` and consumed `effort` on the
  cross-model arm only. The `claude-subagent` arm dispatches through a seam
  whose surface is `(agent_name, prompt, model?)`, so on a stock install the
  configured value was read, resolved, and dropped with nothing said - every
  trigger, every fire. Wiring it through is not available: `effort` is a
  subagent definition field with no per-dispatch override on the Agent/Task
  path, so varying it needs per-rung agent files. The key is scoped instead.
  `review-triggers.md` states which fields reach which backend,
  `config.schema.json` says it at the point of setting, and a fire whose
  configured effort differs from `cad-reviewer`'s frontmatter-pinned `high`
  now names the difference in one line rather than silently ignoring it.

## [1.4.1] - 2026-07-28

Two internally-inconsistent contracts, both closed by subtraction.

### Fixed

- `cad-executor`'s `<process>` ended by requiring a success-criteria check
  whose output the same contract gave nowhere to put: the `<report>` block has
  no field for it and `execute.md` never mentions it. The next orchestrator
  step, `goal_check`, already redoes that assessment with the full phase diff
  in view and an articulated purpose. The instruction is deleted rather than
  wired, because the consumer that would have justified it already exists one
  step later. The per-task predict-then-verify at process step 2 is untouched:
  that one has a consumer, a contract, and it is what makes a SUMMARY's claims
  trustworthy. (#65)
- `cadence-core/references/conventions.md` opened with "Shared rules every
  skill and workflow follows. Referenced, not repeated." It is `@`-included by
  exactly one skill and named in prose by 18 other files, so its rules reached
  a model only when something happened to read the file. The header now states
  the reach the file actually has, an on-demand reference cited by path where a
  rule is relevant or `@`-included where a workflow needs the whole set, and
  says plainly that nothing in it reaches an agent that has not read it. The
  alternative, including it everywhere, was rejected: it would spend resident
  context in every session on rules most invocations never need. (#67)

## [1.4.0] - 2026-07-28

Stated grammars. Cadence parsed four formats it owns with accreted heuristic
regexes, and each one failed silently in both directions: an over-read
fabricated a requirement id that surfaced as an `/cad-audit` orphan, an
under-read dropped a real path and handed the parallel-safety gate a false
`overlaps: []`. Both look like success. Each of those readers is now a stated
grammar with a written-down reference, an out-of-grammar table, and a
parser-level test per row - plan-file frontmatter, the shell text both git
rails read, the roadmap phase list, and the `## Active` requirement section -
and every input outside a grammar is reported rather than silently reread. The
spine's own bookkeeping moved with them: `/cad-plan` now seeds the traceability
rows a milestone close used to need by hand.

### Added

**`/cad-plan` seeds its own traceability rows**

- A new `planning.mjs seed-reqs` subcommand, called by `/cad-plan` at the point
  the plan is written, inserts a `Pending` REQUIREMENTS `## Traceability` row
  for every `## Active` requirement the phase covers. A milestone close no
  longer needs a hand-populated table before `/cad-audit` passes - which it did
  need at the v1.2.0 and v1.3.1 closes, and which is why neither close's audit
  fired. Seeding is idempotent: a second run returns `{"seeded":[],
  "skipped":[...]}` and leaves the file byte-unchanged.
- The `## Active` section it reads has a stated grammar (`parseActiveIds`) with
  its own reference, `cadence-core/references/req-traceability.md`. The
  single-writer invariant is restated across five prose surfaces as a
  Status-TRANSITION rule rather than a row-existence one: `/cad-plan` may create
  a row, but only `cad-verify` moves a Status beyond `Pending`.
- A worktree-mode executor asserts its own `PLAN-<k>.md` exists before task 1
  and halts `blocked` naming the missing path and the worktree HEAD, instead of
  planning against a stale merge point - the phase-4 fork bug three executors
  caught only by noticing. It repairs nothing: merge, rebase and fetch are
  banned inside the worktree. The honest worktree binding is now stated across
  six surfaces; Cadence issues no `git worktree add` anywhere, so it cannot
  guarantee a fork point and no longer claims to.

### Fixed

**The plan-file frontmatter grammar**

- `readFrontmatterList` is one normalized classifying pass over a stated
  grammar - a `normalize` step (BOM, CRLF, lone CR, leading blank lines), a
  quote-state value scanner, and a block reader with an explicit terminator
  set - replacing the accreted regexes. The greedy `\[(.*)\]` that three
  reviewers found independently is gone: `files: [a.md, b.md]   # [see notes]`
  reads two files rather than swallowing the comment's bracket, and
  `requirements:   # TODO fill this in` above a block list reads the block
  instead of the comment. That last one was a HIGH regression introduced by the
  v1.3.1 cycle.
- Every input outside the grammar now carries a named diagnostic on the `audit`
  and `plan-overlap` envelopes as `frontmatter_issues`, where it previously
  changed what was read with `issues: []`. The shipped template's own former
  shape was one of them: a `files: []  # comment` key line followed by indented
  paths took the inline arm, so `currentKey` was never set and every path
  beneath it vanished - two plans in that shape handed `plan-overlap` a false
  `overlaps: []` and the parallel gate would dispatch both onto the same file.
  Also diagnosed: a quoted value with trailing text (`- "src/shared.rs" (new)`,
  which used to mint a value carrying its own quotes and match nothing), a
  commented-out key line inside an open block (an over-read of one key and an
  under-read of the other in one pass), `requirements:["#41"]` with no space
  after the colon, a backslash escape inside an inline list, and a
  backtick-wrapped value tested on the value's BOUNDARY - which catches a half
  wrap, a wrap plus punctuation, and a backticked id that `#`-comment handling
  would otherwise reduce to a one-character phantom.
- Frontmatter paths reach `plan-overlap` byte-exact as the plan wrote them:
  `resolveValue` replaced the old global rewriting, so `src/x(1)` and
  `` lib/a`b.mjs `` survive unrewritten while a `- **Files:** src/a.rs (edit)`
  task line still normalizes. A path declared in one plan's frontmatter and the
  other's task line now reports as an overlap where it was a silent miss.
- The grammar, every diagnostic code, and a per-code table stating whether that
  code DROPS what it read are written down in
  `cadence-core/references/plan-frontmatter.md`, the payload column proved at
  the audit seam rather than asserted in prose. 33+ parser-level grammar rows,
  each reported as its own test.

**One quote-state tokenizer for the git-guard rails**

- The seven shapes that reached the network with no prompt now all ask: a
  quoted `-C` path with a space (`git -C "my repo" push origin main`), `&` as a
  separator, `$(git push)`, backticks, a subshell, an escaped `\"` before a
  real push, and the shell-wrapper set `bash` / `sh` / `zsh` / `dash` / `eval`
  with `-c`. This closes the "Six pre-existing `git-guard` rail-3 holes"
  known gap recorded under [1.3.1]; `eval` was the seventh, found while
  gathering context for the fix.
- The strip-and-split arms and the parity-aware continuation pre-pass are
  DELETED, not extended: one left-to-right pass in
  `cadence-core/bin/lib/shell-tokens.mjs` carries a single quote/escape state,
  preserves word boundaries, descends into `$(...)`, backticks and subshells,
  and re-tokenizes a shell wrapper's operands. Six regex arms would have been
  the alternative; regex accretion is what produced the two push-rail
  regressions this repo already paid for. The module is pure and total (no
  I/O, never throws, bounded descent and expansion), so the grammar is tested
  as a table with no subprocess per row.
- Both rails read that one output, so they agree on what a wrapped command IS:
  a wrapped `git commit` on a protected branch now follows the same
  `git.on_protected` path as the bare form. Detection is any-position, so
  `sudo bash -c "git push"` is seen; hard refusal is command-position only at
  BOTH levels - the wrapper's position and the git word's own - so a read-only
  `rg -t sh "git commit"`, a bare mention like `grep git commit` and a lookup
  like `command -v git commit` can never be blocked by a rail meant for real
  commits.
- Command position is one rule with nothing to enumerate: word 0 of the simple
  command, after leading `VAR=value` assignments and empty placeholder words,
  and past an `env` word with its option region. The consequence to know is a
  deliberate regression: under `git.on_protected: refuse` a transparent prefix
  now ASKS rather than denying, so `sudo git commit`, `timeout 60 git commit`
  and `find . -exec git commit \;` all prompt instead of hard-blocking. The
  enumerated prefix-command and shell-keyword sets that used to keep those
  denies are gone, because every prefix carries its own option grammar
  (`sudo -u john`, `timeout --signal KILL 60`) and the tail proved open-ended
  across three review rounds - while producing a false deny on
  `command -v git commit`, which runs nothing.
- A substitution used as a global option's argument
  (`git -C $(pwd) push origin main`, `` git -C `pwd` push ``) keeps its word
  slot, so `-C` can no longer eat the real subcommand, and a `#` glued onto a
  substitution (`echo hi $(echo)#x; git push`) is mid-word content rather than
  a comment. Both ran a real push with no prompt.
- GNU `env -S` / `--split-string` is read as the command line env really splits
  and executes. Finding it means walking env's whole option region: the options
  that take a separate argument (`-a`/`--argv0`, `-u`/`--unset`, `-C`/`--chdir`)
  are skipped WITH that argument instead of ending the scan, and `-S` is
  matched anywhere in a short cluster rather than only at its head, so
  `env -S "git push origin main"`, `env -u HOME -S "..."`, `env -C /tmp -S
  "..."` and `env -iS "..."` all reach a decision - each was a real push with
  no prompt. An env option the guard does not know no longer ends the scan
  quietly: the command text is read for a `git` token and the guard asks, so
  the next unanticipated option cannot become the next silent bypass.
- A command carrying a `git` word the tokenizer cannot place - an unterminated
  quote, a heredoc-fed or pipe-fed wrapper - now asks instead of going silent,
  and never denies. A shape with no `git` word in it (`echo "unterminated`,
  `eval $CMD`) stays silent.
- The grammar and the shapes deliberately left out of it (heredocs, `<<<`,
  `${...}` expansion, brace expansion, ANSI-C escape sequences, aliases and
  functions, variable indirection, `ssh host "git push"`) are written down in
  `cadence-core/references/git.md` rail 3, each out-of-grammar row stating the
  behavior it actually has and pinned by a test.

**A stated grammar for the roadmap phase list**

- An empty `## Phases` is now a derived closed-milestone state instead of
  `unparseable-roadmap`: `planning.mjs status` returns `ok:true` carrying an
  additive `cycle:"none"` field, with `current` and `total` unchanged (`null`
  and `0`). `/cad-progress` therefore works in the window between a milestone
  close and the next cycle, where it used to report the roadmap as broken.
  `cycle` is present only in that state, so a caller cannot read a closed
  milestone as "all phases complete" from `current === null` alone.
- A phase-shaped line that is NOT a canonical entry - a plain bullet, a
  heading, an ordered item, a table row, a prose mention - is reported per line
  with its own diagnostic code and the offending line named in `detail`, rather
  than one blanket string, and never classifies as a closed milestone. That
  includes the case which reverted the attempt made during the [1.3.1] close: a
  wiped checkbox list whose `### Phase N:` detail sections survive, which a
  heuristic reported as a cleanly closed milestone. The classification scan
  deliberately reads past the `## `-bounded extent the canonical parse uses.
- `PHASE_LINE` is unchanged - nothing new counts as a phase. This is a
  classifier OVER the `## Phases` section, not a wider phase parser: what
  counts as a phase for `status`, `audit`, `phase-done` and the cursor's
  `total` is exactly what it was.
- Drift detection stays live against a closed milestone, which is the one state
  where the cursor is the only surviving evidence: `phase complete` and
  `ready to plan` agree, `planned`, `executed` and `context gathered` are
  drift, `paused` keeps its any-point carve-out. A surviving `phases/N/`
  directory reports as a new `phase-dir` drift kind, and a stale `of <M>`
  cursor against a zero-phase roadmap reports cursor drift on its own - after a
  tagged close deleted the phase dirs, that total is all that is left to see.
- `cursor set` derives `of 0 (no active cycle)` from a pruned roadmap, so
  `/cad-milestone` step 6 runs with no extra flags on the tree its own step 3
  produces; that step now also prunes each completed phase's `### Phase N:`
  detail section, without which a template-conformant close never reaches the
  closed state. `/cad-progress` and `/cad-milestone` route between milestones
  to `/cad-phase add`, the only workflow that appends a phase line to an
  existing roadmap.
- The grammar, its four states and its out-of-grammar table are written down in
  `cadence-core/references/roadmap-phases.md`, each row pinned by a
  parser-level test.

**An audit armed in the partially-planned state**

- An `## Active` requirement no phase has picked up now breaks `/cad-audit` as
  `unpicked` and moves `counts.broken`, so the traceability gate holds while a
  milestone is only partly planned - rows for some ids and not others, the
  state a milestone spends most of its life in - and not only against a
  zero-row table. That blind spot is the residue of what let the v1.2.0 and
  v1.3.1 closes through.
- `counts.total` now counts Traceability ROWS PLUS unpicked ids, so
  `total = traced + broken + deferred` still holds once a break can exist with
  no row. This is a real change for any caller written against
  `total === rows.length`.
- `unseeded` is row-count-independent: it names the `## Active` ids with no
  Traceability row at ANY row count, not only when the table is empty. It is
  also no longer verdict-neutral, which deliberately reverses the additive
  shape shipped one milestone earlier - a diagnostic that never moves the
  verdict leaves the ship gate exactly as permeable as it was. The two zero-row
  reports are unchanged: `{active_ids: []}` for a present-but-empty section,
  plus `no_active_section: true` when the heading is absent.
- A line inside `## Active` that the bold-bullet grammar does not read - a
  v1.3.1-style table row, an indented sub-bullet, a `*`/`+` bullet, an unbolded
  bullet, an ordered item, a `###` heading, or a prose line in a section that
  declares no ids and names an id recorded nowhere else in the file - is
  reported in `active_issues` with its line, a code and the offending text
  instead of vanishing. The grammar itself is byte-identical: these are
  diagnostics, not a wider parser, and each code names why THAT line is unread
  so the fix it implies changes something.
- The grammar reads any bold span as an id, which is what `seed-reqs` treats as
  declared and does not change. `/cad-audit` narrows on its own side instead:
  only an id that is exactly `PREFIX-N` or `#N` may break the verdict or enter
  `counts`, so `- **Note**: scope frozen` is reported as
  `active-non-id-bullet` rather than failing a gate under a name that is not a
  requirement, and `- **AUD-01:**` can never be counted twice.
- A bullet carrying a SECOND id-shaped bold span
  (`- **AUTH-01** and **AUTH-02**: both sides`) reports
  `active-multi-id-bullet`. The grammar reads the first span only, so without
  this the rest vanished with `issues: []` and a committed requirement could
  drop out of scope while the ship gate reported clean. The grammar is
  deliberately NOT widened to read every span: taking them all would mint an id
  out of ordinary emphasis (`- **GRM-01**: the **core** path` would declare
  `core`), the same silent failure reversed. Emphasis that is not id-shaped
  reports nothing, because nothing is lost.
- The two exits for a broken id: plan it into a phase (`/cad-plan` seeds the
  row), or move the bullet out of `## Active` into the deferred section below
  it (`## v2 Requirements` in the shipped template). A row with an em-dash
  Phase cell is `no-phase`, not an exit.
- A project with no `## Active` heading gains no break from this rule at any
  row count, so a pre-v1.4.0 tree audits exactly as it did before, until the
  heading is renamed. The grammar and its out-of-grammar table are written down
  in `cadence-core/references/req-traceability.md`, each row pinned by a
  parser-level test.

### Breaking

- `/cad-audit`'s `counts.total` is Traceability ROWS PLUS unpicked `## Active`
  ids, not `rows.length`. A caller written against `total === rows.length`
  reads a different number now that a break can exist with no row.
- `unseeded` is no longer verdict-neutral. This reverses the additive shape
  shipped one milestone earlier, deliberately: a diagnostic that never moves
  the verdict leaves the ship gate exactly as permeable as it was. A tree with
  an `## Active` id no phase has picked up now FAILs an audit that passed
  before.
- Under `git.on_protected: refuse`, a transparent prefix before a real commit
  (`sudo git commit`, `timeout 60 git commit`, `find . -exec git commit \;`)
  now ASKS rather than hard-denying. The enumerated prefix-command and
  shell-keyword sets that produced those denies are gone; each prefix carries
  its own option grammar, the tail proved open-ended across three review
  rounds, and the enumeration produced a false deny on `command -v git commit`,
  which runs nothing. A missing deny costs a prompt on a real commit; a wrong
  deny hard-blocks read-only work.

### Known gaps

- **Markdown decoration inside a frontmatter value that touches neither
  boundary.** `` - **`src/shared.rs`** `` still resolves to a value that
  matches no sibling's plain spelling, with no diagnostic. The boundary rule
  catches every wrap that reaches an edge; an interior backtick cannot be
  flagged without also flagging `` lib/a`b.mjs ``, which must stay clean -
  structurally identical inputs. Closing it means stating one rule about
  markdown in values, not adding a sixth arm.
- **`backtick-wrapped-value` fires on any key's scalar**, including prose keys
  no seam reads. Two plans with disjoint file lists can still get a
  `frontmatter_issues` entry and lose their parallel dispatch. Fails safe
  (throughput, not correctness); the shipped template has no prose scalar keys.
- **`seed-reqs`' `mismatched` result is computed but surfaced by no caller**,
  so a moved or renumbered requirement reports as a clean skip in the
  user-visible report.
- **A `blocked` worktree halt has no described remedy.** The no-self-repair
  halt is by design; what is missing is the orchestrator-side refresh path in
  `execute.md`.

## [1.3.1] - 2026-07-27

A tech-debt cycle. Every open bug filed by the post-v1.2.0 review sweep was
triaged, all thirteen were accepted, and all thirteen are fixed here. No new
features, no config keys, no workflow changes. The theme running through them is
that a seam which used to fail quietly now says so: a malformed shipped data
file, a bad flag value, an unreadable symlink and a backslash-wrapped
`git push` each used to degrade into something that looked like success.

### Fixed

**Silent data-file failures** (#39, #40, #43, #44)

- A malformed global or repo config layer is now skipped and named in a new
  `warnings[]` field rather than silently reverting every setting to its
  default, which was indistinguishable from the file being absent. `values` and
  `source` stay byte-identical to the absent case, and a merely-absent layer
  stays silent (`lib/config-merge.mjs`, `config.mjs get`).
- `route.mjs` and `config.mjs` read their shipped `route-table.json` /
  `config.schema.json` inside the dispatch guard, so a corrupt or missing one
  degrades to `{ok:false, reason:"bad-table"|"bad-schema"}` on one JSON line
  instead of throwing at module load. `CADENCE_ROUTE_TABLE` and
  `CADENCE_CONFIG_SCHEMA` inject fixtures hermetically.
- A corrupt `model-hints.json` surfaces a warning in the detect envelope instead
  of silently disabling `classify()`'s non-text-model exclude filter, which had
  been failing open (`review-provider.mjs`).
- `self-verify` treats an absent core surface dir, `weight-budgets.json` or
  `INTERNALS.md` as a failure on a full tree rather than skipping it and
  reporting green with zero coverage. Keyed on `.claude-plugin/plugin.json`, so
  minimal `--root` fixtures are unaffected.

**Seam input validation** (#42, #45)

- A shared `requireInt` guard (`lib/require-int.mjs`) rejects bad numeric flags
  before any write. `cursor set --total` no longer writes an unparseable
  STATE.md while reporting `ok:true`; `route.mjs resolve --attempt` no longer
  coerces NaN to `attempt:1`.
- `phase-done --reqs` keys off flag presence rather than truthiness, so the
  valueless form and an empty interpolated `--reqs ""` are both refused instead
  of bulk-closing the entire phase.
- A scalar or array top-level config is rejected on all three faces: `validate`
  errors at `(root)`, the read path skips it with a warning rather than
  returning the scalar at `source:"repo"`, and `config.mjs set` refuses to write
  over it.

**planning-files parser robustness** (#41, #46, #47, #48)

- `parseRequirements` bounds the Traceability section at the next `## ` heading
  and skips GFM alignment cells, so colon-aligned separators stop minting
  phantom requirement rows and failing `/cad-audit` for no reason.
- UAT items anchor on the first line and hand-added `### ` sections round-trip
  verbatim through a new `extras[]` channel; `uat merge` reports partial success
  with `skipped`/`rejected` counts instead of dropping appended items silently.
- `recall` joins an unquoted multi-word query instead of searching only its
  first word, and indexes completed captures with their phase and a `[closed] `
  marker instead of as junk.
- One `readFrontmatterList` serves both `requirements:` and `files:` in inline,
  block and scalar YAML forms, and a name-less `### Phase N:` heading parses.

**renumber and git-guard hardening** (#37, #49, #50)

- `renumber` leaves a decimal-phase STATE cursor where it is and emits a `warn`
  naming it, instead of silently shifting it onto a phase that does not exist.
- A colliding renumber destination is refused before any write, including the
  case where `git rm -r -q` exits 0 while leaving untracked or modified tracked
  files behind, which had let the next phase nest inside the removed one.
- A renumber apply that dies partway reports the ops that completed and the one
  that failed, rather than a bare `{ok:false, reason:"internal"}`. This is a
  report, not a rollback: the remove destroys a directory first, so a rollback
  would promise a guarantee the code does not have.
- One dangling or unreadable `.md` symlink no longer collapses a whole
  `self-verify` or `weigh` run. The walker skips it, and `self-verify` reports
  it as an `unreadable-surface` problem while finishing the rest of the lint.
- `git-guard` joins backslash line-continuations before parsing subcommands, so
  a wrapped `git \` + newline + `push` reaches the push rail. A single-pass
  alternating quote strip stops a real push beside a quote character from going
  silent, and a push inside a quoted multi-line string still produces no prompt.

### Known gaps

Recorded rather than hidden, both confirmed during phase-4 verification and
deferred by explicit decision:

- `weight.mjs` under-reports an entire subtree when one descendant is
  unreadable. `self-verify` still goes red, so CI does not pass silently. The
  fix wants per-entry recursion, not a wider catch.
- An `unreadable-surface` detail emits `readlinkSync`'s raw absolute target,
  contradicting the comment two lines above it. Cosmetic.
- Six pre-existing `git-guard` rail-3 holes (`git -C "my repo" push`, `&` as a
  separator, `$(git push)`, subshells, escaped quotes, `bash -c`) are silent
  both before and after this cycle and stay out of scope. They want one
  quote-state tokenizer, not more regex arms.

## [1.3.0] - 2026-07-24

"liteSpeed": a flow pass over the whole `/cad-*` surface that cuts coordinator
round-trips without changing what the workflows produce. Two shared conventions
let the spine batch independent known-path reads into one message and fan
independent subagent dispatches out concurrently, instead of walking them one
turn at a time. Three correctness bugs the audit surfaced ship alongside.

### Added

- Parallel-work and concurrent-dispatch conventions (`references/conventions.md`,
  `references/seams.md`), wired into ~18 workflows and skills: independent
  known-path reads batch into one message; independent agent dispatches fire
  concurrently, reusing one route resolution.
- `/cad-config` detects all review providers in one concurrent batch instead of
  serial per-provider timeouts.

### Fixed

- `/cad-progress --stats` no longer writes STATE.md in its documented read-only
  mode (it walked the cursor-reconcile step before the stats stop).
- `/cad-undo` applies the protected-branch guard before a committing revert, like
  every other commit-producing step.
- `/cad-config`'s interactive menu labels `(current)` from the repo file's own
  value, not the effective (possibly global-inherited) value, so an inherited
  global is no longer silently pinned into the repo file.

## [1.2.1] - 2026-07-23

Three high-severity fixes from a post-1.2.0 cross-model review sweep over the
executable seams. All three corrupted state or weakened protection while
reporting success - the silent class the sweep was hunting. Each ships with a
regression test written failing-first.

### Fixed

- **A newline in verifier-authored UAT text can no longer flip a verdict.**
  `renderUat` flattens every field value to one line on write, so an evidence
  string containing `"\nstatus: pass"` stays inert instead of reparsing as a
  second status line where last-assignment-wins silently turned a failed item
  into a pass and opened the phase gate. (#35)
- **`renumber insert` no longer corrupts the phase directories when the
  highest phase is a decimal insertion.** The dir-move ceiling is computed
  over integer phases only, so with a `2.1` present the countdown visits the
  integer dirs it must shift and leaves the decimal dir untouched - previously
  it did the exact opposite and still reported ok. (#36)
- **`git-guard` honors the config it documents.** `on_protected: "deny"` now
  hard-blocks as an alias of `refuse` (it previously fell through to a soft
  ask), and a lone-string `protected_branches` guards the named branch instead
  of silently reverting to `['main','master']` - in `git-publish` too. (#38)

## [1.2.0] - 2026-07-22

The judgment-sharpening cycle, dogfooded on Cadence itself. It repairs the
cross-model review seam so a second opinion actually fires instead of silently
no-opping, sharpens how the planner splits work and how context decides which
decisions are worth remembering, adds an on-demand way to stress-test one
load-bearing decision, and grows the cross-model roster with DeepSeek.

### Cross-model review, repaired

- **The run-as-script guard now compares realpaths on both sides**, so
  `review-provider.mjs` no longer no-ops when the plugin is installed through a
  symlink - cross-model `review` / `consult` / `detect-models` reach the real
  provider instead of degrading to the subagent unnoticed. A symlink regression
  test invokes the script through a link and asserts a non-empty JSON line.
- **An empty or unusable provider result surfaces one line** in the caller
  before falling back to `claude-subagent`, rather than degrading silently.

### Sharper planning and context

- **`cad-planner` carries a standing separation-of-concerns nudge** - a
  heuristic, not a hard rule - that prefers small single-purpose tasks over a
  shared core and splits responsibilities that differ on trigger, size,
  lifecycle, failure-resume, freshness, or ownership. It applies to every plan
  with no per-phase restatement and never forces a split that does not earn
  itself.
- **`cad-context` marks a decision durable only when it passes a three-part
  filter** (hard-to-reverse, surprising-without-context, and the result of a
  real trade-off). Durable decisions are written under a `## Durable decisions`
  heading and resurface via recall; the phase-local rest stay under
  `## Decisions`. Legacy `CONTEXT.md` files with only `## Decisions` still
  resurface unchanged - no retrofitting.

### Decision review

- **`/cad-decision-review <path>`** runs an on-demand refute-then-adjudicate
  pass over one load-bearing decision (a `CONTEXT.md` line or a `PROJECT.md` Key
  Decisions row) through the existing review subsystem. `cad-reviewer` - and a
  cross-model provider when one is configured - refutes the decision; the main
  model grounds each objection against Context7 (library/API claims) and the
  real codebase, then rules it `survives | partial | refuted` with a concrete
  amendment list. It never auto-fires and reports its cost qualitatively. New
  `review.decision_review.{tier,effort}` config governs the model.

### DeepSeek cross-model provider

- **DeepSeek is a third cross-model review provider**, via its own Chat
  Completions adapter (not an OpenAI Responses base-URL swap). Because DeepSeek
  has no server-side `json_schema`, the adapter uses `json_object` mode with the
  finding schema injected into the prompt and the shared validate-on-return
  guard, so a schema-ignoring response degrades to a structured `bad-shape`
  rather than bad data. `reasoning_effort` maps the effort dial and keys resolve
  via `DEEPSEEK_API_KEY`, never logged. Selectable through `review.reviewers`
  and `review.providers.deepseek.tiers.*`.

## [1.1.0] - 2026-07-17

The stable `1.1.0`, promoting the `rc.1` and `rc.2` line to a public release. The
full feature detail lives in those two entries below - recall, measured context,
the two-tier git model, and the release lifecycle all shipped there and carry
forward unchanged.

This final round closed the one acceptance the candidates could not: the
autonomous close (`git.auto_close`) was exercised live end-to-end against the
real remote - audit, tag, PR, merge, then reset to a pulled base with the merged
integration branch reaped - confirming the close chain the `rc.2` tests proved in
isolation also holds in a real publish. The never-auto-push rail via the
git-publish seam stays intact; `auto_close` remains opt-in and off by default.

## [1.1.0-rc.2] - 2026-07-17

Second release candidate toward `1.1.0`, built by dogfooding Cadence on itself.
This line closes Cadence's biggest self-admitted gap - its write-only memory -
turns the context-engineering claims into measured, CI-enforced facts, and gives
the plugin an explicit git branching model plus a release lifecycle that keeps
its own version honest. It accumulates the `rc.1` recall work and adds this
round's git model and release mechanics. The final `1.1.0` tag is cut only at
publish.

### Recall - the write-only memory gap, closed

- **`memory.backend` now defaults to `builtin`** (was the reserved, wired-to-`none`
  socket in `1.0.0`). `none` remains the off switch. The feature's value is being
  there without setup.
- **Deterministic BM25 recall over `.planning/`** as a zero-dep `planning.mjs
  recall` subcommand - same corpus and query always rank the same, no timestamps
  and no embeddings. An empty corpus returns `{ok:true, results:[]}`, never an
  error.
- **Recall is injected where past knowledge changes a decision:** `/cad-context`
  (assumptions), `/cad-plan` (task breakdown), and `/cad-debug` (hypotheses) each
  pull cited snippets at the moment they start reasoning.

### Measured context, enforced in CI

- **Per-surface context-weight measurement** (byte and estimated-token weight of
  agent and skill prose) via a deterministic seam subcommand.
- **A blocking self-verify budget check** names the surface and its overage, so
  prose bloat is caught mechanically, the same way drift is.
- **A blocking tools-declaration lint:** agent prose may reference only the tools
  declared in that agent's frontmatter.

### Two-tier git model

- **`git.integration_branch`** (`milestone` default, `trunk` escape hatch) plus
  **`git.auto_branch`** (`ask` | `auto` | `off`). In `milestone` mode a
  per-milestone integration branch is created at cycle start as the reconciliation
  point parallel worktrees fork from and merge into, keeping merge churn off
  `main`. `trunk` composes with the existing protected-branch guard and creates
  nothing.

### Land cleanup and opt-in autonomous close

- **`git.on_land_cleanup`** (default on): after a land or merge actually lands,
  return to base, pull, and reap the merged integration branch - never via a
  remote-tracking delete.
- **`git.auto_close`** (opt-in, default off): lets `/cad-milestone` and `/cad-land`
  run the whole close - audit, tag, PR or MR, merge, reset - with no per-step
  prompts. A blocking `pre_ship` finding still halts the chain before merge. With
  it off (the default), `/cad-land` still asks the publish mechanism with no
  preselected default: the opt-in never changes the default posture. The decision
  core, gate-halt, publish seam, and guard behavior are covered by tests; the full
  unattended chain has not yet been exercised end-to-end against a live remote, and
  that run is the gate for the final `1.1.0`.
- **The never-auto-push rail holds.** The GitHub arm's one sanctioned push runs
  through a code-guarded `git-publish` subprocess seam invoked only by `/cad-land`;
  every Bash `git push` the guard sees still asks unconditionally (the old
  `isPlainPush` command-string exemption was deleted).

### Release mechanics folded into the close

- **`release-bump.mjs`** bumps a distributed plugin's own `.claude-plugin/plugin.json`
  version and scaffolds the dated CHANGELOG heading and link reference as part of
  the milestone close, idempotently. Non-plugin projects are unaffected (it skips
  when no manifest is present). A plugin release stops shipping with a stale
  version.

### Release prep and store readiness

- **Public docs reconciled** to the shipped code (README, MANIFESTO, DESIGN,
  LINEAGE, NOTICE, CHANGELOG), verified by `/cad-docs-verify`.
- **DESIGN.md records the reversed decisions** with what changed and why - the
  never-auto-push reversal (opt-in `auto_close` plus the one sanctioned push seam)
  and the deleted `isPlainPush` whitelist.
- **GSD lineage framing settled** to independent distillation, with the ~3%
  documentary-mass figure date-labelled (measured 2026-07-10, GSD commit d010ea1).
- **Plugin-store metadata** added (`displayName`, marketplace description);
  `claude plugin validate --strict` exits clean.

## [1.0.0] - 2026-07-16

First public release. Cadence is a standalone planning-and-execution system for
Claude Code, installed as a plugin. Its methodology descends from
[GSD](https://github.com/open-gsd/gsd-core) (MIT) - the discuss/plan/execute/verify
loop - but the codebase is an independent distillation carrying roughly 3% of GSD's
documentary mass (measured 2026-07-10, GSD commit d010ea1). See
[`LINEAGE.md`](./LINEAGE.md) for the measured distance and
[`NOTICE.md`](./NOTICE.md) for the attribution.

### The loop

- One disciplined cycle: `/cad-new-project` then `/cad-context`, `/cad-plan`,
  `/cad-execute`, `/cad-verify`, per phase, with `/cad-progress` reporting where
  you stand and auto-resuming incomplete work.
- One atomic conventional commit per task.
- Durable state lives in `.planning/` files and git, never in the conversation,
  so you can `/clear` at any phase boundary and the next command rebuilds from
  disk.
- 22 skills and 7 agents, and nothing beyond them: no team or multi-author
  tooling, no feature catalog.

### Determinism ladder

- **Deterministic seams.** Every read and write of `.planning/` state, model
  routing, and config validation runs through small zero-dependency Node scripts
  (`planning.mjs`, `route.mjs`, `config.mjs`, `review-provider.mjs`) that emit one
  JSON line and never block the loop. Prose keeps the judgment; the scripts keep
  the invariants.
- **Harness-enforced git rails.** The protected-branch guard is a `PreToolUse`
  hook (`git-guard.mjs`), enforced by the harness rather than by prose the model
  can talk itself out of. It acts only inside a Cadence project and never touches
  unrelated repositories.

### Git model

- Atomic commits, never an automatic push, and a `/cad-land` step that asks how
  you want to publish (push, MR or PR, tag, or leave local) with no preselected
  default.

### Review and routing

- Adversarial review is a first-class, configurable subsystem: a fresh-context
  Claude reviewer by default, with pluggable cross-model reviewers (OpenAI and
  Gemini, direct API calls with provider-enforced structured output). A
  user-gated consult can bring a second model's angles to a debugging dead-end.
- Model routing ships three profiles (fast, balanced, quality) plus an optional
  `auto` mode that picks model (and effort, via role variants) per task, with
  guardrails. Failure escalation only ever raises; a retry is never demoted.

### Memory

- A built-in minimal memory (`.planning/CAPTURE.md`). `memory.backend` reserves
  the seam for a richer backend; only `none` is wired today.

### Hardening pass (2026-07-16, before tagging)

The entry above was drafted 2026-07-15; before cutting the tag, the whole
codebase went through a claims audit and a four-pass sweep, and everything
found was fixed in this release rather than deferred.

- **Parallel safety is arithmetic now.** `planning.mjs plan-overlap` intersects
  the declared file lists of a phase's plans; `/cad-execute` refuses to
  parallelize on any overlap or any plan with no declarations.
- **New review trigger `phase_diff`** (opt-in, off by default): one aggregate
  review of the merged phase diff after parallel execution, because per-plan
  reviews cannot see cross-plan interactions.
- **Configurable consult cadence:** `review.consult.attempt_threshold`
  (default 3) sets how many failed fixes count as a dead-end in `/cad-debug`.
- **Working-method discipline** (after Karpathy's "Recipe" generalized):
  planners order tasks skeleton-first (a wired tracer bullet by commit 2-3),
  executors state the expected output before running each verification and
  record surprises as deviations, and every goal-check claim carries file:line
  or command-output evidence.
- **Guard hardening:** the push rail matches the actual git subcommand
  (`git stash push` and quoted arguments no longer trip it), the project check
  walks up from subdirectories, and the hook is time-bounded.
- **Model detection fixes:** legacy non-reasoning families and Gemini 2.x are
  no longer steered into effort parameters their APIs reject.
- **Ten config keys with no reader were pruned** rather than documented,
  including a `git.auto_push` switch that contradicted the no-push rail.
- **Self-verification in CI:** a drift linter proves every config key, script
  invocation, and path named in the prose exists in the code, on every push.
  Plus typechecking of the `@ts-check` pragmas and a Node 22/24 matrix.
- **Tests: 84 to 132**, covering the previously untested invariants, with
  hermetic fixtures and midnight-robust assertions. The pass surfaced and
  fixed two latent bugs in decimal-phase renumbering.

### Install

```
/plugin marketplace add https://github.com/crenshawdev/cadence.git
/plugin install cadence@cadence
```

[3.7.5]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.5
[3.7.4]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.4
[3.7.3]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.3
[3.7.2]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.2
[3.7.1]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.1
[3.7.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.7.0
[3.6.1]: https://github.com/crenshawdev/cadence/releases/tag/v3.6.1
[3.6.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.6.0
[3.5.9]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.9
[3.5.8]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.8
[3.5.7]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.7
[3.5.6]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.6
[3.5.5]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.5
[3.5.4]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.4
[3.5.3]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.3
[3.5.2]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.2
[3.5.1]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.1
[3.5.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.5.0
[3.4.1]: https://github.com/crenshawdev/cadence/releases/tag/v3.4.1
[3.4.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.4.0
[3.3.1]: https://github.com/crenshawdev/cadence/releases/tag/v3.3.1
[3.3.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.3.0
[3.2.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.2.0
[3.1.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.1.0
[3.0.0]: https://github.com/crenshawdev/cadence/releases/tag/v3.0.0
[2.6.2]: https://github.com/crenshawdev/cadence/releases/tag/v2.6.2
[2.6.1]: https://github.com/crenshawdev/cadence/releases/tag/v2.6.1
[2.6.0]: https://github.com/crenshawdev/cadence/releases/tag/v2.6.0
[2.5.0]: https://github.com/crenshawdev/cadence/releases/tag/v2.5.0
[2.4.0]: https://github.com/crenshawdev/cadence/releases/tag/v2.4.0
[2.3.0]: https://github.com/crenshawdev/cadence/releases/tag/v2.3.0
[2.2.0]: https://github.com/crenshawdev/cadence/releases/tag/v2.2.0
[2.1.0]: https://github.com/crenshawdev/cadence/commit/e457e47
[2.0.0]: https://github.com/crenshawdev/cadence/releases/tag/v2.0.0
[1.5.0]: https://github.com/crenshawdev/cadence/releases/tag/v1.5.0
[1.4.1]: https://github.com/crenshawdev/cadence/releases/tag/v1.4.1
[1.4.0]: https://github.com/crenshawdev/cadence/releases/tag/v1.4.0
[1.3.1]: https://github.com/crenshawdev/cadence/releases/tag/v1.3.1
[1.3.0]: https://github.com/crenshawdev/cadence/releases/tag/v1.3.0
[1.2.1]: https://github.com/crenshawdev/cadence/releases/tag/v1.2.1
[1.2.0]: https://github.com/crenshawdev/cadence/releases/tag/v1.2.0
[1.1.0]: https://github.com/crenshawdev/cadence/releases/tag/v1.1.0
[1.1.0-rc.2]: https://github.com/crenshawdev/cadence/releases/tag/v1.1.0-rc.2
[1.0.0]: https://github.com/crenshawdev/cadence/releases
