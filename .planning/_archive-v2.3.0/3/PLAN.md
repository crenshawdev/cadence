---
phase: 3
plan: 1
requirements:
  - BUD-01
  - BUD-02
files:
  - cadence-core/bin/lib/surface-weight.mjs
  - cadence-core/bin/weight.mjs
  - cadence-core/bin/weight.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - METHOD.md
  - CONTRIBUTING.md
  - CHANGELOG.md
  - .planning/CAPTURE.md
  - .planning/phases/3/MEASUREMENTS.md
  - skills/cad-audit/SKILL.md
  - skills/cad-capture/SKILL.md
  - skills/cad-config/SKILL.md
  - skills/cad-context/SKILL.md
  - skills/cad-coverage/SKILL.md
  - skills/cad-debug/SKILL.md
  - skills/cad-decision-review/SKILL.md
  - skills/cad-docs-verify/SKILL.md
  - skills/cad-execute/SKILL.md
  - skills/cad-health/SKILL.md
  - skills/cad-help/SKILL.md
  - skills/cad-land/SKILL.md
  - skills/cad-milestone/SKILL.md
  - skills/cad-new-project/SKILL.md
  - skills/cad-pause/SKILL.md
  - skills/cad-phase/SKILL.md
  - skills/cad-plan/SKILL.md
  - skills/cad-plan-review/SKILL.md
  - skills/cad-progress/SKILL.md
  - skills/cad-spike/SKILL.md
  - skills/cad-task/SKILL.md
  - skills/cad-undo/SKILL.md
  - skills/cad-verify/SKILL.md
  - agents/cad-assumptions-analyzer.md
  - agents/cad-assumptions-analyzer-high.md
  - agents/cad-executor.md
  - agents/cad-executor-xhigh.md
  - agents/cad-plan-checker.md
  - agents/cad-plan-checker-medium.md
  - agents/cad-plan-checker-high.md
  - agents/cad-plan-checker-xhigh.md
  - agents/cad-planner.md
  - agents/cad-planner-xhigh.md
  - agents/cad-planner-max.md
  - agents/cad-reviewer.md
  - agents/cad-reviewer-medium.md
  - agents/cad-reviewer-xhigh.md
  - agents/cad-reviewer-max.md
  - agents/cad-verifier.md
  - agents/cad-verifier-medium.md
  - agents/cad-verifier-xhigh.md
  - agents/cad-verifier-max.md
---

# Phase 3: The surfaces that are always on, and the ratchet that watches them - Plan

## Goal

The bytes Cadence puts in the system prompt of every session in every project -
29 skill descriptions and 19 agent descriptions - shrink to one routing line
each without losing a trigger word, and the two directories that let 162 KB of
prose grow with no ceiling come under the same byte ratchet that already
watches workflows, skills and agents. The walker that ratchet runs on stops
hiding an entire subtree behind one unreadable descendant, in both of the
copies that carry the defect.

## Must be true when done

- The 29 `cad-*` skill descriptions weigh under 3,900 B against the 5,078 B
  baseline, each is a single line, each still carries the words a user would
  type to reach that command, and the six `cad-*-contract` descriptions are
  byte-identical to what they say today.
- Each of the 19 `agents/*.md` descriptions is one clause naming its rung and
  saying the routing seam picks it rather than the user, and the phase diff
  shows nothing else in those files changed - not `effort:`, `tools:`,
  `disallowedTools:`, `skills:`, a body, or `lib/rung-agent.mjs`.
- `node cadence-core/bin/weight.mjs` lists all 23 files under
  `cadence-core/references/` and `cadence-core/templates/` alongside the 69
  surfaces it already weighed, and `weight-budgets.json` carries an entry for
  each equal to its exact byte count - so a reference that grows fails CI the
  same way a workflow does.
- One unreadable descendant hides only itself: with `skills/private/` at mode
  000, `weight.mjs` still lists a readable `skills/good/SKILL.md`, and
  `self-verify.mjs` names `skills/private` with an EACCES detail rather than
  naming `skills` with `EISDIR`, while still linting every readable sibling.
- A symlinked directory is not descended, so a `skills/a/loop -> ..` cycle
  reports one surface instead of 41, and every prose site that described the
  weighed walk as agents/skills/workflows says what it now walks.
- `node --test cadence-core/bin/*.test.mjs`, `node cadence-core/bin/self-verify.mjs`
  and `npx tsc -p tsconfig.ci.json` all pass, and
  `.planning/phases/3/MEASUREMENTS.md` carries the before/after trigger-word
  table and the closing measurement.

## Context

CONTEXT.md D-01..D-16 are locked and every one has a task below. D-01 widens
the walked set to `**` (all 23 files, JSON included) over ROADMAP SC3's
narrower spelling; D-02 pins each new entry at its exact current bytes and
trims no reference prose; D-11 keeps the manifest regenerating in the same
commit as the edit that moved a surface, because `self-verify.mjs:515` checks
`bytes > budget` and a shrunk file left unregenerated leaves pre-approved
headroom. Out of scope: the CONTENT of any reference or template, the rung map
(`cadence-core/bin/lib/rung-agent.mjs`), `references/COMMANDS.md`'s structure,
and any new self-verify check that reads a `description:` line (D-04).
The phase base ref is `35ba9eb` - every "before" comparison below reads from it.

## Tasks

### Task 1: The weighed walk recurses per entry, so one unreadable child hides only itself

