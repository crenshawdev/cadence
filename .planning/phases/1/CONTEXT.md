# Phase 1: The corpus, read back at a file and line - Context

Gathered: 2026-08-22
Feeds: /cad-plan 1

## Scope boundary

In: `/cad-why <path>[:<line>]` as a deterministic read-only seam join - a
`git log` chain over the queried path, newest first, with each commit joined to
its phase, plan task, D-NN decision, deviation and surviving review finding,
each quoted in the record's own words. Recovery of pruned and renumbered phases
out of git history. Stated results for the two no-join arms.
Out: any write to the record. This phase changes nothing on the write side - not
the `corrected by` deviation marker `/cad-execute` never emits, not a structured
decision cite in PLAN.md, not the ARCHIVE.md row grammar. It gates nothing,
dispatches no subagent, and adds no model judgment or summarization pass to the
join. `RBK-01`, `FST-01`, `FST-02` and `FST-03` are not this phase.
Deferred: None.
Plan shape: multiple plans, same phase - the analyzer's evidence separates the
git-log chain plus its stated-result arms (AC1/AC3/AC5), the reverse
commit-to-phase map over pruned milestones (AC4), and the five per-edge record
readers (AC2). /cad-plan breaks it down.

## Durable decisions

- D-01 (command surface): `/cad-why` ships as a new top-level
  `cadence-core/bin/` script, not a `planning.mjs` subcommand, because its
  primary argument is a repo path while `planning.mjs`'s dispatcher passes
  `--dir <planning-root>` to every handler and all 16 of its git calls are
  `-C <root>` against `.planning`. A new bin needs a `CONTRACTS` row or
  self-verify check 14 fires `uncontracted-script`. Evidence:
  `cadence-core/bin/planning.mjs:2517,5726,6267`,
  `cadence-core/bin/lib/arg-contract.mjs:488-1055`,
  `cadence-core/bin/self-verify.mjs:1196-1203`; precedent in
  `cadence-core/bin/git-guard.mjs`, `read-trace.mjs`, `skim.mjs`.
- D-02 (seam contract): the seam emits ONE JSON object carrying a pre-rendered
  `text` field holding the chain; the skill relays that field verbatim and may
  not reformat it. This keeps the one-JSON-object stdout rule while putting the
  bytes AC6 asserts inside the seam, where a test can hold them. Rejected:
  letting the skill render the chain, which would make criterion 6 a claim about
  model-authored text no test in `cadence-core/bin/*.test.mjs` can assert.
  Evidence: `cadence-core/bin/lib/seam-io.mjs`.
- D-03 (storage tiers): the join must read three tiers, because which one holds
  the record changes with milestone age - live `.planning/phases/<N>/`
  (currently EMPTY), `_archive-v<ver>/<N>/` from the `--mode archive` closes (27
  complete phase directories on disk), and git history alone for the `--mode
  delete` closes. Evidence: `cadence-core/bin/planning.mjs:6398-6537`
  (`cmdMilestonePrune`, `--mode <delete|archive>`); `git show 72940906 --stat`
  deletes 18 phase artifacts with no archive copy.
- D-04 (ARCHIVE.md): `.planning/ARCHIVE.md` carries NO commit-to-phase edge and
  cannot supply one, so criterion 4's "still prints what ARCHIVE.md carries"
  means the phase's deviation, UAT and decision snippets reached by other means,
  never a commit lookup. Its row grammar is origin path plus free text; of 558
  rows measured, only 18 contain any hex token and those are incidental prose
  inside deviation text. Only `Deviations` and `Open items` reach the file - the
  `## Commits` table is never archived. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:1038`, `:806-820`.
- D-05 (pruned recovery): pruned milestones resolve through a reverse
  commit-to-phase map built in ONE pass -
  `git log --diff-filter=D -- '.planning/phases/*/SUMMARY.md'` finds the close
  commits, and each parent tree's recovered SUMMARY `## Commits` tables populate
  the map. The prune commit also appends ARCHIVE.md's `## <label>` heading in the
  same commit, which binds a milestone label to a prune commit deterministically.
  Rejected: lazy per-commit `git show`, which reruns the prune search per entry.
  Evidence: `git show 72940906^:.planning/phases/1/SUMMARY.md` returns the full
  v3.5.9 phase-1 SUMMARY with its `## Commits` table and `Phase range` line; 248
  of 248 shas extracted from archived `## Commits` tables resolve with
  `git cat-file -e`.
