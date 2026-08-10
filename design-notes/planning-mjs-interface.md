# planning.mjs — interface design note

Status: draft for review, nothing implemented.
Scope: the fourth seam script. Owns every deterministic read/write of the
`.planning` file formats (STATE.md, ROADMAP.md, REQUIREMENTS.md, UAT.md,
SUMMARY.md, phase dirs). Prose keeps judgment; this script keeps invariants.

Companion change (separate, small): `config.mjs get` — see §8.

---

## 1. Seam contract (shared with route/config/review-provider)

- Zero-dep Node ESM (`.mjs`), `node:` builtins only. JSDoc + `// @ts-check`.
- Exactly ONE JSON object on stdout per invocation. Nothing else, ever.
- `{ok:true, ...}` exit 0 · `{ok:false, reason, detail, hint?}` exit 1.
  `hint` is the recovery command when one exists (e.g. `"/cad-new-project"`),
  so workflows stop enumerating failure handling in prose.
- Never blocks the spine: any parse failure degrades to `ok:false`.
- `--dir <path>` on every subcommand overrides the default `.planning`
  (cwd-relative). This is the hermetic-test hook, mirroring
  `CADENCE_GLOBAL_CONFIG` in route/config tests.
- All writes are atomic: write `<file>.tmp`, rename over the target. STATE and
  UAT are written constantly; a crash must never leave a torn file.
- All git operations via `execFileSync('git', [...])` — array args, no shell,
  Windows-safe.
- Deterministic output: arrays sorted (phases by number, requirements by id),
  keys in fixed order, no timestamps except where the format requires one.
  Stable output = stable diffs and prompt-cache-friendly re-reads.
- Compact output: omit empty arrays and null/absent optional fields. The
  model is the presenter; the script never pretty-prints.
- The script stamps dates itself (`Updated:` = today). Removes a whole class
  of model date errors and one prose instruction per workflow.

Existing inconsistency to harmonize while here: on failure config.mjs exits 0,
review-provider exits 1, route sets no code. planning.mjs uses 0/1 as above;
recommend migrating config.mjs to match in a later pass (callers parse JSON,
so the change is safe).

---

## 2. `status` — the derived project state

Replaces: progress.md derive/reconcile input, and the phase-resolution prose
repeated in plan, execute, context, coverage, verify.

```
planning.mjs status [--dir <p>]
```

```json
{"ok":true,"current":3,"total":6,
 "phases":[
   {"n":1,"name":"Foundation","status":"complete"},
   {"n":2,"name":"Auth","status":"executed","uat":{"pass":3,"fail":1,"pending":2,"skipped":0,"blocked":0}},
   {"n":3,"name":"Sync","status":"planned","plans":["PLAN-1.md","PLAN-2.md"]},
   {"n":4,"name":"UI","status":"unplanned"}
 ],
 "cursor":{"phase":3,"status":"planned","next":"/cad-execute 3","updated":"2026-07-14","agrees":true},
 "drift":[{"kind":"roadmap-box","phase":1,"detail":"derived complete, box unchecked"}]}
```

Closed-milestone shape (empty `## Phases`, the window between a close and the
next cycle):

```json
{"ok":true,"current":null,"total":0,"cycle":"none","phases":[],
 "drift":[{"kind":"phase-dir","phase":2,"detail":"phases/2/ survives the milestone close (1 plan files)"}]}
```

- Derivation rules (verbatim from progress.md, now encoded once):
  no PLAN → `unplanned`; PLAN without SUMMARY → `planned`; SUMMARY without
  fully-passed UAT → `executed`; SUMMARY + UAT all pass/skipped-with-reason →
  `complete`.
- `current` = lowest non-complete phase; `null` when all complete.
- `cycle` = `"none"`, present ONLY when the phase list is a derived closed
  milestone (`references/roadmap-phases.md`); `current` is null there because
  no cycle is open, not because every phase completed. Additive: absent on
  every live roadmap.
