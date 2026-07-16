---
phase: 3
plan: 1
requirements: [CWT-01, CWT-02, CWT-03]
files:
  - cadence-core/bin/lib/surface-weight.mjs
  - cadence-core/bin/weight.mjs
  - cadence-core/bin/weight.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 3: Context weight - Plan

## Goal

Cadence's context claims become measured and enforced: prose-surface weight is
a deterministic seam output, and CI blocks both budget overruns and
undeclared-tool references in agent prose.

## Must be true when done

- `node cadence-core/bin/weight.mjs` prints one JSON line listing every
  `agents/*.md`, `skills/*/SKILL.md`, and `cadence-core/workflows/*.md` surface
  with a byte count and an estimated-token count; two runs on the same tree
  produce byte-identical stdout.
- The weight that `weight.mjs` reports and the weight `self-verify.mjs`
  enforces come from one shared lib module, so they cannot diverge.
- Adding prose that pushes a surface past its declared budget makes
  `node cadence-core/bin/self-verify.mjs` exit 1, naming that surface and the
  overage amount.
- Adding a backtick-quoted tool name (or "the X tool" phrasing) to an agent's
  prose that is absent from that agent's frontmatter `tools:` list makes
  `self-verify.mjs` exit 1, naming the agent and the tool.
- On the unmodified tree, `node --test cadence-core/bin/*.test.mjs` passes and
  `node cadence-core/bin/self-verify.mjs` exits 0: current surfaces fit their
  seeded budgets and no existing prose is a false undeclared-tool positive.

## Context

Locked decisions (CONTEXT.md D-01..D-10) bind this plan. Surface set is exactly
agents/skills/workflows (D-02), narrower than self-verify's `mdFiles` (which
also walks references/templates/README). Byte weight is UTF-8 byte length;
estimated tokens are `ceil(chars/4)` labeled "estimated"; sorted traversal +
fixed key order give byte-identical repeat runs (D-03), mirroring the recall
sorted-traversal/rounded-value precedent (planning.mjs cmdRecall lines 519-564).
Budgets live in a dedicated JSON manifest beside the check, not in
`config.schema.json` (would trip the inert-key reverse check, self-verify.mjs
188-195) and not in frontmatter (D-04); seeded at each surface's current
measured weight so the repo-passes gate stays green (D-05). Byte/token logic is
shared via a `lib/` module imported by both weight.mjs and the budget check
(D-09), following the lib-split precedent (planning.mjs imports lib/bm25.mjs).
Both new checks run inside `self-verify.mjs run()`, appended to the same
`problems` array, extending the `checked` summary, one JSON line / exit-1 shape,
no new CI job (D-08). Tools lint is agents-only against frontmatter `tools:`;
skills use `allowed-tools:` and are excluded (D-07). Detection counts only
backtick-quoted mentions or "the X tool" phrasing, so no current prose needs
editing (D-06 - confirmed: zero backtick tool mentions and zero "the X tool"
phrasings exist in agent bodies today).

Out of scope: any real tokenizer beyond chars/4; budgets as config keys or
frontmatter; live token telemetry. weight.mjs is a CI/dev-invoked seam and is
NOT referenced in any linted prose surface (see Notes on D-10).

## Tasks

### Task 1: Shared surface-weight lib

- **Files:** cadence-core/bin/lib/surface-weight.mjs
- **Action:** Create a zero-dep, pure lib module (`// @ts-check`, `'use strict'`,
  no Date, no randomness, no process I/O) exporting the surface measurement used
  by both the CLI and self-verify, so reported and enforced weight share one
  source (D-09). Export a generator or function `surfaces(root)` yielding the
  measured surface files in deterministic order: walk exactly
  `join(root,'agents')` (top-level `*.md`), `join(root,'skills')` (recursive,
  files matching `SKILL.md`), and `join(root,'cadence-core','workflows')`
  (top-level `*.md`) - narrower than self-verify's `mdFiles`, per D-02. Guard
  each dir with `existsSync` so an absent dir is empty data, never a throw.
  Export `measure(text)` returning `{ bytes, estTokens }` where
  `bytes = Buffer.byteLength(text,'utf8')` and
  `estTokens = Math.ceil(text.length / 4)` (chars/4 proxy, D-03). Export
  `weighAll(root)` returning an array of `{ surface, bytes, estTokens }` where
  `surface` is the path relative to `root` with forward slashes, sorted
  ascending by `surface` string before returning (do NOT rely on readdir order -
  it is not sorted; the recall seam sorts for exactly this reason). Keep the
  module free of any emit/exit logic - it is a lib, not a seam entry point.
