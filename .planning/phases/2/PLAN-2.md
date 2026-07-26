---
phase: 2
plan: 2
requirements: ["#45"]
files: ["cadence-core/bin/config.mjs", "cadence-core/bin/lib/config-merge.mjs", "cadence-core/bin/config.test.mjs", "cadence-core/workflows/config.md"]
---

# Phase 2: Seam input validation - Gaps Plan

## Goal

Close the two unresolved phase-2 UAT items so the goal's "or pass config
validation" half holds on all three config faces: the write face (`set`) rejects
a non-object top-level config before writing instead of reporting a write that
did not happen or throwing a raw `reason:"internal"`, and every non-object layer
- falsy ones included - is named in `warnings[]` on the read face.

## Must be true when done

- Running `config.mjs set --file F granularity=fine` where F's whole content is
  the array `[1,2,3]` exits `ok:false` naming the non-object top level, and F is
  byte-identical afterwards (today it prints `ok:true, changed:[...]` and rewrites
  the array with the key silently dropped).
- Running the same command where F's whole content is the scalar `42` exits with
  the same clean rejection shape, never `reason:"internal"` with a raw JS message
  like `Cannot create property 'granularity' on number '42'`.
- Setting a valid schema key whose PARENT path is an array in the target file -
  `set --file F git.on_protected=allow` where F is `{"git":["a"]}` - no longer
  reports `{ok:true, changed:[…]}` for a key that never lands: reading
  `git.on_protected` back out of F returns the value just set, not the schema
  default.
- A well-formed object config still sets exactly as before: `set --global
  model.profile=quality` writes and echoes `changed[]`, `--global` still
  auto-creates a missing file and its parent dir, and a bad value still fails
  `reason:"invalid"` with nothing written.
- `config.mjs get` with the repo config file set to `null`, `0`, `false`, or `""`
  returns exactly one `warnings[]` entry naming that file and saying its top level
  is not an object - the same diagnostic a truthy `42` already emits - while
  `values` and `source` stay identical to the no-layer result. The same holds for
  a falsy global layer.
- A legitimately absent layer still emits no `warnings` key at all, and an
  unparseable layer still emits exactly one warning (the parse warning), never a
  second "not an object" warning for the same file.
- Each gap has a regression test that fails against today's HEAD, and
  `node --test cadence-core/bin/*.test.mjs` plus `npx tsc -p tsconfig.ci.json`
  both pass.

## Context