- **Files:** cadence-core/bin/lib/surface-weight.mjs, cadence-core/bin/weight.test.mjs
- **Action:** Replace `entries(dir, opts)` (`:36-42`), whose single `try` around
  a `recursive: true` `readdirSync` returns `[]` for a WHOLE subtree the moment
  one descendant throws, with two helpers. `dirents(dir)` returns
  `readdirSync(dir, { withFileTypes: true })` inside a `try`/`catch` returning
  `[]`, so a failure hides only that one directory's own children. A generator
  `walk(dir)` iterates `dirents(dir)` and, for each dirent `d`, recurses into
  `join(dir, d.name)` when `d.isDirectory()` and otherwise yields
  `join(dir, d.name)`. Test `isDirectory()` on the DIRENT, never via
  `statSync`: a symlink to a directory is not a directory dirent, so the walker
  stops at it, which is D-07 taken deliberately - it makes the module header's
  existing "a symlink cycle ... is silently skipped" claim true for directory
  links for the first time (today it holds only for FILE links, via `isFile()`
  at `:27-33`, and a `skills/a/loop -> ..` cycle measures 41 counted surfaces of
  one 2-byte file). Bound that claim honestly where you write it: the dirent
  test only ever sees DESCENDANTS, so a branch ROOT that is itself a symlink -
  `skills`, `cadence-core/references`, `cadence-core/templates` or the `--root`
  argument - is still descended, because `surfaces(root)` hands those paths to
  `readdirSync` before any parent dirent exists to test. That is correct
  behavior (a caller naming a root means to walk it) but it makes "a symlinked
  directory is not descended" false as an unqualified sentence, so write it as
  "a symlinked directory encountered DURING a walk is not descended; an
  explicitly named root is". Say the same in the module header rather than
  leaving the broader claim to be read off the test row. In `surfaces(root)`, drive the `agents/` and
  `cadence-core/workflows/` branches off `dirents()` (still top-level only, still
  `.md`, still gated on `isFile()`) and the `skills/` branch off `walk(skills)`,
  keeping only paths whose `basename` is `SKILL.md` - import `basename` from
  `node:path` and use it in place of the current `endsWith(sep + 'SKILL.md')`
  plus `String(e) === 'SKILL.md'` pair, which exists only to cover a top-level
  `skills/SKILL.md` that the basename test covers in one expression. KEEP
  `isFile()` (which stats through a link) as the final gate on every yielded
  path: the `#49.1` row depends on a dangling FILE symlink still being skipped
  and on a valid file link still being weighed, and dropping to a dirent-only
  test would silently change both. Do NOT make the lib throw, report, or emit
  on an unreadable entry - D-15 keeps the split contract intact, the lib stays
  silent and `self-verify.mjs:509-519` remains the loud half; a throw here would
  break `weight.mjs`'s one-JSON-line seam contract. Give `dirents` and `walk`
  JSDoc `@param`/`@returns` annotations so the file's `// @ts-check` header
  still passes `tsc`. In `weight.test.mjs` add two rows. First, "BUD-02: an
  unreadable sibling directory hides only itself" - mkdtemp a root, write
  `skills/good/SKILL.md`, `mkdirSync` `skills/private` and `chmodSync` it
  `0o000`, assert the run's `surfaces` includes `skills/good/SKILL.md` and that
  `ok` is still true, and restore mode 0o755 in a `finally` so the temp dir is
  removable; guard the row with the same root skip the self-verify suite uses
  (`typeof process.getuid === 'function' && process.getuid() === 0 ? 'root
  bypasses mode bits' : false`), because root reads a mode-000 directory and the
  fixture would prove nothing. Second, "D-07: a symlinked directory is not
  descended, so a cycle counts one surface" - write `skills/a/SKILL.md`,
  `symlinkSync('..', join(root, 'skills', 'a', 'loop'))`, and assert
  `surfaces.map(s => s.surface)` deep-equals exactly `['skills/a/SKILL.md']`.
  Third, pin the ROOT exception the sentence above admits, so the qualified
  claim is a test row rather than only prose - "a symlinked branch root IS
  descended": write a real `skills-real/a/SKILL.md`, `symlinkSync('skills-real',
  join(root, 'skills'))`, and assert `surfaces` still contains
  `skills/a/SKILL.md`. Without this row the suite would read as proving the
  unqualified claim, which is the gap that let the broader sentence stand.
  Leave the existing `#49.1` dangling/cycle FILE-link row untouched - it is the
  regression guard proving the new per-entry recursion did not start dropping
  readable siblings.
- **Verify:** `node --test cadence-core/bin/weight.test.mjs` passes with both
  new rows present. Against a scratch fixture holding `skills/good/SKILL.md`
  beside `skills/private/` at mode 000, `node cadence-core/bin/weight.mjs --root
  <fixture>` lists `skills/good/SKILL.md` in `surfaces` (it prints
  `"surfaces":[]` at `35ba9eb`). Against a scratch fixture holding
  `skills/a/SKILL.md` and `skills/a/loop -> ..`, the same command reports 1
  surface (41 at `35ba9eb`). `node cadence-core/bin/weight.mjs` on the repo
  still reports 69 surfaces totalling 259,048 B, unchanged, and `node
  cadence-core/bin/self-verify.mjs` prints `"problems":[]`.