- **Verify:** `node -e "import('./cadence-core/bin/lib/surface-weight.mjs').then(m=>{const r=m.weighAll('.');console.log(r.length, r.every(x=>x.bytes>0&&x.estTokens>0), r.map(x=>x.surface).join()===[...r].sort((a,b)=>a.surface<b.surface?-1:1).map(x=>x.surface).join())})"`
  prints a count of 49 (7 agents + 22 skills + 20 workflows), `true` for positive
  counts, and `true` for sorted order.

### Task 2: weight.mjs seam CLI (CWT-01)

- **Files:** cadence-core/bin/weight.mjs
- **Action:** Create the seam entry point mirroring self-verify.mjs's structure:
  shebang `#!/usr/bin/env node`, `// @ts-check`, header comment stating it
  measures the plugin's own prose surfaces (contrast planning.mjs, which is
  scoped to `.planning` state - D-01), `'use strict'`, import `emit` from
  `./lib/seam-io.mjs` and `weighAll` from `./lib/surface-weight.mjs`. Resolve
  root from `--root <path>` argv (default `join(HERE,'..','..')` via
  `fileURLToPath(import.meta.url)`), exactly as self-verify.mjs does. Emit one
  JSON line `{ ok: true, checked: 'surface-weight', surfaces: weighAll(root) }`
  with a fixed key order so repeat runs are byte-identical (D-03); wrap in
  try/catch emitting `{ ok:false, reason:'internal', detail }` on failure like
  self-verify.mjs's entry block. Do NOT add subcommands or per-surface flags -
  the only accepted flag is the global `--root`. Do NOT reference this script in
  any agent/skill/workflow/README prose (see Notes, D-10).
- **Verify:** `node cadence-core/bin/weight.mjs > /tmp/w1.json; node cadence-core/bin/weight.mjs > /tmp/w2.json; diff /tmp/w1.json /tmp/w2.json && node -e "const j=require('/tmp/w1.json');process.exit(j.ok&&j.surfaces.length===49&&j.surfaces.every(s=>typeof s.bytes==='number'&&typeof s.estTokens==='number')?0:1)"`
  produces empty diff (byte-identical) and exits 0.

### Task 3: weight.test.mjs

- **Files:** cadence-core/bin/weight.test.mjs
- **Action:** Add `node:test` coverage mirroring the recall test-placement and
  determinism-test pattern (phase 1 CONTEXT D-13: cover shape, empty corpus,
  and determinism by byte-comparing two runs). Use `execFileSync('node',[WEIGHT,
  '--root',root])` and JSON.parse. Tests: (1) shape - on the real repo root, the
  JSON has `ok:true` and a non-empty `surfaces` array where every entry has
  string `surface`, numeric `bytes`, numeric `estTokens`; (2) surface set - the
  surfaces include a known agent (`agents/cad-planner.md`), a known
  `skills/.../SKILL.md`, and a known `cadence-core/workflows/*.md`, and exclude
  anything under `references/` or `templates/` or `README.md` (proves D-02
  narrowing); (3) determinism - two runs on the same root return byte-identical
  stdout (compare the raw execFileSync strings, not parsed objects); (4) empty
  tree - a `mkdtempSync` fixture root with no agents/skills/workflows dirs
  returns `ok:true` with `surfaces:[]` (never a throw); (5) chars/4 - a fixture
  root containing a single workflow file of known length asserts
  `estTokens === Math.ceil(len/4)` and `bytes === Buffer.byteLength(...)`.
- **Verify:** `node --test cadence-core/bin/weight.test.mjs` reports all tests
  passing, 0 failing.

### Task 4: Seed the budget manifest (D-04, D-05)

