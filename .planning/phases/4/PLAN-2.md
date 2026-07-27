---
phase: 4
plan: 2
requirements: ["#49", "#50"]
files: ["cadence-core/bin/lib/surface-weight.mjs", "cadence-core/bin/self-verify.mjs", "cadence-core/bin/self-verify.test.mjs", "cadence-core/bin/weight.test.mjs"]
---

# Phase 4: renumber & git-guard hardening - Plan 2 (surface-walk resilience)

## Goal

One dangling or unreadable `.md` symlink under a measured prose surface can no
longer collapse a whole self-verify or weigh run into an opaque
`{ok:false,reason:"internal"}`: the shared lib skips it silently, self-verify
names it loudly and finishes every other check.

## Must be true when done

- `weight.mjs --root <fixture>` on a tree carrying a dangling `agents/*.md`
  symlink and a symlink cycle (`a.md -> b.md -> a.md`) exits `ok:true` with
  those entries simply absent from `surfaces`, the real surfaces still measured,
  and the envelope's key set unchanged (`ok`, `checked`, `surfaces`).
- `self-verify.mjs --root <fixture>` on the same shape runs the FULL lint and
  exits `ok:false` with an `unreadable-surface` problem naming the link path -
  and its other problems (config keys, budgets, tools) still present in the same
  envelope, with no top-level `reason` field.
- A dangling symlink under `agents/` no longer sinks the run at the agents
  tools-declaration lint either - the check that runs last, after the budget
  check, on the very directory the filed repro targets.
- The same unreadable entry produces NO `unbudgeted-surface` problem: the lib's
  silence and self-verify's loudness are one deliberate split, not two
  inconsistent guards.
- `self-verify.mjs` reads a `\r\n` backslash continuation in prose as one joined
  command line, exactly as it already reads an `\n` one.
- #49.1 and #50's self-verify arm each have at least one test that fails on the
  pre-fix code and passes after it, and all three CI gates pass:
  `node --test cadence-core/bin/*.test.mjs`,
  `node cadence-core/bin/self-verify.mjs`, `npx tsc -p tsconfig.ci.json`.

## Context

Locked decisions bind this plan: D-05 (an unreadable surface is SILENT in the
shared lib - `weighAll` skips it and `weight.mjs` still exits `ok:true` with the
envelope shape `weight.test.mjs:24-33` asserts - and LOUD in `self-verify.mjs`,
which pushes an `unreadable-surface` problem and exits `ok:false`), D-06 (the
guard is a try/catch or equivalent BROAD guard, never
`statSync(f, {throwIfNoEntry:false})` alone: a symlink cycle throws `ELOOP`,
which `throwIfNoEntry` does not suppress on any Node version, and `readFileSync`
is a second throw site), D-13 (the guard lands at THREE sites - the shared
`surfaces()` generator, self-verify's own `mdFiles()` walker, and the agents
tools-declaration lint's `statSync`; the third runs after the budget check on
the same `agents/` directory the filed repro targets, so omitting it means the
filed repro still sinks the run one check later while the test passes), D-15
(the continuation-join regex becomes `/\\\r?\n\s*/g` in `self-verify.mjs:205`
too, keeping the two seams one idiom), D-18 (symlink fixtures are built with
`symlinkSync` in a tmpdir; nothing symlinked is committed - both test files
assert against the real `REPO` root, so a committed dangling symlink would turn
"the repo itself passes self-verification" red on every branch). Out of scope:
rewriting `weighAll`'s return shape into `{surfaces, unreadable}` (D-05 -
`weight.mjs:26` emits it verbatim), any new flag or CONTRACTS entry, and the
other two slices (renumber in PLAN-1, `git-guard.mjs` in PLAN-3). This plan is
the SOLE owner of `self-verify.mjs` for the phase: #50's CRLF widening lands
here (Task 3) precisely so PLAN-3 never opens the file.

Every new test must be verified failing-capable against the pre-fix code (stash
or revert the source hunk, run the test, see it fail) - not merely passing. A
prior cycle shipped an assertion that passed unpatched (`.planning/CAPTURE.md`,
phase 2; `.planning/phases/2/SUMMARY.md`).

## Tasks

### Task 1: Make the shared surface walker skip what it cannot read (#49.1)