### Task 2: self-verify names the path that is actually unreadable, not the directory above it

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** Fix the second copy of task 1's defect (D-06): `mdFiles`
  (`:169-212`) wraps one `recursive: true` `readdirSync` per directory and, on a
  throw, does `yield d; continue;` - so with `skills/private/` at mode 000 the
  run emits exactly `{"kind":"unreadable-surface","file":"skills","detail":"EISDIR"}`
  (measured live at `35ba9eb`), naming a directory that reads fine, with an
  errno from the failed `readFileSync` rather than the EACCES that actually
  occurred, never naming `skills/private`, and silently skipping every readable
  sibling so genuine prose drift there is checked by nothing. Change `mdFiles`
  to yield OBJECTS rather than strings: `{ file }` for a candidate surface, and
  `{ file, unreadable }` where `unreadable` is the caught error's `code` (falling
  back to its `message`) for a directory whose own `readdirSync` threw. Walk per
  entry with `readdirSync(dir, { withFileTypes: true })` in a `try`/`catch` that
  yields the unreadable marker for THAT directory and descends no further into
  it, recursing only when the dirent `isDirectory()` - which also stops this
  walker at symlinked directories, matching task 1 so the reporting and
  enforcing halves do not diverge in what they traverse. Keep the deliberately
  optimistic stat on yielded files (`statSync().isFile()` in a `try` defaulting
  to `true`), so a dangling or cyclic FILE link still reaches run()'s read-guard
  as a surface rather than vanishing. Keep the three trailing docs (`README.md`,
  `INTERNALS.md`, `METHOD.md`) yielding `{ file: p }`. At the single consumer
  (`:306`), destructure `const { file, unreadable }` and, when `unreadable` is
  set, push `{ kind: 'unreadable-surface', file: rel, detail: unreadable }` and
  `continue` BEFORE the `readFileSync` - which is what turns `skills` + `EISDIR`
  into `skills/private` + `EACCES`. Rewrite the `:179-182` comment, which
  currently justifies the `yield d; continue;` fallback, to state the per-entry
  rule and the symlinked-directory stop. Do not touch the read-guard's existing
  symlink-target detail branch or the `readlinkSync` call, and do not widen
  `mdFiles` beyond `.md` - the budget walk is task 3's job and this one is the
  linter's walk. In `self-verify.test.mjs` add two rows built on `fullFixture()`.
  First, "#49.1: an unreadable CHILD directory is named, and its readable
  siblings are still linted" - write `skills/good/SKILL.md` containing a bogus
  dotted token in a real family (`git.bogus_key`), `mkdirSync` `skills/private`
  with a file inside, `chmodSync` it `0o000`, then assert `r.reason` is
  undefined, that exactly one problem has `kind === 'unreadable-surface'` and
  `file === 'skills/private'` with `detail === 'EACCES'`, that NO problem has
  `file === 'skills'`, and that a problem with `kind === 'unknown-config-key'`
  and `file === 'skills/good/SKILL.md'` is present (this last assertion is the
  under-linting half of the defect and fails at `35ba9eb`); restore mode 0o755
  in a `finally` and carry the existing root skip. Second, "a symlinked
  directory is not descended, so a cycle lints each file once" - write
  `skills/a/SKILL.md` with the same bogus token plus
  `symlinkSync('..', join(root, 'skills', 'a', 'loop'))`, and assert exactly one
  `unknown-config-key` problem for `skills/a/SKILL.md`. Assert by FILTER on kind
  and file in both rows, never on `ok` or on a total problem count: `fullFixture`
  intentionally breaks several unrelated checks, and task 3 adds an
  `unbudgeted-surface` problem to every row built on it.
- **Verify:** `node --test cadence-core/bin/self-verify.test.mjs` passes with
  both new rows. Against a scratch fixture carrying `.claude-plugin/plugin.json`,
  a copied `cadence-core/config.schema.json`, an `agents/cad-verifier.md`,
  `skills/good/SKILL.md` and `skills/private/` at mode 000, `node
  cadence-core/bin/self-verify.mjs --root <fixture>` reports one
  `unreadable-surface` naming `skills/private` with detail `EACCES` and no
  problem naming `skills` (at `35ba9eb` the same fixture prints
  `{"kind":"unreadable-surface","file":"skills","detail":"EISDIR"}`). `node
  cadence-core/bin/self-verify.mjs` on the repo prints `"problems":[]` and `npx
  tsc -p tsconfig.ci.json` exits 0.

### Task 3: references/** and templates/** come under the weight budget

- **Files:** cadence-core/bin/lib/surface-weight.mjs, cadence-core/bin/weight-budgets.json, cadence-core/bin/weight.test.mjs
- **Action:** Add two branches to `surfaces(root)` after the workflows branch,
  each guarded by `existsSync` like the others and each driven by task 1's
  `walk()`: `cadence-core/references` and `cadence-core/templates`, yielding
  EVERY file that passes `isFile()`, with no extension filter. The `**`-and-any-
  extension scope is D-01 taken over ROADMAP SC3's `references/*.md` +
  `templates/*`: an extension filter would leave `references/model-hints.json`
  (2,635 B, read by `cadence-core/bin/review-provider.mjs`) and
  `templates/config.json` (1,554 B) inside named directories capped by nothing,
  which is the defect BUD-02 exists against in miniature. Both directories are
  flat today; the recursive walk is what keeps a future subdirectory from
  reopening the hole. The accepted cost, recorded here so it is not read as an
  accident, is that a `model-hints.json` edit now trips a prose ratchet. Update
  the module header comment (`:8-12`) - which currently states the measured set
  as exactly agents/skills/workflows and calls it "narrower than self-verify's
  mdFiles" - to name all five branches and to say the two new ones are walked
  whole-directory rather than by extension. Then regenerate
  `cadence-core/bin/weight-budgets.json` IN THIS COMMIT (D-11): run `node
  cadence-core/bin/weight.mjs` and set every surface's entry to its measured
  `bytes`, keeping the `_comment` key first and the `budgets` keys in
  `weighAll`'s already-sorted order. Every new entry equals the file's exact
  current byte count with NO headroom (D-02) - matching all 69 existing entries,
  which sit at exactly their budget with zero slack - so
  `references/acceptance-criteria.md` is budgeted at 22,506 B, larger than the
  largest budgeted workflow (`workflows/config.md` at 18,541 B). Pinning with
  headroom would recreate in 22 fresh entries at once the pre-approved-growth
  hole phase 1 found as a 2-byte drift on `workflows/plan.md`. Trim no reference
  or template prose in this task or any other in this phase. In
  `weight.test.mjs`, INVERT rather than delete the row at `:35-44` named
  "surface set is exactly agents/skills/workflows (D-02 narrowing)" (D-13):
  rename it to name the widened set, keep the three positive `includes`/`test`
  assertions, replace the two negative assertions with positives requiring a
  `cadence-core/references/` path and a `cadence-core/templates/` path to be
  present, add one assertion that a NON-`.md` file is weighed
  (`cadence-core/references/model-hints.json`), and KEEP
  `assert.ok(!paths.includes('README.md'))` - README is on self-verify's lint
  walk and stays off the weighed one. Expect `self-verify.test.mjs` rows built
  on `fullFixture` to gain an `unbudgeted-surface` problem for
  `cadence-core/references/config-reach.md`: per D-14 no such row asserts on `ok`
  or on a problem count, they all filter by kind, so no fixture needs a new
  budget entry - if a row does break, fix the ASSERTION to filter rather than
  adding a budget entry to the fixture.