- **Files:** cadence-core/bin/weight-budgets.json
- **Action:** Create the dedicated budget manifest beside the checks (NOT a
  config.schema.json key, NOT frontmatter - D-04). Shape: a JSON object
  `{ "budgets": { "<surface-rel-path>": <maxBytes>, ... } }` keyed by the same
  forward-slash surface path `weighAll` reports, mapping to an integer maximum
  UTF-8 byte budget. Seed every one of the 49 surfaces at its CURRENT measured
  byte weight (the exact `bytes` value from `node cadence-core/bin/weight.mjs`),
  so the unmodified tree passes (measured <= budget) and any prose addition to a
  surface trips its budget - "at or above current" per D-05, chosen at exactly
  current for the tightest honest bloat gate. Generate the values by running
  weight.mjs, not by hand. Include every surface weight.mjs lists so no surface
  is unbudgeted. Add a leading `"_comment"` string key explaining the manifest
  is regenerated from `weight.mjs` when intentional surface growth is accepted,
  and that it is not a config-schema key (so readers do not migrate it).
- **Verify:** `node -e "const b=require('./cadence-core/bin/weight-budgets.json').budgets;const{execFileSync}=require('child_process');const w=JSON.parse(execFileSync('node',['cadence-core/bin/weight.mjs'])).surfaces;process.exit(w.every(s=>b[s.surface]>=s.bytes)&&Object.keys(b).length===w.length?0:1)"`
  exits 0 (every surface budgeted at or above its current bytes, no extra or
  missing keys).

### Task 5: self-verify budget check (CWT-02)

- **Files:** cadence-core/bin/self-verify.mjs
- **Action:** Add the blocking budget check inside `run(root)`, appending to the
  same `problems` array (D-08). Import `weighAll` from `./lib/surface-weight.mjs`
  (the SAME lib weight.mjs uses, so reported and enforced weight cannot diverge -
  D-09). Read the manifest from `join(root,'cadence-core','bin',
  'weight-budgets.json')` - root-relative like the existing
  `config.schema.json` read, so `--root` fixtures can supply their own manifest;
  guard with `existsSync` and, if absent, skip the check without erroring (keeps
  hermetic fixtures that omit it clean). For each `{surface,bytes}` in
  `weighAll(root)`, if a budget exists for that surface and `bytes > budget`,
  push `{ kind:'budget-overrun', file: surface, detail: \`${bytes}B exceeds
  budget ${budget}B by ${bytes-budget}B\` }`. Additionally, when the manifest is
  present, for any surface in `weighAll(root)` that has NO manifest entry push
  `{ kind:'unbudgeted-surface', file: surface, detail:'no budget entry' }` - so a
  newly added agent/skill/workflow cannot silently bypass the gate; every
  measured surface must be budgeted, the same drift class as the reverse
  `inert-config-key` check (folds cad-plan-checker WARNING). Task 4 seeds all 49
  current surfaces, so the unmodified tree has no unbudgeted surface and the
  repo-passes gate stays green. Extend the `emit` `checked` string
  from `'config-keys, invocations, paths'` to include `'budgets'`. Do NOT add
  weight.mjs to the CONTRACTS table (it has no subcommand and is not named in
  linted prose - see Notes, D-10). Do NOT alter the existing three checks.
- **Verify:** `node --test cadence-core/bin/self-verify.test.mjs` still passes
  the repo-passes gate, and `node cadence-core/bin/self-verify.mjs | node -e "const j=JSON.parse(require('fs').readFileSync(0));process.exit(/budgets/.test(j.checked)&&j.ok?0:1)"`
  exits 0 with `budgets` present in `checked`.

### Task 6: self-verify tools-declaration lint (CWT-03)

- **Files:** cadence-core/bin/self-verify.mjs
- **Action:** Add the blocking agents-only tools lint inside `run(root)`,
  appending to the same `problems` array (D-08). Define a FIXED module-level
  constant `KNOWN_TOOLS` = the canonical Claude Code tool names
  (`Read, Write, Edit, MultiEdit, Bash, Grep, Glob, Task, WebFetch, WebSearch,
  NotebookEdit, TodoWrite`) - a fixed set, NOT derived from the tree, so a
  single-agent fixture still has a non-empty vocabulary. Walk only
  `join(root,'agents')` top-level `*.md` (D-07 - skills use `allowed-tools:` and
  are excluded). For each agent file: split frontmatter as the text between the
  first `---` line and the next `---` line; parse the `tools:` line into a Set of
  declared tool names (split on comma, trim); the remainder after the closing
  `---` is the prose body. In the body, find tool references two ways per D-06:
  (a) backtick-quoted mentions matching `` `<KnownTool>` `` exactly, and (b) the
  phrasing `the <KnownTool> tool` (case-sensitive on the tool name). For every
  matched known tool NOT in that agent's declared `tools:` Set, push
  `{ kind:'undeclared-tool', file: <agent rel path>, detail: \`${tool} not in
  tools:\` }`. Ignore bare-word uses (a table header `| Task |`, prose
  `Task completeness`, `Write \`None.\``) - only backtick-quoted or "the X tool"
  forms count, which is why no current prose needs editing (D-06). Extend the
  `checked` string to also include `'tools'`.