- D-06 (commit scope): the conventional-commit scope `<type>(<phase>-<plan>)` is
  corroboration and a named fallback, NEVER the primary key, because phase
  numbers reset every milestone - `feat(1-1)` exists in seven cycles. Reading it
  as the phase key is exactly the guessed phase number criterion 4 forbids, and
  the failure is invisible because both directories legitimately exist. Measured
  over 1,711 commits: 749 carry `(N-M)`, 190 carry `(N)`, 526 are conventional
  with no scope, 135 non-conventional. Evidence:
  `cadence-core/workflows/execute.md:194`,
  `skills/cad-executor-contract/SKILL.md:95`,
  `cadence-core/workflows/undo.md:11`.
- D-07 (trace.jsonl): `.planning/trace.jsonl` is gitignored, so it cannot be a
  required input - anything read from it is local-only enrichment that must
  degrade to absent on a clone or in CI. Rejected: anchoring the join on its
  `corr` (`<phase>-<phase_start sha>`), which would work here and return an empty
  chain everywhere else. Evidence: `.gitignore` "Joined run record" block;
  `cadence-core/bin/lib/trace.mjs:212-230`.
- D-08 (commit-to-task edge): the SUMMARY `## Commits` table is the authoritative
  commit-to-plan-task edge and needs a NEW reader - nothing in
  `lib/planning-files.mjs` parses it today, and `workflows/undo.md:3-12` reads it
  by model. Its `Task` cell is not an integer (`fix`, `fix 1`, `fix 2` appear) and
  its sha abbreviation length varies by era (7 chars in the older summaries, 8 in
  v3.5.9), so neither `Number()` nor a fixed-width slice is safe. Evidence:
  `cadence-core/templates/SUMMARY.md`; 26 of 27 archived summaries carry the
  section; `.planning/_archive-v3.4.0/1/SUMMARY.md`.
- D-09 (deviation edge): the deviation-refutes-a-decision edge does not exist in
  machine-readable form, so `/cad-why` names the missing marker by name and then
  prints the phase's deviation bullets unjoined and labelled phase-scoped.
  `execute.md:437-444` prescribes appending `[corrected by plan-<k> deviation:
  ...]` to the refuted D-NN line; 0 of 792 D-NN lines across the archived and
  git-recovered CONTEXT files carry it, and only 6 of 123 `## Deviations` bullets
  name any D-NN. Rejected: reporting the edge as "none", which would hide the
  write-side gap this phase exists to expose. Evidence:
  `cadence-core/workflows/execute.md:437-444`.
- D-10 (decision edge): an entry reaches its D-NN by explicit textual cite when
  the plan's `## Context` or the task body names one, and otherwise prints the
  resolved phase's decisions labelled phase-scoped - never silent, never
  inventing a task-level edge the record does not carry. Nothing in a PLAN.md or
  SUMMARY.md structurally references a D-NN; the template's `## Context` is free
  prose. Reads `## Durable decisions` first with the documented `## Decisions`
  fallback [corrected by plan-2 deviation: the `## Decisions` fallback never
  fires - `## Durable decisions` is present in 27 of 27 CONTEXT files, so
  `parseContextDecisions` alone leaves 243 of 435 decision bullets (56%)
  unreachable and D-08 read back as a false gap]. Evidence: `cadence-core/bin/lib/planning-files.mjs:998-1007`
  (`parseContextDecisions`); all 26 archived CONTEXT files carry
  `## Durable decisions`; 405 of 418 D-NN lines match the template shape.
- D-11 (review edge): surviving review findings come from
  `ADJUDICATION-<trigger>-<discriminator>[-rN].json` entries with
  `ruling: "survived"`, joined to a commit through the record's
  `base_id`/`head_id` range. SUMMARY prose is not a viable source: review
  sections appear under five different one-off spellings, one file each, against
  `## Commits` at 26 of 26. Evidence:
  `cadence-core/bin/lib/adjudication-record.mjs:79,99-100`;
  `git show 72940906^:.planning/phases/1/ADJUDICATION-plan-cad-plan-64cf967.json`
  carries `base_id`/`head_id` plus verbatim `claim`, `failure_scenario`,
  `counter_evidence`.