- **Files:** cadence-core/bin/lib/surface-weight.mjs, cadence-core/bin/weight.test.mjs
- **Action:** In `surface-weight.mjs` add two module-local helpers above
  `surfaces()`: `function isFile(f) { try { return statSync(f).isFile(); }
  catch { return false; } }` and `function entries(dir, opts) { try { return
  readdirSync(dir, opts); } catch { return []; } }`. Replace all three
  `statSync(f).isFile()` calls (:31, :40, :49) with `isFile(f)` and all three
  `readdirSync(...)` calls (:29, :37, :47) with `entries(...)`, keeping each
  call's options exactly as they are (`{ encoding: 'utf8' }`, and
  `{ recursive: true, encoding: 'utf8' }` for skills). In `weighAll` (:75-83)
  guard the read too - `let text; try { text = readFileSync(f, 'utf8'); } catch
  { continue; }` then push `{ surface, ...measure(text) }` - because a link that
  passes the stat can still fail the read (D-06). Use try/catch, NOT
  `statSync(f, { throwIfNoEntry: false })`: that suppresses `ENOENT` and nothing
  else on every Node version, so a symlink cycle would still throw `ELOOP` and
  leave the class only half fixed while the suite reported it closed. Extend the
  `surfaces()` JSDoc and the module header comment to state the contract in both
  directions: an entry this walker cannot stat or read is skipped SILENTLY here,
  because `weight.mjs` emits this return verbatim and an absent directory is
  already empty data (:20-23), while `self-verify.mjs` reports the same entry
  loudly as `unreadable-surface` - naming both halves so a later reader does not
  "fix" the silence into a throw (D-05). Add one test to `weight.test.mjs` named
  for #49.1: `mkdtempSync` a root, `mkdirSync` `agents`, `skills/x`, and
  `cadence-core/workflows`; write a real `agents/good.md` with a known body,
  and a real `skills/y/SKILL.md` and `cadence-core/workflows/good.md` too - one
  readable control per walker branch, so a regression where the new catch-all
  wrapper swallows an ENTIRE tree (returning `[]` for all of `skills` or all of
  `workflows`) is caught; with only `agents/good.md` present that regression
  passes the test unnoticed. Then `symlinkSync('nowhere.md', join(root,'agents','dangling.md'))`,
  `symlinkSync('b.md', ...'agents/a.md')` plus `symlinkSync('a.md',
  ...'agents/b.md')` for the cycle, `symlinkSync('nowhere.md',
  ...'skills/x/SKILL.md')`, and `symlinkSync('nowhere.md',
  ...'cadence-core/workflows/w.md')` - one per stat site. Assert `ok === true`,
  `Object.keys(j)` deep-equals `['ok','checked','surfaces']` (the envelope shape
  is unchanged - D-05), and `surfaces.map((s) => s.surface).sort()` deep-equals
  all three readable controls - `['agents/good.md',
  'cadence-core/workflows/good.md', 'skills/y/SKILL.md']` (match the exact
  surface-key spelling `surfaces()` emits) - and contains none of the five
  broken links. Import `symlinkSync` from `node:fs` in the test file.
  Do not commit any symlink into the repo tree (D-18).
- **Verify:** `node --test cadence-core/bin/weight.test.mjs` passes; the new
  test fails on pre-fix code, where `weight.mjs` exits 1 with
  `{"ok":false,"reason":"internal","detail":"ENOENT: no such file or directory,
  stat '<root>/agents/dangling.md'"}` (reproduced live) and the test's
  `execFileSync` throws.