- `uat` present only when UAT.md exists; `plans` present only when files
  deviate from a single `PLAN.md`; `drift` omitted when empty.
- `drift[].kind` ∈ `cursor` (cursor disagrees with derivation) ·
  `roadmap-box` · `req-status` (traceability row vs derived phase status) ·
  `phase-dir` (a `phases/<N>/` dir surviving a milestone close).
- `cursor.agrees` saves the caller comparing fields itself.
- Failure shapes: `{ok:false, reason:"no-planning-dir", hint:"/cad-new-project"}`,
  `{ok:false, reason:"no-roadmap", ...}`, `{ok:false, reason:"unparseable-roadmap",
  detail:"<line>"}` — exactly the checks progress.md `parse` does today.

Scale note: called at the top of ~6 workflows for the life of the tool.
Replaces reading ROADMAP + STATE + N phase dirs (~2–3k tokens) with ~150–250
tokens, and the derivation becomes untestable-prose → tested-code.

---

## 3. `cursor` — the STATE.md 4-line cursor

Replaces the "overwrite, never append, Read it first, never cold-Write it
unread" prose in seven workflows.

```
planning.mjs cursor get
planning.mjs cursor set --phase N --status <s> --next <cmd> [--name <s>] [--total N] [--note <s>]
```

- `get` → `{ok:true, phase, total, name, status, next, updated, note?}`.
  Missing file → `{ok:false, reason:"no-cursor"}`.
- `set` writes the canonical 4-line cursor (+ optional pause-note line),
  atomically, stamping `Updated:` itself. **Derives `--name`/`--total` from
  ROADMAP.md when omitted** — callers pass only what changed. Against a PRUNED
  roadmap (an empty `## Phases`) it derives `no active cycle` / `0`, so
  `/cad-milestone` step 6 runs with no flags on the tree its own step 3
  produces; an out-of-grammar roadmap is broken rather than closed and still
  falls through to the prior cursor, then `cannot-derive`.
- `set` creates the file when absent; there is no append path at all.
- Output: `{ok:true, cursor:{...as get}}`.

---

## 4. `phase-done` — the two status flips

Replaces verify.md `complete` steps 2–3, undo.md step 5, milestone step 5's
mechanical half. The prose "change only that one line / only those rows"
becomes structural.

```
planning.mjs phase-done --n N [--reqs REQ-1,REQ-2] [--undo]
```

- Flips phase N's ROADMAP `## Phases` box to `[x]` and every traceability row
  mapped to phase N to `Complete` (`--reqs` restricts to a subset).
- `--undo` reverses both (for cad-undo): box to `[ ]`, rows to `Pending`.
- Output names exactly what changed:
  `{ok:true, roadmap:{line:12,now:"[x]"}, reqs:["REQ-3","REQ-4"]}`.
- Refuses (ok:false, `reason:"unknown-phase"` / `"no-reqs-for-phase"`) rather
  than guessing.

---

## 5. `audit` — the traceability trace

Replaces audit.md steps 2–4 (the joins). The model keeps step 1 (scope) and
step 5 (verdict narrative + next actions). A ship-blocking gate should not
depend on the model joining tables faithfully.

```
planning.mjs audit [--milestone <label>]
```

```json
{"ok":true,
 "requirements":[
   {"id":"REQ-1","phase":2,"plan":"phases/2/PLAN.md","status":"Complete","box":true},
   {"id":"REQ-7","phase":null,"break":"no-phase"},
   {"id":"REQ-4","phase":3,"plan":null,"break":"no-plan"},
   {"id":"REQ-2","phase":1,"plan":"phases/1/PLAN.md","status":"Complete","box":false,"break":"drift"},
   {"id":"REQ-8","break":"unpicked"}
 ],
 "orphans":{"plan_ids":[{"file":"phases/3/PLAN.md","ids":["REQ-99"]}]},
 "deferred":["REQ-9"],
 "counts":{"total":6,"traced":1,"broken":4,"deferred":1}}
```

