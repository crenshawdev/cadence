# Phase 1: Recall engine - Context

Gathered: 2026-07-16
Feeds: /cad-plan 1

## Scope boundary

In: A `recall` subcommand on planning.mjs — zero-dep BM25 over `.planning/` artifacts, backend-gated by `memory.backend`, with the schema/default flip to `builtin`, CONTRACTS entry, tests, and the three prose wording updates its existence obligates.
Out: Consumers (cad-context/cad-planner/cad-debug injection) — phase 2. External backends (mem-*/MCP) — v2 (RCL-06). Any write-path change to CAPTURE.md.
Deferred: None
Plan shape: one plan

## Decisions

- D-01 (surface): `recall "<query>"` joins the planning.mjs COMMANDS dispatch table — positional query, `--dir` honored, one JSON line via seam-io, exit 0 on ok:true / 1 on ok:false. Evidence: cadence-core/bin/planning.mjs dispatch header, lib/seam-io.mjs.
- D-02 (surface): Empty or absent corpus returns `{ok: true, results: []}` exit 0; deliberately does NOT copy cmdStatus's `no-planning-dir` failure path. Evidence: RCL-02; contrast planning.mjs cmdStatus.
- D-03 (surface): `memory.backend: none` → `ok: true`, exit 0, explicit backend-off field, no results — off is a successful check with a negative answer, matching the plan-overlap precedent. Evidence: cmdPlanOverlap in planning.mjs.
- D-04 (surface): Drift-lint obligation this phase is the CONTRACTS entry alone (invocation check is prose→table, one-directional); `recall` stays out of the TWO_WORD set. Evidence: self-verify.mjs lines 34-74, invocation regex.
- D-05 (corpus): Indexed corpus is exactly: `phases/*/SUMMARY.md`, `.planning/CAPTURE.md`, `phases/*/UAT.md`, and the Decisions section of `phases/*/CONTEXT.md`. PROJECT/ROADMAP/STATE/REQUIREMENTS/PLAN are not indexed. Evidence: RCL-01.
- D-06 (corpus): BM25 documents are item-level snippets — one SUMMARY deviation/open-item bullet, one CAPTURE line, one UAT item, one D-NN decision line — not whole files. Evidence: templates/SUMMARY.md, workflows/execute.md CAPTURE format, templates/UAT.md, workflows/context.md D-NN format.
- D-07 (corpus): Phase attribution from the `phases/<N>/` directory segment (decimal names legal) and `(phase N)` tags in CAPTURE; phaseless snippets omit the field per the omit-optionals output convention. Evidence: planning.mjs join(dir,'phases',...), lib/planning-files.mjs decimal handling.
- D-08 (corpus): New corpus parsers live in `lib/planning-files.mjs` (the single .planning grammar home); UAT snippets reuse existing `parseUat`. Evidence: planning-files.mjs header contract.
- D-09 (config): `memory.backend` schema enum becomes `["none","builtin"]` with default `builtin`; both explicit `"none"` pins flip too — `cadence-core/templates/config.json` and this repo's `.planning/config.json` (repo layer beats schema default). Evidence: config.schema.json line 34, templates/config.json line 22, lib/config-merge.mjs.
- D-10 (config): recall reads the effective backend itself via shared `mergeLayers` (same layering as route.mjs/git-guard.mjs); recall tests must pin `CADENCE_GLOBAL_CONFIG` for hermeticity — planning.test.mjs's current run() helper sets no env and cannot be reused as-is. Evidence: lib/config-merge.mjs, route.test.mjs:32, git-guard.test.mjs:30.
- D-11 (config): `builtin` is read-side only — CAPTURE.md remains the write path; the three prose surfaces claiming only `none` is wired get wording updates this phase: `cadence-core/workflows/config.md` (~line 93), `skills/cad-capture/SKILL.md` (note routing), `README.md` (~line 115). Evidence: those files; README is a linted surface via self-verify mdFiles.
- D-12 (determinism): Sorted corpus traversal (never raw readdirSync order) + total result order (BM25 score desc, tie-break on source path then position); no timestamp or date field in recall output. Evidence: planning.mjs determinism header, derivePhases sort.
- D-13 (tests): Recall tests live in planning.test.mjs; extend the makeTree fixture to write real SUMMARY/CAPTURE/UAT/CONTEXT bodies (today SUMMARY is frontmatter-only); cover ranking, empty corpus, determinism (byte-compare two runs). Evidence: planning.test.mjs makeTree lines 25-72; self-verify.test.mjs repo-passes gate.
- D-14 (BM25): Textbook parameters — k1=1.2, b=0.75, lowercase alphanumeric tokenization, small fixed English stopword list, no stemming. Deterministic, zero-dep, verifiable against any BM25 reference. Decided by user (research topic; no IR prior art in repo).

## Acceptance criteria

- [ ] On a fixture with a SUMMARY deviation containing term X, `node cadence-core/bin/planning.mjs recall "X"` emits one JSON line with that deviation's snippet ranked first, carrying source file and phase fields
- [ ] Two consecutive identical recall runs on the same corpus produce byte-identical stdout
- [ ] In a directory with no `.planning/` or an empty corpus, recall exits 0 emitting `{"ok":true,"results":[]}`
- [ ] With effective `memory.backend: none`, recall exits 0 emitting an explicit backend-off field and no results
- [ ] `config.schema.json` lists `memory.backend` values `["none","builtin"]` with default `builtin`; the engine template and this repo's `.planning/config.json` both read `builtin`
- [ ] `node --test cadence-core/bin/*.test.mjs` passes, including new recall tests for ranking, empty corpus, and determinism
- [ ] `node cadence-core/bin/self-verify.mjs` exits 0 with a `recall` CONTRACTS entry present, and the three prose surfaces (config.md workflow, cad-capture SKILL.md, README.md) no longer claim only `none` is wired

## Flagged assumptions

None - all assumptions confirmed