Gaps plan for UAT items 9 (major) and 10 (minor); items 1-8 pass and must not
regress. CONTEXT D-04 binds both: the seam fails BEFORE any write, as one
`{ok:false, reason, detail}` JSON line, never a raw JS error surfaced as
`reason:"internal"`. D-02 closed the validate and read faces only; the write
face is the residue. Item 10 sits on phase-2 code (`config-merge.mjs:84,88`, the
`isPlainObject` gate shipped in 7625984 for #45.3) surfaced through phase-1
#39's `warnings[]` channel, so it is attributed to #45 with #39 lineage. Out of
scope: the wider phase-1 residue where the other six `mergeLayers` callers drop
the `warnings` field (route.mjs, git-guard.mjs, git-branch.mjs, git-publish.mjs,
land-cleanup.mjs, planning.mjs) - they keep ignoring it; no new flags, so no
self-verify CONTRACTS change. Tests are zero-dep `node:test` siblings using the
existing `run(args, globalPath)` helper in `config.test.mjs`.

## Tasks

### Task 1: Reject a non-object top-level config on the write face (#45.3 residue, UAT item 9)

- **Files:** cadence-core/bin/lib/config-merge.mjs, cadence-core/bin/config.mjs, cadence-core/bin/config.test.mjs, cadence-core/workflows/config.md
- **Action:** Make the top-level shape rule one definition all three config faces
  share. In `config-merge.mjs`, add `export` to the existing private
  `isPlainObject(v)` (line 59) - that is the ONLY change to this file in this
  task; leave `readLayer`/`mergeLayers` alone (Task 2 owns them). In `config.mjs`,
  import `isPlainObject` alongside `GLOBAL_CONFIG, mergeLayers` from
  `./lib/config-merge.mjs`, and replace the inline shape test in `validate` (line
  103, `cfg === null || typeof cfg !== 'object' || Array.isArray(cfg)`) with
  `!isPlainObject(cfg)` so validate and set can never drift. Then in `set(file,
  tokens, create)`, immediately after the `JSON.parse`/`create` block resolves
  `cfg` and BEFORE the `for (const {key, value} of pairs) setInto(...)` loop, the
  `mkdirSync`, and the `atomicWrite`, add: `if (!isPlainObject(cfg)) fail('invalid',
  [{ key: '(root)', error: 'top-level config must be a JSON object', value: cfg }]);`.
  Reuse the existing `invalid` reason and its array-of-error-objects `detail`
  shape (the same shape `set --global model.profile=nonsense` already returns and
  the config workflow already tells the agent to surface) rather than inventing a
  new reason string - the seam contract stays as documented, and the failure lands
  before any filesystem write, so the TOP-LEVEL array case can no longer report a
  write that did not happen and the scalar case can no longer reach `setInto`'s
  TypeError and surface as `reason:"internal"` (D-04). That `(root)` guard is
  top-level only, so close the same defect one level down in the same pass:
  `setInto` (config.mjs:160-168) tests each parent container with
  `typeof node[parts[i]] !== 'object'`, which is true for a scalar (replaced with
  `{}`) but FALSE for an array - so an array parent is walked INTO, the leaf is set
  as an expando, and `JSON.stringify` silently drops it. Reproduced live at HEAD:
  `{"git":["a"]}` plus `set --file F git.on_protected=allow` prints
  `{"ok":true,…,"changed":[{"key":"git.on_protected","value":"allow"}]}`, rewrites F
  with only the array in it, and `get --file F git.on_protected` reads back the
  default `ask`. Change that container test to `!isPlainObject(node[parts[i]])` so an
  array parent is replaced with `{}` exactly as a scalar parent already is - the
  existing intent applied consistently, not a new policy - which keeps `changed[]`
  honest. Reachability matches the gap it closes: `checkPairs` rejects unknown keys
  before `setInto` runs, so this needs a VALID schema key sitting over a corrupt
  container, the same malformed-config premise as item 9 itself. Note the `create`
  (`--global`) path still
  starts from `{}` only on ENOENT, so an existing corrupt or non-object global file
  keeps failing rather than being clobbered - do not weaken that. In
  `config.test.mjs`, add two tests next to the existing `set:` tests: (1) "set: an
  array top-level config is rejected, nothing written (write face)" - write the
  exact bytes `[1,2,3]` to a temp file, capture them, run `set --file <f>
  granularity=fine`, assert `ok === false`, `reason === 'invalid'`,
  `detail[0].key === '(root)'`, `/must be a JSON object/` matches
  `detail[0].error`, and `readFileSync(f,'utf8')` is strictly equal to the captured
  bytes (this byte-identity plus `ok:false` is the failing-capable assertion - HEAD
  returns `ok:true` and rewrites the file pretty-printed with the key dropped);
  (2) "set: a scalar top-level config is rejected as invalid, never reason:internal"
  - write `42`, run the same command, assert `ok === false`, `reason === 'invalid'`,
  explicitly `assert.notEqual(r.reason, 'internal')`, `detail[0].key === '(root)'`,
  and the file bytes are unchanged; in the same test assert the happy path still
  holds by writing `{"granularity":"coarse"}` to a sibling file, running `set
  --file <that> model.profile=fast`, and asserting `ok === true` and the reparsed
  file has both `granularity === 'coarse'` and `model.profile === 'fast'`; and (3)
  "set: an array parent container cannot swallow a reported change" - write
  `{"git":["a"]}` to a temp file, run `set --file <f> git.on_protected=allow`, assert
  `ok === true` and `changed[0].key === 'git.on_protected'`, then reparse the file
  and assert `cfg.git.on_protected === 'allow'` (that reparse is the failing-capable
  half - HEAD reports the same `ok:true` while the key is absent from the file).
  Finally, in `cadence-core/workflows/config.md` extend the Direct set bullet
  (line ~156) that reads "It rejects an unknown key or bad value (`{ok:false,
  reason:"invalid", detail:[…]}`)" to also name the non-object case - "an unknown
  key, a bad value, or a target file whose top level is not a JSON object" - so the
  documented seam contract matches the code; and fix the adjacent remediation bullet
  (config.md:159-160), which currently sends the agent to `config.mjs keys` for
  "the allowed values" - meaningless for a `(root)` detail, since `(root)` is not a
  schema key and the dump lists nothing for it. Qualify it: for a `(root)` detail the
  remediation is that the target file's top level is not a JSON object (repair or
  replace the file), and the `config.mjs keys` lookup applies to per-key details only.
- **Verify:** `node --test cadence-core/bin/config.test.mjs` passes including all
  three new `set` tests; and a live repro settles it - write `[1,2,3]` to a temp
  file, copy it, run `node cadence-core/bin/config.mjs set --file <f>
  granularity=fine`, and confirm the output line is `ok:false` with
  `reason:"invalid"` and `cmp <f> <copy>` reports no difference; repeat with a file
  containing `42` and confirm the output contains neither `"reason":"internal"` nor
  `Cannot create property`; then write `{"git":["a"]}` to a third file, run `set
  --file <f> git.on_protected=allow`, and confirm `get --file <f> git.on_protected`
  reads back `allow` rather than the default `ask`.

### Task 2: Warn on every non-object config layer, falsy ones included (UAT item 10)

- **Files:** cadence-core/bin/lib/config-merge.mjs, cadence-core/bin/config.test.mjs
- **Action:** In `config-merge.mjs`, make the skip-warning key off layer PRESENCE
  instead of layer truthiness. Extend `readLayer(file)` to return a third field
  `present`: `true` only when `readFileSync` + `JSON.parse` both succeeded (whatever
  the parsed value - `null`, `0`, `false`, `""` included); `false` on the ENOENT
  branch and `false` on the other-error branch (that path already carries its own
  `failed to parse and was skipped` warning, so `present:false` is what stops a
  second, wrong "not an object" warning being pushed for the same file). Update the
  `@returns` JSDoc to `{{value: any, warning: string|null, present: boolean}}` -
  the repo typechecks these pragmas under `tsc -p tsconfig.ci.json`, so a stale
  annotation is a CI failure. Leave the existing `readJSON` export untouched. In
  `mergeLayers`, change both gates (lines 84 and 88) from `if (globalValue &&
  !isPlainObject(globalValue))` / `if (repoValue && !isPlainObject(repoValue))` to
  test the layer's `present` flag instead: warn and null the value when the layer
  is present and its parsed value is not a plain object. Do NOT touch the
  `layers.push` / `source` / `deepMerge` lines below them - a falsy layer already
  contributes nothing today, so `values` and `source` must stay byte-identical to
  the no-layer result and the passing UAT items 4/5 and the #39 corrupt-layer tests
  must keep passing; the only observable change is that `warnings[]` now names the
  falsy non-object layer. Update the `mergeLayers` doc comment (lines 63-76) so its
  description of the skipped-layer warning says "present but not a JSON object"
  rather than implying a truthy value. In `config.test.mjs`, add next to the
  existing `get:` scalar test: (1) "get: a falsy non-object repo layer warns like a
  truthy one" - loop over the exact file contents `null`, `0`, `false`, and `""`,
  each written to its own temp file with an absent global path, and for each assert
  `ok === true`, `warnings.length === 1`, the warning matches both the file name
  and `/not an object/`, and `values`/`source` deep-equal the truly-absent-repo-file
  result (HEAD emits no `warnings` key at all for these four, so every iteration is
  failing-capable); (2) "get: a falsy non-object global layer warns too" - global
  file containing `0` with a valid object repo layer, asserting `source === 'repo'`,
  the repo value still wins, and one warning naming the global file; (3) "get: an
  absent layer stays silent and an unparseable layer warns exactly once" - a
  no-regression guard asserting `warnings === undefined` for a truly absent file,
  and for a file containing `{ torn mid-write` exactly one warning that matches
  `/failed to parse/` and does NOT match `/not an object/` (and likewise a
  zero-byte file, which stays on the parse-failure path since `JSON.parse('')`
  throws).
- **Verify:** `node --test cadence-core/bin/config.test.mjs` passes including all
  three new `get` tests; then `node --test cadence-core/bin/*.test.mjs` passes
  across every seam test (no regression in items 1-8) and `npx tsc -p
  tsconfig.ci.json` exits 0.

## Notes

- Structure honors the CONTEXT `Plan shape: one plan` directive: the two gaps
  share `cadence-core/bin/config.test.mjs` (and Task 1 touches `config-merge.mjs`
  to export `isPlainObject`, which Task 2 edits), so they fail the file-independence
  test and cannot be split into parallel slices.
- `requirements` lists `#45` only. This is a gaps plan: #42's UAT items (1, 7)
  passed and left no residue, so no task here would legitimately claim it - #42
  stays covered by plan 1 of this phase. Item 10 is scored under #45 because the
  truthiness gate it fixes is #45.3's own code (`config-merge.mjs:84,88`, shipped
  in 7625984); its `warnings[]` channel comes from phase-1 #39, which is noted as
  lineage, not re-opened here.
- Recalled evidence backing both tasks: CAPTURE.md phase 2 ("the scalar/non-object
  config guard (#45.3) closed the validate and read faces but not the WRITE face",
  and "the skipped-config-layer warning is gated on truthiness
  (`config-merge.mjs:84,88`)") and `phases/2/SUMMARY.md` phase 2 open items. Both
  behaviors were re-reproduced live against HEAD while planning: the array `set`
  prints `{"ok":true,...,"changed":[...]}` and rewrites the file pretty-printed
  without the key; the scalar `set` prints `{"ok":false,"reason":"internal",
  "detail":"Cannot create property 'granularity' on number '42'"}`; and `get` on a
  `null` repo layer prints no `warnings` key while a `42` layer does.
- CAPTURE.md phase 1 flags that the other six `mergeLayers` callers still drop
  `warnings` entirely - deliberately left open here (phase-1 residue, not a phase-2
  UAT item); Task 2 only widens what lands in that field.
- Adjudicated `plan` review (2026-07-25, reviewers: claude-subagent + deepseek;
  the openai reviewer timed out in transport and was dropped). Two findings
  survived grounding and are folded into Task 1 above: (1) the `(root)` guard is
  top-level only, so `setInto`'s `typeof !== 'object'` container test let an ARRAY
  parent reproduce item 9's reported-write-that-did-not-happen one level down -
  confirmed live, and the file is rewritten without the key rather than left
  untouched; (2) the `config.md` remediation bullet pointed at `config.mjs keys`
  for allowed values, which returns nothing for a `(root)` detail. Both raised the
  precision of Task 1's claims rather than changing the plan's shape; the deepseek
  reviewer returned no findings.
