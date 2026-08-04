# Phase 1: The read face under everything - Summary

Executed: 2026-07-30 .. 2026-08-01
Plans: PLAN-1 (tasks 1-9), PLAN-2 (tasks 1-4), plus five fixes at /cad-verify 1
Commits: `b8d200e..436e117`
Gate: `node --test cadence-core/bin/*.test.mjs` 1177 pass / 0 fail (baseline
1138), `npx tsc -p tsconfig.ci.json` exit 0, `node
cadence-core/bin/self-verify.mjs` `ok:true` with `problems:[]`.

## What closed

The `mergeLayers` read-face identity defect - the shared root at
`CAPTURE.md:46` - plus six of the seven phase-6-deferred config-reach and
risk-waiver items, and a cross-seam proof that every consuming seam acts on the
value `config.mjs get` reports.

Two layer paths that resolve to one file now merge once: the identity is
computed before either read (`lib/config-merge.mjs:148-152`), so a symlinked or
relative-vs-absolute spelling of one file reports a single layer instead of
`global+repo`, and a broken such file earns ONE parse warning instead of two.
The collapse targets the REPO layer per D-02, which preserves today's live
behaviour for anyone pointing `CADENCE_GLOBAL_CONFIG` at their repo config.

## The seven-item roster (AC6, D-03)

Each item with the test that pins it - not the task that wrote it.

| CAPTURE item | What it was | Test file | Test title |
|---|---|---|---|
| `:164` (a) | the two read faces disagree about a global-layer waiver, with nothing said | `config.test.mjs` | `get: a truthy waiver in the GLOBAL layer is returned AND named as repo-scoped` |
| `:164` (b) | `validate --global` blesses the file `set --global` refuses | — | **NOT CLOSED** - see below |
| `:165` | the eight `risk.override.*` reach rows still read `universal`, and check 9 was structurally blind to it | `self-verify.test.mjs` | `check 9: the risk.override narrowing is now VISIBLE to the check` |
| `:166` | the global-waiver warning hands out remediation `config.mjs set` rejects | `route.test.mjs` | "a MISSPELLED surface in the global layer is not sent to a key `set` refuses" + "a NON-BOOLEAN global waiver is told what the repo layer would also refuse" |
| `:168` | `fsIdentity`'s last fallback throws outside the try, so a valueless `--file` degraded to `reason:"internal"` | `config.test.mjs` | `a valueless --file is a named usage failure on every subcommand` |
| `:169` | the global-waiver warning fires wrongly when both layers resolve to one file | `route.test.mjs` | `the global env pointed AT the repo config: one layer, waiver honoured, nothing IGNORED` + `the same through a SYMLINK: identity, not the spelling of the two paths` |
| `:170` | a duplicate reach row is dropped with no issue emitted | `self-verify.test.mjs` | `check 9: a SECOND row for a declared key is duplicate-reach-row naming both lines` |
| `:171` | `normalize` does not case-fold the Reach cell, so `Universal` emits `unstated-reach` | `self-verify.test.mjs` | "check 9: \`Universal\` and \`universal.\` are the sentinel, not a narrow phrase" |

Plus the shared root at `:46`, pinned in `config.test.mjs` by "get: a SYMLINKED
global layer is the same file, so one layer is reported" and "get: a RELATIVE
spelling of the repo file is the same file too".

Those two are also the AC1 fails-against-HEAD evidence, together with "get: a
BROKEN file reached under two spellings" and the `get --global` label row: all
four fail when the pre-phase `lib/config-merge.mjs` is dropped into the tree.
The row "get: one file resolving as both layers warns once, not twice" is NOT
part of that evidence - the exact-path case was already deduped by
`[...new Set(warnings)]`, so it passes before the fix as well as after.

`:167` (the self-verify URL mask covering `https?://` only) is deferred by
CONTEXT and is NOT claimed here.

### `:164` is PARTIALLY closed