- D-12 (declared files): a task-attributed declared-files reader is added BESIDE
  `parsePlanFiles` rather than changing it, because `plan-overlap` depends on its
  current behavior. The existing task-line regex is single-line and returns one
  flat array with no task attribution; 92 of 251 task `Files:` lines across the
  27 archived plans wrap onto a continuation line, so 37% of declared task paths
  would never match. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:2277-2393`,
  `cadence-core/bin/lib/lease-grammar.mjs`.

## Decisions

- D-13 (bulk output): the prescribing `/cad-why` call registers in
  `cadence-core/bin/lib/bulk-output.mjs` or the command carries a default entry
  cap, or self-verify check 20 reports an unclassified prescribing site and AC7
  cannot pass [corrected by plan-1 deviation: check 20 cannot report this site -
  `BULK_SHAPES` watches only `trace render`, `recall` and `git diff`, so the
  decision is met by its other arm, task 2's default entry cap of 10]. Raw `git log` bytes before any join already cross the 10,000-byte
  threshold on two of four sampled paths: `cadence-core/bin/planning.mjs` 21,684 B
  over 144 commits, `cadence-core/workflows/execute.md` 10,098 B over 68.
  Evidence: `cadence-core/references/conventions.md:144-147`.
- D-14 (surface registration): the phase adds `skills/cad-why/SKILL.md`, a
  `cadence-core/bin/weight-budgets.json` row and a
  `cadence-core/references/COMMANDS.md` row; a separate
  `cadence-core/workflows/why.md` is optional - `skills/cad-health/SKILL.md` is
  self-contained and `skills/cad-report/SKILL.md` delegates, and both pass today.
  A SKILL.md with no budget row makes self-verify return `unbudgeted-surface`.
  Evidence: `cadence-core/bin/lib/surface-weight.mjs:8-20`,
  `cadence-core/bin/self-verify.mjs:727-742`.
- D-15 (git invocation): the bare-path arm and the `:<line>` arm use DIFFERENT
  git invocations - `--follow` and `-L` are mutually exclusive
  (`fatal: --follow requires exactly one pathspec`), and `--follow` also reorders
  the answer on a bare path. Evidence: measured 2026-08-22 against this repo on
  `.planning/phases/1/SUMMARY.md` and
  `cadence-core/bin/lib/adjudication-record.mjs`.
- D-16 (no-result arms): a path git has never seen is detected EXPLICITLY, not
  inferred from an empty chain, and the `-L` arm's hard failure is caught and
  converted to a stated result. `git log --format=%H -- no/such/file` prints
  nothing and exits 0 - observably identical to a real path with no commits -
  while `git log -L 1,1:nope -s` exits non-zero with a `fatal:` that would break
  the one-JSON-object stdout contract. Evidence: measured 2026-08-22.
- D-17 (determinism discipline): emit full 40-char shas and match corpus
  abbreviations by prefix in either direction, pin `-M` explicitly, and sort every
  emitted array by an explicit key (commit date then full sha) rather than
  trusting git's or the filesystem's order. Renames are pervasive in the surface
  this command reads: 173 rename records in the last 400 commits, including
  wholesale `phases/1/*` to `_archive-v3.4.0/1/*` moves and 3 renumber renames.
  Evidence: `cadence-core/bin/planning.mjs:5726`.

## Acceptance criteria

- [ ] AC1: The seam invoked with a bare `<path>` emits one JSON object whose
      `text` field holds a chain of the commits touching that path, newest first,
      and the `/cad-why` skill's output is byte-identical to that field.
- [ ] AC2: Each chain entry names its commit, phase, plan task, D-NN decision,
      deviation and surviving review finding, each quoted verbatim from the
      record. A join that is phase-level rather than task-level carries a
      phase-scoped label, and the absent `corrected by` deviation marker is named
      as a gap rather than reported as "none".
- [ ] AC3: `<path>:<line>` returns only commits whose diff touched that line, and
      a bare path returns the AC1 chain unchanged - neither invocation exits
      non-zero on a path present at HEAD.
- [ ] AC4: A commit behind a pruned milestone resolves its phase through the
      reverse commit-to-phase map and prints the recovered plan task and
      decision. When the map has no entry the output names the gap and the
      milestone label and still prints what git history carries. No phase number
      appears in output that was not read from a recovered artifact.
- [ ] AC5: A path git has never seen returns a stated not-in-history result; a
      path in history with no `.planning/` join returns its chain with each join
      field stated absent. Neither returns an empty chain, and no raw git
      `fatal:` reaches stdout.
- [ ] AC6: A test in `cadence-core/bin/` runs the seam twice over an unchanged
      tree and asserts byte-identical stdout; the run dispatches no subagent.
- [ ] AC7: `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
      with `problems: []`, and `node cadence-core/bin/test.mjs` reports 0
      failures.

## Flagged assumptions

- `-L` resolves its pathspec against a commit rather than the whole history, so
  the narrow arm may need an explicit commit anchor for a path that existed in
  history but not at HEAD - Likely; the fatal was measured, the fix was not. If
  wrong, AC3 and AC5 interact: a deleted path either crashes the narrow arm or
  answers differently from the bare-path arm.
- Every `ADJUDICATION-*.json` entry carries both `base_id` and `head_id` -
  Likely; verified on one git-recovered record, not across the corpus. If wrong,
  the review edge falls back to joining by the finding's `file` field and the
  per-commit claim in AC2 weakens to per-plan.
