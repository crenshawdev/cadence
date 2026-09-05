# Phase 1: The baseline and the two probes - Context

Gathered: 2026-09-05
Feeds: /cad-plan 1

## Scope boundary

In: OQ-1, OQ-2 and OQ-3 answered with observations. OQ-3 is answered by MINING
the trace and reads records already on disk - no live measurement run. OQ-1 and
OQ-2 are answered by two probes against the running Claude Code CLI. Output is
three spike records plus in-place edits to `.planning/ROADMAP.md` and
`docs/rationale/architecture-v4.md`.
Out: any Rust. Any behavior change to the 3.7.12 tree. Any instrumentation
added to record what the existing record does not already carry. Writing the
ToolSearch preamble itself into any skill file - OQ-1's verdict decides whether
and how that gets written, in a later phase.
Deferred: None.
Plan shape: one plan.

## Durable decisions

- D-01 (Corpus): The OQ-3 corpus is `/projects/cadence-archive-v3.7.12/.planning/`,
  never `/code/cadence/.planning/trace.jsonl`. The archive holds 3,619 lines /
  933,844 bytes spanning 2026-08-07T18:39:40Z to 2026-09-05T18:33:03Z, rendering
  574 brackets over 118 `corr` values. The working-directory record is
  gitignored (`/code/cadence/.gitignore:32`) and was reset by the 2026-09-05
  delete-and-re-clone to 20 lines: 19 `routing/resolve` events, 1 unpaired
  `lifecycle/dispatch`, `"brackets":[]`. Evidence: `/code/cadence/.gitignore:32`,
  `/projects/cadence-archive-v3.7.12/.planning/trace.jsonl`,
  `cadence-core/bin/lib/trace.mjs:145`.
- D-02 (OQ-3 prompt size): "Prompt size per dispatch" is reported as TWO
  labeled numbers, and neither is called "prompt size" unqualified. Static
  `dispatchBytes` per role from `node cadence-core/bin/weight.mjs resident`, and
  terminal `tokens` p75 per role from `node cadence-core/bin/planning.mjs trace
  window`. The composed dispatch prompt's own size is recorded nowhere on disk
  and is not recoverable. Evidence:
  `cadence-core/references/seam-spawn-agent.md:28-42`,
  `cadence-core/bin/lib/resident-weight.mjs:299-366`,
  `cadence-core/bin/lib/trace.mjs:1273-1278`.
- D-03 (OQ-3 topology): Every per-phase figure is reported twice, serial-only
  and all-phases, because 54 of the 118 recorded `corr` values carry more than
  one numeric executor plan key and 4.0.0 drops the parallel worktree path. The
  gap between the two figures is the dropped feature's cost and is stated as
  such. Evidence: `.planning/ROADMAP.md:26-34`,
  `cadence-core/bin/lib/read-trace.mjs:1309-1316`.
- D-04 (Landing): Phase 1 edits `.planning/ROADMAP.md`'s Open Questions section
  IN PLACE - each of OQ-1, OQ-2, OQ-3 replaced by its verdict plus the path to
  its spike record - and corrects the two sentences the mined-baseline scope
  makes false ("across one real phase" at `:73-77`, "on a real phase" at
  `:93-94`). SPIKE.md is not phase-linked and nothing in `cadence-core/bin`
  parses it, so a tracked prose citation is the only mechanism that reaches
  phase 2. Precedent: `.planning/spikes/host-effort-downgrade/SPIKE.md:86-93`.

## Decisions

- D-05 (Corpus): Non-Cadence and experiment traffic is excluded before any
  total: `cadence:zz-abtest-noexcerpt` (61 calls, the excerpt A/B control) and
  `hookify:conversation-analyzer` (2 calls). Evidence:
  `cadence-core/bin/lib/read-trace.mjs:1264-1291`.
- D-06 (Method): No instrumentation and no code change. Phase 1 writes no Rust,
  adds no field to any record, and alters no shipped behavior. Anything the
  record does not already carry is reported as not derivable rather than made
  derivable. Evidence: `.planning/ROADMAP.md` phase 1 detail.
- D-07 (OQ-3 main thread): The main-thread proxy is `reads.jsonl` rows with
  `agent: "coordinator"`, attributed to a phase by joining their `ts` into a
  `corr`'s min-dispatch-to-max-close window; 3,672 of 3,823 coordinator rows
  (96%) fall inside one. BOTH `reads.jsonl` (9,839 lines, Aug 29 - Sep 5) and
  the rotated `reads.1.jsonl` (40,091 lines, Aug 14 - Aug 29, full to its
  8,388,608-byte cap) are parsed by a throwaway script, because the shipped
  seam reads only the live file and `joinReads` drops the `bytes` field from
  its row shape. Nothing before 2026-08-14 is recoverable. Evidence:
  `cadence-core/bin/lib/read-trace.mjs:55`, `:93`, `:397`, `:1345`, `:1366`,
  `cadence-core/bin/planning/reads.mjs:16-32`, `:53-60`.