- `break` ∈ `no-phase` · `phase-missing` (assigned phase not in ROADMAP) ·
  `no-plan` (no PLAN frontmatter carries the id) · `not-verified` ·
  `drift` (the two status sources contradict) · `unpicked` (an `## Active`
  id with no traceability row at all — so the entry carries no `phase` key,
  which is what keeps it distinguishable from `no-phase`). Absent = fully
  traced.
- `counts.total` is traceability ROWS PLUS unpicked ids, which is what keeps
  `total = traced + broken + deferred` true once a break can exist without a
  row. The sample above is exact: five rows (four requirements plus the
  deferred REQ-9) plus one unpicked id, 1 + 4 + 1 = 6.
- `deferred` requires pinning a marker: **add `Deferred` as a legal
  traceability Status value** in the REQUIREMENTS template/conventions.
  Today "explicitly marked deferred" has no pinned format — that's a latent
  hole in the audit gate worth closing regardless.
- PASS/FAIL stays the model's sentence, but it is now arithmetic over
  `counts.broken`.

---

## 6. `renumber` — phase insert/remove mechanics

Replaces phase.md's insert/remove step lists (the "thing humans botch by
hand"). The model keeps: gathering the new phase's name/criteria, the
destructive-op confirmation, and reassigning orphaned requirements.

```
planning.mjs renumber insert --at N [--dry-run]
planning.mjs renumber remove --n N [--dry-run]
```

- `--dry-run` returns the full operation plan without touching anything:
  `{ok:true, ops:[{git_mv:["phases/4","phases/5"]},{edit:"ROADMAP.md",changes:3},
  {edit:"REQUIREMENTS.md",changes:2},{edit:"STATE.md",changes:1}],
  in_text_refs:[{file:"...", line:9, text:"phase 4"}],
  orphaned_reqs:["REQ-4"], warn:"working tree has uncommitted changes"}`
  — the workflow shows this to the user at the confirmation gate, then
  re-runs without the flag. The gate now displays *exactly* what will happen.
- Live run performs: collision-safe `git mv` ordering (high-to-low on insert,
  low-to-high on remove), number shifts in ROADMAP / REQUIREMENTS Phase
  column / cursor, in-text `phase K` + `phases/K/` repairs, final recount +
  sanity check (ROADMAP count == dirs, every req points at a real phase).
- `insert` opens a numbered gap (blank slot); the model writes the new
  phase's line afterward (wording is judgment). `remove` deletes the dir via
  `git rm -r` only on the live run.
- `orphaned_reqs` are flagged, never auto-dropped — reassignment is the
  model's ask-user step.
- Commit stays with the model (message wording + protected-branch guard).

---

## 7. `uat` — checklist persistence

Replaces verify.md's persistence rules (counts, timestamps, set-once
`first_pass`, verifier-merge precedence). The model keeps: extracting items
from criteria, inferring pass/fail/severity from the user's prose, diagnosis.

```
planning.mjs uat init    --phase N --items -            # JSON on stdin
planning.mjs uat refresh --phase N --items -
planning.mjs uat record  --phase N --item K --result pass|fail|skipped|blocked
                         [--reason <s>] [--severity blocker|major|minor|cosmetic]
                         [--source user|verifier] [--fix <hash>]
planning.mjs uat merge   --phase N --findings -         # verifier JSON on stdin
planning.mjs uat status  --phase N
```

- `init` items (stdin): `[{"name","expected","source"}]` — model extracts and
  dedupes them (judgment), script writes the file all-`pending`, status
  `testing`, per templates/UAT.md.
- `refresh` appends only items whose name/expected match nothing existing;
  never touches a recorded result (the invariant, now structural).
- `record` enforces in one atomic write: item status + reason/severity,
  `first_pass` set on first non-pending result and NEVER after, Summary
  counts recomputed, frontmatter `updated` stamped. Output includes
  **`next`: the next pending item** `{k,name,expected}` (or `null`), so the
  entire UAT walk loop needs zero UAT.md re-reads between items.