Half (a) closed: `get` now names a global-layer waiver as repo-scoped, so the
read face agrees with the resolver. Half (b) did not: `config.mjs validate
--global` on a file holding `risk.override.auth: true` still returns
`{"ok":true,"checked":1,"errors":[]}` while `set --global` refuses the identical
write as repo-scoped. Every layer is validated on its own by design
(`config.mjs:19-20`), so `validate` has no layer-scoped arm at all - closing it
means teaching `validate` which file it is looking at, a shape change no task in
either plan carried. Recorded as a phase-1 todo in `.planning/CAPTURE.md`
(commit `a249232`).

## Decisions changed during execution

- **D-02 amended by the plan review.** `source` now names the file that actually
  supplied the values, so `get --global` reports `'global'` rather than
  `'global+repo'`, and task 3's warning stays reachable there. Recorded here as
  an amendment, not a silent divergence from CONTEXT's D-02.
- **`DESIGN.md:443-456`'s "the read face is deliberately unchanged" marker** was
  amended in this phase (task 8, commit `a0d9c7e`) rather than left
  contradicted, per D-01.
- **The accepted-surface list is printed sorted.** Discovered by the AC2
  equality row at /cad-verify 1: route.mjs's vocabulary comes from
  route-table.json in declaration order and config.mjs's from the schema keys
  alphabetically, so an unsorted list made the two faces emit different text for
  one entry - the exact divergence the shared check exists to close. Sorted also
  matches the write face's `surfaceKeyError`.
- **The reach vocabulary list is no longer counted.** D-12 had this phase
  correct "Four phrases are in use today" to six; the phase's own last commit
  then added a seventh without touching the list. The count is gone rather than
  corrected a third time (commit `436e117`).

## PLAN-2 scope deviation

PLAN-2 declared `files: [cadence-core/bin/config-seams.test.mjs]` and stated it
"modifies no source". Its commits also edited `land-cleanup.mjs`,
`land-cleanup.test.mjs`, `config.schema.json` and
`references/config-reach.md`.

`0b1c322` narrowed the land gate's `git.auto_close` read to the repo layer, and
`dbfe84c` reverted that. The revert is the correct end state:
`skills/cad-land/SKILL.md:27` reads `git.auto_close` through `config.mjs get`
(the MERGED value) and `:60` suppresses the triage ask under it, so the gate's
halt must read the same value or the ask and the halt disagree. Net effect on
`land-cleanup.mjs` is comment-only; three new `land-cleanup.test.mjs` rows now
pin the halt in the direction a repo-layer read would break.

**The deliberate divergence this leaves standing:** `git-publish.mjs` reads
`git.auto_close` from the repo layer ALONE (a user-global value authorizes no
push, D-08), while `land-cleanup.mjs`, `skills/cad-land/SKILL.md` and
`workflows/milestone.md` read the MERGED value. Both directions are encoded as
expected in `config-seams.test.mjs`, not asserted as equality, and
`git.auto_close`'s reach row states the split.

## Open at close

Two items deferred out of the phase at /cad-verify 1, both carried to
`.planning/CAPTURE.md` with their fix shapes:

- **Hard links defeat the layer-identity check.** `realpathSync` resolves a
  symlink but cannot see a hard link, so one file under two hard-linked names
  still reports `global+repo`. Outside AC1's enumerated cases, and the
  write-face half proved benign - `atomicWrite`'s temp+rename breaks the link,
  so the physical user-global file is untouched.
- **The read face decides a shared file's layer from caller intent, the write
  face from filesystem identity.** Reconciling them is a write-face shape
  change, which this phase's scope boundary puts explicitly Out. It is also a
  real divergence from PLAN-1's own D-02 amendment (`PLAN-1.md:116-127`), which
  required `source:'global'` for the aliased-env path too.

`workflows/config.md` was left byte-unchanged (18168/18168, zero headroom per
D-11), so no `weight-budgets.json` regeneration was due. Its `:108` line ("a
global-layer waiver is ignored and named in the resolve's `warnings`") is now
incomplete in the same way the sixteen surfaces `50b25da` corrected were: true
except when both layer paths resolve to one file. A byte-neutral rewrite or a
prose edit plus a regenerated budget manifest is the stated route; the omission
is deliberate and recorded here rather than left for the docs gate to discover.