- **Verify:** `node cadence-core/bin/self-verify.mjs | node -e "const j=JSON.parse(require('fs').readFileSync(0));process.exit(/tools/.test(j.checked)&&j.ok&&!j.problems.some(p=>p.kind==='undeclared-tool')?0:1)"`
  exits 0 (tools listed in `checked`, no undeclared-tool problems on the real
  tree).

### Task 7: self-verify tests for both new checks (D-05, D-06 no-false-positive)

- **Files:** cadence-core/bin/self-verify.test.mjs
- **Action:** Extend the existing test file. The `fixture()` helper currently
  writes one workflow file and copies `config.schema.json`; add a second helper
  (or extend it) that also writes an agent file and/or a `cadence-core/bin/
  weight-budgets.json` manifest into the fixture root so the new checks have
  input. Add tests: (1) budget-overrun - a fixture with a surface (e.g.
  `agents/big.md`) and a manifest budgeting it far below its actual byte size
  produces a problem with `kind:'budget-overrun'` whose detail names the overage;
  (2) budget-ok - a fixture whose manifest budgets a surface at or above its size
  yields no `budget-overrun` problem; (3) undeclared-tool - a fixture agent with
  frontmatter `tools: Read` and body prose containing `` `Bash` `` (and/or "the
  Bash tool") produces a problem `kind:'undeclared-tool'` naming `Bash` and the
  agent; (4) declared-tool-ok - the same agent declaring `tools: Read, Bash`
  yields no `undeclared-tool` problem; (5) no-false-positive - a fixture agent
  whose body has the bare-word collisions from D-06 (`| Task |`, `Write \`None.\``,
  `Task completeness`) with matching frontmatter yields no `undeclared-tool`
  problem; (6) unbudgeted-surface - a fixture with a measured surface but a
  manifest that omits it produces a problem `kind:'unbudgeted-surface'` naming
  that surface (folds cad-plan-checker WARNING). Keep the existing "repo itself
  passes self-verification" test - it now
  also proves the seeded budgets fit and no real agent trips the tools lint.
- **Verify:** `node --test 'cadence-core/bin/*.test.mjs'` reports all tests
  passing (including the repo-passes gate and the five new self-verify cases),
  0 failing.

## Notes

D-10 (weight.mjs drift contract) is conditional: "invocations named in linted
prose get a CONTRACTS entry." This plan keeps weight.mjs a CI/dev-invoked seam
and does NOT name it in any linted prose surface (agents/skills/workflows/
README), exactly like the already-shipped `self-verify.mjs` and `git-guard.mjs`
seams, which are CI-invoked, unreferenced in linted prose, and carry no CONTRACTS
entry (verified: `git-guard.mjs` appears in no linted prose surface). Because
weight.mjs has no subcommand, naming it in prose would additionally make the
invocation regex read its `--root` flag as an unknown subcommand; keeping it
CI-only both honors D-10's conditional and avoids a broken CONTRACTS row. If a
future phase documents `weight.mjs` in linted prose, D-10 then requires adding
its CONTRACTS entry at that time. This precedent was surfaced by recall over
phases/1/CONTEXT.md D-04 and phases/2/CONTEXT.md D-05 (CONTRACTS-only drift
pattern) and the phases/1-2 UAT "self-verify exits 0" repo-passes gate.

Plan shape honors the CONTEXT directive (one plan): all tasks share
`self-verify.mjs`, `self-verify.test.mjs`, and the surface-weight lib, so the
slices are not file-independent and must not be split.