- D-08 (Method): Every figure publishes its denominator, and `unrecorded` stays
  distinct from a recorded zero. Corpus counts over 574 brackets: `tokens` 528,
  `turns` 385, `duration_ms` 138, cache keys 147, `agent_id` 163, `effort`/`rung`
  39. A per-role mean divides by `dispatches - unrecorded`, never by
  `dispatches`. The role keys `""` (11 dispatches) and `cad-task` (13) are
  figureless by construction and are excluded from any all-roles mean.
  Evidence: `cadence-core/references/seam-spawn-agent.md:63-68`, `:145-153`,
  `cadence-core/bin/lib/trace.mjs:1233-1241`, `:1312-1319`.
- D-09 (Artifact): Three spike slugs under `.planning/spikes/`, one per open
  question, each a conventional one-verdict record carrying exactly one
  `VERDICT:` line. All nine existing records under `.planning/spikes/` have this
  shape and all are tracked in git. Evidence:
  `cadence-core/workflows/spike.md:12-21`, `:36-51`,
  `.planning/spikes/host-effort-downgrade/SPIKE.md:81`, `:86`.
- D-10 (Landing): The AC3 and AC4 figures also go into
  `docs/rationale/architecture-v4.md`, beside the go/no-go threshold they
  are judged against, with a citation to the spike-record path. Evidence:
  `.planning/ROADMAP.md` overview (design doc named as the architecture of
  record, written 2026-09-05).
- D-11 (OQ-1/OQ-2): Both probes start from zero in-tree prior art - a grep for
  `ToolSearch|preCompactDiscoveredTools|deferred tool|tool search|discovered_tools`
  across `*.md`, `*.mjs` and `*.json` returns three hits, all inside this
  cycle's own ROADMAP Open Questions block. The preamble surface is confirmed at
  28: `skills/cad-*/SKILL.md` = 34 minus `skills/cad-*-contract/SKILL.md` = 6,
  corroborated by `weight.mjs resident` emitting exactly 28 `commands` rows.
  Evidence: `.planning/ROADMAP.md:58`, `:66`, `:69`,
  `cadence-core/bin/lib/resident-weight.mjs:253`.

## Acceptance criteria

- [ ] AC1: Three files exist under `.planning/spikes/`, one per open question,
      each carrying exactly one `VERDICT:` line reading `validated`,
      `invalidated` or `inconclusive`.
- [ ] AC2: `.planning/ROADMAP.md`'s Open Questions section shows a verdict and a
      spike-record path for each of OQ-1, OQ-2 and OQ-3, and the strings "across
      one real phase" and "on a real phase" do not appear anywhere in the file.
- [ ] AC3: The OQ-3 record states, for each of the six dispatched roles, a
      static `dispatchBytes` figure and a terminal `tokens` p75, each with the
      dispatch count it was computed over and the unrecorded count excluded.
- [ ] AC4: The OQ-3 record states a per-phase-run coordinator byte figure for
      two populations, serial-only and all-phases, each with its n, and names
      the date range the reads corpus covers.
- [ ] AC5: `docs/rationale/architecture-v4.md` contains the AC3 and AC4
      figures with a citation to the spike-record path.
- [ ] AC6: The OQ-1 record states, from an observed run, the token cost of a
      first `ToolSearch` load and of a second `ToolSearch` for an
      already-loaded schema, as two numbers. (human-verify: needs a live Claude
      Code CLI session)
- [ ] AC7: The OQ-2 record states, from one observed compaction, whether a tool
      loaded before the boundary was still callable after it with no reload.
      (human-verify: needs a live Claude Code CLI session that compacts)

## Flagged assumptions

- The host's `Done (N tool uses - X tokens - Ys)` rendering was stable across
  2026-08-07 to 2026-09-05 - Unclear; every `tokens` figure in the corpus is
  hand-copied off that line and Cadence can test for no version. If wrong, the
  528 token figures are not one population and the p75s in AC3 are a blend. The
  `dispatchBytes` half of AC3 is host-independent and unaffected. Decided
  2026-09-05 to flag rather than chase: a step change in the distribution cannot
  be told apart from a workload change.
- The archive `trace.jsonl` sits at 933,844 of the 1,048,576-byte read cap
  (89.1%) - Confident; `trace render` reports `"capped":false` today. If the
  file grows past the cap the reader takes the FIRST `MAX_TRACE_BYTES` and drops
  the trailing partial line, so the NEWEST brackets are lost to the pairing, not
  the oldest. Evidence: `cadence-core/bin/lib/trace.mjs:145`, `:322-337`.
- An unconditional preamble in all 28 command skills would cross 28 pinned
  `weight-budgets.json` ceilings at once - Likely; `self-verify.mjs` (CWT-02)
  enforces them and the manifest permits intentional raises. Not this phase's
  work; it is what OQ-1's verdict has to be actionable against. Evidence:
  `cadence-core/bin/weight-budgets.json:2`, `cadence-core/bin/weight.mjs:3-10`.
- The shipped `workflow.max_dispatch_tokens` defaults are stale against today's
  corpus - Confident, measured but out of scope here. Recomputed p75s:
  `cad-planner` 206,434 (n=101, ceiling 200,000), `cad-executor` 179,483
  (n=241), `cad-verifier` 99,474 (n=89), `cad-assumptions-analyzer` 137,165
  (n=82), `cad-reviewer` 124,193 (n=10), `cad-plan-checker` 64,203 (n=5).
  Planner exceeds its own ceiling at p75. Phase 1 reports this; it does not
  retune a tree that is being replaced.