- `merge` fills only `pending` items (`source:"verifier"`), appends unmatched
  gaps as new failed items, appends human-checks as pending — and can never
  overwrite a `source:"user"` result. Output: `{auto_passed, gaps, added}`.
- `status` → `{ok, status:"testing|complete|partial", counts:{...},
  first_pending:{k,name,expected}|null, result:"complete|partial"}` —
  verify.md's `complete` computation, as arithmetic.

Scale note: the walk is Cadence's highest-frequency interactive loop. Today
each reply costs a full-file rewrite by the model plus a re-read (~800+
tokens/item). With `record` returning `next`, per-item cost is one ~40-token
call + the item text. Over a 10-item UAT × every phase × every project, this
is the single largest recurring saving in the system.

---

## 8. `config.mjs get` (companion change, config.mjs not planning.mjs)

```
config.mjs get [key ...]        # no keys = all effective values
```

→ `{ok:true, values:{...}, source:"repo+global"}` using route.mjs's exact
deep-merge (repo > global > schema defaults). Closes the latent gap where
workflows read `.planning/config.json` raw and never see the global layer.
Consider extracting the merge into a tiny shared `lib/` module so route.mjs
and config.mjs cannot drift.

---

## 9. Internal structure

```
cadence-core/bin/planning.mjs        # CLI: dispatch, args, output — thin
cadence-core/bin/lib/planning-files.mjs  # parsers/writers: roadmap, cursor,
                                         # requirements table, uat, summary
```

The lib split is what makes fast unit tests possible (import the parser,
feed it a string) alongside the existing black-box CLI tests. Still zero-dep;
`lib/` is plain ESM imported by relative path.

Parsers are format-pinned, not general markdown parsing: each format's
grammar (the 4-line cursor, `- [ ] **Phase N: Name**` lines, the
traceability table columns, UAT item blocks) lives in ONE place. Any format
change = one lib function + its tests.

---

## 10. Testing strategy (TDD, red-first)

Framework: `node:test` + `node:assert/strict`, run
`node --test 'cadence-core/bin/*.test.mjs'` — same as route/config today.

1. **Fixture builder first**: `makeTree(dir, spec)` writing a fabricated
   `.planning/` into `mkdtempSync` — spec like
   `{phases:{1:{plan:true,summary:true,uat:"5p/0f/0"},2:{plan:true}},
   reqs:[["REQ-1",1,"Complete"]]}`. Every test builds its exact world.
2. **Contract tests from this note**: each JSON shape above becomes an
   assertion set BEFORE implementation. The shapes in §2–§7 are the spec.
3. **Two layers**: unit tests on lib parsers (edge cases: CRLF, malformed
   tables, missing files, phase dirs with suffixes, duplicate REQ ids);
   CLI tests via `execFileSync` for the end-to-end contract (existing
   pattern).
4. **Implementation order = risk order**: `status` → `cursor` → `phase-done`
   → `uat` → `audit` → `renumber` last (most destructive, and by then the
   parsers are battle-tested).
5. **Invariant tests are the point**: "first_pass never changes after set",
   "merge cannot overwrite user results", "renumber dry-run touches
   nothing", "every write is atomic (no .tmp left behind)".

Pre-existing gaps, noted while auditing (not this seam's scope, worth a
task): review-provider.mjs has zero tests (adapters + validators are pure
functions — testable without network); config.mjs non-global paths untested;
no CI (a later phase could add a single `node --test` GitHub Action).

---

## 11. Sizing and rollout

- Estimate: planning.mjs ~250 lines, lib ~400–500, tests ~500–700. Total repo
  script surface lands ~2.5k lines — still comfortably zero-dep territory.
- Rollout is per-workflow and non-breaking: ship script + tests first, then
  convert workflows one at a time (progress and verify first — highest
  traffic), deleting the prose each subcommand obsoletes. Hooks (the
  never-push / protected-branch rails) are a separate change and not part of
  this seam.