- **Verify:** `node cadence-core/bin/weight.mjs` reports 92 surfaces (69 + 23)
  and every one of the 23 paths under `cadence-core/references/` and
  `cadence-core/templates/` appears, including `cadence-core/references/model-hints.json`
  and `cadence-core/templates/config.json`. The budget-equality one-liner `node
  -e 'const{execFileSync}=require("child_process"),fs=require("fs");const
  w=JSON.parse(execFileSync("node",["cadence-core/bin/weight.mjs"],{encoding:"utf8"})).surfaces;const
  b=JSON.parse(fs.readFileSync("cadence-core/bin/weight-budgets.json","utf8")).budgets;const
  bad=w.filter(s=>b[s.surface]!==s.bytes);console.log(bad.length?JSON.stringify(bad):"budgets
  exact")'` prints `budgets exact`, and `node -e` over the manifest reports 92
  budget keys with no orphan (every key is also a measured surface). `node
  cadence-core/bin/self-verify.mjs` prints `"problems":[]`, `node --test
  cadence-core/bin/*.test.mjs` passes, and `npx tsc -p tsconfig.ci.json` exits 0.

### Task 4: Every claim about what the ratchet weighs is corrected, and the 22 KB reference is captured

- **Files:** cadence-core/bin/weight.mjs, cadence-core/bin/self-verify.mjs, METHOD.md, CONTRIBUTING.md, .planning/CAPTURE.md
- **Action:** Four prose sites state the pre-task-3 narrow set and stop being
  true the moment task 3 lands (D-13; `lib/surface-weight.mjs`'s own header is
  already corrected in task 3). Fix `weight.mjs`'s header (`:3-8`), which says it
  "Measures the plugin's OWN prose surfaces (agents/skills/workflows)", to name
  the five walked branches. Fix `METHOD.md:581-583` ("It also weighs every
  agent, skill and workflow surface against a byte budget") the same way, keeping
  the paragraph's regenerate-on-accepted-growth point intact. Fix
  `CONTRIBUTING.md:21`, which carries the identical "every agent, skill, and
  workflow surface" claim - it is a fifth site D-13 did not enumerate, found by
  grepping for the claim rather than for the file list, and it is corrected here
  for the same reason as the other four. Fix `self-verify.mjs:428-431`, where
  check 10's scope is justified with "references/ is outside
  lib/surface-weight.mjs's weighed walk, so no other check reaches it at all":
  that clause is now false, so replace it with the reason that survives - check
  10 is scoped to workflows and references because those are where dispatch
  instructions are AUTHORED - and leave the check's actual scope, the skills/
  carve-out and the pinned out-of-scope test row untouched, since widening check
  10 is a separate decision this phase does not make. Then append one `- [ ]`
  bullet to the `## Todos` section of `.planning/CAPTURE.md`, tagged
  `(cadence-wide)`, recording that `cadence-core/references/acceptance-criteria.md`
  is now budgeted at 22,506 B - larger than any budgeted workflow - that D-02
  deliberately budgeted it at its current size rather than splitting it, because
  splitting it would have turned a budget phase into a 145 KB prose edit, and
  that the split is a candidate for a later cycle. Name the phase and the date
  in the bullet, matching the existing entries' shape.
- **Verify:** `grep -rn "agent, skill and workflow surface\|agent, skill, and
  workflow surface\|agents/skills/workflows" METHOD.md CONTRIBUTING.md
  cadence-core/bin/weight.mjs cadence-core/bin/lib/surface-weight.mjs
  cadence-core/bin/weight.test.mjs` returns nothing; `grep -n "outside
  lib/surface-weight.mjs" cadence-core/bin/self-verify.mjs` returns nothing;
  `grep -c "acceptance-criteria.md" .planning/CAPTURE.md` returns at least 1 and
  the new bullet names `22,506` or `22506`. `node cadence-core/bin/self-verify.mjs`
  prints `"problems":[]` (its check 3 and check 3b are what prove the edited
  prose still names live paths), `node --test cadence-core/bin/*.test.mjs`
  passes, and the budget-equality one-liner still prints `budgets exact`.

### Task 5: The 23 user-facing skill descriptions become one routing line each

- **Files:** skills/cad-audit/SKILL.md, skills/cad-capture/SKILL.md, skills/cad-config/SKILL.md, skills/cad-context/SKILL.md, skills/cad-coverage/SKILL.md, skills/cad-debug/SKILL.md, skills/cad-decision-review/SKILL.md, skills/cad-docs-verify/SKILL.md, skills/cad-execute/SKILL.md, skills/cad-health/SKILL.md, skills/cad-help/SKILL.md, skills/cad-land/SKILL.md, skills/cad-milestone/SKILL.md, skills/cad-new-project/SKILL.md, skills/cad-pause/SKILL.md, skills/cad-phase/SKILL.md, skills/cad-plan/SKILL.md, skills/cad-plan-review/SKILL.md, skills/cad-progress/SKILL.md, skills/cad-spike/SKILL.md, skills/cad-task/SKILL.md, skills/cad-undo/SKILL.md, skills/cad-verify/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** Rewrite the `description:` value of these 23 skills to a single
  routing line of at most 175 B each (measured D-09's way: the value as written
  including its surrounding quotes, plus one newline), bringing the 29-skill
  total from 5,078 B to under 3,900 B. Touch the `description:` line only - no
  `name:`, `argument-hint:`, `allowed-tools:` or body edit belongs in this task.
  Do NOT edit the six `cad-*-contract` skills (D-10): their descriptions are
  already single routing lines totalling 567 B, so editing them would churn six
  compliant lines and six budget entries for no measured gain. The shape is one
  clause naming what the command does, then the two to four distinguishing nouns
  a user would type reaching for it. Three things get cut. Positioning and
  design rationale - `cad-capture`'s "the queue mem-* lacks", `cad-phase`'s "the
  thing humans botch by hand", `cad-debug`'s "Single pass, no session-manager
  layer", `cad-spike`'s "not a five-artifact wrap-up", `cad-pause`'s "No Stop
  hook", `cad-milestone`'s "Works for non-release projects too. Folds in
  cleanup", `cad-undo`'s "Reports later work factually instead of guessing
  dependencies", `cad-decision-review`'s "never auto-fires". Implementation
  detail the user does not route on - `cad-capture`'s "which the builtin memory
  backend makes recallable at planning time", `cad-config`'s "(live model
  detection + per-tier assignment)", `cad-execute`'s "one cad-executor per
  plan". And flag re-enumerations: `argument-hint:` sits on the same frontmatter,
  names every flag verbatim and is not edited by this phase, so dropping
  `cad-verify`'s "--sweep for a cross-phase audit, --deep for a goal-backward
  codebase pass" and `cad-help`'s cluster list removes a duplicate rather than a
  trigger word. Three disambiguating NEGATIVE clauses survive, compressed, inside
  the one line (D-03), because nothing else separates these commands at selection
  time - `references/COMMANDS.md` carries its own phrasing but is `@`-included
  only by `skills/cad-help/SKILL.md:15`, so it is not in context when the routing
  choice is made: `cad-health`'s "Not a traceability audit (that is /cad-audit)",
  `cad-docs-verify`'s "Reports; it does not rewrite docs", and `cad-land`'s
  "Never decides how you publish". Every trigger word survives; the words that
  must still appear, per skill, are - `cad-audit`: traceability, requirement,
  orphan, pre-ship, gate; `cad-capture`: capture, todo, seed, note, CAPTURE.md;
  `cad-config`: config, config.json, review provider, stakes; `cad-context`:
  context, assumptions, decisions, acceptance criteria, phase; `cad-coverage`:
  coverage, tests, requirements, gaps; `cad-debug`: debug, hypothesis,
  symptom; `cad-decision-review`: decision, refute, adjudicate, objection;
  `cad-docs-verify`: docs, claims, stale, codebase; `cad-execute`: execute,
  plans, phase, commit; `cad-health`: health, .planning, STATE, ROADMAP,
  REQUIREMENTS; `cad-help`: help, command reference; `cad-land`: land, publish,
  push, MR, PR, tag, pre_ship; `cad-milestone`: milestone, tag, prune, roadmap,
  PROJECT, REQUIREMENTS; `cad-new-project`: initialize, project, PROJECT.md,
  REQUIREMENTS.md, ROADMAP.md; `cad-pause`: pause, WIP commit, STATE, resume;
  `cad-phase`: phase, ROADMAP, add, insert, remove, edit, renumber; `cad-plan`:
  plan, PLAN.md, phase; `cad-plan-review`: plan review, adversarial, PLAN.md;
  `cad-progress`: progress, status, resume; `cad-spike`: spike, experiment,
  time-boxed, unknown, verdict; `cad-task`: task, off-roadmap, atomic commits;
  `cad-undo`: undo, roll back, revert, phase, commits; `cad-verify`: verify,
  UAT, checklist, phase. Keep each value a valid single-line YAML double-quoted
  scalar - no line wrap, no unescaped inner `"` - because a wrapped value would
  break AC1's single-line requirement and the frontmatter readers that match
  `description:` at column 0. Add no self-verify check over these lines (D-04):
  no check reads a `description:` today, and one asserting a byte cap or a
  trigger-word set would either constrain wording forever or become 29
  hand-maintained sets that go stale whenever a command's scope shifts. Finally,
  regenerate `cadence-core/bin/weight-budgets.json` in this same commit (D-11) -
  each edited SKILL.md shrinks, and the check is a ceiling (`bytes > budget`), so
  an unregenerated manifest leaves pre-approved headroom behind.
- **Verify:** `grep -h "^description:" skills/cad-*/SKILL.md | sed 's/^description:
  //' | wc -c` returns a number below 3900 (5078 at `35ba9eb`). Presence is its
  own row and must come FIRST, because every other row on this list passes
  vacuously on a file whose `description:` line was deleted rather than
  shortened - the aggregate only shrinks, the diff row below excludes
  `^[+-]description:` lines so a deletion is invisible to it, and an absent line
  makes the cap loop's `wc -c` zero: `ls skills/cad-*/SKILL.md | wc -l` and
  `grep -l "^description:" skills/cad-*/SKILL.md | wc -l` both return 29, and
  `grep -c "^description:" skills/cad-*/SKILL.md | grep -v ":1$"` prints nothing
  (exactly one description line per file, never zero and never two). Then the
  per-file band, a FLOOR as well as a ceiling so a line gutted to a word is
  caught too: `for f in skills/cad-*/SKILL.md; do n=$(grep -m1 '^description:'
  "$f" | sed 's/^description: //' | wc -c); { [ "$n" -gt 175 ] || [ "$n" -lt 40 ]; }
  && echo "$n $f"; done` prints nothing. `for f in skills/cad-*/SKILL.md; do awk '/^description:/{getline nxt;
  if (nxt !~ /^[a-zA-Z-]+:|^---$/) print FILENAME}' "$f"; done` prints nothing,
  proving all 29 values are single-line. `git diff 35ba9eb -- skills/ | grep
  '^[+-]' | grep -v '^[+-][+-]' | grep -vc '^[+-]description:'` returns 0, and
  `for s in assumptions-analyzer executor plan-checker planner reviewer verifier;
  do git diff 35ba9eb --quiet -- skills/cad-$s-contract/SKILL.md || echo "$s
  changed"; done` prints nothing, proving the six contract descriptions are
  byte-identical. `grep -c "cad-audit" skills/cad-health/SKILL.md`,
  `grep -ci "does not rewrite" skills/cad-docs-verify/SKILL.md` and
  `grep -ci "never decides" skills/cad-land/SKILL.md` each return at least 1.
  The budget-equality one-liner prints `budgets exact`, `node
  cadence-core/bin/self-verify.mjs` prints `"problems":[]`, and `node --test
  cadence-core/bin/*.test.mjs` passes.

### Task 6: All 19 rung-agent descriptions become one routed-rung clause

- **Files:** agents/cad-assumptions-analyzer.md, agents/cad-assumptions-analyzer-high.md, agents/cad-executor.md, agents/cad-executor-xhigh.md, agents/cad-plan-checker.md, agents/cad-plan-checker-medium.md, agents/cad-plan-checker-high.md, agents/cad-plan-checker-xhigh.md, agents/cad-planner.md, agents/cad-planner-xhigh.md, agents/cad-planner-max.md, agents/cad-reviewer.md, agents/cad-reviewer-medium.md, agents/cad-reviewer-xhigh.md, agents/cad-reviewer-max.md, agents/cad-verifier.md, agents/cad-verifier-medium.md, agents/cad-verifier-xhigh.md, agents/cad-verifier-max.md, cadence-core/bin/weight-budgets.json
- **Action:** Rewrite the `description:` value of all 19 agent files so each is
  one clause naming its rung and stating that the routing seam picks it rather
  than the user. All 19, not only the 13 suffixed ones (D-05): each unsuffixed
  `agents/<role>.md` is itself a rung in the map - `lib/rung-agent.mjs:34-68`'s
  `RUNG_FILES` names the unsuffixed file as a rung for all six roles, so
  `cad-assumptions-analyzer` is the `xhigh` rung and `-high` its lower sibling -
  and leaving them alone would keep 1,180 B of role prose AC2 was written to
  remove. The 13 suffixed files take the clause alone, at most 110 B each
  (measured as the value plus one newline; agent descriptions are unquoted
  scalars today, keep them unquoted). The 6 unsuffixed files take the same clause
  plus a short role noun - three or four words naming what the role does - at
  most 150 B each, because a `{ok:false}` routing fallback dispatches the base
  agent by name and a uniform one-clause line would strip the noun that makes
  that dispatch intelligible. The 19-description total drops from 3,472 B to
  under 2,400 B. Each line must name the rung as it appears in that file's
  `effort:` value (`cad-plan-checker.md` is `low`, `cad-planner.md`/`cad-executor.md`/
  `cad-reviewer.md`/`cad-verifier.md` are `high`, `cad-assumptions-analyzer.md` is
  `xhigh`) and must name the routing seam - use `bin/route.mjs`, the spelling the
  13 suffixed lines already carry, so no repo-path claim changes. Change NOTHING
  else in these files (D-12): `effort:`, `tools:`, `disallowedTools:`, `skills:`,
  `color:`, `name:` and every body stay byte-identical, because three blocking
  self-verify checks read exactly those - check 7 holds a rung body against a
  canonical template, 7b `rung-effort-mismatch` reads `effort:` against the
  filename, and 7c `verifier-write-grant` reads `tools:`/`disallowedTools:` on
  every `cad-verifier` rung. Do not edit `cadence-core/bin/lib/rung-agent.mjs`
  or `cadence-core/route-table.json`; the rung map is out of scope. Avoid
  backtick-quoting any Claude Code tool name (`Read`, `Write`, `Bash` and the
  rest) in the new lines - check 5's tools lint reads the agent BODY and its
  preloaded contract rather than the frontmatter, so a mention would not fire
  today, but naming a tool in a routing clause invites exactly the drift that
  check exists to catch. Regenerate `cadence-core/bin/weight-budgets.json` in
  this same commit (D-11).
- **Verify:** `grep -h "^description:" agents/*.md | sed 's/^description: //' |
  wc -c` returns a number below 2400 (3472 at `35ba9eb`). `for f in agents/*.md;
  do n=$(grep -m1 '^description:' "$f" | sed 's/^description: //' | wc -c); case
  "$f" in *-high.md|*-medium.md|*-xhigh.md|*-max.md) cap=110;; *) cap=150;; esac;
  [ "$n" -gt "$cap" ] && echo "$n $f"; done` prints nothing. `git diff 35ba9eb --
  agents/ | grep '^[+-]' | grep -v '^[+-][+-]' | grep -vc '^[+-]description:'`
  returns 0, and `git diff 35ba9eb --quiet -- cadence-core/bin/lib/rung-agent.mjs
  cadence-core/route-table.json` exits 0. The routed-and-named-rung half must be
  checked ON THE DESCRIPTION LINE and for ALL 19, not file-wide and not for one
  file: `grep -L "route.mjs" agents/*.md` searches whole files, and every rung
  body already mentions the routing seam, so it would pass on descriptions that
  say nothing. Use instead - `for f in agents/*.md; do grep -m1 '^description:'
  "$f" | grep -q "route.mjs" || echo "no route.mjs in description: $f"; done`
  prints nothing; and each description names the rung the MAP assigns that file,
  driven off `RUNG_FILES` itself rather than off the filename suffix, because
  the six unsuffixed files sit at four different rungs (`cad-plan-checker` base
  is `low`, `cad-assumptions-analyzer` base is `xhigh`, the other four base
  files are `high`) and a suffix-based rule cannot name any of them:

  ```
  node -e 'import("./cadence-core/bin/lib/rung-agent.mjs").then(m=>{
    const fs=require("fs"); let bad=0;
    for (const map of Object.values(m.RUNG_FILES))
      for (const [rung,stem] of Object.entries(map)) {
        const line=(fs.readFileSync(`agents/${stem}.md`,"utf8")
          .match(/^description:.*$/m)||[""])[0];
        if (!new RegExp(`\\b${rung}\\b`).test(line)) { console.log(`${stem}: description does not name rung ${rung}`); bad++; }
      }
    console.log(bad?`BAD ${bad}`:"all 19 name their rung");
  })'
  ```

  prints `all 19 name their rung`. Together the two rows prove AC2's whole
  clause - routed, and by name - for every file rather than for one. `node cadence-core/bin/self-verify.mjs`
  prints `"problems":[]` with no `agent-carries-behaviour`,
  `rung-effort-mismatch` or `verifier-write-grant` entry, the budget-equality
  one-liner prints `budgets exact`, and `node --test cadence-core/bin/*.test.mjs`
  passes.

### Task 7: The phase record carries the trigger-word table and the closing measurement

- **Files:** .planning/phases/3/MEASUREMENTS.md, CHANGELOG.md
- **Action:** Create `.planning/phases/3/MEASUREMENTS.md` with three sections,
  every number RECOMPUTED at write time rather than transcribed from this plan or
  from CONTEXT.md (D-16 - a number transcribed into prose is the stale-
  transcription defect this repo has closed repeatedly). Section one,
  "Trigger words, before and after": one row per each of the 23 skills task 5
  edited, with the `35ba9eb` description read back via `git show
  35ba9eb:skills/<name>/SKILL.md`, the new description, and the trigger-word list
  task 5 required, marked present in both. This discharges AC1's record half;
  D-04 deliberately adds no mechanical check for it, so this table is the whole
  evidence. Section two, "Closing measurement - turn-one totals": for each of the
  12 commands D-19 measured (`.planning/phases/2/CONTEXT.md:214-223`), the
  turn-one total as SKILL.md bytes plus the bytes of every file its
  `@${CLAUDE_PLUGIN_ROOT}/...` lines include, against D-19's baseline, with a
  per-command delta and the summed total. LEAD with this table (D-08): it is the
  cycle's actual result. Report every command honestly, including any that grew -
  four did between D-19 and `35ba9eb` - and name the cause where one is visible.
  Section three, "Closing measurement - weighed total": the weighed total at
  `0bf6284` (the baseline captured before phase 1), reproduced by `git archive
  0bf6284 | tar -x -C <tmp>` and then running THAT tree's own
  `cadence-core/bin/weight.mjs --root <tmp>` so the comparison is like-for-like
  against the narrow walker of the time - it reports 69 surfaces at 246,127 B -
  against HEAD's `node cadence-core/bin/weight.mjs`, SPLIT into the surfaces that
  were already budgeted and the 23 reference and template entries this phase
  added. State plainly that the already-budgeted total GREW across the cycle,
  because phases 1 and 2 moved prose INTO weighed workflow and skill files while
  cutting what loads in turn one, and that the 23 new entries are new COVERAGE
  rather than growth (the same set measures 156,572 B at `0bf6284` and 162,186 B
  at `35ba9eb`, the difference being phase 2's `git-guard.md`, `git-publish.md`
  and `triage-gate.md` against the deleted `git.md`). Then add one bullet under
  CHANGELOG.md's `## [Unreleased]` `### Changed` heading covering both halves of
  the phase: the description cut with its before/after totals for the 29 skill
  and 19 agent lines, and `cadence-core/references/**` plus `templates/**`
  coming under the weight budget with the walker fix that made the measurement
  honest, naming the symlinked-directory stop as a deliberate behavior change.
  Do not restate the trigger-word table or the per-command table in the
  CHANGELOG; point at the phase record.
- **Verify:** `.planning/phases/3/MEASUREMENTS.md` exists and `grep -c
  "^| " .planning/phases/3/MEASUREMENTS.md` returns at least 35 (23 skill rows
  plus 12 command rows); `grep -c "0bf6284" .planning/phases/3/MEASUREMENTS.md`
  and `grep -c "246,127\|246127" .planning/phases/3/MEASUREMENTS.md` each return
  at least 1; every one of the 12 command names from D-19 appears
  (`for c in land milestone verify config pause execute plan-review context phase
  undo plan new-project; do grep -q "cad-$c" .planning/phases/3/MEASUREMENTS.md
  || echo "missing $c"; done` prints nothing). `grep -c "weight budget"
  CHANGELOG.md` returns at least 1 under `## [Unreleased]`. The recorded numbers
  are RECOMPUTED, not just present - a row count and a `grep` for `246,127` pass
  equally on a table of invented after-figures, and this file is the sole
  evidence for both AC1's trigger words and AC6's closing measurement: re-run
  `grep -h "^description:" skills/cad-*/SKILL.md | sed 's/^description: //' | wc -c`
  and `grep -h "^description:" agents/*.md | sed 's/^description: //' | wc -c`,
  and confirm each printed total appears verbatim in MEASUREMENTS.md's after
  column; re-run `node cadence-core/bin/weight.mjs` and confirm its `surfaces`
  total and the 23-entry reference/template subtotal both appear; and for three
  commands picked at random from the twelve, recompute the turn-one total by
  summing the SKILL.md plus every file it `@`-includes and confirm the table's
  figure matches. A mismatch on any of them is a FAIL, not a rounding note.
  Finally, the per-commit ratchet is verified by REPLAY, since the
  budget-equality one-liner only describes the final worktree and the check is a
  ceiling (`bytes > budget`, `self-verify.mjs:515`) - so a commit that shrank a
  surface without regenerating the manifest stays green and D-11 goes unenforced:
  for each commit C in `<PHASE_START>..HEAD`, with a clean tree, `git checkout C`
  and run the budget-equality one-liner restricted to the surfaces C touched
  (`git show --stat --name-only C`), requiring it to name no file. Every commit
  passes, with the single permitted exception of a `fix(budget):` repair commit
  naming the commit it repairs. Return to the branch head and confirm `git status`
  is clean. `node --test
  cadence-core/bin/*.test.mjs` passes, `node cadence-core/bin/self-verify.mjs`
  prints `"problems":[]`, `npx tsc -p tsconfig.ci.json` exits 0, and the
  budget-equality one-liner prints `budgets exact` tree-wide.

## Notes

**Plan review (`plan` trigger, adjudicated): all five survivors applied.** Every
one was a verification too loose to prove its own criterion, not a wrong action -
the tasks already did the right work, but four of them could be reported done
while the goal stayed unmet. (1) Task 5's checks all passed vacuously on a
DELETED description: the aggregate only shrinks, the diff row excludes
`^[+-]description:` so a deletion is invisible to it, and an absent line makes
the cap loop's `wc -c` zero. Presence is now the first row, plus a floor as well
as a ceiling. (2) Task 6 never bound a description to its rung - `grep -L
"route.mjs"` and `grep -c "rung"` both searched whole files, and only one of the
19 was checked at all. Now every description line is matched against the rung
`RUNG_FILES` assigns it, which is also the only way to check the six unsuffixed
files, since they sit at four different rungs. (3) D-11's same-commit budget rule
was only a final-worktree check, and the ceiling (`bytes > budget`) keeps an
unregenerated intermediate commit green - replaced with a per-commit replay, the
same fix phase 2 needed. (4) The dirent test only ever sees descendants, so a
symlinked branch ROOT is still descended; the claim is now written qualified and
a third test row pins the exception. (5) Task 7's measurement rows counted and
grepped but never recomputed, so invented after-figures would pass on the one
file that is the sole evidence for AC1's trigger words and AC6's closing number.

Plan shape: one plan, matching CONTEXT's directive. The independence test also
forbids a split here - tasks 1, 2 and 3 share `cadence-core/bin/lib/surface-weight.mjs`
and `cadence-core/bin/weight.test.mjs`, and tasks 3, 5 and 6 all regenerate
`cadence-core/bin/weight-budgets.json`, so no two slices are file-independent.

Task ordering is measurement-first on purpose. Task 1 makes the seam honest
before task 3 uses it to generate 23 budget entries: at `35ba9eb` an unreadable
descendant under `references/` or `templates/` would have made `weight.mjs`
return `[]` for that whole directory and the manifest would have been generated
incomplete with no signal. Task 3 widens the walk and regenerates the manifest
in ONE task because splitting them leaves the repo red between commits -
self-verify reports `unbudgeted-surface` for all 23 the moment the walk widens.

Two additions found while reading the tree, both recorded rather than taken
silently. First, `CONTRIBUTING.md:21` carries the same "every agent, skill, and
workflow surface" claim as `METHOD.md:581`; D-13 enumerates four sites and this
is a fifth, so task 4 corrects it on the same reasoning. Second, task 2 applies
the dirent recursion to `self-verify.mjs`'s `mdFiles` as well, which stops that
walker at symlinked directories - D-07 states the change only for the lib, but
leaving the reporting and enforcing walkers traversing different sets after a
task whose premise is "the same defect in two copies" would reopen the
divergence D-06 exists to close. A test row pins it.

Recalled prior art bearing on this phase, all from `.planning/CAPTURE.md`: the
phase-4 `weight.mjs` subtree-blindness item and the phase-4 `mdFiles`
misreport item ground tasks 1 and 2 (both reproduced live at `35ba9eb` during
planning, with the exact `{"kind":"unreadable-surface","file":"skills","detail":"EISDIR"}`
output CONTEXT records); the phase-1 `workflows/plan.md` 2-byte budget drift
grounds D-02's exact-bytes rule in task 3; and the phase-1 item noting
`skills/cad-executor-contract/SKILL.md` grew 6,954 -> 10,891 B is why task 7
reports the weighed total split rather than as one number.

`0bf6284` (pre-phase-1) and `35ba9eb` (pre-phase-3) are both reachable from the
current branch and every baseline figure quoted above was reproduced from them
during planning: 69 surfaces at 246,127 B, references + templates at 156,572 B
then and 162,186 B now, skill descriptions at 5,078 B, agent descriptions at
3,472 B, and 41 counted surfaces for the one-file symlink-cycle fixture.