### Task 2: Report an unreadable surface instead of collapsing the run (#49.1)

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** Give `self-verify.mjs` one invariant: the walker never drops an
  entry it cannot inspect - it yields the path, and the single read-guard in
  `run()` reports it. In `mdFiles` (:105-127) wrap the `readdirSync` at :115 in
  a try/catch that `yield d; continue;` on failure (an unreadable directory is
  itself the unreadable surface), and replace `if (f.endsWith('.md') &&
  statSync(f).isFile()) yield f` with an `.md` filter followed by a guarded
  stat: `let isFile; try { isFile = statSync(f).isFile(); } catch { isFile =
  true; }` then `if (isFile) yield f` - deliberately optimistic on the throw so
  the entry reaches the reporter rather than vanishing. In `run()`'s file loop
  (:182-183) replace the bare read with
  `let text; try { text = readFileSync(file, 'utf8'); } catch (e) { problems.push({
  kind: 'unreadable-surface', file: rel, detail: <see below> }); continue; }`,
  moving the `const rel = relative(root, file)` line above the try so the
  problem can name it. For `detail`, resolve the link target when there is one -
  `let target = null; try { target = readlinkSync(file); } catch { }` - and emit
  `unreadable symlink -> ${target} (${e.code || e.message})` when `target` is
  set, otherwise `e.code || e.message`; naming the target costs one line and
  saves the operator an `ls -l` on a rare failure (the planner's call on
  CONTEXT's open question). Import `readlinkSync` from `node:fs` alongside the
  existing imports at :27. Use `e.code` rather than the full message where a
  target is known, so the detail stays free of machine-specific absolute paths.
  Then guard the agents tools-declaration lint (:294-298), the third site
  (D-13): wrap its `readdirSync(agentsDir)` in a try/catch defaulting to `[]`,
  and wrap the `statSync(file).isFile()` and `readFileSync(file, 'utf8')` calls
  so an unreadable entry is skipped with `continue`. Push NO problem from that
  loop - the `mdFiles` pass has already reported the same file, and a second
  entry would double-count one broken link. Note in a comment that this site
  runs after the budget check on the same `agents/` directory the filed repro
  targets, which is why guarding only the two walkers would leave the exact
  repro reachable. Add one test to `self-verify.test.mjs` named for #49.1 using
  `fixtureWith({ agents: { 'a.md': '---\nname: t\ntools: Read\n---\nUse
  `Bash` here.\n' }, budgets: { 'agents/a.md': 10000 } })`, then
  `symlinkSync('nowhere.md', join(root, 'agents', 'dangling.md'))`. Assert
  `r.ok === false`, `r.reason === undefined` (the envelope is the problems
  envelope, not the collapsed internal one), a problem with
  `kind === 'unreadable-surface'` and `file === 'agents/dangling.md'`, a
  problem with `kind === 'undeclared-tool'` naming `Bash` (proof the LAST check
  still ran - the D-13 site), and NO problem with
  `kind === 'unbudgeted-surface' && file === 'agents/dangling.md'` (proof the
  lib stayed silent - D-05). Add a second, smaller test for the cycle: the same
  fixture with `a.md -> b.md -> a.md` instead, asserting at least one
  `unreadable-surface` problem naming `agents/a.md` and the same
  `r.reason === undefined`. Import `symlinkSync` from `node:fs` in the test
  file; build every symlink in the tmpdir fixture, never in the repo (D-18).
- **Verify:** `node --test cadence-core/bin/self-verify.test.mjs` passes,
  including the shipped "the repo itself passes self-verification" test; both
  new tests fail on pre-fix code, where the run exits
  `{"ok":false,"reason":"internal","detail":"ENOENT: ... stat
  '<root>/agents/dangling.md'"}` with `problems` absent entirely (reproduced
  live).

### Task 3: Widen self-verify's continuation join to CRLF (#50, D-15)

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** At `self-verify.mjs:204-205` change the join from
  `text.replace(/\\\n\s*/g, ' ')` to `text.replace(/\\\r?\n[ \t]*/g, ' ')` and
  extend the comment to say the `\r?` arm exists so a CRLF-checked-out prose
  file joins like an LF one, and that `git-guard.mjs` carries the identical
  regex for the same reason - the two seams stay one idiom rather than two
  spellings (D-15). The trailing class tightens from `\s*` to `[ \t]*` in the
  same edit, in lockstep with PLAN-3 Task 1: `\s` matches `\n`, so `\s*`
  swallows the newline that ends the continued line and merges the NEXT line
  into the joined command. That is a live push-rail bypass in `git-guard.mjs`
  (measured - see PLAN-3 Notes) and here it silently merges an unrelated
  following line into a script-invocation scan, so the flag-checking regex
  bounded by `[^\n]*` reads words that were never on that command. Changing
  both seams together is what PRESERVES D-15's one-idiom requirement; changing
  only git-guard would split it. Keep the replacement string a single space, not the empty
  string: a space is what this seam already does, and matching it is the whole
  point of the shared idiom. Add one test to `self-verify.test.mjs`: build
  `fixture('node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" uat
  refresh --phase 1 \\\r\n  --items -\r\n')` (a real backslash + CRLF in the
  written bytes) and assert a problem with `kind === 'unknown-flag'` whose
  `detail` matches `/--items/` - the same `--items` regression the shipped
  LF test at :96-101 guards, in its CRLF spelling.
- **Verify:** `node --test cadence-core/bin/self-verify.test.mjs` passes; the
  new test fails on pre-fix code, where the LF-only join leaves `--items` on the
  following line and the invocation regex (bounded by `[^\n]*`) never sees it,
  so no problem is reported.

## Notes

- CONTEXT's flagged assumption stands: `ELOOP`/`EACCES` behavior and
  `readdirSync(..., {recursive:true})`'s symlink semantics were confirmed on
  Node 26 only, while CI runs the Node 22/24 matrix. The broad try/catch is
  chosen precisely because it does not depend on which errno a given version
  raises; if a version differs, CI is where it surfaces and the guard shape
  needs no redesign.
- D-15 widens CRLF without evidence that a CRLF prose file or payload is
  reachable in this repo. Accepted: the `\r?` arm costs two characters and the
  question cannot be settled from the codebase.
